// lib/engine.js under node, where lang.js's unit tests run: file: URLs come
// from disk. The browser half (streaming, http) is in tests/browser/app.test.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadWasm, fetchText, fetchBytes } from "../lib/engine.js";

const fixture = new URL("fixtures/add.wasm", import.meta.url);

test("loadWasm instantiates a file: URL", async () => {
  const { instance } = await loadWasm(fixture);
  assert.equal(/** @type {any} */ (instance.exports).add(2, 3), 5);
});

test("fetchBytes and fetchText read file: URLs", async () => {
  const bytes = await fetchBytes(fixture);
  assert.deepEqual([...bytes.slice(0, 4)], [0, 0x61, 0x73, 0x6d], "\\0asm");
  assert.match(await fetchText(new URL("../lang.js", import.meta.url)), /export function evaluate/);
});

test("a missing file rejects", async () => {
  await assert.rejects(fetchText(new URL("fixtures/nope.txt", import.meta.url)));
});
