import Foundation

/// Parses `--key=value` style CLI arguments (the only form this app emits or
/// documents — see `HANDOFF.md` / `README`). Bare flags (`--foo` with no
/// `=value`) are not recognised; every switch here takes an explicit value.
struct CommandLineArguments {
    private let values: [String: String]

    init(_ arguments: [String]) {
        var values: [String: String] = [:]
        for argument in arguments {
            guard argument.hasPrefix("--"),
                  let equalsIndex = argument.firstIndex(of: "=") else { continue }
            let key = String(argument[argument.index(argument.startIndex, offsetBy: 2)..<equalsIndex])
            let value = String(argument[argument.index(after: equalsIndex)...])
            values[key] = value
        }
        self.values = values
    }

    func value(for key: String) -> String? {
        values[key]
    }

    func boolValue(for key: String) -> Bool? {
        switch value(for: key)?.lowercased() {
        case "true", "yes", "1": return true
        case "false", "no", "0": return false
        default: return nil
        }
    }

    func doubleValue(for key: String) -> Double? {
        value(for: key).flatMap(Double.init)
    }
}
