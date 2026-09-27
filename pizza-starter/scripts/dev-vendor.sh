#!/usr/bin/env bash
# Bundle client-side deps into vendor/. Run after bumping their versions in
# package.json, then commit vendor/.
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

cp node_modules/lit/LICENSE vendor/lit.LICENSE.txt
