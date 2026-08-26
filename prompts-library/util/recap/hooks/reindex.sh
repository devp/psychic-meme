#!/usr/bin/env bash
# regenerate feed.xml + index.html for a recap output dir.
# symlink this file to <dest>/.hooks/reindex.sh; recap-to-audio.sh runs it
# after each recap. dest dir defaults to the symlink's own parent-of-.hooks,
# or pass it explicitly as $1.
# env: RECAP_FEED_BASE_URL (default: auto-detect LAN IP, assumes Apache
#   DocumentRoot == this dir), RECAP_FEED_TITLE
set -euo pipefail

dest="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$dest" || exit 1

lan_ip() {
  for ifc in en0 en1; do
    ipconfig getifaddr "$ifc" 2>/dev/null && return
  done
}
base_url="${RECAP_FEED_BASE_URL:-}"
if [ -z "$base_url" ]; then
  ip="$(lan_ip)"
  [ -n "$ip" ] && base_url="http://${ip}/$(basename "$dest")/"
fi
title="${RECAP_FEED_TITLE:-Recaps}"

xml_esc() { sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'; }
html_esc() { xml_esc; }

# stamp comes from the filename (recap-YYYYMMDD-HHMM-slug.ext), not mtime:
# mtime gets rewritten by sync/backup tools and plain cp, filename doesn't.
stamp_epoch() {
  local ts="${1#recap-}"
  if [[ "$ts" =~ ^([0-9]{8})-([0-9]{4}) ]]; then
    date -j -f '%Y%m%d%H%M' "${BASH_REMATCH[1]}${BASH_REMATCH[2]}" '+%s' 2>/dev/null && return
  fi
  stat -f '%m' "$1"
}

# filenames are our own output (recap-*, no spaces) so plain newline sort is safe
files=()
while IFS= read -r f; do files+=("$f"); done < <(
  for f in *.mp3 *.m4a; do
    [ -e "$f" ] || continue
    printf '%s %s\n' "$(stamp_epoch "$f")" "$f"
  done | sort -rn | cut -d' ' -f2-
)

{
  echo '<?xml version="1.0" encoding="UTF-8"?>'
  echo '<rss version="2.0"><channel>'
  echo "<title>$(printf '%s' "$title" | xml_esc)</title>"
  echo "<link>${base_url}</link>"
  echo '<description>Audio recaps</description>'
  for f in "${files[@]}"; do
    name="$(basename "$f")"
    esc_name="$(printf '%s' "$name" | xml_esc)"
    url="${base_url}${name}"
    size=$(stat -f '%z' "$f")
    pubdate=$(date -r "$(stamp_epoch "$name")" -u '+%a, %d %b %Y %H:%M:%S GMT')
    case "$name" in
      *.m4a) mime="audio/mp4" ;;
      *) mime="audio/mpeg" ;;
    esac
    echo '<item>'
    echo "<title>${esc_name}</title>"
    echo "<guid isPermaLink=\"false\">${esc_name}</guid>"
    echo "<pubDate>${pubdate}</pubDate>"
    echo "<enclosure url=\"$(printf '%s' "$url" | xml_esc)\" length=\"${size}\" type=\"${mime}\"/>"
    echo '</item>'
  done
  echo '</channel></rss>'
} > feed.xml

{
  echo '<!doctype html><html><head>'
  echo "<meta charset=\"utf-8\"><title>$(printf '%s' "$title" | html_esc)</title>"
  echo '<meta name="viewport" content="width=device-width, initial-scale=1">'
  echo '<link rel="alternate" type="application/rss+xml" title="Recaps" href="feed.xml">'
  echo '</head><body>'
  echo "<h1>$(printf '%s' "$title" | html_esc)</h1>"
  echo '<p><a href="feed.xml">RSS feed</a></p>'
  echo '<ul>'
  for f in "${files[@]}"; do
    name="$(basename "$f")"
    esc_name="$(printf '%s' "$name" | html_esc)"
    echo "<li><a href=\"${esc_name}\">${esc_name}</a></li>"
  done
  echo '</ul>'
  echo '</body></html>'
} > index.html
