import { test } from "node:test";
import assert from "node:assert/strict";
import { dayKey, dayLabel, cleanLine, blob, measure, progress, allPagesText, GOAL_DEFAULTS } from "../lib/pages.js";

test("dayKey: local date, zero-padded", () => {
  assert.equal(dayKey(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
});

test("dayLabel: reads the key as a local date, no month/day shift", () => {
  const opts = /** @type {const} */ ({ weekday: "long", year: "numeric", month: "long", day: "numeric" });
  assert.equal(dayLabel("2026-01-05"), new Date(2026, 0, 5).toLocaleDateString(undefined, opts));
  assert.equal(dayLabel(dayKey(new Date(2026, 11, 31, 23, 59))), new Date(2026, 11, 31).toLocaleDateString(undefined, opts));
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

test("measure: whitespace-only and missing text count no words", () => {
  assert.deepEqual(measure([{ text: "   " }, {}]), { words: 0, chars: 3, lines: 2 });
});

test("progress: off or bad target is null; caps at 1", () => {
  const lines = [{ text: "one two three" }, { text: "four" }];
  assert.equal(progress(lines, "off", 10), null);
  assert.equal(progress(lines, "words", 0), null);
  assert.equal(progress(lines, "words", 8), 0.5);
  assert.equal(progress(lines, "lines", 1), 1);
  assert.equal(progress(lines, "chars", 34), 0.5);
  assert.equal(progress(lines, "words", NaN), null);
  assert.equal(progress(lines, "bogus", 10), null);
});

test("GOAL_DEFAULTS: one per countable unit", () => {
  assert.deepEqual(Object.keys(GOAL_DEFAULTS).sort(), ["chars", "lines", "words"]);
});

test("allPagesText: oldest first, each under its date", () => {
  const out = allPagesText([
    { name: "2026-09-24", items: [{ text: "later" }] },
    { name: "2026-09-23", items: [{ text: "first" }, { text: "second" }] },
  ]);
  assert.equal(out, "# 2026-09-23\n\nfirst\nsecond\n\n# 2026-09-24\n\nlater\n");
});
