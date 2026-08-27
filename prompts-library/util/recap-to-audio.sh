#!/usr/bin/env bash
# usage: recap.sh <repo-path> <sha-or-pr>...
# engine select: RECAP_TTS_ENGINE=say|gcloud (default gcloud)
set -euo pipefail
repo="$1"; shift
cd "$repo" || exit 1

in="/tmp/transcript.txt"
engine="${RECAP_TTS_ENGINE:-gcloud}"
pause_ms="${RECAP_PAUSE_MS:-1500}"

rm -f "$in"
claude -p "Use the pr-recap skill to generate a recap for: $*" \
  --allowedTools "Skill" "Bash(git *)" "Bash(gh *)" "Write" > /dev/null

[ -s "$in" ] || { echo "empty transcript, aborting" >&2; exit 1; }

mkdir -p "$HOME/recaps"

# Slug for the filename: sha/PR-number args resolve to their subject/title
# (raw SHAs aren't readable), branch/ref names are used as-is.
first_ref="$1"
if [[ "$first_ref" =~ ^[0-9a-f]{7,40}$ || "$first_ref" =~ ^HEAD([~^][0-9]*)*$ ]]; then
  slug_src=$(git log -1 --format=%s "$first_ref" 2>/dev/null || true)
elif [[ "$first_ref" =~ ^[0-9]+$ ]]; then
  slug_src=$(gh pr view "$first_ref" --json title -q '.title' 2>/dev/null || true)
else
  slug_src="$first_ref"
fi
slug=$(printf '%s' "${slug_src:-recap}" | tr '[:upper:]' '[:lower:]' \
  | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//' | cut -c1-50)
[ -n "$slug" ] || slug="recap"
stamp="$(date +%Y%m%d-%H%M)-${slug}"

case "$engine" in
  say)
    out="$HOME/recaps/recap-${stamp}.m4a"
    sed "s/{{PAUSE}}/[[slnc ${pause_ms}]]/g" "$in" > /tmp/recap-say.txt
    say -f /tmp/recap-say.txt -r 165 -o /tmp/recap.aiff --data-format=BEI16@22050
    afconvert /tmp/recap.aiff "$out" -d aac -f mp4f
    ;;
  gcloud)
    out="$HOME/recaps/recap-${stamp}.mp3"
    voice="${GOOGLE_TTS_VOICE:-en-US-Neural2-C}"
    lang="${GOOGLE_TTS_LANG:-en-US}"
    project="${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
    # Sync text:synthesize hard-caps input.ssml at 5000 bytes. Split the
    # transcript into sub-limit chunks (prefer {{PAUSE}} / paragraph / sentence
    # boundaries), synth each, then concat the MP3s. Budget under 5000 leaves
    # headroom for the <speak> wrapper and <break> tag expansion.
    chunk_bytes="${RECAP_TTS_CHUNK_BYTES:-4000}"
    chunk_pfx="/tmp/recap-chunk-"

    token=$(gcloud auth print-access-token)
    headers=(-H "Authorization: Bearer $token" -H "Content-Type: application/json; charset=utf-8")
    [ -n "$project" ] && headers+=(-H "x-goog-user-project: $project")

    rm -f "${chunk_pfx}"*.txt /tmp/recap-part-*.mp3

    # awk writes each chunk to its own zero-padded file (BSD awk can't emit NUL,
    # so no read -d '' pipeline). LC_ALL=C makes length() count bytes.
    LC_ALL=C awk -v lim="$chunk_bytes" -v pfx="$chunk_pfx" '
      BEGIN { RS = ""; buf = ""; k = 0 }
      function emit(   f) {
        if (buf == "") return
        f = sprintf("%s%03d.txt", pfx, ++k)
        printf "%s", buf > f; close(f); buf = ""
      }
      function add(t,   n, i, s, p) {
        if (buf != "" && length(buf) + length(t) > lim) emit()
        if (length(t) > lim) {
          n = split(t, p, /\. /)
          for (i = 1; i <= n; i++) {
            s = p[i]; if (i < n) s = s ". "
            if (buf != "" && length(buf) + length(s) > lim) emit()
            buf = buf s
          }
        } else {
          buf = buf t
        }
      }
      {
        m = split($0, segs, /\{\{PAUSE\}\}/)
        for (j = 1; j <= m; j++) {
          add(segs[j])
          if (j < m) add(" {{PAUSE}} ")
        }
        add("\n\n")
      }
      END { emit() }
    ' "$in"

    parts=()
    idx=0
    for cf in "${chunk_pfx}"*.txt; do
      [ -e "$cf" ] || { echo "chunker produced no output, aborting" >&2; exit 1; }
      idx=$((idx + 1))
      ssml=$(sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' "$cf" \
        | sed "s|{{PAUSE}}|<break time=\"${pause_ms}ms\"/>|g")
      ssml="<speak>${ssml}</speak>"

      payload=$(jq -n --arg ssml "$ssml" --arg voice "$voice" --arg lang "$lang" \
        '{input: {ssml: $ssml}, voice: {languageCode: $lang, name: $voice},
          audioConfig: {audioEncoding: "MP3", speakingRate: 0.92,
                         effectsProfileId: ["headphone-class-device"]}}')

      resp=$(curl -sS -X POST "${headers[@]}" -d "$payload" \
        "https://texttospeech.googleapis.com/v1/text:synthesize")

      audio=$(jq -r '.audioContent // empty' <<< "$resp")
      [ -n "$audio" ] || { echo "TTS request failed (chunk $idx): $(jq -c '.error // .' <<< "$resp")" >&2; exit 1; }

      part="/tmp/recap-part-${idx}.mp3"
      base64 -D <<< "$audio" > "$part"
      parts+=("$part")
    done
    rm -f "${chunk_pfx}"*.txt

    [ "${#parts[@]}" -gt 0 ] || { echo "no audio produced, aborting" >&2; exit 1; }

    if [ "${#parts[@]}" -eq 1 ]; then
      mv "${parts[0]}" "$out"
    elif command -v ffmpeg >/dev/null 2>&1; then
      list=/tmp/recap-concat.txt; : > "$list"
      for p in "${parts[@]}"; do printf "file '%s'\n" "$p" >> "$list"; done
      ffmpeg -y -f concat -safe 0 -i "$list" -c copy "$out" >/dev/null 2>&1
      rm -f "$list" "${parts[@]}"
    else
      cat "${parts[@]}" > "$out"
      rm -f "${parts[@]}"
    fi
    ;;
  *)
    echo "unknown RECAP_TTS_ENGINE: $engine (want say|gcloud)" >&2
    exit 1
    ;;
esac

dest_dir="$(dirname "$out")"
if [ -x "$dest_dir/.hooks/reindex.sh" ]; then
  "$dest_dir/.hooks/reindex.sh" "$dest_dir"
fi

echo "$out"
