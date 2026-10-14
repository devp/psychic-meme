// lang.js needs vendor/tau-prolog.js's global, which index.html provides with
// a classic <script>. Here, run it in this context.
import vm from "node:vm";
import { readFileSync } from "node:fs";

const g = /** @type {any} */ (globalThis);
g.window = globalThis; // Tau's modules attach `pl` to window outside CommonJS
vm.runInThisContext(readFileSync(new URL("../vendor/tau-prolog.js", import.meta.url), "utf8"), { filename: "vendor/tau-prolog.js" });

export const lang = await import("../lang.js");
