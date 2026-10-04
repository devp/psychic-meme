// The forgetting. Priority is written in the text itself -- trailing `!`s
// raise it, trailing `?`s lower it -- so it survives a beam round-trip.
// Each local day a to-do goes unfinished it drops a tier:
//   foo!! -> foo! -> foo -> foo? (faded) -> foo?? (forgotten)
// Forgotten is the bottom: hidden from the list but still counted, until it's
// swept or remembered. Done items are removed the day after they were checked.

/**
 * Local calendar day, e.g. "2026-09-27".
 * @param {Date} [d]
 * @returns {string}
 */
export function dayKey(d = new Date()) {
  const pad = (/** @type {number} */ n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Whole days from one day key to another. UTC, so DST can't shave an hour off.
 * @param {string} from
 * @param {string} to
 * @returns {number}
 */
export function daysBetween(from, to) {
  const utc = (/** @type {string} */ k) => {
    const [y, m, d] = k.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(to) - utc(from)) / 86400000);
}

/**
 * `foo!!` is 2, `foo?` is -1, `foo` and mixed endings like `foo?!` are 0.
 * @param {string} text
 * @returns {number}
 */
export function priorityOf(text) {
  const run = text.trimEnd().match(/[!?]+$/)?.[0] ?? "";
  if (/^!+$/.test(run)) return run.length;
  if (/^\?+$/.test(run)) return -run.length;
  return 0;
}

/** The bottom tier: `foo??`, or more `?`s typed by hand. */
export const FORGOTTEN = -2;

/** @param {string} text */
export function tierOf(text) {
  return Math.max(FORGOTTEN, priorityOf(text));
}

/** `foo?`: still shown, faded. @param {string} text */
export function isFaded(text) {
  return tierOf(text) === -1;
}

/** `foo??`: hidden, but counted. @param {string} text */
export function isForgotten(text) {
  return tierOf(text) === FORGOTTEN;
}

/**
 * The same text, re-suffixed for a tier: `!` per point up, `?` per point down.
 * @param {string} text
 * @param {number} tier
 * @returns {string}
 */
export function withTier(text, tier) {
  const base = text.trimEnd().replace(/[!?]+$/, "").trimEnd();
  return base + (tier > 0 ? "!".repeat(tier) : "?".repeat(-Math.max(FORGOTTEN, tier)));
}

/**
 * One day's decay: down a tier, stopping at forgotten.
 * @param {string} text
 * @returns {string}
 */
export function decayOnce(text) {
  const tier = tierOf(text);
  return tier === FORGOTTEN ? text.trimEnd() : withTier(text, tier - 1);
}

/**
 * @typedef {{ id: string, text: string, done?: boolean, seenDay?: string, doneDay?: string|null }} ForgetItem
 * @typedef {{ id: string, remove: true } | { id: string, patch: Partial<ForgetItem> }} ForgetChange
 */

/**
 * What to change so `items` are current as of `today`. Pure; the caller writes
 * it back. Items missing their day stamps get today's, so nothing already
 * stored is aged retroactively.
 *
 * @param {ForgetItem[]} items
 * @param {string} today day key
 * @returns {ForgetChange[]}
 */
export function forgetChanges(items, today) {
  /** @type {ForgetChange[]} */
  const changes = [];
  for (const item of items) {
    if (item.done) {
      if (!item.doneDay) changes.push({ id: item.id, patch: { doneDay: today } });
      else if (daysBetween(item.doneDay, today) >= 1) changes.push({ id: item.id, remove: true });
      continue;
    }
    if (!item.seenDay) {
      changes.push({ id: item.id, patch: { seenDay: today } });
      continue;
    }
    const days = daysBetween(item.seenDay, today);
    if (days <= 0) continue;
    let text = item.text;
    for (let i = 0; i < days; i++) {
      const next = decayOnce(text);
      if (next === text) break;
      text = next;
    }
    changes.push({ id: item.id, patch: text === item.text ? { seenDay: today } : { text, seenDay: today } });
  }
  return changes;
}

/**
 * Fast Forward: one extra day's rollover, right now. Open to-dos drop a tier
 * and done ones go, as if the night had passed. Day stamps are left alone, so
 * the real tomorrow still rolls over too.
 * @param {ForgetItem[]} items
 * @returns {ForgetChange[]}
 */
export function fastForwardChanges(items) {
  /** @type {ForgetChange[]} */
  const changes = [];
  for (const item of items) {
    if (item.done) changes.push({ id: item.id, remove: true });
    else if (decayOnce(item.text) !== item.text) changes.push({ id: item.id, patch: { text: decayOnce(item.text) } });
  }
  return changes;
}
