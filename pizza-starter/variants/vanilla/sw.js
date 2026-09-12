/// <reference lib="webworker" />
// Offline. Bump CACHE when you want every client to re-fetch from scratch.
//
// ASSETS is the one derived thing in this project: it must list every file the
// app needs offline. `just check` compares it against the directory and fails
// if they've drifted -- which is the only reason it's safe to maintain by hand.

// TypeScript types the bare `self` as WorkerGlobalScope, which is the generic
// worker scope and lacks skipWaiting/clients/FetchEvent. Narrow it once here
// and the rest of the file typechecks as the service worker it actually is.
const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));

const CACHE = "pizza-starter-v1";

const ASSETS = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "reactive-element.js",
  "components/tabs.js",
  "components/checklist.js",
  "manifest.webmanifest",
  "icons/pizza.svg",
  "../../lib/viewport.js",
  "../../lib/store.js",
];

sw.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Deliberately NOT cache.addAll(): that is atomic, so one bad path means
      // no offline at all, silently, on a phone with no console. Adding each
      // separately degrades instead -- you lose one asset, not the app.
      const results = await Promise.allSettled(ASSETS.map((url) => cache.add(url)));
      const failed = ASSETS.filter((_, i) => results[i].status === "rejected");
      if (failed.length) console.warn("[sw] failed to precache:", failed);
      await sw.skipWaiting();
    })()
  );
});

sw.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await sw.clients.claim();
    })()
  );
});

sw.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  event.respondWith(
    (async () => {
      // ignoreSearch: a link carrying ?utm=... is the same asset, and without
      // this it misses the cache and breaks offline.
      const cached =
        (await caches.match(request, { ignoreSearch: true })) ??
        // A deep link or refresh on an unknown path should still boot the app.
        (request.mode === "navigate"
          ? await caches.match("index.html", { ignoreSearch: true })
          : undefined);

      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      // Stale-while-revalidate. The ?? matters: with nothing cached AND no
      // network, `network` resolves to undefined, and respondWith(undefined)
      // is a hard error rather than a failed request.
      return (await (cached ?? network)) ?? new Response("", { status: 504, statusText: "Offline" });
    })()
  );
});
