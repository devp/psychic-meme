// The decisions this app makes, as pure functions over plain data.
//
// Nothing here touches the DOM, localStorage or the stores -- it takes the
// library, the pantry and your filters, and returns what to show. That's what
// makes the interesting parts testable at `node --test` speed instead of only
// in a browser, and it's why tests/plan.test.mjs can assert on the shopping
// list without booting the app.

/** The nights a plan has. A week is seven slots; that's the whole calendar. */
export const NIGHTS = [
  { id: "mon", label: "Mon" },
  { id: "tue", label: "Tue" },
  { id: "wed", label: "Wed" },
  { id: "thu", label: "Thu" },
  { id: "fri", label: "Fri" },
  { id: "sat", label: "Sat" },
  { id: "sun", label: "Sun" },
];

/** Pantry states, in the order the three-way toggle cycles. */
export const PANTRY_STATES = ["have", "low", "out"];

/**
 * @typedef {Object} Filters
 * @property {string} method a METHODS id, or "any"
 * @property {string} lane a LANES id, or "any"
 * @property {string} time a TIME_BUCKETS id ("any" | "15" | "30" | "45")
 * @property {boolean} kidOk only dishes both kids eat
 * @property {boolean} cookable only dishes whose staples are all on hand
 */

/**
 * A pantry as the rest of this file wants it: staple id -> state. A staple
 * that isn't in the map counts as "have", so an untracked ingredient never
 * blocks a dish.
 * @typedef {Map<string, string>} Pantry
 */

/**
 * Staples a dish needs that aren't on hand. Order follows the recipe's own
 * staples list, so the card reads the way the cook thinks about it.
 *
 * @param {{staples: string[]}} recipe
 * @param {Pantry} pantry
 * @returns {string[]} staple ids at "low" or "out"
 */
export function missingFor(recipe, pantry) {
  return recipe.staples.filter((id) => (pantry.get(id) ?? "have") !== "have");
}

/**
 * @param {{staples: string[]}} recipe
 * @param {Pantry} pantry
 * @returns {boolean} everything it needs is in the kitchen right now
 */
export function isCookable(recipe, pantry) {
  return missingFor(recipe, pantry).length === 0;
}

/**
 * @param {string} bucketId a TIME_BUCKETS id
 * @returns {number|null} inclusive ceiling in minutes, null for no ceiling
 */
export function timeCeiling(bucketId) {
  const n = Number(bucketId);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Apply the filter chips. Deliberately AND-ed and single-select per axis:
 * multi-select filtering is a second decision problem stacked on the first
 * one, which is the problem this app exists to remove.
 *
 * @param {import("../data/recipes.js").Recipe[]} recipes
 * @param {Filters} filters
 * @param {Pantry} pantry
 * @returns {import("../data/recipes.js").Recipe[]}
 */
export function filterRecipes(recipes, filters, pantry) {
  const ceiling = timeCeiling(filters.time);
  return recipes.filter((r) => {
    if (filters.method !== "any" && r.method !== filters.method) return false;
    if (filters.lane !== "any" && r.lane !== filters.lane) return false;
    if (ceiling !== null && r.prep > ceiling) return false;
    if (filters.kidOk && !r.kidOk) return false;
    if (filters.cookable && !isCookable(r, pantry)) return false;
    return true;
  });
}

/**
 * A deterministic shuffle.
 *
 * The deck must not reorder itself while you're looking at it -- a card that
 * moves because state changed elsewhere is exactly the dither this app is
 * supposed to end. But a deck in library order means you see bn01 every
 * single night. So: Fisher-Yates driven by a seeded PRNG, with the seed being
 * the date. Same order all evening, different order tomorrow, and no stored
 * shuffle state to keep in sync.
 *
 * @template T
 * @param {T[]} items not mutated
 * @param {string} seed
 * @returns {T[]}
 */
export function seededShuffle(items, seed) {
  const rand = mulberry32(hashString(seed));
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The deck, in the order you'll see it: filtered, minus what's already on the
 * plan, minus what you've waved off, shuffled stably for the day.
 *
 * @param {Object} args
 * @param {import("../data/recipes.js").Recipe[]} args.recipes
 * @param {Filters} args.filters
 * @param {Pantry} args.pantry
 * @param {Set<string>} args.plannedIds already on the plan
 * @param {Set<string>} args.skippedIds waved off
 * @param {string} args.seed
 * @returns {import("../data/recipes.js").Recipe[]}
 */
export function buildDeck({ recipes, filters, pantry, plannedIds, skippedIds, seed }) {
  const pool = filterRecipes(recipes, filters, pantry).filter(
    (r) => !plannedIds.has(r.id) && !skippedIds.has(r.id)
  );
  return seededShuffle(pool, seed);
}

/**
 * The first night with nothing on it. Picking a dish shouldn't also ask you
 * which night -- that's a second decision, so the app takes it and lets you
 * drag it later if you care.
 *
 * @param {{night: string}[]} picks
 * @returns {string|null} a NIGHTS id, or null when the week is full
 */
export function nextOpenNight(picks) {
  const taken = new Set(picks.map((p) => p.night));
  return NIGHTS.find((n) => !taken.has(n.id))?.id ?? null;
}

/**
 * @typedef {Object} ShoppingLine
 * @property {string} stapleId
 * @property {string} name
 * @property {string} status "low" or "out"
 * @property {string[]} forDishes dish names on the plan that need it
 * @property {boolean} restockOnly needed for the routine, not for this week's plan
 */

/**
 * @typedef {Object} ShoppingGroup
 * @property {import("../data/staples.js").Store} store
 * @property {ShoppingLine[]} lines
 */

/**
 * The week's list: everything a picked dish needs that isn't on hand, plus
 * everything you've flagged for restocking anyway, grouped by store.
 *
 * Union, not sum. Four dishes wanting onions is one line -- quantities are a
 * judgement you make at the shelf, and a number the app invented would just
 * be wrong with more confidence.
 *
 * @param {Object} args
 * @param {import("../data/recipes.js").Recipe[]} args.picks dishes on the plan
 * @param {Pantry} args.pantry
 * @param {import("../data/staples.js").Staple[]} args.staples
 * @param {import("../data/staples.js").Store[]} args.stores in route order
 * @returns {ShoppingGroup[]} stores with nothing to buy are omitted
 */
export function buildShoppingList({ picks, pantry, staples, stores }) {
  /** @type {Map<string, ShoppingLine>} */
  const lines = new Map();

  /** @param {string} stapleId @returns {ShoppingLine|null} */
  const lineFor = (stapleId) => {
    const status = pantry.get(stapleId) ?? "have";
    if (status === "have") return null;
    let line = lines.get(stapleId);
    if (!line) {
      const staple = staples.find((s) => s.id === stapleId);
      if (!staple) return null; // a recipe naming a staple we no longer track
      line = { stapleId, name: staple.name, status, forDishes: [], restockOnly: true };
      lines.set(stapleId, line);
    }
    return line;
  };

  // What the plan demands. These carry dish names, which is the difference
  // between "buy paneer" and "buy paneer or Thursday doesn't happen".
  for (const recipe of picks) {
    for (const stapleId of recipe.staples) {
      const line = lineFor(stapleId);
      if (!line) continue;
      line.restockOnly = false;
      if (!line.forDishes.includes(recipe.name)) line.forDishes.push(recipe.name);
    }
  }

  // Plus the standing restock: anything flagged low or out, plan or no plan.
  for (const staple of staples) lineFor(staple.id);

  const byStore = new Map(stores.map((s) => [s.id, /** @type {ShoppingLine[]} */ ([])]));
  const order = new Map(staples.map((s, i) => [s.id, i]));
  for (const line of lines.values()) {
    const staple = staples.find((s) => s.id === line.stapleId);
    byStore.get(staple?.store ?? "")?.push(line);
  }

  return stores
    .map((store) => ({
      store,
      // Staple-file order inside a store: proteins, veg, starches, dairy,
      // pantry -- roughly how a store is laid out, and stable run to run.
      lines: (byStore.get(store.id) ?? []).sort(
        (a, b) => (order.get(a.stapleId) ?? 0) - (order.get(b.stapleId) ?? 0)
      ),
    }))
    .filter((g) => g.lines.length > 0);
}

/**
 * @param {ShoppingGroup[]} groups
 * @returns {number} total lines, for the tab badge
 */
export function countLines(groups) {
  return groups.reduce((n, g) => n + g.lines.length, 0);
}

/**
 * Today, as a stable seed. Local date, not UTC -- the deck should turn over
 * at your midnight, not London's.
 *
 * @param {Date} [now]
 * @returns {string} e.g. "2026-09-17"
 */
export function dayStamp(now = new Date()) {
  const pad = (/** @type {number} */ n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// ---- seeded PRNG ----------------------------------------------------------
// Two small well-known functions rather than a dependency: xmur3-style string
// hash into mulberry32. Not cryptographic; it shuffles a dinner list.

/**
 * @param {string} str
 * @returns {number}
 */
function hashString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

/**
 * @param {number} seed
 * @returns {() => number} floats in [0, 1)
 */
function mulberry32(seed) {
  let a = seed;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
