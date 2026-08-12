import AppKit

/// Owns the single, chrome-less window.
///
/// Window-chrome tradeoff, decided here once: fullscreen kiosks use a
/// `.borderless` window pinned to `NSScreen.main.frame` rather than
/// `toggleFullScreen(nil)`. The real Fullscreen API moves the app into its own
/// Space, which means a four-finger swipe or ctrl-arrow puts the user back on
/// the desktop, and the green traffic light exists to be clicked. A borderless
/// window at screen size has no traffic lights, no Space to swipe out of, and no
/// titlebar to drag — at the cost of not being "fullscreen" as far as macOS is
/// concerned, which is exactly what we want.
final class KioskWindowController: NSWindowController {
    private let config: Config
    private let webViewController: KioskWebViewController

    init(config: Config) {
        self.config = config
        self.webViewController = KioskWebViewController(config: config)

        let screenFrame = NSScreen.main?.frame ?? KioskWindowController.windowedFrame
        var styleMask: NSWindow.StyleMask = [.borderless]
        if !config.fullscreen {
            styleMask = [.titled, .closable, .miniaturizable]
            if config.resizable {
                styleMask.insert(.resizable)
            }
        }

        let window = KioskWindow(
            contentRect: config.fullscreen ? screenFrame : KioskWindowController.windowedFrame,
            styleMask: styleMask,
            backing: .buffered,
            defer: false
        )

        super.init(window: window)

        window.delegate = self
        // Assigning a content view controller re-sizes the window to the view's
        // fitting size, so every frame decision below has to come after it.
        window.contentViewController = webViewController
        window.title = "Kiosk"

        // Kills native macOS window tabbing outright: no cmd-shift-T, no "+"
        // tab button, no "Merge All Windows" in the Window menu. Unconditional —
        // there is no configuration in which a kiosk wants a tab bar.
        window.tabbingMode = .disallowed

        window.isMovable = !config.fullscreen
        window.isMovableByWindowBackground = false
        // No green traffic light, no Space transition, no swipe-out-of-fullscreen.
        window.collectionBehavior = [.fullScreenNone]

        if config.fullscreen {
            window.setFrame(screenFrame, display: true)
            // Above other windows, but not above the "the system is asking you
            // something" layer — a modal auth sheet the user genuinely cannot
            // see is worse than a kiosk that isn't quite the topmost thing.
            window.level = .normal
        } else {
            window.setFrame(KioskWindowController.windowedFrame, display: true)
            window.center()
        }
    }

    /// Development-mode window size, used whenever `fullscreen` is off or no
    /// screen is attached (headless CI, remote build machine).
    private static let windowedFrame = NSRect(x: 0, y: 0, width: 1280, height: 800)

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("KioskBrowser builds its UI in code; there are no nibs to decode.")
    }

    func present() {
        // Dock and menu bar are OS chrome the app can hide but not remove; the
        // auto-hiding variants keep the kiosk covering them without fighting the
        // window server. `keepSystemUIVisible` opts out for development.
        if config.fullscreen, !config.keepSystemUIVisible {
            NSApp.presentationOptions = [.autoHideDock, .autoHideMenuBar]
        }

        showWindow(nil)
        window?.makeKeyAndOrderFront(nil)
        // Deprecated in macOS 14 in favour of activate(), which cooperates with
        // whatever is frontmost. A kiosk wants the uncooperative version: on
        // launch it should be in front, full stop.
        NSApp.activate(ignoringOtherApps: true)
    }

    func reload() {
        webViewController.reload()
    }
}

// MARK: - NSWindowDelegate

extension KioskWindowController: NSWindowDelegate {
    /// cmd-W and any other route to closing the window: refuse. The kiosk has
    /// exactly one window, and a kiosk showing an empty desktop is a broken
    /// kiosk. Quitting goes through the configured hotkey instead.
    func windowShouldClose(_ sender: NSWindow) -> Bool {
        false
    }

    /// A borderless window that loses key status while the kiosk is still the
    /// front app (a display reconfiguration, a stray click on nothing) should
    /// take it back.
    ///
    /// Two cases must *not* be reclaimed, or the kiosk fights the user:
    /// an attached sheet (a JS dialog we put there ourselves), and another
    /// application being frontmost — which is exactly what
    /// `allowExternalInSystemBrowser` deliberately causes. Both checks run
    /// inside the async block, once activation state has settled.
    func windowDidResignKey(_ notification: Notification) {
        guard config.fullscreen else { return }
        DispatchQueue.main.async { [weak self] in
            guard NSApp.isActive,
                  let window = self?.window,
                  window.attachedSheet == nil
            else { return }
            window.makeKeyAndOrderFront(nil)
        }
    }

    /// Display resolution changed, or the kiosk was moved to a different screen:
    /// re-pin to the new screen frame.
    func windowDidChangeScreen(_ notification: Notification) {
        guard config.fullscreen, let screenFrame = window?.screen?.frame else { return }
        window?.setFrame(screenFrame, display: true)
    }
}

// MARK: - KioskWindow

/// A `.borderless` `NSWindow` refuses to become key or main by default, which
/// would leave the webview unable to take keyboard focus (no typing, no form
/// input). Overriding both is the standard fix, and `performClose` is stubbed
/// out so cmd-W has nothing to call even if it slips past the event monitor.
final class KioskWindow: NSWindow {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }

    override func performClose(_ sender: Any?) {
        // Intentionally empty: the kiosk window does not close.
        NSSound.beep()
    }
}
