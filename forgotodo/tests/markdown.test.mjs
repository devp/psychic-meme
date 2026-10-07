import { test } from "node:test";
import assert from "node:assert/strict";
import { toMarkdown, fromMarkdown } from "../lib/markdown.js";

const items = [
  { text: "Back up before the trip", done: false },
  { text: "Buy AAA batteries", done: true },
];

test("list text round-trips", () => {
  const text = toMarkdown("Unfiled", items);
  assert.equal(text, "To Do List: Unfiled\n- [ ] Back up before the trip\n- [x] Buy AAA batteries\n");
  assert.deepEqual(fromMarkdown(text), items);
});

test("receive accepts Markdown task lists and skips everything else", () => {
  const text = "# groceries\n- [ ] milk\n* [X] eggs\n\njust a note\n[ ]   \n  [x] bread  \r\n";
  assert.deepEqual(fromMarkdown(text), [
    { text: "milk", done: false },
    { text: "eggs", done: true },
    { text: "bread", done: true },
  ]);
});
