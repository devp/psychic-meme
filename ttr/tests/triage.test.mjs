import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CONFIG,
  withDefaults,
  addBucket,
  overdueDays,
  sortTasks,
  verbsFor,
  verbLabel,
  decide,
  Session,
  summarize,
  batches,
  readStatus,
} from "../lib/triage.js";
import { places } from "../lib/todoist.js";

const [today, pins, inbox] = DEFAULT_CONFIG.targets;
const config = DEFAULT_CONFIG;
const where = {
  watchProjectId: "pW",
  agendaSections: [
    { id: "sL", name: "Laura" },
    { id: "sS", name: "School" },
  ],
};
let n = 0;
const ctx = { today: "2026-10-20", places: where, config, uuid: () => "u" + ++n };

/** @param {Partial<import("../lib/triage.js").Task>} t */
const task = (t) => ({ id: "t1", content: "a task", project_id: "p1", labels: [], due: null, ...t });
const recurring = task({ due: { date: "2026-10-20", string: "every day", is_recurring: true } });

test("addBucket", () => {
  assert.equal(addBucket("2026-10-20", "+1d"), "2026-10-21");
  assert.equal(addBucket("2026-10-20", "+1w"), "2026-10-27");
  assert.equal(addBucket("2026-10-20", "+2w"), "2026-11-03");
  assert.equal(addBucket("2026-10-20", "+1mo"), "2026-11-20");
  assert.equal(addBucket("2026-10-20", "+3mo"), "2027-01-20");
  assert.equal(addBucket("2026-01-31", "+1mo"), "2026-02-28", "months clamp");
  assert.equal(addBucket("2028-02-29", "+1y"), "2029-02-28");
  assert.equal(addBucket("2026-12-31", "+1d"), "2027-01-01");
  assert.throws(() => addBucket("2026-10-20", "next week"));
});

test("overdueDays: date or datetime, never negative", () => {
  assert.equal(overdueDays(task({ due: { date: "2026-10-17" } }), "2026-10-20"), 3);
  assert.equal(overdueDays(task({ due: { date: "2026-10-19T09:00:00" } }), "2026-10-20"), 1);
  assert.equal(overdueDays(task({ due: { date: "2026-10-20" } }), "2026-10-20"), 0);
  assert.equal(overdueDays(task({ due: { date: "2026-10-25" } }), "2026-10-20"), 0);
  assert.equal(overdueDays(task({}), "2026-10-20"), 0);
});

test("sortTasks: overdue first, oldest first, else API order", () => {
  const ts = [
    task({ id: "a", due: { date: "2026-10-20" } }),
    task({ id: "b", due: { date: "2026-10-19" } }),
    task({ id: "c" }),
    task({ id: "d", due: { date: "2026-10-10" } }),
    task({ id: "e", due: { date: "2026-10-20" } }),
  ];
  assert.deepEqual(sortTasks(ts, "2026-10-20").map((t) => t.id), ["d", "b", "a", "c", "e"]);
});

test("verbsFor: the target's verbs", () => {
  assert.deepEqual(verbsFor(task({}), today, config), ["date", "agenda", "tomorrow", "done"]);
  assert.deepEqual(verbsFor(task({}), inbox, config), ["watch", "agenda", "tomorrow", "done"]);
});

test("verbsFor: Unpin only on pinned tasks", () => {
  assert.deepEqual(verbsFor(task({ labels: ["pin"] }), pins, config), ["unpin", "date", "agenda", "done"]);
  assert.deepEqual(verbsFor(task({ labels: [] }), pins, config), ["date", "agenda", "done"]);
});

test("verbsFor: recurring tasks never get a date, and get Kill series", () => {
  for (const target of [today, pins, inbox]) {
    const vs = verbsFor({ ...recurring, labels: ["pin"] }, target, config);
    assert.ok(!vs.includes("date") && !vs.includes("tomorrow") && !vs.includes("watch"), target.name);
    assert.equal(vs.at(-1), "kill");
  }
  assert.equal(verbLabel("done", recurring), "Done (this one)");
  assert.equal(verbLabel("done", task({})), "Done");
});

test("decide: each verb's Sync commands", () => {
  const t = task({ id: "x", labels: ["pin", "home"], due: { date: "2026-10-18" } });
  const cmds = (/** @type {any} */ v, arg = "") => decide(t, v, arg, ctx).commands.map(({ type, args }) => ({ type, args }));
  assert.deepEqual(cmds("date", "+1w"), [{ type: "item_update", args: { id: "x", due: { date: "2026-10-27" } } }]);
  assert.deepEqual(cmds("tomorrow"), [{ type: "item_update", args: { id: "x", due: { date: "2026-10-21" } } }]);
  assert.deepEqual(cmds("watch", "+1mo"), [
    { type: "item_move", args: { id: "x", project_id: "pW" } },
    { type: "item_update", args: { id: "x", due: { date: "2026-11-20" } } },
  ]);
  assert.deepEqual(cmds("agenda", "sL"), [
    { type: "item_move", args: { id: "x", section_id: "sL" } },
    { type: "item_update", args: { id: "x", due: null } },
  ]);
  assert.deepEqual(cmds("unpin"), [{ type: "item_update", args: { id: "x", labels: ["home"] } }]);
  assert.deepEqual(cmds("done"), [{ type: "item_close", args: { id: "x" } }]);
  assert.deepEqual(cmds("kill"), [{ type: "item_delete", args: { id: "x" } }]);
  assert.deepEqual(cmds("skip"), []);
});

test("decide: labels for the summary", () => {
  assert.equal(decide(task({}), "date", "+1w", ctx).label, "Date +1w");
  assert.equal(decide(task({}), "agenda", "sS", ctx).label, "Agenda → School");
  assert.equal(decide(recurring, "done", "", ctx).label, "Done (this one)");
});

test("decide: Agenda leaves a recurring task's due alone, and skips the clear when undated", () => {
  assert.deepEqual(decide(recurring, "agenda", "sL", ctx).commands.map((c) => c.type), ["item_move"]);
  assert.deepEqual(decide(task({}), "agenda", "sL", ctx).commands.map((c) => c.type), ["item_move"]);
});

test("decide: no recurring decision ever sends a due", () => {
  for (const v of verbsFor(recurring, today, config)) {
    const arg = v === "agenda" ? "sL" : "";
    for (const c of decide(recurring, v, arg, ctx).commands) assert.ok(!("due" in c.args), `${v}: ${JSON.stringify(c)}`);
  }
});

test("decide: every command gets its own uuid", () => {
  const d = decide(task({ due: { date: "2026-10-20" } }), "watch", "+1w", { ...ctx, uuid: () => crypto.randomUUID() });
  assert.notEqual(d.commands[0].uuid, d.commands[1].uuid);
});

test("decide: missing Watchlist or section throws instead of queueing junk", () => {
  assert.throws(() => decide(task({}), "watch", "+1w", { ...ctx, places: { ...where, watchProjectId: null } }));
  assert.throws(() => decide(task({}), "agenda", "nope", ctx));
});

test("Session: decide, undo all the way back, summary at the end", () => {
  const ts = [task({ id: "a" }), task({ id: "b" }), task({ id: "c" })];
  const s = new Session(today, ts);
  const at = () => s.current?.id ?? null; // a call, so TS doesn't narrow it
  assert.equal(at(), "a");
  s.push(decide(ts[0], "done", "", ctx));
  s.push(decide(ts[1], "skip", "", ctx));
  s.push(decide(ts[2], "date", "+1w", ctx));
  assert.equal(at(), null, "summary");
  s.push(decide(ts[2], "done", "", ctx));
  assert.equal(s.decisions.length, 3, "nothing past the last card");
  assert.equal(s.changes.length, 2);
  s.undo();
  assert.equal(at(), "c");
  s.undo();
  s.undo();
  assert.equal(at(), "a");
  assert.equal(s.undo(), undefined);
  assert.equal(s.index, 0);
});

test("Session: dropping a change keeps the count", () => {
  const ts = [task({ id: "a" }), task({ id: "b" })];
  const s = new Session(today, ts);
  s.push(decide(ts[0], "done", "", ctx));
  s.push(decide(ts[1], "done", "", ctx));
  s.drop(s.decisions[0]);
  assert.equal(s.index, 2);
  assert.equal(s.current, null);
  assert.deepEqual(s.changes.map((d) => d.task.id), ["b"]);
});

test("summarize: grouped by label, first-seen order, skips left out", () => {
  const ds = [
    decide(task({ id: "a" }), "done", "", ctx),
    decide(task({ id: "b" }), "date", "+1w", ctx),
    decide(task({ id: "c" }), "skip", "", ctx),
    decide(task({ id: "d" }), "done", "", ctx),
  ];
  assert.deepEqual(
    summarize(ds).map((g) => [g.label, g.decisions.map((d) => d.task.id)]),
    [
      ["Done", ["a", "d"]],
      ["Date +1w", ["b"]],
    ]
  );
});

test("batches: at most 100 commands, a decision's commands kept together", () => {
  const ds = Array.from({ length: 60 }, (_, i) => decide(task({ id: "t" + i, due: { date: "2026-10-01" } }), "agenda", "sL", ctx));
  const bs = batches(ds);
  assert.deepEqual(bs.map((b) => b.length), [50, 10]);
  assert.ok(bs.every((b) => b.flatMap((d) => d.commands).length <= 100));
  assert.deepEqual(batches([decide(task({}), "skip", "", ctx)]), []);
});

test("readStatus: ok, error, missing", () => {
  const a = decide(task({ id: "a" }), "done", "", ctx);
  const b = decide(task({ id: "b", due: { date: "2026-10-01" } }), "agenda", "sL", ctx);
  const c = decide(task({ id: "c" }), "done", "", ctx);
  const status = {
    [a.commands[0].uuid]: "ok",
    [b.commands[0].uuid]: "ok",
    [b.commands[1].uuid]: { error: "Item not found", error_code: 22 },
  };
  const r = readStatus([a, b, c], status);
  assert.deepEqual(r.applied.map((d) => d.task.id), ["a"]);
  assert.deepEqual(r.failed.map((f) => [f.decision.task.id, f.reason]), [
    ["b", "Item not found"],
    ["c", "no response for this change"],
  ]);
});

test("withDefaults fills what a hand-edited config leaves out", () => {
  const c = withDefaults({ watchBuckets: ["+1mo", "+3mo", "+6mo"] });
  assert.deepEqual(c.watchBuckets, ["+1mo", "+3mo", "+6mo"]);
  assert.equal(c.targets.length, 3);
  assert.equal(withDefaults(null).pinLabel, "pin");
});

test("places: by name, sections in order", () => {
  const p = places(
    [
      { id: "p1", name: "Inbox" },
      { id: "pA", name: "agenda" },
      { id: "pW", name: "Watchlist" },
    ],
    [
      { id: "s2", name: "School", project_id: "pA", section_order: 2 },
      { id: "s1", name: "Laura", project_id: "pA", section_order: 1 },
      { id: "s9", name: "Other", project_id: "p1", section_order: 1 },
    ],
    config
  );
  assert.equal(p.watchProjectId, "pW");
  assert.deepEqual(p.agendaSections, [
    { id: "s1", name: "Laura" },
    { id: "s2", name: "School" },
  ]);
  assert.equal(p.projectNames.pA, "agenda");
  assert.equal(p.sectionNames.s9, "Other");
});
