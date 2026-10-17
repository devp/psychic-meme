import { test } from "node:test";
import assert from "node:assert/strict";
import { splitEntry } from "../lib/entry.js";

test("splitEntry: one to-do per semicolon, in order", () => {
  assert.deepEqual(splitEntry("milk; eggs ;bread"), ["milk", "eggs", "bread"]);
});

test("splitEntry: no semicolon is one to-do, trimmed", () => {
  assert.deepEqual(splitEntry("  call mom!  "), ["call mom!"]);
});

test("splitEntry: empty pieces are dropped", () => {
  assert.deepEqual(splitEntry(";milk;; ;eggs;"), ["milk", "eggs"]);
  assert.deepEqual(splitEntry(" ; ; "), []);
  assert.deepEqual(splitEntry(""), []);
});
