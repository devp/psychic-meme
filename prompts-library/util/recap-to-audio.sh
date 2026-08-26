#!/usr/bin/env bash
# usage: recap.sh <repo-path> <sha-or-pr>...
# engine select: RECAP_TTS_ENGINE=say|gcloud (default gcloud)
set -euo pipefail
repo="$1"; shift
cd "$repo" || exit 1

in="/tmp/transcript.txt"
engine="${RECAP_TTS_ENGINE:-gcloud}"

rm -f "$in"
claude -p "Use the pr-recap skill to generate a recap for: $*" \
  --allowedTools "Skill" "Bash(git *)" "Bash(gh *)" "Write" > /dev/null

[ -s "$in" ] || { echo "empty transcript, aborting" >&2; exit 1; }

mkdir -p "$HOME/recaps"

case "$engine" in
  say)
    out="$HOME/recaps/recap-$(date +%Y%m%d-%H%M).m4a"
    say -f "$in" -o /tmp/recap.aiff --data-format=BEI16@22050
    afconvert /tmp/recap.aiff "$out" -d aac -f mp4f
    ;;
  gcloud)
    out="$HOME/recaps/recap-$(date +%Y%m%d-%H%M).mp3"
    voice="${GOOGLE_TTS_VOICE:-en-US-Neural2-C}"
    lang="${GOOGLE_TTS_LANG:-en-US}"

    # Sync synthesize API caps input around 5000 bytes; long recaps may need chunking.
    payload=$(jq -n --rawfile text "$in" --arg voice "$voice" --arg lang "$lang" \
      '{input: {text: $text}, voice: {languageCode: $lang, name: $voice}, audioConfig: {audioEncoding: "MP3"}}')

    token=$(gcloud auth print-access-token)
    headers=(-H "Authorization: Bearer $token" -H "Content-Type: application/json; charset=utf-8")
    [ -n "${GOOGLE_CLOUD_PROJECT:-}" ] && headers+=(-H "x-goog-user-project: $GOOGLE_CLOUD_PROJECT")

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
