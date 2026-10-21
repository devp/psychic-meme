// Engines ship as classic scripts that define globals (UMD builds, or lil.js,
// which assigns undeclared names and so throws as a module). lang.js loads its
// own with this, so index.html stays the same in every pizza-repl-<lang>:
//
//   globalThis.fengari ?? (await loadScript(new URL("vendor/fengari-web.js", import.meta.url)));
//
// The guard is for tests: load-lang.mjs runs the engine in node first, and
// there's no document there to load anything into.

/**
 * @param {string | URL} src
 * @returns {Promise<void>} resolves once the script has run
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
