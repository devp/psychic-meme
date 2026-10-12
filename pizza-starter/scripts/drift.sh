#!/usr/bin/env bash
# Diff a copied app against the starter tree it last took: STARTER-LAST-UPDATED
# (written by sync.sh), else STARTER. Committed state only (HEAD). Extra args
# go to git diff; default --stat.
#
#   scripts/drift.sh <app> [git-diff-args...]    # app is relative to the repo root
set -euo pipefail
cd "$(dirname "$0")/.."

app=${1:?usage: drift.sh <app> [git-diff-args...]}
shift
[ $# -eq 0 ] && set -- --stat
top=$(git rev-parse --show-toplevel)
prefix=$(git rev-parse --show-prefix)app

stamp=$app/STARTER-LAST-UPDATED
[ -f "$top/$stamp" ] || stamp=$app/STARTER
tree=$(sed -n 's/^tree: //p' "$top/$stamp")
[ -n "$tree" ] || { echo "no tree: line in $stamp" >&2; exit 1; }

echo "== starter since $stamp ($prefix)"
git --no-pager diff "$@" "$tree" "HEAD:$prefix"
echo "== $app since $stamp"
git --no-pager diff "$@" "$tree" "HEAD:$app"
