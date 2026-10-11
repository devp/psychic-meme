import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, analyze, sketches, mermaid } from "./outline.js";

const src = `# Game

> pitch

## Goals
- goal fast: quick

## Act 1
### Scene
- rule a: first
  - serves: fast
- rule b: uses [[a]]
  - serves: fast  hurts: fast
  - rule b2: nested
    - deeper step
- rule c
  - needs: d
- rule d
  - needs: c
  - ? open
  - serve: fast

\`\`\`js
- rule ignored: inside a fence
\`\`\`

- stub m: x
  - slot: {t} and {u}
- table t: one | two
- rul typo: x

risk --> [[a]] --> endgame
calm --> risk

other --> thing
`;

test("teach order: deps first, cycles grouped, ties by document order", () => {
  const a = analyze(parse(src));
  assert.deepEqual(a.teach.map((t) => t.ids.join("+")), ["a", "b", "b2", "c+d"]);
  assert.deepEqual(a.cycles, [["c", "d"]]);
});

test("groups, nesting, fields, refs, fences", () => {
  const doc = parse(src);
  const b = doc.nodes.find((n) => n.id === "b");
  assert.deepEqual(b.group, ["Game", "Act 1", "Scene"]);
  assert.deepEqual(b.needs, ["a"]);
  assert.deepEqual(b.hurts, ["fast"]);
  const b2 = doc.nodes.find((n) => n.id === "b2");
  assert.equal(b2.parent, "b");
  assert.deepEqual(b2.steps.map((s) => s.depth), [0]);
  assert.ok(!doc.nodes.some((n) => n.id === "ignored"));
  assert.equal(doc.pitch, "pitch");
  assert.equal(doc.questions[0].node, "d");
  assert.deepEqual(doc.nodes.find((n) => n.id === "t").items, ["one", "two"]);
});

test("lints: near-miss keys and kinds, missing slot table, goal-less rules", () => {
  const a = analyze(parse(src));
  const msgs = a.warnings.map((w) => w.msg);
  assert.ok(msgs.includes('"serve:" reads as prose; did you mean "serves:"?'));
  assert.ok(msgs.includes('"rul" isn\'t a kind; did you mean "rule"?'));
  assert.ok(msgs.some((m) => m.startsWith('no table "u"')));
  assert.ok(msgs.some((m) => m.startsWith('rule "c" doesn\'t trace to a goal')));
  assert.deepEqual(a.tension, [{ rule: "b", serves: ["fast"], hurts: ["fast"] }]);
});

test("unknown refs suggest the closest id", () => {
  const a = analyze(parse("- goal g: x\n- rule delve: x\n  - serves: g\n- rule t: [[delv]]\n  - serves: g\n"));
  assert.deepEqual(a.warnings.map((w) => w.msg), ['unknown [[delv]]; did you mean "delve"?']);
});

test("arrow sketches: consecutive lines group, ids resolve", () => {
  const doc = parse(src);
  const s = sketches(doc);
  assert.equal(s.length, 2);
  assert.deepEqual(s[0].arrows[0].chain, ["risk", "a", "endgame"]);
});

test("next step guides a blank file", () => {
  assert.match(analyze(parse("# x\n")).next.text, /pitch/);
  assert.match(analyze(parse("# x\n> p\n")).next.text, /goal/);
});

test("scoped graph includes neighbors as ext", () => {
  const g = mermaid(parse(src), "scene");
  assert.match(g, /n_a\[/);
  assert.match(g, /n_fast\(\[.*:::ext/);
});

test("ids are optional", () => {
  const doc = parse("- goal fast: x\n- rule: enter the next room\n  - serves: fast\n  - needs: named\n- rule named\n  - serves: fast\n- rule enter the room\n");
  const [anon, named] = doc.nodes.filter((n) => n.kind === "rule");
  assert.equal(anon.anon, true);
  assert.equal(anon.label, "enter the next room");
  assert.equal(named.id, "named");
  assert.equal(doc.nodes.length, 3);
  const a = analyze(doc);
  assert.deepEqual(a.teach.map((t) => t.ids[0]), ["named", "@2"]);
  assert.deepEqual(a.warnings.map((w) => w.msg), ['not a node: an id is one word; write "rule: text" for an unnamed one']);
});

test("numbered rules form a sequence; goals trace through needs, parents, sequences", () => {
  const doc = parse(`- goal g: x
- rule turn
  - serves: g
  1. rule: pick your car
  2. rule race
  3. rule: score
- rule helper
- rule user
  - needs: helper
  - serves: g
1. rule top1
   - serves: g
2. rule top2
- rule orphan
`);
  const by = (id) => doc.nodes.find((n) => n.id === id);
  assert.equal(by("@4").next, "race");
  assert.equal(by("race").prev, "@4");
  assert.equal(by("race").next, "@6");
  assert.equal(by("top1").next, "top2");
  const a = analyze(doc);
  assert.deepEqual(a.warnings.map((w) => w.msg.split(":")[0]), ['rule "orphan" doesn\'t trace to a goal']);
});

test("attic: parked sections and nodes are ignored, core refs into it warn", () => {
  const doc = parse(`> p
- goal g: x
- rule core
  - serves: g
  - uses [[later]]
- rule maybe #attic
  - ? parked question
  - needs: nowhere

## Attic
- rule later: no goal, unknown [[ghost]]
- ? also parked
`);
  const a = analyze(doc);
  assert.deepEqual(a.attic.map((n) => n.id), ["maybe", "later"]);
  assert.deepEqual(a.rules.map((r) => r.id), ["core"]);
  assert.deepEqual(a.questions, []);
  assert.deepEqual(a.warnings.map((w) => w.msg), ["[[later]] is in the attic"]);
  assert.doesNotMatch(mermaid(doc), /later|maybe/);
});

test("effects: trace rules to goals, need grounding, seen via tag or log; goals need serving", () => {
  const doc = parse(`- goal dread: x
- goal calm: y
- rule rest
- effect pressure: resting feels expensive
  - needs: rest
  - serves: dread
- effect float #seen
- effect drift: z
  - needs: rest
  - serves: dread
- log: [[drift]] happened
`);
  const a = analyze(doc);
  const msgs = a.warnings.map((w) => w.msg);
  assert.ok(!msgs.some((m) => m.startsWith('rule "rest"')), "rest traces through pressure");
  assert.ok(msgs.includes('effect "float" has no needs: (which rules produce it?)'));
  assert.ok(msgs.includes('effect "float" doesn\'t serve or hurt a goal'));
  assert.ok(msgs.includes('goal "calm" has nothing serving it'));
  assert.deepEqual(a.effects.map((e) => e.seen), [false, true, true]);
  assert.match(mermaid(doc), /n_pressure\{\{"pressure"\}\}:::effect/);
});

test("@roles: on the head line or in steps, inherited by nested rules; #void goals need no server", () => {
  const doc = parse(`- goal g: x
- goal mystery #void: what is faith
- rule frame @gm: set the scene
  - serves: g
  - rule bang: a dilemma
- rule act @player
  - serves: g
  - @dice decide the outcome
- rule: @left narrates the cost
  - serves: g
- rule loose
  - needs: frame
  - serves: g
`);
  const who = Object.fromEntries(doc.nodes.filter((n) => n.kind === "rule").map((n) => [n.label, n.who]));
  assert.deepEqual(who.frame, ["gm"]);
  assert.deepEqual(who.bang, ["gm"]);
  assert.deepEqual(who.act, ["player", "dice"]);
  assert.deepEqual(who["@left narrates the cost"], ["left"]);
  const a = analyze(doc);
  assert.deepEqual(a.authority.get("").map((r) => r.id), ["loose"]);
  assert.ok(!a.warnings.some((w) => w.msg.includes("mystery")));
  assert.match(mermaid(doc), /"frame @gm"/);
});

test("givens: serves draws a per line but doesn't trace; hurts breaks; no tension, no unserved warning", () => {
  const doc = parse(`> p
- goal g: x
- given no-dice: perfect information
- given lonely: nothing serves this
- rule move
  - serves: g no-dice
- rule shaped
  - serves: no-dice
- rule roll
  - serves: g  hurts: no-dice
- rule typo
  - serves: g no-dic
`);
  const a = analyze(doc);
  const msgs = a.warnings.map((w) => w.msg);
  assert.deepEqual(a.givens.map((n) => n.id), ["no-dice", "lonely"]);
  assert.ok(msgs.some((m) => m.startsWith('rule "shaped" doesn\'t trace to a goal')));
  assert.ok(msgs.includes('rule "roll" breaks given "no-dice"'));
  assert.ok(msgs.includes('serves "no-dic" isn\'t a goal or given; did you mean "no-dice"?'));
  assert.ok(!msgs.some((m) => m.includes("lonely")));
  assert.deepEqual(a.tension, []);
  assert.equal(a.checks.find((c) => c.label === "no rule breaks a given").ok, false);
  const g = mermaid(doc);
  assert.match(g, /n_move -\. per \.-> n_no_dice/);
  assert.match(g, /n_roll -\. breaks \.-x n_no_dice/);
  assert.match(g, /n_no_dice\[\["no-dice"\]\]:::given/);
});

test("?! blockers and ! flags: parsed at top level and under nodes; resolves closes a blocker", () => {
  const doc = parse(`- goal g: x
- ! playtest first
- ?! grid: hex or square
- ?! no id here
- given square: square grid
  - resolves: grid
- given stray
  - resolves: gird
- rule r
  - serves: g
  - resolves: grid
  - ?! kick: can a kick fail
  - ! fiddly
  - ? plain question
? loose question
`);
  assert.deepEqual(doc.flags.map((f) => [f.text, f.node]), [["playtest first", null], ["fiddly", "r"]]);
  assert.deepEqual(doc.blockers.map((b) => [b.id, b.text, b.node]), [["grid", "hex or square", null], [null, "no id here", null], ["kick", "can a kick fail", "r"]]);
  assert.deepEqual(doc.questions.map((q) => q.text), ["plain question", "loose question"]);
  const a = analyze(doc);
  assert.deepEqual(a.open.map((b) => b.id), [null, "kick"]);
  assert.equal(a.blockers.find((b) => b.id === "grid").resolved, true);
  const msgs = a.warnings.map((w) => w.msg);
  assert.ok(msgs.includes('no ?! "gird" to resolve; did you mean "grid"?'));
  assert.ok(msgs.includes("resolves: belongs on a given, not a rule"));
});

test("next: ! first, then open ?!, then basics, then ?; readiness counts all three", () => {
  const base = "# x\n> p\n- goal g: x\n- rule r\n  - serves: g\n";
  const next = (s) => analyze(parse(s)).next.text;
  const ready = (s) => analyze(parse(s)).checks.find((c) => c.label === "no open questions").ok;
  assert.equal(next("# x\n- ? q\n- ?! b: blocker\n- ! flag\n"), "! flag");
  assert.equal(next("# x\n- ? q\n- ?! b: blocker\n"), "?! blocker");
  assert.match(next("# x\n- ? q\n- ?! b: blocker\n- given s\n  - resolves: b\n"), /pitch/);
  assert.equal(next(base + "- ? q\n"), "? q");
  assert.equal(ready(base), true);
  for (const extra of ["- ? q\n", "- ?! b\n", "- ! f\n"]) assert.equal(ready(base + extra), false, extra);
  assert.equal(ready(base + "- ?! b: x\n- given s\n  - resolves: b\n"), true);
});
