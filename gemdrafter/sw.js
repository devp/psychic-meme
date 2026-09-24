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
// partial deploy. See COMPARISON.md, axis 2.
workbox.precacheAndRoute(self.__PRECACHE);

// Any navigation -- deep link, refresh on an unknown path, a url carrying
// ?utm_source=... -- boots the app shell.
workbox.registerRoute(
  new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html"))
);

sw.addEventListener("install", () => sw.skipWaiting());
sw.addEventListener("activate", () => sw.clients.claim());

// Which build is actually serving you.
//
// sw.js never changes; precache-manifest.js changes on every deploy. So the
// manifest's contents are the only honest version number this app has, and
// the worker is the only scope that can see them. The Options panel asks for
// this over a MessagePort and shows the answer -- which turns "did my change
// ship?" from a conversation into a glance.
sw.addEventListener("message", (event) => {
  if (event.data?.type !== "build") return;
  const port = event.ports[0];
  if (port) port.postMessage(buildId());
});

/**
 * FNV-1a over every url:revision pair. Not a cryptographic hash and doesn't
 * need to be: it only has to change when the deploy does, and be the same
 * eight characters on every device serving that deploy.
 * @returns {{ build: string, files: number }}
 */
function buildId() {
  let h = 0x811c9dc5;
  for (const entry of self.__PRECACHE) {
    const line = entry.url + ":" + entry.revision;
    for (let i = 0; i < line.length; i++) {
      h ^= line.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  return { build: h.toString(16).padStart(8, "0"), files: self.__PRECACHE.length };
}
