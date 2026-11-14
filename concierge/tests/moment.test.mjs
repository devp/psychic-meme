import { test } from "node:test";
import assert from "node:assert/strict";
import { momentOf, PERIODS } from "../lib/moment.js";

// 2014-12-10 was a Wednesday.
const at = (/** @type {number} */ hour) => momentOf(new Date(2014, 11, 10, hour, 30));

test("momentOf: the day and the part of it", () => {
  assert.deepEqual(at(14), { day: "wednesday", period: "afternoon", month: 12, label: "Wednesday Afternoon" });
});

test("momentOf: every hour lands in a period, changing at each `from`", () => {
  const byHour = Array.from({ length: 24 }, (_, h) => at(h).period);
  assert.equal(byHour[0], "late-night");
  assert.equal(byHour[4], "late-night");
  assert.equal(byHour[5], "morning");
  assert.equal(byHour[11], "late-morning");
  assert.equal(byHour[12], "afternoon");
  assert.equal(byHour[17], "evening");
  assert.equal(byHour[23], "night");
  assert.deepEqual([...new Set(byHour)].sort(), PERIODS.map((p) => p.id).sort());
});

test("momentOf: overrides pin either part; nonsense is ignored", () => {
  assert.equal(momentOf(new Date(2014, 11, 10, 14), { day: "friday", period: "night" }).label, "Friday Night");
  assert.equal(momentOf(new Date(2014, 11, 10, 14), { day: "blursday", period: null }).label, "Wednesday Afternoon");
});
