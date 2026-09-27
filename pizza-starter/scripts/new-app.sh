#!/usr/bin/env bash
# Copy app/ as committed to a new app dir and stamp it with STARTER.
#
#   scripts/new-app.sh <dest>    # dest is relative to the repo root
set -euo pipefail
cd "$(dirname "$0")/.."

dest=${1:?usage: new-app.sh <dest>}
top=$(git rev-parse --show-toplevel)
prefix=$(git rev-parse --show-prefix)app

[ -e "$top/$dest" ] && { echo "$dest already exists" >&2; exit 1; }
if [ -n "$(git status --porcelain -- app)" ]; then
  echo "app/ has uncommitted changes; commit them first so the stamp matches the copy" >&2
  exit 1
fi

commit=$(git log -1 --format=%H -- app)
tree=$(git rev-parse "$commit:$prefix")

mkdir -p "$top/$dest"
git -C "$top" archive "$tree" | tar -x -C "$top/$dest"
# warnings.sh treats package.json named pizza-starter as the starter itself and skips starter-leftover.
sed -i.bak "s/\"name\": \"pizza-starter\"/\"name\": \"$(basename "$dest")\"/" "$top/$dest/package.json"
rm "$top/$dest/package.json.bak"
cat >"$top/$dest/STARTER" <<STAMP
from: $prefix
commit: $commit
tree: $tree
copied: $(date +%Y-%m-%d)
STAMP

echo "created $dest from $prefix@${commit:0:7}. Next: cd $dest && just warnings"
