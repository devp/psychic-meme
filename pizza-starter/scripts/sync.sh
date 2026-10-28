#!/usr/bin/env bash
# Merge the starter's committed changes to CORE files into a copied app, and
# stamp the app with STARTER-LAST-UPDATED. Each file is a 3-way merge from the
# last stamp (else STARTER), so the app's own edits survive; a conflict is left
# as markers. Non-core files that changed upstream are listed, not touched.
#
#   scripts/sync.sh <app>    # app: relative to the repo root, or any path
#
# The app can be in another repo: the stamp's commit is fetched from its
# remote: (or STARTER_REMOTE, or this checkout's origin) if it is missing here.
set -euo pipefail
cwd=$PWD
cd "$(dirname "$0")/.."
. scripts/lib.sh

app=${1:?usage: sync.sh <app>}
resolve_app "$app" "$cwd"

[ -f "$dir/STARTER" ] || { echo "no $app/STARTER; not a copy of the starter" >&2; exit 1; }
if [ -n "$(git status --porcelain -- app CORE)" ]; then
  echo "starter app/ or CORE has uncommitted changes; commit them first" >&2
  exit 1
fi
if in_repo "$dir" && [ -n "$(git -C "$dir" status --porcelain -- .)" ]; then
  echo "$app has uncommitted changes; commit them first so the merge is reviewable" >&2
  exit 1
fi

stamp=$dir/STARTER-LAST-UPDATED
[ -f "$stamp" ] || stamp=$dir/STARTER
base=$(stamp_field "$stamp" tree)
remote=$(starter_remote "$stamp")
ensure_tree "$base" "$(stamp_field "$stamp" commit)" "$remote"
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
  if git merge-file -L "$(basename "$dir")" -L "starter@${base:0:7}" -L "starter@${commit:0:7}" "$ours" "$tmp/base" "$tmp/theirs"; then
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

if [ "$(stamp_field "$dir/STARTER-LAST-UPDATED" tree 2>/dev/null)" != "$tree" ]; then
  cat >"$dir/STARTER-LAST-UPDATED" <<STAMP
from: $prefix
${remote:+remote: $remote
}commit: $commit
tree: $tree
updated: $(date +%Y-%m-%d)
STAMP
fi

if [ $conflicts -gt 0 ]; then
  echo "$conflicts conflict(s); resolve the markers, then commit with STARTER-LAST-UPDATED" >&2
  exit 1
fi
echo "synced $app to ${commit:0:7}"
