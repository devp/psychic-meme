import AppKit
import Foundation

/// Kiosk configuration.
///
/// Load order (last one wins): compiled-in defaults < JSON file < CLI args.
/// The JSON file is `--config=/path/to.json` when given, otherwise
/// `kiosk.config.json` from the app bundle's Resources.
///
/// Every key is optional in JSON — a config file that sets only `url` is valid,
/// everything else falls back to the default below. That is deliberate: ops
/// should be able to retarget a kiosk with a two-line file. (Swift's synthesized
/// `Decodable` conformance would make every key *required*, which is why
/// `init(from:)` is written out by hand at the bottom of this file.)
struct Config: Codable {
    /// Home URL. Loaded at launch, and re-loaded on failure / `window.close()`.
    var url: String = "about:blank"

    /// Hostnames the kiosk may navigate to. Empty means "no allowlist": free
    /// navigation within the single window. Matching is exact-or-subdomain,
    /// so "example.com" also allows "www.example.com" (same semantics as the
    /// chrome-extension sibling in this repo).
    var allowedHosts: [String] = []

    /// When a navigation is denied by the allowlist, hand the URL to the system
    /// default browser instead of silently swallowing it. Usually false on a
    /// real kiosk — there is no second browser on the machine.
    var allowExternalInSystemBrowser: Bool = false

    /// false → `.nonPersistent()` data store: cookies/localStorage die with the
    /// process, so every relaunch is a clean session.
    var persistCookies: Bool = true

    /// true → borderless window pinned to the full screen frame, menu bar and
    /// Dock auto-hidden. false → a normal titled window (dev convenience).
    var fullscreen: Bool = true

    var resizable: Bool = false

    /// Seconds to wait before reloading the home URL after a navigation failure.
    /// 0 disables the retry entirely (WebKit's error page stays on screen).
    var reloadOnFailureSeconds: Double = 5

    /// Cap on consecutive retries, and the multiplier applied to the delay after
    /// each one. `reloadMaxAttempts: 0` means retry forever, which is what a
    /// kiosk behind a flaky network usually wants.
    var reloadMaxAttempts: Int = 0
    var reloadBackoffMultiplier: Double = 1.5

    /// Only honoured in DEBUG builds, and only on macOS 13.3+. A release build
    /// never sets `isInspectable`, whatever this says.
    var allowDevToolsInDebugBuilds: Bool = false

    /// Modifier+key combo that quits the app. Parsed by `Hotkey`; an
    /// unparseable value disables quit-by-hotkey (and is logged at launch).
    var quitHotkey: String = "cmd+opt+shift+Q"

    /// Kiosk content usually needs JS. Off is supported for static-signage
    /// deployments that want the extra attack surface gone.
    var allowContentJavaScript: Bool = true

    /// Downloads trigger Finder/Downloads-folder UI, which is chrome leaking out
    /// of the kiosk. Off by default: download responses are cancelled.
    var allowDownloads: Bool = false

    /// What to do with a link that asked for a new window (`target="_blank"`,
    /// `window.open`, cmd-click). true → load it in the same webview when the
    /// destination passes the allowlist; false → drop it on the floor.
    /// Either way no second window is ever created.
    var openNewWindowLinksInPlace: Bool = true

    /// Show native `NSAlert`s for JS alert/confirm/prompt. false → dialogs are
    /// auto-dismissed with their default answer (cancel/empty), so a page can
    /// neither hang the kiosk nor show OS chrome.
    var showJavaScriptDialogs: Bool = false

    /// Leave cmd-R working. Harmless on most kiosks and handy for staff.
    var allowReloadHotkey: Bool = true

    /// Right-click behaviour: false → no context menu at all. true → a menu
    /// trimmed to "Reload" only (never "Open in New Window", never "Inspect
    /// Element", never "View Source").
    var allowReloadContextMenu: Bool = false

    /// Skip the `NSApp.presentationOptions` hiding of the menu bar and Dock.
    /// Set true during development so you can reach the rest of the system.
    var keepSystemUIVisible: Bool = false

    var homeURL: URL? { URL(string: url) }

    var quitHotkeyCombo: Hotkey? { Hotkey(string: quitHotkey) }
}

// MARK: - Loading

extension Config {
    enum LoadError: Error, CustomStringConvertible {
        case unreadable(path: String, underlying: Error)
        case malformed(path: String, underlying: Error)

        var description: String {
            switch self {
            case let .unreadable(path, underlying):
                return "could not read config at \(path): \(underlying)"
            case let .malformed(path, underlying):
                return "config at \(path) is not valid kiosk JSON: \(underlying)"
            }
        }
    }

    /// Resolve the effective config from `arguments` (typically
    /// `CommandLine.arguments`) and the bundled default file.
    ///
    /// A bad `--config=` path is fatal — an ops typo should fail loudly at
    /// launch rather than silently kiosk-ing `about:blank` forever. A missing
    /// *bundled* config is not fatal: `--url=` alone is a legitimate way to run.
    static func resolve(
        arguments: [String],
        bundledConfigURL: URL?
    ) throws -> Config {
        let args = CommandLineArguments(arguments)
        var config = Config()

        if let explicitPath = args.value(for: "config") {
            config = try load(from: URL(fileURLWithPath: explicitPath))
        } else if let bundledConfigURL,
                  FileManager.default.fileExists(atPath: bundledConfigURL.path) {
            config = try load(from: bundledConfigURL)
        }

        config.apply(args)
        return config
    }

    static func load(from fileURL: URL) throws -> Config {
        let data: Data
        do {
            data = try Data(contentsOf: fileURL)
        } catch {
            throw LoadError.unreadable(path: fileURL.path, underlying: error)
        }
        do {
            return try JSONDecoder().decode(Config.self, from: data)
        } catch {
            throw LoadError.malformed(path: fileURL.path, underlying: error)
        }
    }

    /// CLI overrides. Only the knobs worth flipping from a LaunchAgent plist or
    /// a terminal are exposed; everything else lives in the JSON.
    private mutating func apply(_ args: CommandLineArguments) {
        if let value = args.value(for: "url") { url = value }
        if let value = args.value(for: "allowed-hosts") {
            allowedHosts = value
                .split(separator: ",")
                .map { $0.trimmingCharacters(in: .whitespaces) }
                .filter { !$0.isEmpty }
        }
        if let value = args.boolValue(for: "fullscreen") { fullscreen = value }
        if let value = args.boolValue(for: "resizable") { resizable = value }
        if let value = args.boolValue(for: "persist-cookies") { persistCookies = value }
        if let value = args.boolValue(for: "allow-downloads") { allowDownloads = value }
        if let value = args.boolValue(for: "keep-system-ui") { keepSystemUIVisible = value }
        if let value = args.doubleValue(for: "reload-on-failure-seconds") {
            reloadOnFailureSeconds = value
        }
    }
}

// MARK: - Decoding

extension Config {
    enum CodingKeys: String, CodingKey {
        case url
        case allowedHosts
        case allowExternalInSystemBrowser
        case persistCookies
        case fullscreen
        case resizable
        case reloadOnFailureSeconds
        case reloadMaxAttempts
        case reloadBackoffMultiplier
        case allowDevToolsInDebugBuilds
        case quitHotkey
        case allowContentJavaScript
        case allowDownloads
        case openNewWindowLinksInPlace
        case showJavaScriptDialogs
        case allowReloadHotkey
        case allowReloadContextMenu
        case keepSystemUIVisible
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        var config = Config()

        func decode<T: Decodable>(_ key: CodingKeys, _ fallback: T) throws -> T {
            try container.decodeIfPresent(T.self, forKey: key) ?? fallback
        }

        config.url = try decode(.url, config.url)
        config.allowedHosts = try decode(.allowedHosts, config.allowedHosts)
        config.allowExternalInSystemBrowser =
            try decode(.allowExternalInSystemBrowser, config.allowExternalInSystemBrowser)
        config.persistCookies = try decode(.persistCookies, config.persistCookies)
        config.fullscreen = try decode(.fullscreen, config.fullscreen)
        config.resizable = try decode(.resizable, config.resizable)
        config.reloadOnFailureSeconds =
            try decode(.reloadOnFailureSeconds, config.reloadOnFailureSeconds)
        config.reloadMaxAttempts = try decode(.reloadMaxAttempts, config.reloadMaxAttempts)
        config.reloadBackoffMultiplier =
            try decode(.reloadBackoffMultiplier, config.reloadBackoffMultiplier)
        config.allowDevToolsInDebugBuilds =
            try decode(.allowDevToolsInDebugBuilds, config.allowDevToolsInDebugBuilds)
        config.quitHotkey = try decode(.quitHotkey, config.quitHotkey)
        config.allowContentJavaScript =
            try decode(.allowContentJavaScript, config.allowContentJavaScript)
        config.allowDownloads = try decode(.allowDownloads, config.allowDownloads)
        config.openNewWindowLinksInPlace =
            try decode(.openNewWindowLinksInPlace, config.openNewWindowLinksInPlace)
        config.showJavaScriptDialogs =
            try decode(.showJavaScriptDialogs, config.showJavaScriptDialogs)
        config.allowReloadHotkey = try decode(.allowReloadHotkey, config.allowReloadHotkey)
        config.allowReloadContextMenu =
            try decode(.allowReloadContextMenu, config.allowReloadContextMenu)
        config.keepSystemUIVisible = try decode(.keepSystemUIVisible, config.keepSystemUIVisible)

        self = config
    }
}

// MARK: - Hotkey

/// A modifier+character combo, parsed from strings like `"cmd+opt+shift+Q"`.
/// Only single-character keys are supported — this exists for the maintenance
/// quit gesture, not for a general keybinding system.
struct Hotkey: Equatable {
    let modifiers: NSEvent.ModifierFlags
    /// Lowercased, so "Q" and "q" describe the same combo.
    let key: String

    /// Modifiers we compare on. Caps lock, function and numeric-pad flags are
    /// ignored so a stuck caps lock can't lock an operator out of the kiosk.
    static let significantModifiers: NSEvent.ModifierFlags =
        [.command, .option, .shift, .control]

    init?(string: String) {
        var modifiers: NSEvent.ModifierFlags = []
        var character: String?

        for rawToken in string.split(separator: "+") {
            let token = rawToken.trimmingCharacters(in: .whitespaces).lowercased()
            switch token {
            case "cmd", "command", "⌘": modifiers.insert(.command)
            case "opt", "option", "alt", "⌥": modifiers.insert(.option)
            case "shift", "⇧": modifiers.insert(.shift)
            case "ctrl", "control", "⌃": modifiers.insert(.control)
            default:
                // Anything that isn't a modifier must be the (single) key, and
                // there must be exactly one of them.
                guard token.count == 1, character == nil else { return nil }
                character = token
            }
        }

        guard let character, !modifiers.isEmpty else { return nil }
        self.modifiers = modifiers
        self.key = character
    }

    func matches(_ event: NSEvent) -> Bool {
        let pressed = event.modifierFlags
            .intersection(.deviceIndependentFlagsMask)
            .intersection(Hotkey.significantModifiers)
        guard pressed == modifiers else { return false }
        return event.charactersIgnoringModifiers?.lowercased() == key
    }
}
