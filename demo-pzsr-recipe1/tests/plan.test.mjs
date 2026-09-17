import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NIGHTS,
  missingFor,
  isCookable,
  timeCeiling,
  filterRecipes,
  seededShuffle,
  buildDeck,
  nextOpenNight,
  buildShoppingList,
  countLines,
  dayStamp,
} from "../lib/plan.js";
import { RECIPES } from "../data/recipes.js";
import { STAPLES, STORES, STAPLE_BY_ID } from "../data/staples.js";

// A four-dish, three-staple kitchen. Small enough to assert on by hand, which
// is the point -- the real library is checked for integrity separately, below.
/** @type {import("../data/staples.js").Store[]} */
const stores = [
  { id: "a", name: "Store A", note: "first" },
  { id: "b", name: "Store B", note: "second" },
];
/** @type {import("../data/staples.js").Staple[]} */
const staples = [
  { id: "rice", name: "rice", kind: "starch", store: "a" },
  { id: "dal", name: "dal", kind: "protein", store: "a" },
  { id: "paneer", name: "paneer", kind: "protein", store: "b" },
  { id: "onions", name: "onions", kind: "veg", store: "b" },
];
/** @type {import("../data/recipes.js").Recipe[]} */
const recipes = [
  { id: "r1", name: "Dal & rice", lane: "bengali", method: "stovetop", prep: 25, kidOk: true, staples: ["dal", "rice"] },
  { id: "r2", name: "Palak paneer", lane: "indian", method: "stovetop", prep: 35, kidOk: true, staples: ["paneer", "onions"] },
  { id: "r3", name: "Cold plate", lane: "medi", method: "no-cook", prep: 10, kidOk: false, staples: ["rice"] },
  { id: "r4", name: "Long braise", lane: "italian", method: "oven", prep: 90, kidOk: true, staples: ["onions"] },
];

/** @param {Record<string, string>} obj */
const pan = (obj) => new Map(Object.entries(obj));

// ---- pantry awareness -----------------------------------------------------

test("missingFor: low and out both count as missing, have does not", () => {
  const p = pan({ dal: "have", rice: "low" });
  assert.deepEqual(missingFor(recipes[0], p), ["rice"]);
  assert.deepEqual(missingFor(recipes[0], pan({ dal: "out", rice: "low" })), ["dal", "rice"]);
  assert.deepEqual(missingFor(recipes[0], pan({ dal: "have", rice: "have" })), []);
});

test("missingFor: an untracked staple never blocks a dish", () => {
  assert.deepEqual(missingFor(recipes[0], pan({})), []);
  assert.equal(isCookable(recipes[0], pan({})), true);
});

test("missingFor: order follows the recipe, not the pantry", () => {
  const p = pan({ paneer: "out", onions: "out" });
  assert.deepEqual(missingFor(recipes[1], p), ["paneer", "onions"]);
});

// ---- filters --------------------------------------------------------------

test("timeCeiling: buckets parse, 'any' is no ceiling", () => {
  assert.equal(timeCeiling("15"), 15);
  assert.equal(timeCeiling("45"), 45);
  assert.equal(timeCeiling("any"), null);
});

test("filterRecipes: each axis narrows, and they AND together", () => {
  const all = { method: "any", lane: "any", time: "any", kidOk: false, cookable: false };
  const p = pan({});
  assert.equal(filterRecipes(recipes, all, p).length, 4);
  assert.deepEqual(
    filterRecipes(recipes, { ...all, time: "30" }, p).map((r) => r.id),
    ["r1", "r3"]
  );
  assert.deepEqual(
    filterRecipes(recipes, { ...all, method: "no-cook" }, p).map((r) => r.id),
    ["r3"]
  );
  assert.deepEqual(
    filterRecipes(recipes, { ...all, lane: "indian" }, p).map((r) => r.id),
    ["r2"]
  );
  assert.deepEqual(
    filterRecipes(recipes, { ...all, kidOk: true }, p).map((r) => r.id),
    ["r1", "r2", "r4"]
  );
  // time AND kidOk: r3 is quick but not kid-safe, r1 is both.
  assert.deepEqual(
    filterRecipes(recipes, { ...all, time: "30", kidOk: true }, p).map((r) => r.id),
    ["r1"]
  );
});

test("filterRecipes: 'cookable' hides anything the kitchen can't finish", () => {
  const p = pan({ rice: "have", dal: "have", paneer: "out", onions: "low" });
  const filters = { method: "any", lane: "any", time: "any", kidOk: false, cookable: true };
  assert.deepEqual(filterRecipes(recipes, filters, p).map((r) => r.id), ["r1", "r3"]);
});

// ---- the deck -------------------------------------------------------------

test("seededShuffle: same seed same order, different seed different order", () => {
  const items = Array.from({ length: 30 }, (_, i) => i);
  assert.deepEqual(seededShuffle(items, "2026-09-17"), seededShuffle(items, "2026-09-17"));
  assert.notDeepEqual(seededShuffle(items, "2026-09-17"), seededShuffle(items, "2026-09-18"));
});

test("seededShuffle: a permutation, and the input is untouched", () => {
  const items = [1, 2, 3, 4, 5];
  const out = seededShuffle(items, "x");
  assert.deepEqual(items, [1, 2, 3, 4, 5]);
  assert.deepEqual(out.slice().sort((a, b) => a - b), items);
});

test("buildDeck: drops what's planned and what's been waved off", () => {
  const filters = { method: "any", lane: "any", time: "any", kidOk: false, cookable: false };
  const deck = buildDeck({
    recipes,
    filters,
    pantry: pan({}),
    plannedIds: new Set(["r1"]),
    skippedIds: new Set(["r4"]),
    seed: "seed",
  });
  assert.deepEqual(deck.map((r) => r.id).sort(), ["r2", "r3"]);
});

test("buildDeck: stable for a given seed, so the card doesn't move under you", () => {
  const args = {
    recipes: RECIPES,
    filters: { method: "any", lane: "any", time: "any", kidOk: false, cookable: false },
    pantry: pan({}),
    plannedIds: new Set(),
    skippedIds: new Set(),
    seed: "2026-09-17",
  };
  assert.equal(buildDeck(args)[0].id, buildDeck(args)[0].id);
  assert.deepEqual(buildDeck(args).map((r) => r.id), buildDeck(args).map((r) => r.id));
});

// ---- nights ---------------------------------------------------------------

test("nextOpenNight: fills in week order, then reports full", () => {
  assert.equal(nextOpenNight([]), "mon");
  assert.equal(nextOpenNight([{ night: "mon" }]), "tue");
  // A gap gets filled before the tail.
  assert.equal(nextOpenNight([{ night: "mon" }, { night: "wed" }]), "tue");
  assert.equal(nextOpenNight(NIGHTS.map((n) => ({ night: n.id }))), null);
});

// ---- the shopping list ----------------------------------------------------

test("buildShoppingList: only what the plan needs and hasn't got", () => {
  const groups = buildShoppingList({
    picks: [recipes[0], recipes[1]],
    pantry: pan({ rice: "have", dal: "have", paneer: "out", onions: "low" }),
    staples,
    stores,
  });
  assert.equal(groups.length, 1, "store A has nothing to buy, so it's omitted");
  assert.equal(groups[0].store.id, "b");
  assert.deepEqual(groups[0].lines.map((l) => l.name), ["paneer", "onions"]);
  assert.equal(groups[0].lines[0].status, "out");
  assert.deepEqual(groups[0].lines[0].forDishes, ["Palak paneer"]);
  assert.equal(groups[0].lines[0].restockOnly, false);
});

test("buildShoppingList: two dishes wanting the same staple is one line", () => {
  const groups = buildShoppingList({
    picks: [recipes[1], recipes[3]],
    pantry: pan({ onions: "low", paneer: "have" }),
    staples,
    stores,
  });
  const onions = groups.flatMap((g) => g.lines).filter((l) => l.stapleId === "onions");
  assert.equal(onions.length, 1);
  assert.deepEqual(onions[0].forDishes, ["Palak paneer", "Long braise"]);
});

test("buildShoppingList: a flagged staple no dish needs is a restock line", () => {
  const groups = buildShoppingList({
    picks: [],
    pantry: pan({ dal: "out" }),
    staples,
    stores,
  });
  assert.equal(countLines(groups), 1);
  assert.equal(groups[0].lines[0].stapleId, "dal");
  assert.equal(groups[0].lines[0].restockOnly, true);
  assert.deepEqual(groups[0].lines[0].forDishes, []);
});

test("buildShoppingList: a planned dish upgrades a restock line, not duplicates it", () => {
  const groups = buildShoppingList({
    picks: [recipes[0]],
    pantry: pan({ dal: "out", rice: "out" }),
    staples,
    stores,
  });
  assert.equal(countLines(groups), 2);
  for (const line of groups[0].lines) {
    assert.equal(line.restockOnly, false, `${line.name} is needed by a dish`);
  }
});

test("buildShoppingList: nothing flagged means an empty list, not empty groups", () => {
  const groups = buildShoppingList({
    picks: [recipes[0], recipes[1]],
    pantry: pan({ rice: "have", dal: "have", paneer: "have", onions: "have" }),
    staples,
    stores,
  });
  assert.deepEqual(groups, []);
  assert.equal(countLines(groups), 0);
});

test("buildShoppingList: groups follow route order, lines follow staple order", () => {
  const groups = buildShoppingList({
    picks: [],
    // Flagged in reverse of both the store order and the staple order.
    pantry: pan({ onions: "low", paneer: "low", dal: "low", rice: "low" }),
    staples,
    stores,
  });
  assert.deepEqual(groups.map((g) => g.store.id), ["a", "b"]);
  assert.deepEqual(groups[0].lines.map((l) => l.name), ["rice", "dal"]);
  assert.deepEqual(groups[1].lines.map((l) => l.name), ["paneer", "onions"]);
});

test("buildShoppingList: a recipe naming an untracked staple is skipped, not fatal", () => {
  const ghost = { id: "g", name: "Ghost", lane: "x", method: "y", prep: 1, kidOk: true, staples: ["unobtainium"] };
  const groups = buildShoppingList({
    picks: [ghost],
    pantry: pan({ unobtainium: "out" }),
    staples,
    stores,
  });
  assert.deepEqual(groups, []);
});

// ---- the real library -----------------------------------------------------
// Data integrity, because a typo'd staple id is invisible until a card renders
// with a missing ingredient name and the shopping list silently drops a line.

test("library: over 100 dishes, unique ids", () => {
  assert.ok(RECIPES.length > 100, `${RECIPES.length} dishes`);
  assert.equal(new Set(RECIPES.map((r) => r.id)).size, RECIPES.length);
});

test("library: every staple a dish names is tracked", () => {
  const bad = RECIPES.flatMap((r) =>
    r.staples.filter((s) => !STAPLE_BY_ID.has(s)).map((s) => `${r.id} -> ${s}`)
  );
  assert.deepEqual(bad, []);
});

test("library: every tracked staple is reachable from some dish", () => {
  const used = new Set(RECIPES.flatMap((r) => r.staples));
  assert.deepEqual(STAPLES.filter((s) => !used.has(s.id)).map((s) => s.id), []);
});

test("library: every staple belongs to a real store", () => {
  const ids = new Set(STORES.map((s) => s.id));
  assert.deepEqual(STAPLES.filter((s) => !ids.has(s.store)).map((s) => s.id), []);
});

test("library: the ten-minute shelf isn't empty", () => {
  const quick = RECIPES.filter((r) => r.prep <= 15 && r.kidOk);
  assert.ok(quick.length >= 5, `${quick.length} quick kid-safe dishes`);
});

// ---- misc -----------------------------------------------------------------

test("dayStamp: local date, zero-padded", () => {
  assert.equal(dayStamp(new Date(2026, 8, 7, 23, 30)), "2026-09-07");
  assert.match(dayStamp(), /^\d{4}-\d{2}-\d{2}$/);
});
