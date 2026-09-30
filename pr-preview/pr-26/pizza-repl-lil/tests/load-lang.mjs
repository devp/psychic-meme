// lang.js needs vendor/lil.js's globals, which index.html provides with a
// classic <script>. Here, run it in this context the same way.
import vm from "node:vm";
import { readFileSync } from "node:fs";

vm.runInThisContext(readFileSync(new URL("../vendor/lil.js", import.meta.url), "utf8"), { filename: "vendor/lil.js" });

export const lang = await import("../lang.js");
