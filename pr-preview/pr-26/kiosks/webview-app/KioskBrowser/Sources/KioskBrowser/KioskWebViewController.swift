import AppKit
import WebKit

/// Hosts the one and only `WKWebView` and implements the lockdown rules.
///
/// The short version of everything below: `createWebViewWith` always returns
/// `nil` (no second webview can ever exist), and every navigation runs through
/// `NavigationPolicy` before WebKit is allowed to act on it.
final class KioskWebViewController: NSViewController {
    private let config: Config
    private let policy: NavigationPolicy

    private var webView: KioskWebView!

    /// Retry bookkeeping for `reloadOnFailureSeconds`. Reset on every
    /// successful navigation so a kiosk that recovers gets its full retry
    /// budget back the next time the network drops.
    private var failureCount = 0
    private var retryTimer: Timer?

    init(config: Config) {
        self.config = config
        self.policy = NavigationPolicy(config: config)
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("KioskBrowser builds its UI in code; there are no nibs to decode.")
    }

    deinit {
        retryTimer?.invalidate()
    }

    // MARK: - View

    override func loadView() {
        let configuration = WKWebViewConfiguration()

        // First line of defence against window.open(). Not the only one — see
        // createWebViewWith below, which is what actually holds.
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        configuration.defaultWebpagePreferences.allowsContentJavaScript =
            config.allowContentJavaScript
        configuration.websiteDataStore =
            config.persistCookies ? .default() : .nonPersistent()

        webView = KioskWebView(frame: .zero, configuration: configuration)
        webView.allowReloadContextMenu = config.allowReloadContextMenu
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = false
        webView.allowsMagnification = false
        // No visible drop target: dragging a file or URL onto the window is
        // another way to navigate a kiosk somewhere it shouldn't go. The
        // navigation delegate would catch it anyway; this stops the drag from
        // ever registering.
        webView.unregisterDraggedTypes()

        // `isInspectable` is macOS 13.3+. Release builds never touch it — the
        // property defaults to false, which is the shipping behaviour we want.
        #if DEBUG
        if #available(macOS 13.3, *), config.allowDevToolsInDebugBuilds {
            webView.isInspectable = true
        }
        #endif

        view = webView
    }

    override func viewDidAppear() {
        super.viewDidAppear()
        loadHome()
    }

    // MARK: - Loading

    /// Load (or reload) the configured home URL. Also the recovery path for
    /// navigation failures and stray `window.close()` calls.
    func loadHome() {
        guard let homeURL = config.homeURL else {
            presentFatalConfigError(
                "The configured url is not a valid URL: \"\(config.url)\""
            )
            return
        }

        if homeURL.isFileURL {
            // A file: load needs an explicit read scope; grant the containing
            // directory so sibling assets (CSS, images) resolve.
            webView.loadFileURL(
                homeURL,
                allowingReadAccessTo: homeURL.deletingLastPathComponent()
            )
        } else {
            webView.load(URLRequest(url: homeURL))
        }
    }

    func reload() {
        // `reload()` on a webview whose last load failed has nothing to reload,
        // so go back to the home URL instead of webView.reload().
        loadHome()
    }

    private func scheduleRetry() {
        guard config.reloadOnFailureSeconds > 0 else { return }
        if config.reloadMaxAttempts > 0, failureCount >= config.reloadMaxAttempts {
            NSLog(
                "KioskBrowser: giving up after %ld failed loads of %@",
                failureCount, config.url
            )
            return
        }

        // Exponential backoff, capped at a minute so a kiosk that has been
        // offline overnight still recovers promptly once the network returns.
        let multiplier = max(1, config.reloadBackoffMultiplier)
        let delay = min(
            60,
            config.reloadOnFailureSeconds * pow(multiplier, Double(failureCount))
        )
        failureCount += 1

        retryTimer?.invalidate()
        retryTimer = Timer.scheduledTimer(
            withTimeInterval: delay,
            repeats: false
        ) { [weak self] _ in
            self?.loadHome()
        }
    }

    private func cancelRetries() {
        retryTimer?.invalidate()
        retryTimer = nil
        failureCount = 0
    }

    private func presentFatalConfigError(_ message: String) {
        // Config errors are an ops problem, and a kiosk stuck on a blank screen
        // gives them nothing to work with. Render the message in-place rather
        // than opening a dialog nobody may be standing in front of.
        NSLog("KioskBrowser: %@", message)
        let escaped = message
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
        webView.loadHTMLString(
            """
            <html><body style="font: 16px -apple-system; padding: 3rem; color: #222">
            <h1>Kiosk configuration error</h1><p>\(escaped)</p>
            </body></html>
            """,
            baseURL: nil
        )
    }
}

// MARK: - WKNavigationDelegate

extension KioskWebViewController: WKNavigationDelegate {
    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        let url = navigationAction.request.url

        // Belt and suspenders with createWebViewWith: anything that would have
        // become a new window dies here too. `targetFrame == nil` covers
        // target="_blank", window.open, and cmd/middle-clicked links.
        if navigationAction.targetFrame == nil {
            decisionHandler(.cancel)
            if config.openNewWindowLinksInPlace,
               policy.allowsLoadingInPlace(url),
               let url {
                // Starting a load from inside the decision handler is asking
                // WebKit to re-enter itself; hop to the next runloop turn first.
                DispatchQueue.main.async {
                    webView.load(URLRequest(url: url))
                }
            } else {
                NSLog(
                    "KioskBrowser: suppressed new window for %@",
                    url?.absoluteString ?? "(nil)"
                )
            }
            return
        }

        switch policy.decision(for: url) {
        case .allow:
            decisionHandler(.allow)

        case .cancel:
            NSLog("KioskBrowser: blocked navigation to %@", url?.absoluteString ?? "(nil)")
            decisionHandler(.cancel)

        case .openInSystemBrowser:
            decisionHandler(.cancel)
            if let url {
                NSWorkspace.shared.open(url)
            }
        }
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationResponse: WKNavigationResponse,
        decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void
    ) {
        guard !config.allowDownloads else {
            decisionHandler(.allow)
            return
        }

        let isAttachment: Bool = {
            guard let http = navigationResponse.response as? HTTPURLResponse,
                  let disposition = http.value(forHTTPHeaderField: "Content-Disposition")
            else { return false }
            return disposition.lowercased().contains("attachment")
        }()

        // A response WebKit can't render becomes a download, and a download
        // means Finder windows and Downloads-folder chrome on a machine that is
        // supposed to show exactly one page.
        if !navigationResponse.canShowMIMEType || isAttachment {
            NSLog(
                "KioskBrowser: blocked download of %@",
                navigationResponse.response.url?.absoluteString ?? "(nil)"
            )
            decisionHandler(.cancel)
            return
        }

        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        cancelRetries()
    }

    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error
    ) {
        handleNavigationFailure(error)
    }

    func webView(
        _ webView: WKWebView,
        didFail navigation: WKNavigation!,
        withError error: Error
    ) {
        handleNavigationFailure(error)
    }

    private func handleNavigationFailure(_ error: Error) {
        let nsError = error as NSError

        // Our own `.cancel` decisions surface here as errors. Retrying them
        // would turn every blocked link into a reload loop back to the home URL.
        if nsError.domain == NSURLErrorDomain, nsError.code == NSURLErrorCancelled {
            return
        }
        // WebKitErrorFrameLoadInterruptedByPolicyChange — same story, raised
        // when a navigation-response decision cancels a load.
        if nsError.domain == "WebKitErrorDomain", nsError.code == 102 {
            return
        }

        NSLog("KioskBrowser: navigation failed (%@), scheduling retry", nsError.localizedDescription)
        scheduleRetry()
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        // The content process was killed (OOM, crash). Nothing is on screen but
        // white; come back to the home URL rather than sit there.
        NSLog("KioskBrowser: web content process terminated, reloading home")
        loadHome()
    }
}

// MARK: - WKUIDelegate

extension KioskWebViewController: WKUIDelegate {
    /// The single most important method in this file. Returning nil means WebKit
    /// has no second webview to put anything in, so `target="_blank"`,
    /// `window.open()`, cmd-click and middle-click cannot produce a window —
    /// there is nothing to produce it *into*.
    ///
    /// (In practice the navigation delegate above usually gets there first and
    /// redirects the load in-place; this stays as the hard floor.)
    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        let url = navigationAction.request.url
        if config.openNewWindowLinksInPlace, policy.allowsLoadingInPlace(url), let url {
            webView.load(URLRequest(url: url))
        } else {
            NSLog(
                "KioskBrowser: suppressed new window for %@",
                url?.absoluteString ?? "(nil)"
            )
        }
        return nil
    }

    /// Some pages call `window.close()` on what they assume is a popup. There is
    /// no popup, so treat it as "the session is over": go home.
    func webViewDidClose(_ webView: WKWebView) {
        loadHome()
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptAlertPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping () -> Void
    ) {
        guard config.showJavaScriptDialogs else {
            // Auto-dismissed: the page carries on, the kiosk shows no chrome.
            completionHandler()
            return
        }
        runAlert(message: message, buttons: ["OK"]) { _ in completionHandler() }
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptConfirmPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping (Bool) -> Void
    ) {
        guard config.showJavaScriptDialogs else {
            completionHandler(false)
            return
        }
        runAlert(message: message, buttons: ["OK", "Cancel"]) { response in
            completionHandler(response == .alertFirstButtonReturn)
        }
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptTextInputPanelWithPrompt prompt: String,
        defaultText: String?,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping (String?) -> Void
    ) {
        guard config.showJavaScriptDialogs else {
            completionHandler(nil)
            return
        }

        let field = NSTextField(frame: NSRect(x: 0, y: 0, width: 260, height: 24))
        field.stringValue = defaultText ?? ""
        runAlert(message: prompt, buttons: ["OK", "Cancel"], accessory: field) { response in
            completionHandler(response == .alertFirstButtonReturn ? field.stringValue : nil)
        }
    }

    /// `<input type="file">`. An open panel is a full Finder browser bolted onto
    /// the kiosk; never show one.
    func webView(
        _ webView: WKWebView,
        runOpenPanelWith parameters: WKOpenPanelParameters,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping ([URL]?) -> Void
    ) {
        completionHandler(nil)
    }

    private func runAlert(
        message: String,
        buttons: [String],
        accessory: NSView? = nil,
        completion: @escaping (NSApplication.ModalResponse) -> Void
    ) {
        let alert = NSAlert()
        alert.messageText = message
        alert.accessoryView = accessory
        for button in buttons {
            alert.addButton(withTitle: button)
        }

        guard let window = view.window else {
            completion(alert.runModal())
            return
        }
        alert.beginSheetModal(for: window, completionHandler: completion)
    }
}

// MARK: - KioskWebView

/// `WKWebView` subclass whose only job is the context menu.
///
/// On macOS the documented way to trim the right-click menu is
/// `willOpenMenu(_:with:)` (WKWebView is an NSView, so it inherits it); the
/// `contextMenuConfigurationForElement` UI-delegate hook in the spec is the iOS
/// spelling and is unavailable on macOS. Emptying the menu here is what removes
/// "Open Link in New Window", "Download Linked File", "Inspect Element" and
/// "View Source" — WebKit builds those items unconditionally, and this is the
/// last point before they're shown.
final class KioskWebView: WKWebView {
    var allowReloadContextMenu = false

    override func willOpenMenu(_ menu: NSMenu, with event: NSEvent) {
        menu.removeAllItems()
        guard allowReloadContextMenu else {
            // An empty menu is not displayed at all, which is the goal.
            return
        }
        let item = menu.addItem(
            withTitle: "Reload",
            action: #selector(reloadFromContextMenu(_:)),
            keyEquivalent: ""
        )
        item.target = self
    }

    @objc private func reloadFromContextMenu(_ sender: Any?) {
        _ = reload()
    }
}
