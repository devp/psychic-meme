#!/usr/bin/env bash
# usage: recap.sh <repo-path> <sha-or-pr>...
set -euo pipefail
repo="$1"; shift
cd "$repo" || exit 1

in="/tmp/transcript.txt"
out="$HOME/recaps/recap-$(date +%Y%m%d-%H%M).m4a"

rm -f "$in"
claude -p "Use the pr-recap skill to generate a recap for: $*" \
  --allowedTools "Skill" "Bash(git *)" "Bash(gh *)" "Write" > /dev/null

[ -s "$in" ] || { echo "empty transcript, aborting" >&2; exit 1; }

mkdir -p "$(dirname "$out")"
say -f "$in" -o /tmp/recap.aiff --data-format=LEI16@22050
afconvert /tmp/recap.aiff "$out" -d aac -f mp4f
echo "$out"
