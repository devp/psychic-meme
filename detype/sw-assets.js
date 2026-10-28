// Every file the app needs offline, fetched on install. Add a file to the app,
// add it here -- `just warnings` flags anything missing or listed-but-gone.
// sw.js loads this with importScripts, so it's a classic script: no export.
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
  "components/update-toast.js",
  "vendor/lit.js",
  "icons/detype.svg",
];
