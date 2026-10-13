#!/bin/sh
# Copy what ships from <dir> into <out> for `wrangler deploy --assets <out>`.
# With a sw.js ASSETS list (pizza-starter apps): sw.js, ASSETS, NOTICE.md, vendor licenses.
# Without one: the whole dir.
#
#   scripts/cf-stage.sh <dir> <out>    # dir is relative to the repo root; out must not exist
set -eu
dir=${1:?usage: cf-stage.sh <dir> <out>}
out=${2:?usage: cf-stage.sh <dir> <out>}
mkdir "$out"
out=$(cd "$out" && pwd)
cd "$(dirname "$0")/../$dir"

ship() { mkdir -p "$out/$(dirname "$1")" && cp "$1" "$out/$1"; }

if [ -f sw.js ] && grep -q '^const ASSETS = \[' sw.js; then
  assets=$(awk '/^const ASSETS = \[/ { on=1; next } on && /^\];/ { exit } on' sw.js | grep -oE '"[^"]+"' | tr -d '"')
  for f in sw.js $assets; do ship "$f"; done
  for f in NOTICE.md vendor/*.LICENSE.txt; do [ ! -e "$f" ] || ship "$f"; done
else
  cp -R . "$out/"
fi
