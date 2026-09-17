// This app's state, in one place.
//
// Two shapes only, both from lib/store.js: persisted scalars for the things
// where the value *is* the state (theme, active tab, each filter chip), and
// record stores for the lists (the plan, the pantry, the cart, the log).
//
// The filters are five separate scalars rather than one JSON blob on purpose.
// persistedValue only holds strings, and a blob would mean parse-on-read,
// stringify-on-write and a subscriber that fires when an unrelated key
// changes. Five scalars, five subscribers, no serialisation code.

import { persistedValue, recordStore } from "./lib/store.js";

const NS = "supper-deck";

export const theme = persistedValue(NS + ":theme", "dusk");
export const font = persistedValue(NS + ":font", "sans");
export const tab = persistedValue(NS + ":tab", "pick");

// ---- filter chips ---------------------------------------------------------
// "any" rather than "" so the value is readable in devtools and in the
// aria-checked sync. Booleans are "1"/"0" -- see boolValue() below.

export const fMethod = persistedValue(NS + ":f-method", "any");
export const fLane = persistedValue(NS + ":f-lane", "any");
export const fTime = persistedValue(NS + ":f-time", "any");
export const fKidOk = persistedValue(NS + ":f-kid", "0");
export const fCookable = persistedValue(NS + ":f-cookable", "0");

/** Every filter, for the "clear all" button and the active-count badge. */
export const FILTERS = [
  { value: fMethod, reset: "any" },
  { value: fLane, reset: "any" },
  { value: fTime, reset: "any" },
  { value: fKidOk, reset: "0" },
  { value: fCookable, reset: "0" },
];

/** @returns {number} how many chips are doing something */
export function activeFilterCount() {
  return FILTERS.filter((f) => f.value.get() !== f.reset).length;
}

export function clearFilters() {
  FILTERS.forEach((f) => f.value.set(f.reset));
}

// ---- lists ----------------------------------------------------------------
// One active record each. `plan` is the week; a new week is a new record, so
// last week's picks are still there if you want to look.

/** items: `{ recipeId: string, night: string }` */
export const plan = recordStore(NS + ":plan");

/** items: `{ stapleId: string, status: "have"|"low"|"out" }` */
export const pantry = recordStore(NS + ":pantry");

/** items: `{ stapleId: string }` -- ticked off in the shop tab */
export const cart = recordStore(NS + ":cart");

/** items: `{ recipeId: string, at: number }` -- waved off, not offered again */
export const skips = recordStore(NS + ":skips");

/** items: `{ text: string, at: number }` -- feeds the log strip */
export const activity = recordStore(NS + ":activity");

/** The tabs this app has. Add a panel in index.html, add a line here. */
export const TABS = [
  { id: "pick", label: "tonight" },
  { id: "week", label: "week" },
  { id: "pantry", label: "pantry" },
  { id: "shop", label: "shop" },
  { id: "about", label: "about" },
];

// ---- views over the records -----------------------------------------------
// lib/plan.js is pure and takes plain Maps and Sets; these adapt the stores to
// it. They live here rather than in lib/ because they know this app's item
// shapes, which is the line lib/ is on the other side of.
//
// All of them read through get(), never ensureActive(): a read that can create
// a record would flush, which would notify subscribers, which would re-render,
// which would read again.

/** @returns {Map<string, string>} staple id -> "have" | "low" | "out" */
export function pantryMap() {
  const id = pantry.getActiveId();
  const rec = id ? pantry.get(id) : null;
  return new Map((rec?.items ?? []).map((i) => [i.stapleId, i.status]));
}

/** @returns {{id: string, recipeId: string, night: string}[]} this week's picks */
export function planItems() {
  const id = plan.getActiveId();
  const rec = id ? plan.get(id) : null;
  return /** @type {{id: string, recipeId: string, night: string}[]} */ (rec?.items ?? []);
}

/** @returns {Set<string>} recipe ids already on the plan */
export function plannedIds() {
  return new Set(planItems().map((p) => p.recipeId));
}

/** @returns {{id: string, recipeId: string, at: number}[]} newest last */
export function skipItems() {
  const id = skips.getActiveId();
  const rec = id ? skips.get(id) : null;
  return /** @type {{id: string, recipeId: string, at: number}[]} */ (rec?.items ?? []);
}

/** @returns {Set<string>} recipe ids waved off */
export function skippedIds() {
  return new Set(skipItems().map((s) => s.recipeId));
}

/** @returns {Set<string>} staple ids already in the cart */
export function cartIds() {
  const id = cart.getActiveId();
  const rec = id ? cart.get(id) : null;
  return new Set((rec?.items ?? []).map((i) => i.stapleId));
}

/**
 * Append to the log strip. Components talk to each other through this rather
 * than through each other -- the pantry tab never imports the deck.
 * @param {string} text
 */
export function note(text) {
  const rec = activity.ensureActive();
  activity.append(rec.id, { text, at: Date.now() });
  // A night's decisions, not a life's. Keeps the strip and localStorage small.
  const items = activity.get(rec.id)?.items ?? [];
  if (items.length > 40) activity.removeItem(rec.id, items[0].id);
}
