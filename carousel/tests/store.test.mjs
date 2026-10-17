import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { persistedValue, recordStore } from "../lib/store.js";

// Node has no localStorage without --localstorage-file.
/** @type {Map<string, string>} */
let data;
beforeEach(() => {
  data = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (/** @type {string} */ k) => (data.has(k) ? data.get(k) : null),
      setItem: (/** @type {string} */ k, /** @type {string} */ v) => data.set(k, String(v)),
      removeItem: (/** @type {string} */ k) => data.delete(k),
    },
  });
});

test("persistedValue: default, set, persist, notify", () => {
  const v = persistedValue("t:theme", "dusk");
  /** @type {string[]} */
  const seen = [];
  v.subscribe((x) => seen.push(x));
  v.set("paper");
  v.set("paper");
  assert.equal(v.get(), "paper");
  assert.deepEqual(seen, ["dusk", "paper"]);
  assert.equal(persistedValue("t:theme", "dusk").get(), "paper");
});

test("persistedValue: survives a throwing localStorage", () => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("blocked");
    },
  });
  const v = persistedValue("t:x", "fallback");
  assert.equal(v.get(), "fallback");
  v.set("y");
  assert.equal(v.get(), "y");
});

test("recordStore: create, append, update, remove items", () => {
  const s = recordStore("t:lists");
  const rec = s.ensureActive();
  const a = s.append(rec.id, { text: "a", done: false });
  s.append(rec.id, { text: "b", done: false });
  assert.ok(a);
  s.updateItem(rec.id, a.id, { done: true });
  s.removeItem(rec.id, a.id);
  const items = s.get(rec.id)?.items ?? [];
  assert.deepEqual(items.map((i) => i.text), ["b"]);
});

test("recordStore: reads are copies, not live state", () => {
  const s = recordStore("t:lists");
  const rec = s.ensureActive();
  s.append(rec.id, { text: "a" });
  const copy = s.get(rec.id);
  assert.ok(copy);
  copy.items.push({ id: "x", text: "sneaky" });
  assert.equal(s.get(rec.id)?.items.length, 1);
  assert.notEqual(s.get(rec.id), s.get(rec.id));
});

test("recordStore: persists across instances and notifies subscribers", () => {
  const s = recordStore("t:lists");
  let calls = 0;
  s.subscribe(() => calls++);
  const rec = s.create("first");
  s.rename(rec.id, "renamed");
  assert.equal(calls, 2);
  const again = recordStore("t:lists");
  assert.equal(again.getActiveId(), rec.id);
  assert.equal(again.get(rec.id)?.name, "renamed");
});
