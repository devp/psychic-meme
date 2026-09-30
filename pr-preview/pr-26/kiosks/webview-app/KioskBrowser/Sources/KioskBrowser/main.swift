import AppKit

// MARK: - Keyboard lockdown

/// `NSApplication` subclass that swallows the key combos AppKit would otherwise
/// honour on our behalf.
///
/// This is the only place that can see cmd-N/cmd-W/cmd-H before AppKit acts on
/// them: `sendEvent` is upstream of menu key-equivalent dispatch and of the
/// responder chain. Note the honesty caveat from the spec — cmd-opt-esc (Force
/// Quit), cmd-tab, cmd-space and the screenshot hotkeys are handled by the
/// window server before any application sees them and cannot be blocked from
/// here. Blocking those is an MDM/restricted-account job; see README §Deployment.
final class KioskApplication: NSApplication {
    /// Set from `main` before `run()`.
    var config = Config()
    weak var kioskDelegate: AppDelegate?

    /// Command-key combos that all lead somewhere a kiosk shouldn't go:
    /// n/t → new window or tab, w → close, m → minimise (desktop visible),
    /// h → hide the app (desktop visible), q → quit, o/s/p → Open/Save/Print
    /// panels, comma → preferences, d → add bookmark in some web content.
    private static let blockedCommandKeys: Set<String> =
        ["n", "t", "w", "m", "h", "q", "o", "s", "p", ",", "d"]

    override func sendEvent(_ event: NSEvent) {
        if event.type == .keyDown, handleKeyDown(event) {
            return  // swallowed
        }
        super.sendEvent(event)
    }

    /// Returns true when the event has been consumed and must not propagate.
    private func handleKeyDown(_ event: NSEvent) -> Bool {
        let modifiers = event.modifierFlags
            .intersection(.deviceIndependentFlagsMask)
            .intersection(Hotkey.significantModifiers)
        let key = event.charactersIgnoringModifiers?.lowercased() ?? ""

        // Checked first, so a quit hotkey that overlaps a blocked combo (the
        // default cmd-opt-shift-Q overlaps cmd-Q's key) still works.
        if let quitHotkey = config.quitHotkeyCombo, quitHotkey.matches(event) {
            NSApp.terminate(nil)
            return true
        }

        // Fullscreen toggles: F11 and ctrl-cmd-F. The window is deliberately
        // .fullScreenNone, but swallowing these keeps the OS from beeping and
        // from flashing the "can't do that" animation at a passer-by.
        if event.keyCode == 103 /* F11 */ {
            return true
        }
        if modifiers == [.control, .command], key == "f" {
            return true
        }

        guard modifiers.contains(.command) else { return false }

        if key == "r" {
            if config.allowReloadHotkey {
                kioskDelegate?.reload()
            }
            return true
        }

        // cmd-shift-T (reopen closed tab) arrives as key "t" with shift held,
        // which the set below already covers.
        return KioskApplication.blockedCommandKeys.contains(key)
    }
}

// MARK: - Entry point

let bundledConfigURL = Bundle.main.url(forResource: "kiosk.config", withExtension: "json")

// Named `resolvedConfig` rather than `config` so it cannot be confused with
// KioskApplication's own `config` property inside this file.
let resolvedConfig: Config
do {
    resolvedConfig = try Config.resolve(
        arguments: CommandLine.arguments,
        bundledConfigURL: bundledConfigURL
    )
} catch {
    // A misconfigured kiosk should fail at launch, loudly, while someone is
    // still standing in front of it — not three weeks later on a blank screen.
    FileHandle.standardError.write(Data("KioskBrowser: \(error)\n".utf8))
    exit(1)
}

// `NSApplication.shared` instantiates the class it is called on, which is how a
// plain SPM executable (no Info.plist NSPrincipalClass) gets a custom
// NSApplication subclass installed.
guard let application = KioskApplication.shared as? KioskApplication else {
    FileHandle.standardError.write(
        Data("KioskBrowser: could not install the kiosk NSApplication subclass\n".utf8)
    )
    exit(1)
}

let appDelegate = AppDelegate(config: resolvedConfig)
application.config = resolvedConfig
application.kioskDelegate = appDelegate
application.delegate = appDelegate

// An activation policy set at runtime overrides LSUIElement, so read the key
// back rather than hard-coding .regular — otherwise `build.sh --lsuielement`
// would put the Dock icon straight back. .accessory is the kiosk deployment
// shape: no Dock icon, no cmd-tab entry, but still able to show a key window.
let isUIElement = (Bundle.main.object(forInfoDictionaryKey: "LSUIElement") as? Bool) ?? false
_ = application.setActivationPolicy(isUIElement ? .accessory : .regular)
application.run()
