// Everything about the language, in one place: the plugin. The rest of the
// app is the same REPL shell in every pizza-repl-<lang> (see ../README.md for
// the full contract); swapping this file, vendor/ and docs/ is the port.
//
// The skeleton's own language is the one the browser already has: JavaScript,
// via indirect eval, so it runs with nothing vendored. A real port loads its
// engine here -- a classic script, an ES module, WebAssembly, or files the
// engine reads -- with lib/engine.js, e.g.
//
//   import { loadScript } from "./lib/engine.js";
//   globalThis.lmenv ?? (await loadScript(new URL("vendor/lil.js", import.meta.url)));

// ---- identity ---------------------------------------------------------------

export const name = "js";
export const placeholder = "1 + 2";
export const greeting =
  "JavaScript REPL — try 1 + 2 or console.log('hi'). var and function persist; let and const don't. Docs tab above; the log tab keeps your sessions.";
/** Shown under About in Options. Trusted HTML: it's this file's, not the user's. */
export const about = `
  <p>A REPL for pizza rats: <strong>JavaScript</strong>, in your pocket, offline.</p>
  <p>This is the pizza-repl skeleton: it runs your browser's own JavaScript, so
  there's no engine to vendor. Copy it to make a REPL for another language.</p>`;

// ---- (1) evaluate -----------------------------------------------------------

/**
 * Console output first, then the value. `_` is bound to the value, as in node.
 * @param {string} source
 * @returns {{text: string, isError: boolean}}
 */
export function evaluate(source) {
  /** @type {string[]} */
  const printed = [];
  const log = console.log;
  console.log = (...args) => void printed.push(args.map((a) => (typeof a === "string" ? a : show(a))).join(" "));
  try {
    const value = (0, eval)(source); // indirect: global scope, not this module's
    /** @type {any} */ (globalThis)._ = value;
    return { text: [...printed, show(value)].join("\n"), isError: false };
  } catch (e) {
    return { text: [...printed, e instanceof Error ? `${e.name}: ${e.message}` : "Uncaught " + show(e)].join("\n"), isError: true };
  } finally {
    console.log = log;
  }
}

/** @param {unknown} v */
function show(v) {
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "function") return `[Function ${v.name || "(anonymous)"}]`;
  if (typeof v === "bigint") return v + "n";
  if (v === null || typeof v !== "object") return String(v);
  try {
    return JSON.stringify(v, (_k, x) => (typeof x === "function" ? `[Function ${x.name || "(anonymous)"}]` : typeof x === "bigint" ? x + "n" : x)) ?? String(v);
  } catch {
    return String(v); // cyclic
  }
}

/** Line-comment prefix, for the export. */
export const comment = "//";

/**
 * An open bracket, string, template or block comment at end of input: run on
 * its own it's a SyntaxError anyway, but in an export it would swallow what
 * follows. Approximate: a `/` that starts a regex isn't told from division.
 * @param {string} source
 */
export function hasUnterminated(source) {
  /** @type {string | null} */
  let quote = null;
  let depth = 0;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quote === "//") {
      if (c === "\n") quote = null;
    } else if (quote === "/*") {
      if (c === "*" && source[i + 1] === "/") (quote = null), i++;
    } else if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "/" && (source[i + 1] === "/" || source[i + 1] === "*")) quote = c + source[++i];
    else if (c === "(" || c === "[" || c === "{") depth++;
    else if ((c === ")" || c === "]" || c === "}") && depth > 0) depth--;
  }
  return (quote !== null && quote !== "//") || depth > 0;
}

/**
 * Export caveat lines, or none. Pasting an export runs it as one program, so
 * `_` is only rebound at the end, not after each entry.
 * @param {string[]} inputs
 * @returns {string[]}
 */
export function replayCaveat(inputs) {
  if (!inputs.some((s) => /(^|[^\w$])_([^\w$]|$)/.test(s))) return [];
  return [
    "Heads up: this uses _, which won't replay faithfully. Pasting the",
    "whole transcript runs it as one program, so _ is only rebound at",
    "the end rather than after each entry.",
  ];
}

/**
 * Optional: completions for the word at the caret, shown as chips above the
 * key row. Leave it out and the shell hides the strip and its option. Here:
 * global names and keywords, not properties after a `.` (that would mean
 * evaluating the left side, getters and all).
 * @param {string} source
 * @param {number} caret
 * @returns {{from: number, items: string[]} | null} items replace source.slice(from, caret)
 */
export function complete(source, caret) {
  let from = caret;
  while (from > 0 && /[\w$]/.test(source[from - 1])) from--;
  const fragment = source.slice(from, caret);
  if (fragment === "" || /^\d/.test(fragment) || source[from - 1] === "." || hasUnterminated(source.slice(0, from))) return null;
  const names = new Set([...KEYWORDS, ...Object.getOwnPropertyNames(globalThis)]);
  const items = [...names].filter((n) => n.startsWith(fragment) && n !== fragment).sort((a, b) => a.length - b.length || (a < b ? -1 : 1));
  return { from, items };
}

const KEYWORDS = "await break case catch class const continue debugger default delete do else export extends false finally for function if in instanceof let new null return super switch this throw true try typeof undefined var void while yield".split(" ");

// ---- (2) shortcuts ----------------------------------------------------------

/**
 * The key row above the input: one tap inserts. The ⋯ key sits in the middle,
 * so the halves mirror; colors pair up from the outside in.
 */
export const keys = ["(", "[", "{", "}", "]", ")"];
/** Behind the ⋯ key, ahead of the user's own (Options). Each is pasted in as-is. */
export const commands = ["console.log(", "=>", "_"];

// ---- (3) docs ---------------------------------------------------------------

/**
 * The docs tab, in menu order; the first is shown until another is picked.
 * `src` is Markdown (rendered by vendor/marked) or, ending in .html, an HTML
 * fragment used as-is. `note` is trusted HTML shown above the doc.
 * @type {{id: string, label?: string, src: string, note?: string}[]}
 */
export const docs = [
  { id: "guide", src: "docs/guide.md" },
  {
    id: "javascript",
    src: "docs/javascript.md",
    note: "Just enough JavaScript to use this REPL. MDN has the rest, when you're back online.",
  },
];

/**
 * Each doc's text before it's rendered: strip site-build markup, fix links.
 * @param {string} md
 * @param {string} _src the doc's src, for a language with several kinds
 */
export function preprocessDoc(md, _src) {
  return md;
}
