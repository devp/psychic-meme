// The lang.js contract, checked against whichever language this app is. The
// shell trusts these shapes without checking, so a port that gets one wrong
// fails here rather than as a blank page. See ../../README.md for the contract.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { lang } from "./load-lang.mjs";

const L = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (lang));
const root = new URL("..", import.meta.url);
const assets = readFileSync(new URL("sw-assets.js", root), "utf8").match(/"[^"]+"/g)?.map((s) => s.slice(1, -1)) ?? [];

test("identity: name, placeholder, greeting, about", () => {
  for (const k of ["name", "placeholder", "greeting", "about", "comment"]) {
    assert.equal(typeof L[k], "string", k);
    assert.notEqual(L[k], "", k);
  }
  assert.match(lang.name, /^[a-z0-9-]+$/, "name goes in the export header");
});

test("(1) evaluate and its export helpers are functions", () => {
  for (const k of ["evaluate", "hasUnterminated", "replayCaveat", "preprocessDoc"]) assert.equal(typeof L[k], "function", k);
  if ("complete" in L) assert.equal(typeof L.complete, "function", "complete is optional, but a function if there");
  const r = lang.evaluate(lang.placeholder);
  assert.deepEqual(Object.keys(r).sort(), ["isError", "text"]);
  assert.equal(r.isError, false, `the placeholder runs: ${r.text}`);
  assert.deepEqual(lang.replayCaveat([]), []);
});

test("(2) shortcuts: keys and commands are lists of non-empty strings", () => {
  for (const k of ["keys", "commands"]) {
    const v = L[k];
    assert.ok(Array.isArray(v), k);
    assert.ok(v.every((x) => typeof x === "string" && x !== ""), k);
  }
  assert.ok(lang.keys.length > 0, "an empty key row is just a gap");
  assert.equal(new Set(lang.keys).size, lang.keys.length, "no duplicate keys");
});

test("(3) docs: unique ids, files on disk and cached offline", () => {
  assert.ok(Array.isArray(lang.docs));
  const ids = lang.docs.map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length, "unique ids");
  for (const d of lang.docs) {
    assert.match(d.id, /^[a-z0-9-]+$/, "an id is also a localStorage value and a selector");
    assert.ok(!["repl", "docs", "log"].includes(d.id), `${d.id} would collide with a tab`);
    assert.match(d.src, /\.(md|html)$/, `${d.src}: Markdown or an HTML fragment`);
    assert.ok(existsSync(new URL(d.src, root)), `${d.src} exists`);
    assert.ok(assets.includes(d.src), `${d.src} is in sw-assets.js`);
  }
});
