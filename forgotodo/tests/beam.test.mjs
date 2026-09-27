import { test } from "node:test";
import assert from "node:assert/strict";
import { toBeamText, fromBeamText } from "../lib/beam.js";

const items = [
  { text: "HotSync before the trip", done: false },
  { text: "Buy AAA batteries", done: true },
];

test("beam text round-trips", () => {
  const text = toBeamText("Unfiled", items);
  assert.equal(text, "To Do List: Unfiled\n- [ ] HotSync before the trip\n- [x] Buy AAA batteries\n");
  assert.deepEqual(fromBeamText(text), items);
});

test("receive accepts Markdown task lists and skips everything else", () => {
  const text = "# groceries\n- [ ] milk\n* [X] eggs\n\njust a note\n[ ]   \n  [x] bread  \r\n";
  assert.deepEqual(fromBeamText(text), [
    { text: "milk", done: false },
    { text: "eggs", done: true },
    { text: "bread", done: true },
  ]);
});
