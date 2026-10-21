#!/usr/bin/env bash
# Copy app/ as committed to a new app dir and stamp it with STARTER.
#
#   scripts/new-app.sh <dest> [name]
#
# dest is absolute (the app can live in any repo, or none), else relative to
# the starter repo root. name is the app's slug (package.json name and the
# localStorage namespace); default basename of dest. dest may already exist as
# a directory (e.g. one holding other files) if none of the app's files are in it.
#
# Also run from pizza-repl/ (its scripts/ link here), copying pizza-repl/app:
# paths are relative to whichever starter the script was invoked from. The
# starter app's own STARTER stamps stay behind.
set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/lib.sh

dest=${1:?usage: new-app.sh <dest> [name]}
case $dest in /*) ;; *) dest=$top/$dest ;; esac
slug=${2:-$(basename "$dest")}

if [ -e "$dest" ] && [ ! -d "$dest" ]; then echo "$dest exists and is not a directory" >&2; exit 1; fi
if [ -n "$(git status --porcelain -- app)" ]; then
  echo "app/ has uncommitted changes; commit them first so the stamp matches the copy" >&2
  exit 1
fi

commit=$(git log -1 --format=%H -- app)
tree=$(git rev-parse "$commit:$prefix")
remote=$(starter_remote /dev/null)
# The starter app's own name, replaced by slug below.
from=$(git cat-file blob "$tree:package.json" | sed -n 's/^  "name": "\(.*\)",$/\1/p')
stamps=(STARTER STARTER-LAST-UPDATED)

if [ -d "$dest" ]; then
  clash=$(git -C "$top" archive "$tree" | tar -t | grep -v '/$' | grep -vxF -e STARTER -e STARTER-LAST-UPDATED | while read -r f; do
    if [ -e "$dest/$f" ] || [ -L "$dest/$f" ] || [ "$f" = STARTER ]; then echo "$f"; fi
  done)
  [ -z "$clash" ] || { echo "$dest already has app files:" >&2; echo "$clash" | sed 's/^/  /' >&2; exit 1; }
fi
[ -e "$dest/STARTER" ] && { echo "$dest already has a STARTER stamp" >&2; exit 1; }
mkdir -p "$dest"
git -C "$top" archive "$tree" | tar -x -C "$dest" "${stamps[@]/#/--exclude=}"
# warnings.sh treats package.json named pizza-starter as the starter itself and skips starter-leftover.
sed -i.bak "s/\"name\": \"$from\"/\"name\": \"$slug\"/" "$dest/package.json"
# app-ns prefixes localStorage keys, which every app on the origin shares.
sed -i.bak "s/<meta name=\"app-ns\" content=\"$from\">/<meta name=\"app-ns\" content=\"$slug\">/" "$dest/index.html"
rm "$dest/package.json.bak" "$dest/index.html.bak"
cat >"$dest/STARTER" <<STAMP
from: $prefix
${remote:+remote: $remote
}commit: $commit
tree: $tree
copied: $(date +%Y-%m-%d)
STAMP

echo "created $dest from $prefix@${commit:0:7}. Next: cd $dest && just warnings"
