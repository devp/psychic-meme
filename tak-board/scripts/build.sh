#!/usr/bin/env bash
# Bundle src/ and tps-ninja into tak-board.js, the file other apps vendor.
# Run after changing src/ or bumping tps-ninja, then commit tak-board.js.
set -euo pipefail
cd "$(dirname "$0")/.."

node_modules/.bin/esbuild src/tak-board.js --bundle --format=esm --minify \
  --legal-comments=inline \
  --alias:fs=./shims/fs.js --alias:canvas=./shims/canvas.js \
  --banner:js="/*! tak-board · AGPL-3.0-or-later · bundles tps-ninja $(node -p 'require("./node_modules/tps-ninja/package.json").version') (AGPL-3.0, Craig Laparo) and lodash-es (MIT). Source: https://github.com/devp/psychic-meme/tree/main/tak-board */" \
  --outfile=tak-board.js
