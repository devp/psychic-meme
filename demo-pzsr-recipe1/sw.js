/// <reference lib="webworker" />
/// <reference path="./sw-globals.d.ts" />
// Offline, via Workbox. Authored; only precache-manifest.js is generated.

importScripts("vendor/workbox.js", "precache-manifest.js");

const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));

// Revision-stamped precache: entries whose content hash changed are re-fetched,
// the rest are left alone. `./` resolves to index.html via the default
// directoryIndex.
//
// CAUTION, measured: this is ALL-OR-NOTHING. precacheAndRoute installs its own
// install handler, and one entry that fails to cache rejects it, so the worker
// never activates and you get no offline at all -- silently. The mitigation is that the manifest is globbed from disk, so a bad path
// can't normally enter it; the exposure is a file deleted after generation or a
// partial deploy.
workbox.precacheAndRoute(self.__PRECACHE);

// Any navigation -- deep link, refresh on an unknown path, a url carrying
// ?utm_source=... -- boots the app shell.
workbox.registerRoute(
  new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html"))
);

sw.addEventListener("install", () => sw.skipWaiting());
sw.addEventListener("activate", () => sw.clients.claim());
