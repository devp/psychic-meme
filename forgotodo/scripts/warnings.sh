#!/usr/bin/env bash
# Grep-level checks for footguns that typecheck and tests don't catch.
# No node_modules needed. Silence a finding with `warn-ok: <rule>` on the line
# or the line above.
#
#   scripts/warnings.sh [--strict] [root]    # --strict exits 1 on any finding
set -uo pipefail

strict=0
[ "${1:-}" = "--strict" ] && { strict=1; shift; }
root="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$root" || exit 2

findings=$(mktemp)
trap 'rm -f "$findings"' EXIT
hit() { # rule file line message; loops below run in subshells, so record to a file
  local rule=$1 file=$2 line=$3 msg=$4 prev=$(( $3 > 1 ? $3 - 1 : 1 ))
  if sed -n "${prev},${line}p" "$file" 2>/dev/null | grep -q "warn-ok: $rule"; then return; fi
  echo "warn[$rule] $file:$line: $msg" | tee -a "$findings"
}

md5of() { if command -v md5 >/dev/null; then md5 -q "$1"; else md5sum "$1" | cut -d' ' -f1; fi; }

app_files() { # same set as scripts/build-precache.mjs
  find . -type f \( -name '*.html' -o -name '*.css' -o -name '*.js' -o -name '*.webmanifest' -o -name '*.svg' \) \
    -not -path './node_modules/*' -not -path './scripts/*' -not -path './tests/*' \
    -not -name 'sw.js' -not -name 'precache-manifest.js' | sed 's#^\./##' | sort
}
app_js() { app_files | grep -E '\.js$' | grep -v '^vendor/'; }

# precache-stale: manifest must list every app file with its current md5.
if [ -f precache-manifest.js ]; then
  entries=$(sed -n 's/.*"url": "\(.*\)".*/\1/p' precache-manifest.js)
  for f in $(app_files); do
    echo "$entries" | grep -qx "$f" || hit precache-stale precache-manifest.js 1 "$f missing — run just dev-rebuild"
  done
  for url in $entries; do
    rev=$(grep -A1 "\"url\": \"$url\"" precache-manifest.js | sed -n 's/.*"revision": "\(.*\)".*/\1/p')
    if [ ! -f "$url" ]; then
      hit precache-stale precache-manifest.js 1 "$url listed but not on disk — run just dev-rebuild"
    elif [ "$rev" != "$(md5of "$url")" ]; then
      hit precache-stale precache-manifest.js 1 "$url changed — run just dev-rebuild"
    fi
  done
fi

# import-script-missing: importScripts() targets must exist.
[ -f sw.js ] && grep -n 'importScripts(' sw.js | while IFS=: read -r n text; do
  for p in $(echo "$text" | grep -oE '"[^"]+"' | tr -d '"'); do
    [ -f "$p" ] || hit import-script-missing sw.js "$n" "$p does not exist"
  done
done

# element-undefined: custom element tags in HTML need a define() call.
defined=$(app_js | xargs grep -ohE 'define\("[a-z][a-z0-9]*-[a-z0-9-]*"' 2>/dev/null | sed 's/define("//; s/"//')
for html in $(app_files | grep -E '\.html$'); do
  grep -noE '<[a-z][a-z0-9]*-[a-z0-9-]*' "$html" | while IFS=: read -r n tag; do
    tag=${tag#<}
    echo "$defined" | grep -qx "$tag" || echo "$html:$n:$tag"
  done
done | sort -u -t: -k3,3 | while IFS=: read -r f n tag; do
  hit element-undefined "$f" "$n" "<$tag> is never passed to customElements.define"
done

# bare-import-unmapped: bare specifiers need an import map entry.
keys=$(grep -hoE '"[^"]+":' index.html 2>/dev/null | tr -d '":')
for f in $(app_js); do
  grep -noE 'from "[^./][^"]*"' "$f" | while IFS=: read -r n text; do
    spec=${text#from \"}; spec=${spec%\"}
    mapped=0
    for k in $keys; do
      if [ "$k" = "$spec" ] || { [ "${k%/}" != "$k" ] && [ "${spec#"$k"}" != "$spec" ]; }; then mapped=1; fi
    done
    [ $mapped = 1 ] || hit bare-import-unmapped "$f" "$n" "\"$spec\" has no import map entry in index.html"
  done
done

# class-field-shadow: a class field named like a reactive property shadows its accessor.
for f in $(app_js); do
  props=$(grep -oE 'static properties = \{[^}]*\}' "$f" | grep -oE '[A-Za-z_]+:' | tr -d ':')
  for p in $props; do
    grep -nE "^  $p( =|;)" "$f" | while IFS=: read -r n _; do
      hit class-field-shadow "$f" "$n" "field \`$p\` shadows the reactive accessor; assign it in the constructor"
    done
  done
done

# subscribe-no-teardown: fine only if the element is never removed or moved.
for f in $(app_js | grep '^components/'); do
  if ! grep -qE 'disconnectedCallback|unsubscribe' "$f"; then
    grep -nE '\.subscribe\(' "$f" | while IFS=: read -r n _; do
      hit subscribe-no-teardown "$f" "$n" "subscribes without teardown; removing or moving the element leaks and double-subscribes"
    done
  fi
done

# localstorage-direct: throws in private mode; go through lib/store.js.
for f in $(app_js | grep -v '^lib/store\.js$'); do
  grep -nE 'localStorage\.' "$f" | while IFS=: read -r n _; do
    hit localstorage-direct "$f" "$n" "use lib/store.js (it guards against a throwing localStorage)"
  done
done

# innerhtml-assign: interpolating into innerHTML needs manual escaping.
for f in $(app_js); do
  grep -nE '\.innerHTML[[:space:]]*=' "$f" | while IFS=: read -r n _; do
    hit innerhtml-assign "$f" "$n" "innerHTML assignment; escape interpolated values or use a template"
  done
done

# load-after-await: top-level await defers a module past the load event.
for f in $(app_js); do
  if grep -qE '^(const|let|var)?[^/]*\bawait\b' "$f" && grep -q 'addEventListener("load"' "$f" && ! grep -q 'readyState' "$f"; then
    n=$(grep -n 'addEventListener("load"' "$f" | head -1 | cut -d: -f1)
    hit load-after-await "$f" "$n" "load listener in a module with top-level await never fires; check document.readyState first"
  fi
done

# shell-100vh: the layout viewport doesn't shrink for the mobile keyboard.
for f in $(app_files | grep -E '\.css$'); do
  grep -nE '100d?vh' "$f" | grep -v -- '--app-height' | while IFS=: read -r n _; do
    hit shell-100vh "$f" "$n" "use var(--app-height, 100dvh) with syncAppHeight()"
  done
done

# input-font-size: under 16px, iOS zooms the page on focus.
for f in $(app_files | grep -E '\.css$'); do
  awk '/\{/ { sel=$0 }
       sel ~ /(input|textarea|select)/ && match($0, /font-size:[[:space:]]*[0-9]+px/) {
         px=substr($0, RSTART, RLENGTH); gsub(/[^0-9]/, "", px); if (px+0 < 16) print NR
       }
       /\}/ { sel="" }' "$f" | while read -r n; do
    hit input-font-size "$f" "$n" "font-size under 16px on an input makes iOS zoom on focus"
  done
done

count=$(wc -l <"$findings" | tr -d ' ')
echo "warnings: $count"
[ $strict = 1 ] && [ $count -gt 0 ] && exit 1
exit 0
