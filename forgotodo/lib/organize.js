// Organize menu: tidying you ask for, on top of the forgetting that happens by
// itself. Pure; the caller writes changes back. Priority is still just the
// text's trailing `!`s and `?`s (see forget.js), so these only edit text.

import { tierOf, withTier, isForgotten, isSnoozed, snoozeOf, FORGOTTEN } from "./forget.js";

/** @typedef {{ id: string, text: string, done?: boolean }} OrganizeItem */

/** Open and still on the list. @param {OrganizeItem} i */
const visible = (i) => !i.done && !isForgotten(i.text) && !isSnoozed(i.text);
/** Open but forgotten: hidden, still counted. @param {OrganizeItem} i */
const forgotten = (i) => !i.done && isForgotten(i.text);

/**
 * Sweep: everything forgotten.
 * @param {OrganizeItem[]} items
 * @returns {OrganizeItem[]}
 */
export function sweepable(items) {
  return items.filter(forgotten);
}

/**
 * Look Ahead: everything snoozed, soonest first.
 * @param {OrganizeItem[]} items
 * @returns {OrganizeItem[]}
 */
export function snoozed(items) {
  return items.filter((i) => !i.done && isSnoozed(i.text)).sort((a, b) => snoozeOf(a.text) - snoozeOf(b.text));
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
 * One step up, the inverse of decayOnce: forgotten comes back faded.
 * @param {string} text
 * @returns {string}
 */
export function raiseOnce(text) {
  return withTier(text, tierOf(text) + 1);
}

/**
 * @template T
 * @param {T[]} pool
 * @param {() => number} random
 * @returns {T|undefined}
 */
const pickFrom = (pool, random) => pool[Math.floor(random() * pool.length)];

/**
 * Forget: pick one of the least urgent to-dos still on the list and forget it
 * outright.
 * @param {OrganizeItem[]} items
 * @param {() => number} [random]
 * @returns {{ id: string, text: string }|null}
 */
export function forgetOne(items, random = Math.random) {
  const pool = items.filter(visible);
  const low = Math.min(...pool.map((i) => tierOf(i.text)));
  const pick = pickFrom(pool.filter((i) => tierOf(i.text) === low), random);
  return pick ? { id: pick.id, text: withTier(pick.text, FORGOTTEN) } : null;
}

/**
 * Remember: pick one forgotten to-do and bring it back at neutral.
 * @param {OrganizeItem[]} items
 * @param {() => number} [random]
 * @returns {{ id: string, text: string }|null}
 */
export function rememberOne(items, random = Math.random) {
  const pick = pickFrom(items.filter(forgotten), random);
  return pick ? { id: pick.id, text: withTier(pick.text, 0) } : null;
}

/**
 * Run a one-at-a-time pick `n` times, each on the list as the last left it.
 * @param {OrganizeItem[]} items
 * @param {number} n
 * @param {(items: OrganizeItem[]) => { id: string, text: string }|null} pickOne
 */
function pickRepeatedly(items, n, pickOne) {
  /** @type {{ id: string, text: string }[]} */
  const picks = [];
  let pool = items;
  for (let k = 0; k < n; k++) {
    const pick = pickOne(pool);
    if (!pick) break;
    picks.push(pick);
    pool = pool.map((i) => (i.id === pick.id ? { ...i, text: pick.text } : i));
  }
  return picks;
}

/**
 * What Forget or Remember was asked for: blank is one, digits are that many,
 * anything else is every to-do containing it (any case).
 * @param {string} query
 * @returns {{ count: number }|{ phrase: string }}
 */
function parseQuery(query) {
  const q = query.trim();
  if (!q) return { count: 1 };
  if (/^\d+$/.test(q)) return { count: Number(q) };
  return { phrase: q.toLowerCase() };
}

/** @param {string} phrase @param {OrganizeItem} i */
const matches = (phrase, i) => i.text.toLowerCase().includes(phrase);

/**
 * Forget, asked: some number of forgetOne picks, or every visible match.
 * @param {OrganizeItem[]} items
 * @param {string} query
 * @param {() => number} [random]
 * @returns {{ id: string, text: string }[]}
 */
export function forgetSome(items, query, random = Math.random) {
  const q = parseQuery(query);
  if ("count" in q) return pickRepeatedly(items, q.count, (pool) => forgetOne(pool, random));
  return items.filter((i) => visible(i) && matches(q.phrase, i)).map((i) => ({ id: i.id, text: withTier(i.text, FORGOTTEN) }));
}

/**
 * Remember, asked: some number of rememberOne picks, or every forgotten match.
 * @param {OrganizeItem[]} items
 * @param {string} query
 * @param {() => number} [random]
 * @returns {{ id: string, text: string }[]}
 */
export function rememberSome(items, query, random = Math.random) {
  const q = parseQuery(query);
  if ("count" in q) return pickRepeatedly(items, q.count, (pool) => rememberOne(pool, random));
  return items.filter((i) => forgotten(i) && matches(q.phrase, i)).map((i) => ({ id: i.id, text: withTier(i.text, 0) }));
}

/**
 * @typedef {{ id: string, text: string, move: "up"|"down"|"forgotten"|"remembered" }} Shake
 */

// Thresholds below are out of 1.0, defined independent.
const SHAKE_THRESHOLD_UP = 0.25;
const SHAKE_THRESHOLD_DOWN = 0.40;

/**
 * @param {number} roll (0..1)
 * @returns {-1|0|1}
 */
function shakeRollToModifier(roll) {
  if (roll < SHAKE_THRESHOLD_DOWN) return -1;
  if (roll < SHAKE_THRESHOLD_UP + SHAKE_THRESHOLD_DOWN) return 1;
  return 0;
}

/**
 * Shake Up: every open to-do, forgotten ones included, rolls 40% down a tier,
 * 25% up, 35% stays. Forgotten can't go lower; snoozed ones sleep through it;
 * only the movers come back.
 * @param {OrganizeItem[]} items
 * @param {() => number} [random]
 * @returns {Shake[]}
 */
export function shakeUp(items, random = Math.random) {
  /** @type {Shake[]} */
  const moved = [];
  for (const item of items) {
    if (item.done || isSnoozed(item.text)) continue;
    const roll = random();
    const from = tierOf(item.text);
    const to = Math.max(FORGOTTEN, from + shakeRollToModifier(roll));
    if (to === from) continue;
    const move = from === FORGOTTEN ? "remembered" : to === FORGOTTEN ? "forgotten" : to > from ? "up" : "down";
    moved.push({ id: item.id, text: withTier(item.text, to), move });
  }
  return moved;
}
