/// <reference lib="webworker" />
/// <reference path="./sw-globals.d.ts" />
// Offline, via Workbox. Authored; only precache-manifest.js is generated.

importScripts("vendor/workbox.js", "precache-manifest.js");

const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));

// Revision-stamped precache: entries whose content hash changed are re-fetched,
// the rest are left alone. Failures are per-asset, not all-or-nothing, and
// `./` resolves to index.html via the default directoryIndex.
workbox.precacheAndRoute(self.__PRECACHE);

// Any navigation -- deep link, refresh on an unknown path, a url carrying
// ?utm_source=... -- boots the app shell.
workbox.registerRoute(
  new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html"))
);

sw.addEventListener("install", () => sw.skipWaiting());
sw.addEventListener("activate", () => sw.clients.claim());
