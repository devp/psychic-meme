import { test } from "node:test";
import assert from "node:assert/strict";
import { preferredSize, largestFitting, FIT_MAX, FIT_BASE, FIT_MIN } from "../lib/fit.js";

test("big while short, easing down to normal", () => {
  assert.equal(preferredSize(0), FIT_MAX);
  assert.equal(preferredSize(3), FIT_MAX);
  const sizes = [4, 5, 6, 8, 10, 12, 15, 40].map(preferredSize);
  assert.deepEqual(sizes, sizes.slice().sort((a, b) => b - a), "never grows as the list does");
  assert.ok(sizes[0] < FIT_MAX);
  assert.equal(preferredSize(40), FIT_BASE);
});

test("largestFitting bisects to the biggest size that fits, and leaves it applied", () => {
  let applied = 0;
  const upTo = (/** @type {number} */ limit) => (/** @type {number} */ px) => ((applied = px), px <= limit);
  assert.equal(largestFitting(28, upTo(100)), 28);
  assert.equal(applied, 28);
  assert.equal(largestFitting(28, upTo(17)), 17);
  assert.equal(applied, 17);
  assert.equal(largestFitting(28, upTo(0)), FIT_MIN, "floors, then scrolls");
  assert.equal(applied, FIT_MIN);
});
