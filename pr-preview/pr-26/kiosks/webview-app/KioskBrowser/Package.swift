// swift-tools-version:5.7
import PackageDescription

// Single executable target, zero external dependencies: AppKit and WebKit are
// system frameworks. `swift build` produces a bare Mach-O binary; `build.sh`
// wraps that binary into the signed KioskBrowser.app bundle that ships.
let package = Package(
    name: "KioskBrowser",
    platforms: [.macOS(.v12)],
    targets: [
        .executableTarget(
            name: "KioskBrowser",
            path: "Sources/KioskBrowser"
        )
    ]
)
