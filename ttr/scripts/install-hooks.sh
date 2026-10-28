#!/usr/bin/env bash
# Add this app's `warnings.sh --strict` to the repo's pre-push hook. Idempotent;
# appends, so other apps' lines and existing hooks stay. The hook is repo-wide:
# in a monorepo it gates every push. Bypass once: git push --no-verify
set -euo pipefail
cd "$(dirname "$0")/.."

prefix=$(git rev-parse --show-prefix)
hook="$(git rev-parse --git-path hooks)/pre-push"
line="\"\$(git rev-parse --show-toplevel)/${prefix}scripts/warnings.sh\" --strict || exit 1"

if [ -f "$hook" ] && grep -qxF "$line" "$hook"; then
  echo "already in $hook"
  exit 0
fi

mkdir -p "$(dirname "$hook")"
[ -f "$hook" ] || echo '#!/bin/sh' >"$hook"
grep -q '^[[:space:]]*exec ' "$hook" && echo "warning: $hook has an exec line; lines after it never run" >&2
echo "$line" >>"$hook"
chmod +x "$hook"
echo "added ${prefix:-./} to $hook"
