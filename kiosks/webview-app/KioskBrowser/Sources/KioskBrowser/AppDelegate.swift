import AppKit

/// Owns the single window controller for the lifetime of the process.
final class AppDelegate: NSObject, NSApplicationDelegate {
    private let config: Config
    private var windowController: KioskWindowController?

    init(config: Config) {
        self.config = config
        super.init()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        installMainMenu()

        let controller = KioskWindowController(config: config)
        windowController = controller
        controller.present()

        if config.quitHotkeyCombo == nil {
            NSLog(
                "KioskBrowser: quitHotkey \"%@\" is not a parseable combo — "
                    + "quit-by-hotkey is disabled for this session",
                config.quitHotkey
            )
        }
    }

    /// There is one window and it refuses to close, but if something exotic ever
    /// does close it, terminating would leave a bare desktop. Stay alive; the
    /// LaunchAgent's restart is the recovery path we actually want.
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }

    /// Dock-click / reopen: bring the kiosk window back rather than doing
    /// nothing (relevant only when the app is visible in the Dock at all).
    func applicationShouldHandleReopen(
        _ sender: NSApplication,
        hasVisibleWindows flag: Bool
    ) -> Bool {
        windowController?.present()
        return true
    }

    func applicationSupportsSecureRestorableState(_ app: NSApplication) -> Bool {
        true
    }

    /// Called by `KioskApplication` when the reload hotkey fires.
    func reload() {
        windowController?.reload()
    }

    /// The minimum menu that still lets an operator quit.
    ///
    /// Everything else is deliberately absent: no File menu (no New Window, no
    /// Open), no View menu (no Enter Full Screen), no Window menu (no Show Tab
    /// Bar, no Merge All Windows), no Help. With `LSUIElement` set the menu bar
    /// never appears anyway — this exists so that the one build where it does
    /// appear isn't a browser menu.
    private func installMainMenu() {
        let mainMenu = NSMenu()
        let appMenuItem = NSMenuItem()
        mainMenu.addItem(appMenuItem)

        let appMenu = NSMenu()
        let quitItem = NSMenuItem(
            title: "Quit Kiosk",
            action: #selector(NSApplication.terminate(_:)),
            keyEquivalent: config.quitHotkeyCombo?.key ?? ""
        )
        quitItem.keyEquivalentModifierMask = config.quitHotkeyCombo?.modifiers ?? []
        appMenu.addItem(quitItem)
        appMenuItem.submenu = appMenu

        NSApp.mainMenu = mainMenu
        // No Services submenu to reach other applications through.
        NSApp.servicesMenu = nil
    }
}
