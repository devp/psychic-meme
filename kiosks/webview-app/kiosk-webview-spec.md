# Kiosk WKWebView — Spec

Single-purpose macOS kiosk browser. Loads one URL, no tabs, no new windows, no navigation chrome. Spiritually equivalent to `surf` (suckless philosophy: one file, few knobs, hackable) but native to macOS via `WebKit.framework` — no GTK/webkit2gtk/Homebrew dependency chain.

## 1. Goals

- Load exactly one URL at launch, full-screen (or fixed-size window), no address bar, no tab strip, no toolbar.
- Block every path to a second window/tab: `target=_blank`, `window.open()`, cmd-click, middle-click, right-click "Open in New Window", `rel=noopener` popups, Auth/JS dialogs that spawn windows.
- Block navigation away from an allowed origin (optional allowlist), or allow free navigation within the single window (configurable).
- No context menu (or a trimmed one — reload only).
- No DevTools, no view-source, no "Inspect Element".
- Survive process crashes / reloads without leaking a second window.
- Config-driven: URL and lockdown flags come from a plist/JSON/CLI args, not hardcoded, so ops can retarget without recompiling.

## 2. Non-goals

- Not a general-purpose browser. No bookmarks, history UI, downloads UI, extensions.
- Not sandboxed against the *user* (this is a trusted-operator kiosk lock, not a security boundary against a malicious user with keyboard access — see §8 for what's actually enforceable).
- No Windows/Linux port in this spec (macOS/WKWebView only). Linux equivalent remains `surf` itself.

## 3. Platform / Target

- macOS 12+ (Monterey), Swift 5.7+, AppKit + WebKit (`WKWebView`), no SwiftUI dependency required (AppKit is simpler for window-chrome control).
- Distributed as a signed `.app` bundle (notarization recommended for Gatekeeper-clean deployment on kiosk hardware).
- Single executable target — no external package dependencies needed (WebKit + AppKit are system frameworks).

## 4. Project layout

```
KioskBrowser/
├── Package.swift                  # or KioskBrowser.xcodeproj — either works, SPM executable is simplest to port
├── Sources/KioskBrowser/
│   ├── main.swift                 # entry point: parse config, build AppDelegate, run
│   ├── AppDelegate.swift          # NSApplicationDelegate: owns the single NSWindow
│   ├── KioskWindowController.swift# NSWindowController: chrome-less window setup
│   ├── KioskWebViewController.swift # NSViewController hosting WKWebView + delegates
│   ├── Config.swift                # Codable config struct + loader (CLI args > JSON file > defaults)
│   └── NavigationPolicy.swift      # allow/deny decisions, centralizes the lockdown rules
├── Resources/
│   └── kiosk.config.json          # default config (see §9)
└── Info.plist                     # LSUIElement, kiosk-relevant keys (see §7)
```

Keep it to these ~6 files. Mirrors `surf.c`'s one-file-does-everything spirit as closely as AppKit's delegate-heavy API allows.

## 5. Window / chrome setup (`KioskWindowController`)

- `NSWindow` created with `styleMask: [.borderless]` (or `[.titled]` with `titlebarAppearsTransparent` + hidden buttons, if borderless causes focus/fullscreen quirks on some macOS versions — pick one, document the tradeoff in code comment).
- `window.toggleFullScreen(nil)` on launch, or pin `window.setFrame(_:display:)` to `NSScreen.main.frame` for a borderless full-screen-esque window (true Fullscreen API gives you the green-traffic-light space-switch fullscreen; borderless-max-frame avoids that if you don't want a Space transition).
- `window.styleMask.remove(.resizable)` if the deployment is fixed-resolution kiosk hardware; otherwise leave resizable.
- No `NSToolbar`, no tab group (`window.tabbingMode = .disallowed` — this alone kills native macOS window-tabbing (cmd-shift-T / "+" tab button) at the AppKit level, do this regardless of anything else).
- `NSApp.setActivationPolicy(.regular)` normally; use `.prohibited`/`LSUIElement=true` in Info.plist if you also want to hide it from the Dock and cmd-tab (kiosk-typical).

## 6. WKWebView configuration (`KioskWebViewController`)

`WKWebViewConfiguration`:
- `preferences.javaScriptCanOpenWindowsAutomatically = false` — first line of defense against `window.open()`.
- `websiteDataStore`: `.default()` normally; `.nonPersistent()` if the kiosk should not retain cookies/localStorage across relaunches (config flag).
- `defaultWebpagePreferences.allowsContentJavaScript = true` (kiosk content usually needs JS; make it a config flag anyway).
- Disable inspector: do **not** set `isInspectable = true` (Swift 5.9+/macOS 14+ property — default false is what you want; never flip this in a shipped kiosk build).

`WKUIDelegate` (this is the load-bearing piece — implement all of):
- `webView(_:createWebViewWith:for:windowFeatures:) -> WKWebView?` → **return `nil`, always**. This is what actually stops `target="_blank"`, `window.open()`, and JS-driven popups from ever materializing a second webview/window. Optionally: if `navigationAction.targetFrame == nil` (i.e., it would've been a new window) and the request is for an allowed host, load it in the *same* webview instead of just dropping it (`webView.load(navigationAction.request)`) — this way legitimate "opens in new tab" links still work, just redirected in-place. Decide per-deployment; document the choice.
- `webViewDidClose(_:)` → no-op or re-navigate to the home URL (defensive: some content calls `window.close()` expecting a popup; since there is no popup, treat as "reset to home").
- `webView(_:runJavaScriptAlertPanelWithMessage:initiatedByFrame:completionHandler:)` and the confirm/prompt variants → implement minimally (native `NSAlert` or auto-dismiss) so a page can't hang the kiosk waiting on a dialog it thinks is modal-blocking; consider auto-completing with a default value if kiosk should never show any native chrome at all.
- `webView(_:contextMenuConfigurationForElement:completionHandler:)` → `completionHandler(nil)` to kill the context menu entirely, or return a trimmed `UIContextMenuConfiguration`-equivalent (macOS: override via `NSMenu` delegate instead — see note below) with just "Reload".
  - Note: on macOS the standard way to trim/kill the right-click menu is overriding `WKWebView`'s `willOpenMenu(_:with:)` (it's an `NSView` subclass) or subclassing and overriding `menu(for:)` — pick whichever the target Swift/WebKit version supports; both achieve "no Inspect Element, no Open Link in New Window" items.

`WKNavigationDelegate`:
- `webView(_:decidePolicyFor:navigationAction:decisionHandler:)` → this is where `NavigationPolicy.swift` centralizes the allow/deny rule:
  - If an allowlist is configured (list of hostnames/domains), deny (`.cancel`) any navigation to a host not on the list; optionally open denied external links via `NSWorkspace.shared.open(url)` (kicks it out to the *system* default browser instead of the kiosk — decide per deployment) or just swallow it.
  - If no allowlist, allow all navigation within the single window (still no new windows, per §6 createWebViewWith rule above).
  - Always deny `navigationAction.targetFrame == nil` cases that reach here (belt-and-suspenders with createWebViewWith).
- `webView(_:didFailProvisionalNavigation:withError:)` / `didFail:withError:` → retry policy: reload the configured URL after N seconds on network failure (kiosk should self-heal, not show WebKit's default error page). Make retry count/backoff configurable.
- `webView(_:decidePolicyFor:navigationResponse:decisionHandler:)` → deny navigation responses that are file downloads (`canShowMIMEType == false` or `Content-Disposition: attachment`) unless downloads are explicitly enabled in config — a kiosk usually shouldn't be triggering Finder/Downloads folder popups either.

## 7. Keyboard / input lockdown

WKWebView/AppKit won't stop the user from pressing cmd-N, cmd-T, cmd-W, cmd-Q at the OS level unless you intercept them:

- Override `NSApplication.sendEvent(_:)` (subclass `NSApplication` in `main.swift`, or use a global local `NSEvent.addLocalMonitorForEvents(matching: .keyDown)`) and swallow: cmd-N, cmd-T, cmd-shift-T, cmd-W, cmd-Q (unless you want quit allowed — usually you map a specific hidden exit gesture instead, e.g. a long-press hotkey combo, for kiosk maintenance), cmd-R (unless you want reload allowed — often fine to leave), cmd-comma (no prefs to open anyway), F11/cmd-ctrl-F (fullscreen toggle, if you want to force the kiosk to stay fullscreen).
- Menu bar: build a minimal `NSMenu` with just an Application menu containing nothing but a hidden/hotkeyed "Quit" (guarded, e.g. behind a password prompt or a physical-access-only gesture), or set `NSApp.mainMenu = nil` entirely if LSUIElement hides the menu bar anyway.
- Note the honesty caveat: this is deterrence for a semi-trusted kiosk operator/public terminal, not a security sandbox. A user with keyboard + Terminal access (or Force Quit via cmd-opt-esc, which you *cannot* intercept from inside your app) can still exit. If true lockdown is required, pair this with macOS's built-in **Guided Access**-equivalent (there isn't one on macOS the way iOS has it) — realistically pair with: a dedicated login account with a restricted shell, `loginwindow` auto-launch of this app, and MDM profile restrictions (Screen Time / restrictions payload) to block Force Quit / Mission Control / Spotlight. Call this out explicitly in the port so nobody assumes app-level lockdown alone is sufficient.

## 8. Config (`Config.swift` + `kiosk.config.json`)

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

Load order: CLI arg (`--url=...`, `--config=/path/to.json`) overrides JSON file overrides compiled-in default. Keep `Config` a plain `Codable` struct — no third-party parsing dependency needed (`JSONDecoder` from Foundation is enough).

## 9. Info.plist keys of interest

- `LSUIElement` = `true` → hides Dock icon + app switcher entry (true kiosk feel). Set `false` during development so you can actually quit it.
- `NSAppTransportSecurity` → configure if the kiosk target URL is plain HTTP (avoid disabling ATS globally; scope exceptions to the specific domain).
- No `NSSupportsAutomaticGraphicsSwitching`/sandbox entitlements needed unless distributing via MAS (not applicable to a kiosk deployment — ad-hoc/direct signing is simpler).

## 10. Auto-launch / deployment notes (out of app scope, but document alongside)

- Recommend a dedicated macOS user account, `~/Library/LaunchAgents/com.yourorg.kioskbrowser.plist` with `RunAtLoad` + `KeepAlive` (restart the app if it crashes — a kiosk should never sit at a crash-quit desktop).
- Disable Notification Center banners, screensaver, sleep, and Software Update prompts on the kiosk account via `pmset`/profile — these are the actual "chrome" that will leak through since the app itself can't suppress OS-level UI.

## 11. Testing checklist (before calling the port done)

- [ ] `target="_blank"` link → loads in-place or is dropped, never opens a second window.
- [ ] `window.open(url)` from JS console/page script → same as above, no new window.
- [ ] cmd-click / middle-click a link → no new window/tab.
- [ ] Right-click a link → no "Open in New Window" in menu (or no menu at all).
- [ ] cmd-N, cmd-T, cmd-shift-T → no-op.
- [ ] cmd-W → does not close the kiosk window (or is intentionally mapped to something safe).
- [ ] Navigating to a non-allowlisted host (if allowlist configured) → blocked.
- [ ] Network failure → auto-retries to home URL, no WebKit default error page left on screen.
- [ ] File download link → blocked (or explicitly allowed per config).
- [ ] Right-click → no "Inspect Element"; `isInspectable` not set to true in release build.
- [ ] App relaunch after crash (via LaunchAgent) → comes back to the same URL, no leftover state issues from non-persistent data store if configured that way.

## 12. Explicit parity note vs. `surf`

`surf`'s kiosk mode (`-k` flag, see its man page) suppresses the toolbar/statusbar/sitename and is meant to be paired with an X window manager doing the actual fullscreen/lockdown (it deliberately punts window-manager-level lockdown to the WM, same honesty caveat as §7 above). This spec's macOS port takes the same stance: the *app* handles in-webview lockdown (no tabs/windows/devtools), OS-level lockdown (Force Quit, Mission Control, login screen access) is a deployment/MDM concern, not something this app can or should try to own.
