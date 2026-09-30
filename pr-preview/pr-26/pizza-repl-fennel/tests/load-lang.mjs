// lang.js needs vendor/fengari-web.js's global, which index.html provides with
// a classic <script>, and fetches vendor/fennel.lua. Here, run the one in this
// context and serve the other from disk.
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

const g = /** @type {any} */ (globalThis);
g.window = globalThis; // fengari-web's UMD wrapper passes `window` as its root
vm.runInThisContext(readFileSync(new URL("../vendor/fengari-web.js", import.meta.url), "utf8"), { filename: "vendor/fengari-web.js" });

const realFetch = g.fetch;
g.fetch = async (/** @type {URL|string} */ url) =>
  String(url).startsWith("file:") ? new Response(await readFile(new URL(url))) : realFetch(url);

export const lang = await import("../lang.js");
