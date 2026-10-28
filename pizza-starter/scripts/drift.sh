#!/usr/bin/env bash
# Diff a copied app against the starter tree it last took: STARTER-LAST-UPDATED
# (written by sync.sh), else STARTER. The app side is its working tree, so
# uncommitted edits show; files its .gitignore covers do not. Extra args go to
# git diff; default --stat.
#
#   scripts/drift.sh <app> [git-diff-args...]    # app: relative to the repo root, or any path
#
# The app can be in another repo; see sync.sh for where the stamp's commit comes from.
set -euo pipefail
cwd=$PWD
cd "$(dirname "$0")/.."
. scripts/lib.sh

app=${1:?usage: drift.sh <app> [git-diff-args...]}
shift
resolve_app "$app" "$cwd"
[ $# -gt 0 ] || set -- --stat

stamp=$dir/STARTER-LAST-UPDATED
[ -f "$stamp" ] || stamp=$dir/STARTER
tree=$(stamp_field "$stamp" tree)
[ -n "$tree" ] || { echo "no tree: line in $stamp" >&2; exit 1; }
ensure_tree "$tree" "$(stamp_field "$stamp" commit)" "$(starter_remote "$stamp")"

name=$(basename "$stamp")
echo "== starter since $name ($prefix)"
git --no-pager diff "$@" "$tree" "HEAD:$prefix"
echo "== $(basename "$dir") since $name"
# Stage the app's files into a throwaway index (and object dir) and diff that
# against the stamp tree: needs nothing from the app's own repo.
gitdir=$(git rev-parse --absolute-git-dir)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
export GIT_INDEX_FILE=$tmp/index GIT_OBJECT_DIRECTORY=$tmp/objects
export GIT_ALTERNATE_OBJECT_DIRECTORIES=$gitdir/objects GIT_DIR=$gitdir GIT_WORK_TREE=$dir
mkdir "$tmp/objects"
cd "$dir"
git read-tree "$tree"
git add -A .
git --no-pager diff --cached "$@" "$tree"
