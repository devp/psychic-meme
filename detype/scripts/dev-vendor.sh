#!/usr/bin/env bash
# Bundle client-side deps into vendor/. Run after bumping their versions in
# package.json, then run `just dev-rebuild` and commit vendor/.
set -euo pipefail
cd "$(dirname "$0")/.."

# Entry files must sit inside the project so esbuild resolves node_modules.
entry=".vendor-entry.js"
trap 'rm -f "$entry"' EXIT

printf '%s\n' \
  'export { LitElement, html, css, nothing, svg } from "lit";' \
  'export { repeat } from "lit/directives/repeat.js";' >"$entry"
npx esbuild "$entry" --bundle --format=esm --minify --legal-comments=inline \
  --outfile=vendor/lit.js

printf '%s\n' \
  'export { precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching";' \
  'export { registerRoute, NavigationRoute } from "workbox-routing";' \
  'export { StaleWhileRevalidate } from "workbox-strategies";' >"$entry"
npx esbuild "$entry" --bundle --format=iife --global-name=workbox --minify \
  --define:process.env.NODE_ENV='"production"' \
  --outfile=vendor/workbox.js

# workbox-* LICENSE files are identical; its bundle keeps no license comments.
cp node_modules/lit/LICENSE vendor/lit.LICENSE.txt
cp node_modules/workbox-precaching/LICENSE vendor/workbox.LICENSE.txt
