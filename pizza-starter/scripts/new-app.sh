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
slug=$(basename "$dest")
# warnings.sh treats package.json named pizza-starter as the starter itself and skips starter-leftover.
sed -i.bak "s/\"name\": \"pizza-starter\"/\"name\": \"$slug\"/" "$top/$dest/package.json"
# app-ns prefixes localStorage keys, which every app on the origin shares.
sed -i.bak "s/<meta name=\"app-ns\" content=\"pizza-starter\">/<meta name=\"app-ns\" content=\"$slug\">/" "$top/$dest/index.html"
# The shared QR page lives in misc/ at the repo root; app/ is one level deeper than a copy.
sed -i.bak 's|href="../../misc/qr/"|href="../misc/qr/"|' "$top/$dest/index.html"
rm "$top/$dest/package.json.bak" "$top/$dest/index.html.bak"
cat >"$top/$dest/STARTER" <<STAMP
from: $prefix
commit: $commit
tree: $tree
copied: $(date +%Y-%m-%d)
STAMP

echo "created $dest from $prefix@${commit:0:7}. Next: cd $dest && just warnings"
