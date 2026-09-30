#!/usr/bin/env bash
# Diff a copied app against the starter tree in its STARTER stamp. Committed
# state only (HEAD). Extra args go to git diff; default --stat.
#
#   scripts/drift.sh <app> [git-diff-args...]    # app is relative to the repo root
set -euo pipefail
cd "$(dirname "$0")/.."

app=${1:?usage: drift.sh <app> [git-diff-args...]}
shift
[ $# -eq 0 ] && set -- --stat
top=$(git rev-parse --show-toplevel)
prefix=$(git rev-parse --show-prefix)app

tree=$(sed -n 's/^tree: //p' "$top/$app/STARTER")
[ -n "$tree" ] || { echo "no tree: line in $app/STARTER" >&2; exit 1; }

echo "== starter since copy ($prefix)"
git --no-pager diff "$@" "$tree" "HEAD:$prefix"
echo "== $app since copy"
git --no-pager diff "$@" "$tree" "HEAD:$app"
