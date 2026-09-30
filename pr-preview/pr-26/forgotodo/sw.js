/// <reference lib="webworker" />
// Offline support, hand-written. No build step, no library.
//
// How a service worker gets here: app.js calls register("sw.js"). The browser
// downloads this file, runs `install`, then `activate`, and from then on every
// request the page makes passes through `fetch` below. The browser re-checks
// sw.js itself on each visit; if its bytes changed at all, the new version
// installs and replaces this one. Editing style or app code doesn't change
// sw.js, so that path isn't how edits arrive; `check` below is.
//
// Strategy: cache-first, plus an update check. `fetch` answers from the cache
// only. On every launch and every resume, app.js posts "check": this worker
// refetches all of ASSETS, stores them if every fetch succeeded, and tells the
// page "updated" if any bytes changed. app.js reloads on the next resume. So
// an edit shows up one reload late while developing, and an installed app
// picks it up the next time you come back to it. Offline, the check just fails
// quietly and nothing changes.

const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));

// Cache storage is shared by every app on this origin (two apps under one
// github.io user, or two folders on localhost:8000), so the name starts with
// this worker's scope, and `activate` only cleans up names with that prefix.
// Bump the version to throw away every cached file. Content edits don't need
// it; renaming or deleting files is when you'd bother.
const PREFIX = sw.registration.scope + " ";
const CACHE = PREFIX + "v1";

// Every file the app needs offline, fetched on install. Add a file to the app,
// add it here -- `just warnings` flags anything missing or listed-but-gone.
// Editing this list changes sw.js's bytes, which is what makes browsers pick
// it up.
const ASSETS = [
  "index.html",
  "manifest.webmanifest",
  "theme.css",
  "base.css",
  "app.css",
  "app.js",
  "state.js",
  "lib/beam.js",
  "lib/fit.js",
  "lib/forget.js",
  "lib/icons.js",
  "lib/organize.js",
  "lib/store.js",
  "lib/viewport.js",
  "components/checklist.js",
  "vendor/lit.js",
  "fonts/DepartureMono-Regular.woff2",
  "fonts/ComicNeue-Regular.woff2",
  "fonts/ComicNeue-Bold.woff2",
  "icons/forgotodo.svg",
];

// Install: download ASSETS into the cache.
//
// ALL-OR-NOTHING: addAll rejects if any single file fails (a typo, a deleted
// file), and then this worker never activates -- no offline at all, and no
// error on the page. That's why the list is checked by `just warnings`.
//
// `cache: "reload"` skips the browser's HTTP cache, which could otherwise hand
// back an old copy of a file and cache that.
sw.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: "reload" }))))
      // Take over now instead of waiting for every open tab to close.
      .then(() => sw.skipWaiting())
  );
});

// Activate: delete this app's caches under any other version, and start
// handling requests from pages that are already open.
sw.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n.startsWith(PREFIX) && n !== CACHE).map((n) => caches.delete(n))))
      .then(() => sw.clients.claim())
  );
});

sw.addEventListener("fetch", (event) => {
  const req = event.request;
  // Only reads from our own origin. Anything else goes to the network as if
  // this worker didn't exist.
  if (req.method !== "GET" || new URL(req.url).origin !== sw.location.origin) return;

  // A navigation is the page itself: a deep link, a refresh, a url carrying
  // ?utm_source=... It's a one-page app, so every one of them gets index.html.
  const key = req.mode === "navigate" ? "index.html" : req;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      // ignoreSearch: `app.js?x` finds `app.js`. Not cached (not in ASSETS):
      // straight to the network, as with no worker at all.
      return (await cache.match(key, { ignoreSearch: true })) ?? fetch(req);
    })
  );
});

// Check: refetch every file in ASSETS and replace the cached copies.
//
// ALL-OR-NOTHING, like install: if any fetch fails (offline, flaky network, a
// deploy half-uploaded), nothing is stored. Storing some files but not others
// would leave the next launch running new app.js against old state.js.
//
// `no-cache` makes the browser ask the server whether each file changed (a
// cheap 304 if not) instead of trusting its HTTP cache. Launch and resume can
// both ask at once; they share one check.
/** @type {Promise<void> | null} */
let checking = null;

async function check() {
  const cache = await caches.open(CACHE);
  const fresh = await Promise.all(
    ASSETS.map(async (url) => {
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) throw new Error(`${url}: ${res.status}`);
      return { url, res, bytes: new Uint8Array(await res.clone().arrayBuffer()) };
    })
  );
  let changed = false;
  for (const { url, res, bytes } of fresh) {
    const old = await cache.match(url);
    if (old && sameBytes(bytes, new Uint8Array(await old.arrayBuffer()))) continue;
    await cache.put(url, res);
    changed = true;
  }
  if (!changed) return;
  // Every open window of this app, including one that loaded before this
  // worker took over.
  for (const client of await sw.clients.matchAll({ includeUncontrolled: true })) client.postMessage("updated");
}

/** @param {Uint8Array} a @param {Uint8Array} b */
function sameBytes(a, b) {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

sw.addEventListener("message", (event) => {
  if (event.data !== "check") return;
  checking ??= check()
    .catch(() => {})
    .finally(() => (checking = null));
  event.waitUntil(checking);
});
