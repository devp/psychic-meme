// Everything about the language, in one place. The rest of the app is the
// same REPL shell in every pizza-repl-<lang>; swapping this file (plus
// vendor/ and docs/) is the port.
//
// Lil: vendor/lil.js, a classic script that defines its API as globals, loaded
// by index.html before this module. Wrapped the way Decker's own Lilt CLI
// (js/repl.js in JohnEarnest/Decker) does it, minus the filesystem/OS bindings
// that don't exist in a browser (read, write, dir, shell, exit, import, newdeck).

/** @type {any} lil.js's globals, untyped */
const lil = globalThis;

export const name = "lil";
export const comment = "#";
export const placeholder = "1+2";
export const greeting = "lil REPL — try 1+2 or show[1,2,3]. Reference tabs above; the log tab keeps your sessions.";

// Normally supplied by Decker's build step; lil.js reads it for sys.version.
lil.VERSION ??= "1.70";

/** @type {any} created on first evaluate, so tests can import this file without lil.js */
let env = null;
/** @type {string[]} print/show output from the current evaluate */
let printed = [];

function makeEnv() {
  const e = lil.lmenv();
  /** @param {any[]} args */
  const printText = (args) => lil.ls(args.length > 1 ? lil.dyad.format(args[0], lil.lml(args.slice(1))) : args[0]);
  e.local("print", lil.lmnat((/** @type {any[]} */ args) => {
    printed.push(printText(args));
    return lil.NIL;
  }));
  e.local("show", lil.lmnat((/** @type {any[]} */ args) => {
    printed.push(args.map((x) => lil.show(x, args.length === 1)).join(" "));
    return args[0] ?? lil.NIL;
  }));
  for (const n of ["random", "array", "image", "sound", "keystore", "eval", "writecsv", "readcsv", "writexml", "readxml"]) {
    e.local(n, lil.lmnat(lil["n_" + n]));
  }
  e.local("alert", lil.lmnat(() => lil.ONE));
  e.local("panic", lil.lmnat(() => lil.NIL));
  lil.constants(e);
  return e;
}

/** @param {any} prog */
function run(prog) {
  lil.pushstate(env);
  lil.issue(env, prog);
  while (lil.running()) lil.runop();
  const r = lil.arg();
  lil.popstate();
  return r;
}

/** @param {any} e */
function formatError(e) {
  if (e && typeof e === "object" && "x" in e) return `(${e.r + 1}:${e.c + 1}) ${e.x}`;
  if (e instanceof Error) return e.message;
  return String(e);
}

/**
 * Print/show output comes first, then the value. `_` is bound to the value.
 * @param {string} source
 * @returns {{text: string, isError: boolean}}
 */
export function evaluate(source) {
  env ??= makeEnv();
  printed = [];
  try {
    const value = run(lil.parse(source));
    env.local("_", value);
    const shown = lil.show(value, true);
    return { text: printed.concat(shown === "" ? [] : [shown]).join("\n"), isError: false };
  } catch (e) {
    return { text: printed.concat([formatError(e)]).join("\n"), isError: true };
  }
}

/**
 * lil lets end-of-input close a string or a bracketed call, so `"hello` and
 * `show[1,2` are valid on their own. But they only work as the *last* thing in
 * a program: concatenated into a replay, they swallow whatever follows. Mirrors
 * lil's tokenizer: # comments to end of line, \" and \\ escapes in strings.
 * @param {string} source
 */
export function hasUnterminated(source) {
  let inString = false, inComment = false, depth = 0;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (inComment) {
      if (c === "\n") inComment = false;
    } else if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === "#") inComment = true;
    else if (c === "[" || c === "(") depth++;
    else if ((c === "]" || c === ")") && depth > 0) depth--;
  }
  return inString || depth > 0;
}

/**
 * Export caveat lines, or none. Pasting an export runs it as one program, so
 * `_` is only rebound at the end, not after each entry. Matched as a standalone
 * token: my_var doesn't count.
 * @param {string[]} inputs
 * @returns {string[]}
 */
export function replayCaveat(inputs) {
  if (!inputs.some((s) => /(^|[^A-Za-z0-9_])_([^A-Za-z0-9_]|$)/.test(s))) return [];
  return [
    "Heads up: this uses _, which won't replay faithfully. Pasting the",
    "whole transcript runs it as one program, so _ is only rebound at",
    "the end rather than after each line.",
  ];
}

/**
 * Decker's docs carry site-build markup: a title: line, {{TOC}}, and images
 * that aren't vendored.
 * @param {string} md
 */
export function preprocessDoc(md) {
  return md
    .replace(/^title:.*\n/, "")
    .replace(/^\{\{TOC\}\}\n?/m, "")
    .replace(/^!\[[^\]]*\]\(images\/[^)]*\)\n?/gm, "");
}
