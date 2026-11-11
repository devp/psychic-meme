import { test } from "node:test";
import assert from "node:assert/strict";
import {
  causes,
  causedBy,
  connect,
  connectionsWithout,
  hasLoop,
  isResolved,
  needle,
  sinceLastIntervention,
  fromStored,
  titleOf,
} from "../lib/thought.js";

/** @typedef {import("../lib/thought.js").Category} Category */

/**
 * A record from [id, category, text] rows, one minute apart, plus connections.
 * @param {[string, Category, string][]} rows
 * @param {[string, string][]} [links]
 * @returns {import("../lib/thought.js").ThoughtRecord}
 */
function rec(rows, links = []) {
  const t0 = new Date(2026, 10, 11, 14, 0).getTime();
  return {
    id: "r",
    name: "",
    createdAt: t0,
    entries: rows.map(([id, category, text], i) => ({ id, category, text, ts: t0 + i * 60_000 })),
    connections: links.map(([from, to]) => ({ from, to })),
  };
}

test("causes: the source leads to the new entry", () => {
  assert.deepEqual(causes("src", "new"), { from: "src", to: "new" });
});

test("causedBy: the new entry leads to the source", () => {
  assert.deepEqual(causedBy("src", "new"), { from: "new", to: "src" });
});

test("connect: no self-links, duplicates, or dangling ids", () => {
  const r = rec([["a", "thought", "x"], ["b", "feeling", "y"]]);
  r.connections = connect(r, { from: "a", to: "b" });
  assert.equal(r.connections.length, 1);
  assert.equal(connect(r, { from: "a", to: "b" }).length, 1, "duplicate");
  assert.equal(connect(r, { from: "a", to: "a" }).length, 1, "self");
  assert.equal(connect(r, { from: "a", to: "gone" }).length, 1, "dangling");
  assert.equal(connect(r, { from: "b", to: "a" }).length, 2, "the reverse is a different connection");
});

test("deleting an entry drops its connections", () => {
  const r = rec([["a", "thought", ""], ["b", "feeling", ""], ["c", "behavior", ""]], [["a", "b"], ["b", "c"]]);
  assert.deepEqual(connectionsWithout(r, "b"), []);
  assert.deepEqual(connectionsWithout(r, "c"), [{ from: "a", to: "b" }]);
});

test("hasLoop: behavior linked back to an earlier thought", () => {
  const r = rec(
    [["t", "thought", ""], ["f", "feeling", ""], ["b", "behavior", ""]],
    [["t", "f"], ["f", "b"], ["b", "t"]]
  );
  assert.equal(hasLoop(r.entries, r.connections), true);
});

test("hasLoop: a new thought caused by a behavior downstream of a thought", () => {
  const r = rec(
    [["t", "thought", ""], ["b", "behavior", ""], ["t2", "thought", ""]],
    [["t", "b"], ["b", "t2"]]
  );
  assert.equal(hasLoop(r.entries, r.connections), true);
});

test("hasLoop: a straight chain is not a loop", () => {
  const r = rec(
    [["s", "situation", ""], ["t", "thought", ""], ["f", "feeling", ""], ["b", "behavior", ""]],
    [["s", "t"], ["t", "f"], ["f", "b"]]
  );
  assert.equal(hasLoop(r.entries, r.connections), false);
});

test("needle: points at the first corner not visited this round", () => {
  assert.equal(needle(rec([])).target, "thought");
  assert.equal(needle(rec([["t", "thought", ""]])).target, "feeling");
  assert.equal(needle(rec([["t", "thought", ""], ["f", "feeling", ""]])).target, "behavior");
  assert.equal(needle(rec([["t", "thought", ""], ["f", "feeling", ""], ["b", "behavior", ""]])).target, null);
});

test("needle: a loop with nothing tested points at the center, with the hint", () => {
  const r = rec(
    [["t", "thought", ""], ["f", "feeling", ""], ["b", "behavior", ""]],
    [["t", "f"], ["f", "b"], ["b", "t"]]
  );
  assert.deepEqual(needle(r), { target: "intervention", hint: true });
  r.hintDismissedAt = r.entries[2].ts + 1;
  assert.deepEqual(needle(r), { target: "intervention", hint: false }, "dismissed: still the center, but quiet");
});

test("needle: an intervention starts a new round", () => {
  const r = rec(
    [["t", "thought", ""], ["f", "feeling", ""], ["b", "behavior", ""], ["i", "intervention", "check evidence"]],
    [["t", "f"], ["f", "b"], ["b", "t"], ["t", "i"]]
  );
  assert.deepEqual(sinceLastIntervention(r), []);
  assert.deepEqual(needle(r), { target: "thought", hint: false });
});

test("resolve and reopen: resolved while the latest entry is a resolution", () => {
  const r = rec([["t", "thought", ""], ["z", "resolution", "the edible hit, chilling"]]);
  assert.equal(isResolved(r), true);
  r.entries.push({ id: "f", category: "feeling", text: "wait", ts: r.entries[1].ts + 1 });
  assert.equal(isResolved(r), false);
  assert.equal(isResolved(rec([])), false);
});

test("fromStored maps the store's shape and drops unknown categories", () => {
  const r = fromStored({
    id: "x",
    name: "",
    createdAt: 1,
    updatedAt: 1,
    items: [
      { id: "a", category: "situation", text: "Presenting", ts: 1 },
      { id: "b", category: "mystery", text: "?", ts: 2 },
    ],
  });
  assert.deepEqual(r.entries.map((e) => e.id), ["a"]);
  assert.deepEqual(r.connections, []);
  assert.equal(titleOf(r), "Presenting");
});
