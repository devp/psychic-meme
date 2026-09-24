import { test } from "node:test";
import assert from "node:assert/strict";
import { dayKey, cleanLine, blob, measure, progress, allPagesText } from "../lib/pages.js";

test("dayKey: local date, zero-padded", () => {
  assert.equal(dayKey(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
});

test("cleanLine: trims, folds pasted newlines, empty stays empty", () => {
  assert.equal(cleanLine("  hello  "), "hello");
  assert.equal(cleanLine("one\n two\r\nthree"), "one two three");
  assert.equal(cleanLine("   \n "), "");
});

test("blob: one line per line", () => {
  assert.equal(blob([{ text: "a" }, { text: "b c" }]), "a\nb c");
  assert.equal(blob([]), "");
});

test("measure: words, chars, lines", () => {
  assert.deepEqual(measure([{ text: "the quiet  morning" }, { text: "tea" }]), { words: 4, chars: 21, lines: 2 });
});

test("progress: off or bad target is null; caps at 1", () => {
  const lines = [{ text: "one two three" }, { text: "four" }];
  assert.equal(progress(lines, "off", 10), null);
  assert.equal(progress(lines, "words", 0), null);
  assert.equal(progress(lines, "words", 8), 0.5);
  assert.equal(progress(lines, "lines", 1), 1);
  assert.equal(progress(lines, "chars", 34), 0.5);
});

test("allPagesText: oldest first, each under its date", () => {
  const out = allPagesText([
    { name: "2026-09-24", items: [{ text: "later" }] },
    { name: "2026-09-23", items: [{ text: "first" }, { text: "second" }] },
  ]);
  assert.equal(out, "# 2026-09-23\n\nfirst\nsecond\n\n# 2026-09-24\n\nlater\n");
});
