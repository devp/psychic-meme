// Loading an engine, whatever it ships as. lang.js calls these at top level
// (it may await; app.js waits for it), with URLs relative to itself:
//
//   const src = (/** @type {string} */ p) => new URL(p, import.meta.url);
//
//   // a classic script that defines globals (UMD builds; lil.js, which assigns
//   // undeclared names and so throws as a module)
//   globalThis.fengari ?? (await loadScript(src("vendor/fengari-web.js")));
//
//   // an ES module: no helper, the platform has one
//   const engine = await import("./vendor/engine.mjs");
//
//   // WebAssembly: the instance's exports are the engine
//   const { instance } = await loadWasm(src("vendor/engine.wasm"), { env: { ... } });
//
//   // anything else -- source the engine runs (fennel.lua), a stdlib image, data
//   const lua = await fetchText(src("vendor/fennel.lua"));
//   const image = await fetchBytes(src("vendor/boot.img"));
//
// Emscripten-style builds are JS glue plus a .wasm the glue fetches: load the
// glue with loadScript or import, and list both files in sw-assets.js. Every
// file an engine fetches has to be in ASSETS, or it's missing offline.
//
// Node (the unit tests) has no document and its fetch can't read file: URLs,
// so the fetching helpers read those from disk instead. loadScript can't run
// there: tests/load-lang.mjs runs the script first, hence the guard above.

/**
 * Run a classic script, in the page's global scope.
 * @param {string | URL} src
 * @returns {Promise<void>} once it has run
 */
export function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = String(src);
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("couldn't load " + src));
    document.head.append(s);
  });
}

/**
 * Compile and instantiate a .wasm file. Streams when the server says
 * application/wasm; otherwise (some static hosts, node) compiles the bytes.
 * @param {string | URL} src
 * @param {WebAssembly.Imports} [imports]
 * @returns {Promise<WebAssembly.WebAssemblyInstantiatedSource>}
 */
export async function loadWasm(src, imports = {}) {
  if (isFile(src)) return WebAssembly.instantiate(/** @type {BufferSource} */ (await fetchBytes(src)), imports);
  const res = await get(src);
  if (res.headers.get("content-type")?.startsWith("application/wasm")) return WebAssembly.instantiateStreaming(res, imports);
  return WebAssembly.instantiate(await res.arrayBuffer(), imports);
}

/**
 * @param {string | URL} src
 * @returns {Promise<string>}
 */
export async function fetchText(src) {
  if (isFile(src)) return (await import("node:fs/promises")).readFile(new URL(src), "utf8");
  return (await get(src)).text();
}

/**
 * @param {string | URL} src
 * @returns {Promise<Uint8Array>}
 */
export async function fetchBytes(src) {
  if (isFile(src)) return new Uint8Array(await (await import("node:fs/promises")).readFile(new URL(src)));
  return new Uint8Array(await (await get(src)).arrayBuffer());
}

/** @param {string | URL} src */
async function get(src) {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`couldn't load ${src}: HTTP ${res.status}`);
  return res;
}

/** @param {string | URL} src */
const isFile = (src) => String(src).startsWith("file:");
