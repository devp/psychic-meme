/// <reference lib="webworker" />
// Offline support, hand-written. No build step, no library.
//
// How a service worker gets here: app.js calls register("sw.js"). The browser
// downloads this file, runs `install`, then `activate`, and from then on every
// request the page makes passes through `fetch` below. The browser re-checks
// sw.js itself on each visit; if its bytes changed at all, the new version
// installs and replaces this one. That is the only update trigger -- editing
// style or app code never re-runs install. (It doesn't need to; see `fetch`.)
//
// Strategy: stale-while-revalidate. Answer from the cache immediately, then
// refetch in the background and overwrite the cached copy. So an edit shows up
// one reload late: the first reload gets the old file and fetches the new one,
// the second reload gets the new one. Offline, the refetch just fails quietly.

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
  "lib/pages.js",
  "lib/store.js",
  "lib/viewport.js",
  "components/ghost-lines.js",
  "components/pages-list.js",
  "components/tabs.js",
  "vendor/lit.js",
  "icons/detype.svg",
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
      // ignoreSearch: `app.js?x` finds `app.js`.
      const cached = await cache.match(key, { ignoreSearch: true });
      // `no-cache` makes the browser ask the server whether the file changed
      // (a cheap 304 if not) rather than trusting its HTTP cache, which might
      // keep serving the old copy for a while and delay the edit further.
      const refresh = fetch(key, { cache: "no-cache" }).then((res) => {
        if (res.ok) cache.put(key, res.clone());
        return res;
      });
      // Keep the worker alive until the background refresh has been stored.
      event.waitUntil(refresh.catch(() => {}));
      // Cached copy if we have one; else wait for the network (and if that
      // fails too, the request fails, as it would with no worker at all).
      return cached ?? refresh;
    })
  );
});
