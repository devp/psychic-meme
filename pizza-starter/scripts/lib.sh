# Sourced by sync.sh and drift.sh, after they cd to pizza-starter/. Sets $top,
# $prefix (the starter's app/ path within its repo) and, via resolve_app, $dir.

top=$(git rev-parse --show-toplevel)
prefix=$(git rev-parse --show-prefix)app

# resolve_app <arg> <cwd>: the app dir. <arg> is relative to the starter repo
# root (apps beside the starter), else absolute or relative to <cwd> (an app in
# any other repo, or none).
resolve_app() {
  local arg=$1 cwd=$2 cand
  for cand in "$top/$arg" "$cwd/$arg" "$arg"; do
    [ -d "$cand" ] && { dir=$(cd "$cand" && pwd); return; }
  done
  echo "no app directory $arg" >&2
  exit 1
}

# stamp_field <stamp> <key>
stamp_field() { sed -n "s/^$2: //p" "$1"; }

# starter_remote <stamp>: where to fetch starter commits from. STARTER_REMOTE,
# else the stamp's remote:, else this checkout's origin.
starter_remote() {
  local r=${STARTER_REMOTE:-$(stamp_field "$1" remote)}
  echo "${r:-$(git remote get-url origin 2>/dev/null || true)}"
}

# ensure_tree <tree> <commit> <remote>: make <tree> readable here, fetching
# <commit> if this checkout lacks it (a shallow or newer clone, or the app is
# stamped from a different clone of the starter).
ensure_tree() {
  git cat-file -e "$1^{tree}" 2>/dev/null && return
  if [ -n "$3" ]; then
    local depth=()
    [ "$(git rev-parse --is-shallow-repository)" = true ] && depth=(--depth=1)
    echo "fetching starter commit ${2:0:7} from $3" >&2
    git fetch --quiet ${depth[@]+"${depth[@]}"} "$3" "$2" || true
  fi
  git cat-file -e "$1^{tree}" 2>/dev/null && return
  echo "starter tree ${1:0:7} (commit ${2:0:7}) is not in this checkout and could not be fetched;" >&2
  echo "fetch it, or set STARTER_REMOTE to a clone that has it" >&2
  exit 1
}

# in_repo <dir>: is <dir> inside a git work tree?
in_repo() { git -C "$1" rev-parse --is-inside-work-tree >/dev/null 2>&1; }
