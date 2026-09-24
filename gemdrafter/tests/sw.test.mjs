import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// sw.js is a classic script, not a module, so it can't be imported -- it can
// only be *run*, which is what this does: evaluate the real file with the
// globals a worker would have, and keep the handlers it registers. That way
// these tests exercise the shipped file rather than a copy of its logic.
const source = readFileSync(new URL("../sw.js", import.meta.url), "utf8");

/**
 * @param {{url: string, revision: string|null}[]} precache
 * @returns {Map<string, (event: any) => void>}
 */
function runWorker(precache) {
  /** @type {Map<string, (event: any) => void>} */
  const handlers = new Map();
  const self = {
    __PRECACHE: precache,
    addEventListener: (/** @type {string} */ type, /** @type {any} */ fn) => handlers.set(type, fn),
    skipWaiting: () => {},
    clients: { claim: () => {} },
  };
  const workbox = {
    precacheAndRoute: () => {},
    registerRoute: () => {},
    createHandlerBoundToURL: () => {},
    NavigationRoute: class {},
  };
  new Function("self", "workbox", "importScripts", source)(self, workbox, () => {});
  return handlers;
}

/**
 * @param {{url: string, revision: string|null}[]} precache
 * @returns {{ build: string, files: number }}
 */
function askBuild(precache) {
  const onMessage = runWorker(precache).get("message");
  assert.ok(onMessage, "the worker registers a message handler");
  /** @type {any[]} */
  const replies = [];
  onMessage({
    data: { type: "build" },
    ports: [{ postMessage: (/** @type {any} */ m) => replies.push(m) }],
  });
  assert.equal(replies.length, 1, "exactly one reply");
  return replies[0];
}

const MANIFEST = [
  { url: "index.html", revision: "aaaa" },
  { url: "app.js", revision: "bbbb" },
];

test("the build id is eight hex characters and counts the files", () => {
  const info = askBuild(MANIFEST);
  assert.match(info.build, /^[0-9a-f]{8}$/);
  assert.equal(info.files, 2);
});

test("the same deploy gives the same id", () => {
  assert.equal(askBuild(MANIFEST).build, askBuild(MANIFEST).build);
});

test("a changed file changes the id -- the whole point of it", () => {
  const changed = [MANIFEST[0], { url: "app.js", revision: "cccc" }];
  assert.notEqual(askBuild(MANIFEST).build, askBuild(changed).build);
});

test("so does an added file, a removed one, and a rename", () => {
  const base = askBuild(MANIFEST).build;
  assert.notEqual(askBuild([...MANIFEST, { url: "new.js", revision: "dddd" }]).build, base);
  assert.notEqual(askBuild([MANIFEST[0]]).build, base);
  assert.notEqual(askBuild([MANIFEST[0], { url: "renamed.js", revision: "bbbb" }]).build, base);
});

test("order matters, so a reordered manifest isn't mistaken for the same build", () => {
  assert.notEqual(askBuild([MANIFEST[1], MANIFEST[0]]).build, askBuild(MANIFEST).build);
});

test("the real manifest produces one", () => {
  // Evaluated the same way: it's a classic script assigning to self.
  const manifest = readFileSync(new URL("../precache-manifest.js", import.meta.url), "utf8");
  const scope = /** @type {any} */ ({});
  new Function("self", manifest)(scope);
  const info = askBuild(scope.__PRECACHE);
  assert.match(info.build, /^[0-9a-f]{8}$/);
  assert.equal(info.files, scope.__PRECACHE.length);
});

test("a message that isn't ours is ignored, ports or no ports", () => {
  const onMessage = runWorker(MANIFEST).get("message");
  assert.ok(onMessage);
  /** @type {any[]} */
  const replies = [];
  const port = { postMessage: (/** @type {any} */ m) => replies.push(m) };
  onMessage({ data: { type: "something-else" }, ports: [port] });
  onMessage({ data: null, ports: [port] });
  onMessage({ data: "a string from who knows where", ports: [] });
  assert.deepEqual(replies, []);
  // And our own message with no port doesn't throw.
  onMessage({ data: { type: "build" }, ports: [] });
});
