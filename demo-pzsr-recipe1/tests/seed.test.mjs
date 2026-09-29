import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { recordStore } from "../lib/store.js";
import { seedPantry } from "../lib/seed.js";
import { STAPLES } from "../data/staples.js";

// Node has no localStorage without --localstorage-file.
beforeEach(() => {
  /** @type {Map<string, string>} */
  const data = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (/** @type {string} */ k) => (data.has(k) ? data.get(k) : null),
      setItem: (/** @type {string} */ k, /** @type {string} */ v) => data.set(k, String(v)),
      removeItem: (/** @type {string} */ k) => data.delete(k),
    },
  });
});

test("seedPantry: one row per tracked staple, a mid-week mix of states", () => {
  const pantry = recordStore("t:pantry");
  const id = seedPantry(pantry);
  const rec = pantry.get(id);
  assert.equal(rec?.name, "kitchen");
  const items = rec?.items ?? [];
  assert.deepEqual(items.map((i) => i.stapleId), STAPLES.map((s) => s.id));
  const count = (/** @type {string} */ s) => items.filter((i) => i.status === s).length;
  assert.equal(count("low"), 8);
  assert.equal(count("out"), 7);
  assert.equal(count("have"), STAPLES.length - 15);
  assert.equal(items.find((i) => i.stapleId === "paneer")?.status, "out");
  assert.equal(items.find((i) => i.stapleId === "onions")?.status, "low");
});

test("seedPantry: runs once; a pantry with rows is left alone", () => {
  const pantry = recordStore("t:pantry");
  const id = seedPantry(pantry);
  const row = pantry.get(id)?.items.find((i) => i.stapleId === "paneer");
  assert.ok(row);
  pantry.updateItem(id, row.id, { status: "have" });
  assert.equal(seedPantry(pantry), id);
  const items = pantry.get(id)?.items ?? [];
  assert.equal(items.length, STAPLES.length);
  assert.equal(items.find((i) => i.stapleId === "paneer")?.status, "have");
});
