// Organize menu: tidying you ask for, on top of the forgetting that happens by
// itself. Pure; the caller writes changes back. Priority is still just the
// text's trailing `!`s and `?`s (see forget.js), so these only edit text.

import { priorityOf, decayOnce } from "./forget.js";

/** @typedef {{ id: string, text: string, done?: boolean }} OrganizeItem */

/**
 * Sweep: the open to-dos on the lowest priority there is. If every open to-do
 * shares one priority, that's all of them -- the caller should confirm.
 * @param {OrganizeItem[]} items
 * @returns {OrganizeItem[]}
 */
export function sweepable(items) {
  const open = items.filter((i) => !i.done);
  if (open.length === 0) return [];
  const low = Math.min(...open.map((i) => priorityOf(i.text)));
  return open.filter((i) => priorityOf(i.text) === low);
}

/**
 * Recycle: everything checked off.
 * @param {OrganizeItem[]} items
 * @returns {OrganizeItem[]}
 */
export function recyclable(items) {
  return items.filter((i) => i.done);
}

/**
 * One step up: drop the `?`s, else add a `!`. The inverse of decayOnce.
 * @param {string} text
 * @returns {string}
 */
export function raiseOnce(text) {
  const t = text.trimEnd();
  if (priorityOf(t) < 0) return t.replace(/\?+$/, "").trimEnd();
  return t.replace(/[!?]+$/, (run) => (/^!+$/.test(run) ? run : "")).trimEnd() + "!";
}

/**
 * Forget: pick one open to-do that isn't forgotten yet and knock it down a
 * step, just as a day of neglect would.
 * @param {OrganizeItem[]} items
 * @param {() => number} [random]
 * @returns {{ id: string, text: string }|null}
 */
export function forgetOne(items, random = Math.random) {
  const pool = items.filter((i) => !i.done && priorityOf(i.text) >= 0);
  const pick = pool[Math.floor(random() * pool.length)];
  return pick ? { id: pick.id, text: decayOnce(pick.text) } : null;
}

/**
 * Remember: pick any open to-do and bring it up a step.
 * @param {OrganizeItem[]} items
 * @param {() => number} [random]
 * @returns {{ id: string, text: string }|null}
 */
export function rememberOne(items, random = Math.random) {
  const pool = items.filter((i) => !i.done);
  const pick = pool[Math.floor(random() * pool.length)];
  return pick ? { id: pick.id, text: raiseOnce(pick.text) } : null;
}
