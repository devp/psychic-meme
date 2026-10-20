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
  "remote.js",
  "lib/store.js",
  "lib/todoist.js",
  "lib/triage.js",
  "lib/viewport.js",
  "components/picker.js",
  "components/session.js",
  "components/setup.js",
  "components/update-toast.js",
  "vendor/lit.js",
  "icons/ttr.svg",
];
