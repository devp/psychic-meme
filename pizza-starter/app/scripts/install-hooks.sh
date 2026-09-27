#!/usr/bin/env bash
# Install a pre-push hook that runs `warnings.sh --strict`. The hook is
# repo-wide: in a monorepo it gates every push. Bypass once: git push --no-verify
set -euo pipefail
cd "$(dirname "$0")/.."

prefix=$(git rev-parse --show-prefix)
hook="$(git rev-parse --git-path hooks)/pre-push"

if [ -e "$hook" ] && ! grep -q 'installed by scripts/install-hooks.sh' "$hook"; then
  echo "refusing to overwrite existing $hook" >&2
  exit 1
fi

mkdir -p "$(dirname "$hook")"
cat >"$hook" <<HOOK
#!/bin/sh
# installed by scripts/install-hooks.sh. Bypass: git push --no-verify
exec "\$(git rev-parse --show-toplevel)/${prefix}scripts/warnings.sh" --strict
HOOK
chmod +x "$hook"
echo "installed $hook"
