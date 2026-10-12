#!/usr/bin/env bash
# Merge the starter's committed changes to CORE files into a copied app, and
# stamp the app with STARTER-LAST-UPDATED. Each file is a 3-way merge from the
# last stamp (else STARTER), so the app's own edits survive; a conflict is left
# as markers. Non-core files that changed upstream are listed, not touched.
#
#   scripts/sync.sh <app>    # app is relative to the repo root
set -euo pipefail
cd "$(dirname "$0")/.."

app=${1:?usage: sync.sh <app>}
top=$(git rev-parse --show-toplevel)
prefix=$(git rev-parse --show-prefix)app
dir=$top/$app

[ -f "$dir/STARTER" ] || { echo "no $app/STARTER; not a copy of the starter" >&2; exit 1; }
if [ -n "$(git status --porcelain -- app CORE)" ]; then
  echo "starter app/ or CORE has uncommitted changes; commit them first" >&2
  exit 1
fi
if [ -n "$(git -C "$top" status --porcelain -- "$app")" ]; then
  echo "$app has uncommitted changes; commit them first so the merge is reviewable" >&2
  exit 1
fi

stamp=$dir/STARTER-LAST-UPDATED
[ -f "$stamp" ] || stamp=$dir/STARTER
base=$(sed -n 's/^tree: //p' "$stamp")
commit=$(git log -1 --format=%H -- app)
tree=$(git rev-parse "$commit:$prefix")
core=$(grep -v '^#' CORE | grep .)

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
conflicts=0
for f in $core; do
  ours=$dir/$f
  git cat-file blob "$tree:$f" >"$tmp/theirs"
  if [ ! -f "$ours" ]; then
    mkdir -p "$(dirname "$ours")"
    cp "$tmp/theirs" "$ours"
    [ "$(git ls-tree "$tree" -- "$f" | cut -d' ' -f1)" = 100755 ] && chmod +x "$ours"
    echo "added    $f"
    continue
  fi
  cmp -s "$tmp/theirs" "$ours" && continue
  git cat-file blob "$base:$f" >"$tmp/base" 2>/dev/null || : >"$tmp/base"
  if git merge-file -L "$app" -L "starter@${base:0:7}" -L "starter@${commit:0:7}" "$ours" "$tmp/base" "$tmp/theirs"; then
    echo "merged   $f"
  else
    echo "CONFLICT $f"
    conflicts=$((conflicts + 1))
  fi
done

skeleton=$(git diff --name-only "$base" "$tree" | grep -vxF "$core" || true)
if [ -n "$skeleton" ]; then
  echo "== not core, changed upstream; port by hand if wanted:"
  echo "$skeleton" | sed 's/^/  /'
  echo "  see: git diff ${base:0:7} ${tree:0:7} -- <path>"
fi

if [ "$(sed -n 's/^tree: //p' "$dir/STARTER-LAST-UPDATED" 2>/dev/null)" != "$tree" ]; then
  cat >"$dir/STARTER-LAST-UPDATED" <<STAMP
from: $prefix
commit: $commit
tree: $tree
updated: $(date +%Y-%m-%d)
STAMP
fi

if [ $conflicts -gt 0 ]; then
  echo "$conflicts conflict(s); resolve the markers, then commit with STARTER-LAST-UPDATED" >&2
  exit 1
fi
echo "synced $app to ${commit:0:7}"
