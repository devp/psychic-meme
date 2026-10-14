#!/usr/bin/env bash
# Copy app/ as committed to a new app dir and stamp it with STARTER.
#
#   scripts/new-app.sh <dest> [name]
#
# dest is absolute (the app can live in any repo, or none), else relative to
# the starter repo root. name is the app's slug (package.json name and the
# localStorage namespace); default basename of dest. dest must not exist.
set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/lib.sh

dest=${1:?usage: new-app.sh <dest> [name]}
case $dest in /*) ;; *) dest=$top/$dest ;; esac
slug=${2:-$(basename "$dest")}

[ -e "$dest" ] && { echo "$dest already exists" >&2; exit 1; }
if [ -n "$(git status --porcelain -- app)" ]; then
  echo "app/ has uncommitted changes; commit them first so the stamp matches the copy" >&2
  exit 1
fi

commit=$(git log -1 --format=%H -- app)
tree=$(git rev-parse "$commit:$prefix")
remote=$(starter_remote /dev/null)

mkdir -p "$dest"
git -C "$top" archive "$tree" | tar -x -C "$dest"
# warnings.sh treats package.json named pizza-starter as the starter itself and skips starter-leftover.
sed -i.bak "s/\"name\": \"pizza-starter\"/\"name\": \"$slug\"/" "$dest/package.json"
# app-ns prefixes localStorage keys, which every app on the origin shares.
sed -i.bak "s/<meta name=\"app-ns\" content=\"pizza-starter\">/<meta name=\"app-ns\" content=\"$slug\">/" "$dest/index.html"
rm "$dest/package.json.bak" "$dest/index.html.bak"
cat >"$dest/STARTER" <<STAMP
from: $prefix
${remote:+remote: $remote
}commit: $commit
tree: $tree
copied: $(date +%Y-%m-%d)
STAMP

echo "created $dest from $prefix@${commit:0:7}. Next: cd $dest && just warnings"
