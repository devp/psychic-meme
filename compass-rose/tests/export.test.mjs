import { test } from "node:test";
import assert from "node:assert/strict";
import { chronoText, chronoTextAll, markdownGraph, markdownGraphAll, mermaidLabel, outline } from "../lib/export.js";

/** @typedef {import("../lib/thought.js").Category} Category */

/** @param {number} h @param {number} m */
const at = (h, m) => new Date(2026, 10, 11, h, m).getTime();

/** The spec's example, with the behavior -> thought loop. */
function presenting() {
  /** @type {[string, Category, string, number][]} */
  const rows = [
    ["s", "situation", "Presenting to the team tomorrow", at(14, 0)],
    ["t", "thought", "I'm going to mess this up", at(14, 2)],
    ["f", "feeling", "tight chest, dread", at(14, 3)],
    ["b", "behavior", "kept refreshing email", at(14, 5)],
    ["i", "intervention", "what evidence do I have either way?", at(14, 9)],
    ["t2", "thought", "I've presented this twice before and it was fine", at(14, 11)],
  ];
  return {
    id: "r",
    name: "",
    createdAt: at(14, 0),
    // Stored out of order on purpose: exports must sort by ts.
    entries: [rows[3], rows[0], rows[5], rows[1], rows[4], rows[2]].map(([id, category, text, ts]) => ({ id, category, text, ts })),
    connections: [
      { from: "s", to: "t" },
      { from: "t", to: "f" },
      { from: "f", to: "b" },
      { from: "b", to: "t" },
      { from: "b", to: "i" },
      { from: "i", to: "t2" },
    ],
  };
}

test("chronoText: sorted by ts, date on the first line, times after", () => {
  assert.equal(
    chronoText(/** @type {any} */ (presenting())),
    [
      "2026-11-11 Situation: Presenting to the team tomorrow",
      "14:02 [thought] I'm going to mess this up",
      "14:03 [feeling] tight chest, dread",
      "14:05 [behavior] kept refreshing email",
      "14:09 [intervention] what evidence do I have either way?",
      "14:11 [thought] I've presented this twice before and it was fine",
    ].join("\n")
  );
});

test("chronoText: a new day gets a date line; resolutions show their feel", () => {
  const r = {
    id: "r",
    name: "",
    createdAt: 0,
    entries: [
      { id: "b", category: "resolution", text: "", feel: "less", ts: new Date(2026, 10, 12, 9, 0).getTime() },
      { id: "a", category: "thought", text: "line one\nline two", ts: at(23, 50) },
    ],
    connections: [],
  };
  assert.equal(chronoText(/** @type {any} */ (r)), "2026-11-11 Thought: line one line two\n2026-11-12 Resolution: (feels less)");
});

test("chronoTextAll: records oldest first, blank line between", () => {
  const a = presenting();
  const b = { ...presenting(), id: "r2", createdAt: at(9, 0), entries: [{ id: "x", category: "feeling", text: "calm", ts: at(9, 0) }], connections: [] };
  const out = chronoTextAll(/** @type {any} */ ([a, b]));
  assert.ok(out.startsWith("2026-11-11 Feeling: calm\n\n2026-11-11 Situation:"), out);
});

test("mermaidLabel: escapes quotes, newlines, brackets, # and backticks", () => {
  assert.equal(mermaidLabel('she said "fine"'), "she said #quot;fine#quot;");
  assert.equal(mermaidLabel("one\ntwo\r\n three"), "one two three");
  assert.equal(mermaidLabel("<b> & #1"), "#lt;b#gt; & #35;1");
  assert.equal(mermaidLabel("```"), "#96;#96;#96;");
  // The escaped label can't end the quoted string early.
  assert.ok(!mermaidLabel('a"]b').includes('"'));
});

test("markdownGraph: mermaid ids in chronological order, edges for every connection", () => {
  const md = markdownGraph(/** @type {any} */ (presenting()));
  assert.ok(md.startsWith("## Graph\n\n```mermaid\nflowchart TD\n"), md);
  assert.ok(md.includes('  n1["situation: Presenting to the team tomorrow"]'));
  assert.ok(md.includes('  n2["thought: I#quot;m going to mess this up"]') === false, "apostrophes are fine as-is");
  assert.ok(md.includes('  n2["thought: I\'m going to mess this up"]'));
  for (const edge of ["n1 --> n2", "n2 --> n3", "n3 --> n4", "n4 --> n2", "n4 --> n5", "n5 --> n6"]) {
    assert.ok(md.includes(`  ${edge}\n`), edge);
  }
  assert.ok(md.includes("\n## Outline\n\n"));
});

test("outline: a loop terminates, each entry printed in full once", () => {
  const out = outline(/** @type {any} */ (presenting()));
  assert.equal(
    out,
    [
      "- **situation** Presenting to the team tomorrow",
      "  - **thought** I'm going to mess this up",
      "    - **feeling** tight chest, dread",
      "      - **behavior** kept refreshing email",
      "        - (back to) **thought** I'm going to mess this up",
      "        - **intervention** what evidence do I have either way?",
      "          - **thought** I've presented this twice before and it was fine",
    ].join("\n")
  );
});

test("outline: a loop with no way in still prints, and unconnected entries stand alone", () => {
  const r = {
    id: "r",
    name: "",
    createdAt: 0,
    entries: [
      { id: "a", category: "thought", text: "a", ts: 1 },
      { id: "b", category: "behavior", text: "b", ts: 2 },
      { id: "c", category: "feeling", text: "c", ts: 3 },
    ],
    connections: [
      { from: "a", to: "b" },
      { from: "b", to: "a" },
    ],
  };
  assert.equal(
    outline(/** @type {any} */ (r)),
    ["- **feeling** c", "- **thought** a", "  - **behavior** b", "    - (back to) **thought** a"].join("\n")
  );
});

test("markdownGraphAll: one section per record under its title", () => {
  const md = markdownGraphAll(/** @type {any} */ ([presenting(), { ...presenting(), id: "r2", name: "Second", createdAt: at(15, 0) }]));
  assert.ok(md.startsWith("# Presenting to the team tomorrow\n\n## Graph"), md.slice(0, 80));
  assert.ok(md.includes("\n# Second\n\n## Graph"));
});
