// lang.js needs vendor/fengari-web.js's global, which it loads as a classic
// <script> in the browser. Here, run it in this context first. (It also reads
// vendor/fennel.lua; lib/engine.js's fetchText reads that from disk in node.)
import vm from "node:vm";
import { readFileSync } from "node:fs";

const g = /** @type {any} */ (globalThis);
g.window = globalThis; // fengari-web's UMD wrapper passes `window` as its root
vm.runInThisContext(readFileSync(new URL("../vendor/fengari-web.js", import.meta.url), "utf8"), { filename: "vendor/fengari-web.js" });

export const lang = await import("../lang.js");
