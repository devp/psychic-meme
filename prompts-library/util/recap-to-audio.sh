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

    # Sync synthesize API caps input around 5000 bytes; long recaps may need chunking.
    ssml=$(sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' "$in" \
      | sed "s|{{PAUSE}}|<break time=\"${pause_ms}ms\"/>|g")
    ssml="<speak>${ssml}</speak>"

    payload=$(jq -n --arg ssml "$ssml" --arg voice "$voice" --arg lang "$lang" \
      '{input: {ssml: $ssml}, voice: {languageCode: $lang, name: $voice},
        audioConfig: {audioEncoding: "MP3", speakingRate: 0.92,
                       effectsProfileId: ["headphone-class-device"]}}')

    token=$(gcloud auth print-access-token)
    headers=(-H "Authorization: Bearer $token" -H "Content-Type: application/json; charset=utf-8")
    [ -n "$project" ] && headers+=(-H "x-goog-user-project: $project")

    resp=$(curl -sS -X POST "${headers[@]}" -d "$payload" \
      "https://texttospeech.googleapis.com/v1/text:synthesize")

    audio=$(jq -r '.audioContent // empty' <<< "$resp")
    [ -n "$audio" ] || { echo "TTS request failed: $(jq -c '.error // .' <<< "$resp")" >&2; exit 1; }

    base64 -D <<< "$audio" > "$out"
    ;;
  *)
    echo "unknown RECAP_TTS_ENGINE: $engine (want say|gcloud)" >&2
    exit 1
    ;;
esac

echo "$out"
