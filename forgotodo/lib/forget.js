// The forgetting. Priority is written in the text itself -- trailing `!`s
// raise it, trailing `?`s lower it -- so it survives a beam round-trip.
// Each local day a to-do goes unfinished it loses a `!`, or gains a `?` once it
// has none. `foo?` is where it ends up: kept, but shown faded. Done items are
// removed the day after they were checked.

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

/** @param {string} text */
export function isForgotten(text) {
  return priorityOf(text) < 0;
}

/**
 * One day's decay: drop a `!`, else end in a single `?`.
 * @param {string} text
 * @returns {string}
 */
export function decayOnce(text) {
  const t = text.trimEnd();
  if (priorityOf(t) > 0) return t.slice(0, -1).trimEnd();
  return t.replace(/[!?]+$/, "").trimEnd() + "?";
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
