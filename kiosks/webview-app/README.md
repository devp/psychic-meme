# kiosk-webview

A single-purpose macOS kiosk browser: one URL, one window, no tabs, no toolbar,
no DevTools. `surf` in spirit, `WKWebView` in fact — no GTK, no Homebrew, no
dependency chain beyond the system frameworks.

Implementation of [`kiosk-webview-spec.md`](kiosk-webview-spec.md). The spec is
the design document; this README is how you build and run the thing.

**Status:** builds have to happen on a Mac — AppKit and WebKit only exist in the
macOS SDK — and this tree has not been through a macOS toolchain yet. Treat the
[testing checklist](#testing) as outstanding rather than passed.

## Layout

```
KioskBrowser/
├── Package.swift                          SPM executable, no dependencies
├── Info.plist                             bundle keys (LSUIElement, min OS)
├── build.sh                               builds KioskBrowser.app
├── Sources/KioskBrowser/
│   ├── main.swift                         entry point + keyboard lockdown
│   ├── AppDelegate.swift                  owns the window controller, menu
│   ├── KioskWindowController.swift        chrome-less window
│   ├── KioskWebViewController.swift       WKWebView + UI/navigation delegates
│   ├── Config.swift                       Codable config, CLI parsing, hotkeys
│   └── NavigationPolicy.swift             every allow/deny decision
├── Resources/kiosk.config.json            default config, embedded in the bundle
├── TestPage/kiosk-test.html               manual test page for §11
└── deploy/…kioskbrowser.plist             LaunchAgent example
```

## Build

```sh
cd KioskBrowser
./build.sh                    # universal release build → build/KioskBrowser.app
./build.sh --lsuielement      # + no Dock icon, no cmd-tab entry (kiosk default)
./build.sh --sign "Developer ID Application: Acme (TEAMID)"
```

Requires macOS 12+ and Xcode or the Command Line Tools (Swift 5.7+). The default
signature is ad-hoc, which is fine for a machine you control; a fleet wants a
real Developer ID and notarization, or Gatekeeper will quarantine the copy that
lands on the kiosk.

`swift run` also works for a quick loop, but without a bundle there is no
`kiosk.config.json` to find — pass `--url=` on the command line.

## Configure

Load order, last one wins: compiled-in defaults → JSON file → CLI arguments.
The JSON file is `--config=/path/to.json` if given, otherwise
`kiosk.config.json` from the app bundle. Every key is optional.

```json
{
  "url": "https://example.com/kiosk",
  "allowedHosts": ["example.com"],
  "allowExternalInSystemBrowser": false,
  "persistCookies": true,
  "fullscreen": true,
  "resizable": false,
  "reloadOnFailureSeconds": 5,
  "allowDevToolsInDebugBuilds": false,
  "quitHotkey": "cmd+opt+shift+Q"
}
```

| Key | Default | What it does |
| --- | --- | --- |
| `url` | `about:blank` | Home URL. Loaded at launch, and returned to on failure or `window.close()`. |
| `allowedHosts` | `[]` | Exact-or-subdomain allowlist. Empty means unrestricted navigation within the one window. |
| `allowExternalInSystemBrowser` | `false` | Hand blocked `http(s)` URLs to the system default browser instead of swallowing them. |
| `persistCookies` | `true` | `false` → non-persistent data store; every relaunch is a clean session. |
| `fullscreen` | `true` | Borderless window pinned to the screen frame, menu bar and Dock auto-hidden. |
| `resizable` | `false` | Only meaningful when `fullscreen` is false. |
| `reloadOnFailureSeconds` | `5` | Delay before retrying the home URL after a load failure. `0` disables retries. |
| `reloadMaxAttempts` | `0` | `0` = retry forever. |
| `reloadBackoffMultiplier` | `1.5` | Applied per consecutive failure, capped at 60s. |
| `allowDevToolsInDebugBuilds` | `false` | DEBUG builds only, macOS 13.3+. Release builds never set `isInspectable`. |
| `quitHotkey` | `cmd+opt+shift+Q` | Maintenance quit gesture. Unparseable values disable quitting by hotkey. |
| `allowContentJavaScript` | `true` | Off for static signage that doesn't need JS. |
| `allowDownloads` | `false` | Off means download responses are cancelled — no save panel, no Finder. |
| `openNewWindowLinksInPlace` | `true` | `target="_blank"` and friends load in the same webview if the destination passes the allowlist; `false` drops them. |
| `showJavaScriptDialogs` | `false` | Off auto-dismisses alert/confirm/prompt so a page can't hang the kiosk or show OS chrome. |
| `allowReloadHotkey` | `true` | cmd-R reloads the home URL. |
| `allowReloadContextMenu` | `false` | `true` gives a right-click menu with exactly one item: Reload. |
| `keepSystemUIVisible` | `false` | Development escape hatch: don't auto-hide the Dock and menu bar. |

CLI overrides, for LaunchAgent plists and quick tests: `--config=`, `--url=`,
`--allowed-hosts=a.com,b.com`, `--fullscreen=`, `--resizable=`,
`--persist-cookies=`, `--allow-downloads=`, `--keep-system-ui=`,
`--reload-on-failure-seconds=`.

A missing or malformed `--config=` path exits non-zero at launch. A config whose
`url` doesn't parse renders an error page in the window rather than showing a
kiosk that is silently blank.

## What actually enforces the lockdown

- **No second window, ever.** `WKUIDelegate.createWebViewWith…` returns `nil`
  unconditionally, so there is nothing for `target="_blank"`, `window.open()`,
  cmd-click or middle-click to materialise into. The navigation delegate also
  cancels every action whose `targetFrame` is `nil`, and (by default) reloads the
  destination in place when it passes the allowlist.
- **No tab bar.** `window.tabbingMode = .disallowed`, unconditionally.
- **No navigation off the allowlist.** All decisions live in
  `NavigationPolicy`. Non-web schemes (`mailto:`, `tel:`, third-party app
  schemes) are denied outright — each one launches another application, which is
  the thing a kiosk exists to prevent. `file:` is allowed only when the home URL
  is itself a `file:` URL.
- **No DevTools, no view-source, no "Open in New Window".** The context menu is
  emptied in `willOpenMenu(_:with:)`; `isInspectable` is only ever touched in
  DEBUG builds.
- **No downloads, no file pickers, no JS dialogs** unless configured on.
- **Self-healing.** Load failures retry with backoff; a terminated web content
  process reloads the home URL.
- **Keyboard.** `KioskApplication.sendEvent` swallows cmd-N/T/W/M/H/Q/O/S/P/D,
  cmd-comma, F11 and ctrl-cmd-F before AppKit sees them.

## Deployment

The spec's §7 caveat, repeated because it matters: **this is deterrence, not a
security boundary.** cmd-opt-esc (Force Quit), cmd-tab, cmd-space and the
screenshot hotkeys are handled by the window server before any application sees
the keystroke, and nothing in this app can intercept them. App-level lockdown
must be paired with:

- a dedicated macOS account that auto-logs-in and runs nothing else;
- `deploy/net.forgreatjustice.kioskbrowser.plist` in `~/Library/LaunchAgents/`
  with `RunAtLoad` + `KeepAlive`, so a crash restarts the kiosk instead of
  revealing a desktop;
- MDM restrictions (Force Quit, Mission Control, Spotlight, Software Update);
- `pmset` settings plus disabled screensaver, Notification Center banners, and
  update prompts — that OS chrome is what will actually leak through.

If the target URL is plain HTTP, add a scoped `NSAppTransportSecurity`
exception for that domain to `Info.plist`. Don't disable ATS globally.

## Testing

Build a windowed debug bundle and point it at the bundled test page, which walks
the entire §11 checklist with one case per section:

```sh
./build.sh --debug
open -a build/KioskBrowser.app --args \
  --fullscreen=false --keep-system-ui=true \
  --allowed-hosts=example.com \
  --url=file://$PWD/TestPage/kiosk-test.html
```

Blocked navigations, suppressed windows and cancelled downloads each log a line
— watch them in Console.app, filtered on `KioskBrowser`.
