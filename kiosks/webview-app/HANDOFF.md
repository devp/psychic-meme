# Handoff: KioskBrowser, from cloud agent to local (macOS) agent

Written 2026-08-12 by the agent that implemented
[`kiosk-webview-spec.md`](kiosk-webview-spec.md) on branch
`claude/kiosk-webview-osx-binary-qtxwcf` (commit `f6976fe`).

**One-line state:** the whole spec is implemented and pushed; nothing has ever
been compiled. Your job is first compile → first launch → the §11 checklist.

## Why there is no binary

The implementation ran in a Linux container. Two independent blockers, neither
worth re-attempting:

1. AppKit and WebKit ship only in the macOS SDK. There is no cross-compilation
   path from Linux — this was never going to produce a `.app`.
2. The container's network policy denied `download.swift.org` (403 on CONNECT),
   so not even a Swift toolchain for a `swiftc -parse` syntax check was
   reachable.

What *was* verified mechanically: `bash -n build.sh`, `Resources/kiosk.config.json`
parses, both plists parse (`plistlib`), the test page parses, and bracket
balance across all seven Swift files. Everything else is careful reading, not
compiler output. **Assume there are compile errors and budget for them.**

## Step 1 — first compile

```sh
cd kiosks/webview-app/KioskBrowser
swift build 2>&1 | head -50        # fastest loop; skips bundling entirely
```

`build.sh` does a universal release build and needs `--arch` support, so start
with plain `swift build` and only move to `./build.sh` once the sources compile.

### Ranked list of what will break first

These are the constructs I could not verify and would check in this order. Each
is a local fix; none imply a design change.

1. **`Config.init(from:)` in an extension** (`Config.swift`). `CodingKeys` and
   the hand-written `init(from:)` both live in an extension so the memberwise
   `Config()` init survives — synthesis of `Encodable` has to find
   `Config.CodingKeys` from there. If the compiler complains, move `CodingKeys`
   into the main `struct` body (leave `init(from:)` in the extension; that part
   is what preserves `Config()`).
2. **`KioskApplication.shared as? KioskApplication`** (`main.swift`). The
   standard trick for installing an `NSApplication` subclass without
   `NSApplicationMain`. If it returns a plain `NSApplication`, the fallback is
   setting `NSPrincipalClass` to `KioskBrowser.KioskApplication` in
   `Info.plist` — but note that only works for the bundled `.app`, not for
   `swift run`, so keep the runtime guard either way.
3. **Top-level definite initialization** (`main.swift`): `let resolvedConfig:
   Config` declared, assigned inside `do`/`catch`, plus a top-level `guard let
   … else { exit(1) }`. Legal in `main.swift` specifically. If the compiler
   disagrees, wrap the whole entry point in a `func main()` and call it.
4. **`if #available(macOS 13.3, *), config.allowDevToolsInDebugBuilds`**
   (`KioskWebViewController.loadView`). `#available` is first in the condition
   list deliberately; if the ordering is rejected, nest the two `if`s.
5. **`webView.unregisterDraggedTypes()`** — inherited from `NSView`; if WebKit
   re-registers its types later this call is a no-op rather than an error, and
   the navigation delegate still catches dropped URLs. Safe to delete if it
   misbehaves.
6. **`NSLog` format specifiers.** `%ld` is paired with a Swift `Int` and `%@`
   with a Swift `String` throughout. Correct on 64-bit Darwin, but if any line
   crashes or prints garbage, convert explicitly at the call site.
7. **Deprecation warnings, not errors:** `NSApp.activate(ignoringOtherApps:)`
   is deprecated in the macOS 14 SDK. The comment there explains why the
   uncooperative version is the one a kiosk wants — don't "fix" it by switching
   to `activate()`.

## Step 2 — first launch

```sh
./build.sh --debug
open -a build/KioskBrowser.app --args \
  --fullscreen=false --keep-system-ui=true \
  --allowed-hosts=example.com \
  --url=file://$PWD/TestPage/kiosk-test.html
```

Start windowed with system UI visible — a fullscreen borderless build that
mishandles focus or the quit hotkey is genuinely annoying to escape (the quit
hotkey is `cmd+opt+shift+Q`; Force Quit is `cmd+opt+esc`; both should work).
Logs go to `Console.app`, filter on `KioskBrowser` — blocked navigations,
suppressed windows and cancelled downloads each log a line.

### Runtime behaviour I could reason about but not observe

Ranked by how likely they are to need adjustment:

1. **Focus reclaim loop** (`KioskWindowController.windowDidResignKey`). Guarded
   on `NSApp.isActive` and `attachedSheet == nil` so it can't fight a JS dialog
   or a browser launched via `allowExternalInSystemBrowser`. Watch for a
   flicker or a focus tug-of-war on a multi-display kiosk; if you see one,
   this method is the cause.
2. **Empty context menu.** `willOpenMenu` calls `menu.removeAllItems()`. An
   empty `NSMenu` should not display at all — confirm no empty grey rectangle
   appears on right-click. If one does, override `menu(for:)` to return `nil`
   instead.
3. **Double-load on `target="_blank"`.** In theory `decidePolicyFor` (with
   `targetFrame == nil`) cancels before `createWebViewWith` is ever reached, so
   only one of the two in-place reloads fires. Both paths are individually
   guarded, so the worst case is a redundant load of the same URL — but watch
   the Console for two lines where you expect one.
4. **Borderless + key focus.** `KioskWindow` overrides `canBecomeKey` /
   `canBecomeMain` because borderless windows refuse both by default. Verify
   typing into a form actually works in the fullscreen build.
5. **`NSApp.presentationOptions = [.autoHideDock, .autoHideMenuBar]`** — a
   valid combination, but invalid combinations raise an exception rather than
   failing quietly. If launch crashes in `present()`, that's the line.
6. **`.accessory` activation policy** (`build.sh --lsuielement`). Confirm the
   kiosk window can still become key with no Dock icon; `.accessory` should
   allow it where `.prohibited` would not.

## Step 3 — the §11 checklist

Not started. `TestPage/kiosk-test.html` has one numbered section per checklist
item; the spec's list maps onto it directly:

- [ ] `target="_blank"` → in place or dropped, never a second window (§1)
- [ ] `window.open()`, with and without a user gesture (§2)
- [ ] cmd-click / middle-click (§3)
- [ ] Right-click: no menu, no "Open in New Window", no Inspect Element (§4)
- [ ] Non-allowlisted host blocked (§5) and subdomain of an allowed host
      permitted (§6)
- [ ] Download link → nothing; no save panel, no Finder (§7)
- [ ] `<input type="file">` → no open panel (§8)
- [ ] JS alert/confirm/prompt → auto-answered, page never hangs (§9)
- [ ] `window.close()` → returns to home URL (§10)
- [ ] `mailto:` and `file:` handling (§11)
- [ ] cmd-N/T/shift-T/W/M/H/Q, F11, ctrl-cmd-F all no-op; cmd-R reloads;
      quit hotkey quits (§12)
- [ ] Network failure → retries home URL with backoff, no WebKit error page
      left on screen (kill wifi mid-load)
- [ ] Crash relaunch via the LaunchAgent → same URL, no leaked state
- [ ] `isInspectable` absent from a release build (right-click, and confirm
      Safari's Develop menu can't attach)

Nothing in the app is expected to fail these — but nothing has been observed
passing them either.

## Deliberately not done

- **No test target.** SwiftPM can test executable targets, but the setup has
  known link-time wrinkles with top-level code, and I could not verify any of
  it. If you want unit tests, `NavigationPolicy` and `Hotkey` are the pure
  logic worth covering, and doing it properly means splitting a `KioskCore`
  library target out of the executable — a deviation from the spec's §4 layout,
  so worth a nod from the human first.
- **No notarization.** `build.sh` signs ad-hoc by default and passes
  `--timestamp` only for a real identity. Gatekeeper will quarantine an ad-hoc
  bundle copied to another machine; notarize before any fleet deployment.
- **No ATS exception.** Add a scoped `NSAppTransportSecurity` entry to
  `Info.plist` only if the deployment URL is plain HTTP.
- **No icon.** The bundle has no `CFBundleIconFile`; irrelevant under
  `LSUIElement`, visible in the Dock otherwise.

## Decisions already made (don't re-litigate without reason)

The spec left several choices to the porter. All are settled and commented at
the point of decision, most are config flags:

| Spec | Decision |
| --- | --- |
| §5 borderless vs. titled | Borderless pinned to the screen frame — no Space to swipe out of, no traffic lights |
| §6 new-window links | Reloaded in place when the destination passes the allowlist (`openNewWindowLinksInPlace`) |
| §6 JS dialogs | Auto-dismissed by default (`showJavaScriptDialogs`) |
| §6 context menu | Killed entirely by default; reload-only is opt-in (`allowReloadContextMenu`) |
| §7 cmd-R | Left working, handled in `sendEvent` since there is no menu item (`allowReloadHotkey`) |
| §7 quit | Hotkey only, `cmd+opt+shift+Q`, no password prompt |
| beyond spec | Non-web schemes (`mailto:`, `tel:`, app schemes) denied outright — each launches another app, which is the thing a kiosk prevents |
