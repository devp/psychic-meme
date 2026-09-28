// Shrink to Fit: big type while the list is short, a little smaller with each
// to-do after that, and then as small as it takes to fit the screen -- down to
// a floor, past which it scrolls like normal.

export const FIT_MAX = 28;
export const FIT_BASE = 15;
export const FIT_MIN = 10;

/**
 * The size a list of `n` would like, before measuring: FIT_MAX up to three
 * to-dos, easing down to the normal FIT_BASE by about fifteen.
 * @param {number} n
 * @returns {number} whole px
 */
export function preferredSize(n) {
  if (n <= 3) return FIT_MAX;
  return Math.max(FIT_BASE, Math.round(FIT_MAX * (3 / n) ** 0.4));
}

/**
 * Largest whole-px size in [FIT_MIN, max] at which `measure(px)` fits.
 * `measure` applies the size and says whether it fits; bigger never fits
 * better, so this bisects. Leaves the chosen size applied.
 * @param {number} max
 * @param {(px: number) => boolean} measure
 * @returns {number}
 */
export function largestFitting(max, measure) {
  if (measure(max) || max <= FIT_MIN) return max;
  let lo = FIT_MIN;
  let hi = max;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (measure(mid)) lo = mid;
    else hi = mid;
  }
  measure(lo);
  return lo;
}
