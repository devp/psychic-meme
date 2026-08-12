#!/usr/bin/env bash
#
# Build KioskBrowser.app from the SPM executable target.
#
# Usage:
#   ./build.sh                              universal (arm64 + x86_64) release build
#   ./build.sh --native                     host architecture only (faster)
#   ./build.sh --debug                      debug build (allows DevTools per config)
#   ./build.sh --lsuielement                hide the Dock icon / cmd-tab entry
#   ./build.sh --config path/to.json        embed a different default config
#   ./build.sh --sign "Developer ID Application: Acme (TEAMID)"
#   ./build.sh --output /tmp/build          where the .app is written (default: ./build)
#
# Output: <output>/KioskBrowser.app
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

APP_NAME="KioskBrowser"
CONFIGURATION="release"
OUTPUT_DIR="$SCRIPT_DIR/build"
CONFIG_JSON="$SCRIPT_DIR/Resources/kiosk.config.json"
SIGN_IDENTITY="-"          # ad-hoc; pass --sign for a real Developer ID
UNIVERSAL=1
LSUIELEMENT=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --native)      UNIVERSAL=0; shift ;;
    --debug)       CONFIGURATION="debug"; shift ;;
    --lsuielement) LSUIELEMENT=1; shift ;;
    --config)      CONFIG_JSON="$2"; shift 2 ;;
    --sign)        SIGN_IDENTITY="$2"; shift 2 ;;
    --output)      OUTPUT_DIR="$2"; shift 2 ;;
    -h|--help)     sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "build.sh: unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "build.sh: KioskBrowser links AppKit and WebKit, so it builds on macOS only." >&2
  echo "          (There is no cross-compilation path: the macOS SDK ships with Xcode.)" >&2
  exit 1
fi

if ! command -v swift >/dev/null 2>&1; then
  echo "build.sh: no 'swift' on PATH — install Xcode or the Command Line Tools." >&2
  exit 1
fi

if [[ ! -f "$CONFIG_JSON" ]]; then
  echo "build.sh: config file not found: $CONFIG_JSON" >&2
  exit 1
fi

BUILD_ARGS=(--configuration "$CONFIGURATION")
if [[ "$UNIVERSAL" -eq 1 ]]; then
  BUILD_ARGS+=(--arch arm64 --arch x86_64)
fi

echo "==> swift build ${BUILD_ARGS[*]}"
swift build "${BUILD_ARGS[@]}"

BIN_PATH="$(swift build "${BUILD_ARGS[@]}" --show-bin-path)"
EXECUTABLE="$BIN_PATH/$APP_NAME"
if [[ ! -f "$EXECUTABLE" ]]; then
  echo "build.sh: expected executable not found at $EXECUTABLE" >&2
  exit 1
fi

APP_BUNDLE="$OUTPUT_DIR/$APP_NAME.app"
echo "==> assembling $APP_BUNDLE"
rm -rf "$APP_BUNDLE"
mkdir -p "$APP_BUNDLE/Contents/MacOS" "$APP_BUNDLE/Contents/Resources"

cp "$EXECUTABLE" "$APP_BUNDLE/Contents/MacOS/$APP_NAME"
cp "$SCRIPT_DIR/Info.plist" "$APP_BUNDLE/Contents/Info.plist"
cp "$CONFIG_JSON" "$APP_BUNDLE/Contents/Resources/kiosk.config.json"
printf 'APPL????' > "$APP_BUNDLE/Contents/PkgInfo"

if [[ "$LSUIELEMENT" -eq 1 ]]; then
  /usr/libexec/PlistBuddy -c "Set :LSUIElement true" "$APP_BUNDLE/Contents/Info.plist"
  echo "==> LSUIElement=true (no Dock icon, no cmd-tab entry)"
fi

# Ad-hoc signing is enough for a machine you control; a fleet wants a real
# Developer ID plus notarization, or Gatekeeper will quarantine the copy that
# lands on the kiosk.
echo "==> codesign (identity: $SIGN_IDENTITY)"
if [[ "$SIGN_IDENTITY" == "-" ]]; then
  # No timestamp server round-trip for an ad-hoc signature; notarization is not
  # in play, and this keeps the build working on an offline machine.
  TIMESTAMP_ARG="--timestamp=none"
else
  # Developer ID signatures need a secure timestamp or notarization rejects them.
  TIMESTAMP_ARG="--timestamp"
fi
codesign --force "$TIMESTAMP_ARG" --options runtime \
  --sign "$SIGN_IDENTITY" "$APP_BUNDLE"
codesign --verify --verbose=2 "$APP_BUNDLE"

echo
echo "Built $APP_BUNDLE"
echo "Run it:   open -a \"$APP_BUNDLE\" --args --url=https://example.com"
echo "Test it:  open -a \"$APP_BUNDLE\" --args --fullscreen=false --keep-system-ui=true \\"
echo "               --url=file://$SCRIPT_DIR/TestPage/kiosk-test.html"
