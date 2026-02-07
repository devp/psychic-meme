#!/usr/bin/env bash
# weatherstar.sh — build and run the WeatherStar 4000 console display
#
# Usage:
#   ./weatherstar.sh              # build + run in terminal
#   ./weatherstar.sh --screenshot # build + save screenshot.png (no ANSI)
#   ./weatherstar.sh --clean      # remove build artifacts

set -euo pipefail
cd "$(dirname "$0")"

case "${1:-run}" in
    --clean)
        rm -f weatherstar screenshot.png
        echo "Cleaned."
        ;;
    --screenshot)
        make -s screenshot
        ;;
    *)
        make -s
        exec ./weatherstar "$@"
        ;;
esac
