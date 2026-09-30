import Foundation

/// Every allow/deny decision the kiosk makes about a URL lives here, so the
/// delegate methods in `KioskWebViewController` stay dumb wiring and the rules
/// can be reasoned about (and unit-tested) on their own.
struct NavigationPolicy {
    /// Empty means "no allowlist configured": navigation is unrestricted within
    /// the single window.
    let allowedHosts: [String]
    let allowExternalInSystemBrowser: Bool
    /// True only when the configured home URL is itself a `file:` URL, i.e. the
    /// kiosk is serving local content (the bundled test page, signage HTML on
    /// disk). Otherwise `file:` is denied outright — a remote page must never be
    /// able to walk the local filesystem into view.
    let allowsLocalFiles: Bool

    enum Decision: Equatable {
        case allow
        case cancel
        case openInSystemBrowser
    }

    init(config: Config) {
        self.allowedHosts = config.allowedHosts
        self.allowExternalInSystemBrowser = config.allowExternalInSystemBrowser
        self.allowsLocalFiles = config.homeURL?.isFileURL ?? false
    }

    func decision(for url: URL?) -> Decision {
        guard let url, let scheme = url.scheme?.lowercased() else { return .cancel }

        switch scheme {
        case "http", "https":
            if hostIsAllowed(url.host) { return .allow }
            return allowExternalInSystemBrowser ? .openInSystemBrowser : .cancel

        case "about":
            // about:blank / about:srcdoc — WebKit's own idea of an empty frame.
            return .allow

        case "file":
            // Never handed to the system browser: opening a local file in
            // another app is an escape hatch, not a navigation.
            return allowsLocalFiles ? .allow : .cancel

        default:
            // mailto:, tel:, facetime:, and every third-party app scheme. Each
            // one launches *another application*, which is precisely the thing a
            // kiosk exists to prevent. Denied, and never opened externally.
            return .cancel
        }
    }

    /// Whether a would-be new window (`target="_blank"`, `window.open`,
    /// cmd-click) may instead be loaded in place. Deliberately narrower than
    /// `decision(for:)`: a denied destination is dropped rather than kicked out
    /// to the system browser, because a popup the user never asked for should
    /// not be able to launch another app.
    func allowsLoadingInPlace(_ url: URL?) -> Bool {
        decision(for: url) == .allow
    }

    /// Exact match, or a subdomain of an allow-listed domain: allow-listing
    /// "example.com" also allows "www.example.com" but not "notexample.com".
    /// Same semantics as the chrome-extension sibling in this repo.
    func hostIsAllowed(_ host: String?) -> Bool {
        guard !allowedHosts.isEmpty else { return true }
        guard let host = host?.lowercased(), !host.isEmpty else { return false }

        return allowedHosts.contains { rawDomain in
            let domain = rawDomain.lowercased()
            guard !domain.isEmpty else { return false }
            return host == domain || host.hasSuffix("." + domain)
        }
    }
}
