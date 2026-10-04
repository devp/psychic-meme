#!/usr/bin/env bash
# Copy the repo into a folder GitHub Pages can serve as-is.
#
#   .github/scripts/stage-site.sh <out>             # production (main)
#   .github/scripts/stage-site.sh <out> pr-21       # a PR preview
#
# With a preview label, every page that declares <meta name="app-ns"> gets
# that label prefixed onto its localStorage namespace, and onto its <title>.
# Previews live on the same origin as production (devp.github.io), and
# localStorage is per-origin, so without this a preview would read and write
# the real apps' saved data. Cache Storage needs nothing: sw.js already names
# its caches by registration scope, and a preview's scope is its own folder.
set -euo pipefail

out=${1:?usage: stage-site.sh <out> [preview-label]}
label=${2:-}
root=$(git rev-parse --show-toplevel)

rm -rf "$out"
mkdir -p "$out"
# Tracked files only: nothing ignored (node_modules, local scratch) ships.
git -C "$root" archive HEAD | tar -x -C "$out"
rm -rf "$out/.github"

# Serve files verbatim: no Jekyll, which would drop _-prefixed paths and
# render the .md files.
touch "$out/.nojekyll"

if [ -n "$label" ]; then
  grep -rlZ --include='*.html' '<meta name="app-ns" content="' "$out" |
    xargs -0 -r sed -i \
      -e "s/<meta name=\"app-ns\" content=\"/&$label:/" \
      -e "s/<title>/&[$label] /"
fi
