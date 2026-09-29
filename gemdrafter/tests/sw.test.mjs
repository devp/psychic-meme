import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// sw.js is a classic script, not a module, so it can't be imported -- it can
// only be *run*, which is what this does: evaluate the real file with the
// globals a worker would have, and keep the handlers it registers. That way
// these tests exercise the shipped file rather than a copy of its logic.
const source = readFileSync(new URL("../sw.js", import.meta.url), "utf8");

/** The ASSETS list, read out of the shipped file. */
const ASSETS = (() => {
  const m = /^const ASSETS = \[([\s\S]*?)^\];/m.exec(source);
  assert.ok(m, "sw.js has an ASSETS list");
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
})();

/**
 * @param {Record<string, string>} cached url -> body, what the cache holds
 * @returns {Map<string, (event: any) => void>}
 */
function runWorker(cached) {
  /** @type {Map<string, (event: any) => void>} */
  const handlers = new Map();
  const self = {
    registration: { scope: "http://x/" },
    location: { origin: "http://x" },
    addEventListener: (/** @type {string} */ type, /** @type {any} */ fn) => handlers.set(type, fn),
    skipWaiting: () => {},
    clients: { claim: () => {} },
  };
  const cache = {
    match: async (/** @type {string} */ url) =>
      url in cached ? new Response(cached[url]) : undefined,
  };
  const caches = { open: async () => cache };
  new Function("self", "caches", source)(self, caches);
  return handlers;
}

/**
 * @param {Record<string, string>} cached
 * @returns {Promise<{ build: string, files: number }>}
 */
async function askBuild(cached) {
  const onMessage = runWorker(cached).get("message");
  assert.ok(onMessage, "the worker registers a message handler");
  /** @type {any[]} */
  const replies = [];
  /** @type {Promise<unknown>[]} */
  const waits = [];
  onMessage({
    data: { type: "build" },
    ports: [{ postMessage: (/** @type {any} */ m) => replies.push(m) }],
    waitUntil: (/** @type {Promise<unknown>} */ p) => waits.push(p),
  });
  await Promise.all(waits);
  assert.equal(replies.length, 1, "exactly one reply");
  return replies[0];
}

const CACHED = { "index.html": "<!doctype html>", "app.js": "console.log(1)" };

test("sw.js lists the app's own files", () => {
  for (const f of ["lib/gemtext.js", "components/gem-preview.js", "components/post-list.js",
    "components/post-history.js", "icons/gem.svg"]) {
    assert.ok(ASSETS.includes(f), f);
  }
});

test("the build id is eight hex characters and counts the cached files", async () => {
  const info = await askBuild(CACHED);
  assert.match(info.build, /^[0-9a-f]{8}$/);
  assert.equal(info.files, 2);
});

test("the same files give the same id", async () => {
  assert.equal((await askBuild(CACHED)).build, (await askBuild({ ...CACHED })).build);
});

test("a changed file changes the id -- the whole point of it", async () => {
  const changed = { ...CACHED, "app.js": "console.log(2)" };
  assert.notEqual((await askBuild(CACHED)).build, (await askBuild(changed)).build);
});

test("so does an added file and a missing one", async () => {
  const base = (await askBuild(CACHED)).build;
  const added = await askBuild({ ...CACHED, "state.js": "" });
  assert.notEqual(added.build, base);
  assert.equal(added.files, 3);
  const missing = await askBuild({ "index.html": CACHED["index.html"] });
  assert.notEqual(missing.build, base);
  assert.equal(missing.files, 1);
});

test("bytes moving between files isn't mistaken for the same build", async () => {
  const a = await askBuild({ "index.html": "ab", "app.js": "" });
  const b = await askBuild({ "index.html": "a", "app.js": "b" });
  assert.notEqual(a.build, b.build);
});

test("a message that isn't ours is ignored, ports or no ports", () => {
  const onMessage = runWorker(CACHED).get("message");
  assert.ok(onMessage);
  /** @type {any[]} */
  const replies = [];
  const port = { postMessage: (/** @type {any} */ m) => replies.push(m) };
  const waitUntil = () => assert.fail("no work for a message that isn't ours");
  onMessage({ data: { type: "something-else" }, ports: [port], waitUntil });
  onMessage({ data: null, ports: [port], waitUntil });
  onMessage({ data: "a string from who knows where", ports: [], waitUntil });
  assert.deepEqual(replies, []);
  // And our own message with no port doesn't throw.
  onMessage({ data: { type: "build" }, ports: [], waitUntil });
});
