// Everything about the language, in one place: the plugin. The rest of the
// app is the same REPL shell in every pizza-repl-<lang> (../pizza-repl, whose
// README has the contract); swapping this file (plus vendor/ and docs/) is the
// port.
//
// Prolog: Tau Prolog, vendor/tau-prolog.js, a classic script loaded below
// that defines the `pl` global.
//
// An entry is Prolog source, read like a file: clauses join the program,
// `?- Goal.` runs a query, and `;` asks the last query for more answers. A
// blank line also ends a clause, so the final `.` is optional and an export
// (entries separated by blank lines) replays entry by entry. Each paragraph's
// clauses are consulted together, so re-entering a predicate replaces it.
//
// Tau delivers query answers, and runs `?-` inside consulted text, through
// setTimeout. So queries never go through it: nextAnswer() is Tau's own search
// loop, run synchronously.

import { loadScript } from "./lib/engine.js";

/** @type {any} vendor/tau-prolog.js's global, untyped */
const pl =
  /** @type {any} */ (globalThis).pl ??
  (await loadScript(new URL("vendor/tau-prolog.js", import.meta.url)), /** @type {any} */ (globalThis).pl);

export const name = "prolog";
export const comment = "%";
export const placeholder = "?- X is 6 * 7.";
/** The key row; ⋯ goes in the middle. */
export const keys = ["(", "[", "|", "_", "]", ")"];
/** Behind ⋯, ahead of any custom ones; each is pasted into the input as-is. */
export const commands = ["?-", ";"];
export const about = `
  <p>A REPL for pizza rats: <strong>Prolog</strong>, in your pocket, offline.</p>
  <p>
    It runs on <a href="http://tau-prolog.org/" target="_blank" rel="noopener">Tau Prolog</a>,
    by José Antonio Riaza Valverde. This is an unofficial REPL, not affiliated with that project.
  </p>`;

/**
 * The docs tab's menu. Ids are the old per-doc tab names, so a stored tab still opens its doc.
 * @type {{id: string, label?: string, src: string, note?: string}[]}
 */
export const docs = [
  { id: "guide", src: "docs/guide.md" },
  {
    id: "learn",
    src: "docs/learn.md",
    note: `From Learn X in Y minutes (learnxinyminutes.com/prolog, CC BY-SA 3.0).
      It's a Prolog file: paste the whole block in as one entry to run it.
      Written for SWI-Prolog, so a few answers differ here.`,
  },
  { id: "builtins", src: "docs/builtins.md" },
];

export const greeting =
  "Prolog (Tau) — clauses join the program; ?- runs a query; ; asks for more answers. ?- and ; are under ⋯. The docs tab explains; the log tab keeps your sessions.";

/** Inferences per entry before giving up; ~0.5s on a laptop. */
const LIMIT = 1_000_000;
/** Answers per entry before stopping to ask for `;`. */
const BATCH = 10;
/** Consult only the string itself: not a URL, file, or DOM id. */
const TEXT_ONLY = { url: false, file: false, script: false, html: false };
/** Directives Tau runs while consulting. initialization/1 runs via setTimeout, so it runs as a goal instead. */
const DIRECTIVES = new Set(Object.keys(pl.directive).map((k) => k.split("/")[0]));
DIRECTIVES.delete("initialization");

const session = pl.create();

let printed = "";
/** user_output and user_error, collected per entry. */
const sink = { put: (/** @type {string} */ text) => ((printed += text), true), flush: () => true };
/** user_input: there's no stdin, so read/1 sees end_of_file (Tau's default is window.prompt). */
const noInput = { get: () => "end_of_stream", eof: () => true };
session.streams.user_output = session.standard_output = session.current_output =
  new pl.type.Stream(sink, "append", "user_output", "text", false, "reset");
session.streams.user_error = session.standard_error = new pl.type.Stream(sink, "append", "user_error", "text", false, "reset");
session.streams.user_input = session.standard_input = session.current_input =
  new pl.type.Stream(noInput, "read", "user_input", "text", false, "reset");

/** The query `;` continues, if it might have more answers. */
let pending = false;

const LIBRARIES = ["lists", "format", "charsio", "random", "statistics"];
// Tau lacks the usual prefix operator, so `:- dynamic foo/1.` wouldn't parse.
consult([...LIBRARIES.map((m) => `:- use_module(library(${m})).`), ":- op(1150, fx, dynamic)."].join("\n"));

// SWI-Prolog staples that tutorials (the learn doc among them) lean on and Tau
// lacks. A module of their own keeps them out of `listing.`; importing it is
// what use_module does for a library (vendor/tau-prolog.js:4563).
consult(`:- module(compat, [writeln/1, print/1, plus/3, memberchk/2]).
writeln(X) :- write(X), nl.
print(X) :- writeq(X).
plus(X, Y, Z) :- nonvar(X), nonvar(Y), !, Z is X + Y.
plus(X, Y, Z) :- nonvar(X), nonvar(Z), !, Y is Z - X.
plus(X, Y, Z) :- X is Z - Y.
memberchk(X, [Y|T]) :- ( X = Y -> true ; memberchk(X, T) ).`);
session.modules.user.modules.compat = session.modules.compat;

/**
 * Built in, or from a preloaded library. Tau lets the user module redefine
 * these, and a `?-` left off (`X = 1.`) would then break `=` for the session.
 * @param {string} indicator
 */
const isBuiltin = (indicator) =>
  indicator in pl.modules.system.rules ||
  [...LIBRARIES, "compat"].some((m) => session.modules[m].exports_predicate(indicator));

/**
 * @param {string} source
 * @returns {{text: string, isError: boolean}}
 */
export function evaluate(source) {
  printed = "";
  if (hasUnclosedComment(source)) return { text: "Unclosed /* comment: close it with */ and run again.", isError: true };
  const parts = split(source);
  const echo = parts.length > 1;
  /** @type {string[]} */
  const lines = [];
  let isError = false;
  for (const part of parts) {
    if (echo && part.kind !== "program") lines.push(part.clause);
    const r = part.kind === "program" ? consult(part.text) : part.kind === "goal" ? ask(part.text) : more();
    lines.push(...r.lines);
    isError ||= r.isError;
  }
  return { text: lines.join("\n"), isError };
}

/**
 * Entries as Tau sees them, cut into runs of program clauses, goals, and `;`.
 * Text Tau can't tokenize stays whole, for Tau to report.
 * @param {string} source
 * @returns {{kind: "program" | "goal" | "more", text: string, clause: string}[]}
 */
function split(source) {
  const tokens = tokenize(source);
  if (!tokens) return [{ kind: "program", text: source, clause: source }];
  /** @type {{kind: "program" | "goal" | "more", text: string, clause: string}[]} */
  const parts = [];
  // Program clauses not yet consulted. (Cast, or TS narrows it to null for good.)
  let run = /** @type {{from: number, to: number, dot: boolean} | null} */ (null);
  const flush = () => {
    if (run) {
      const text = source.slice(run.from, run.to);
      parts.push({ kind: "program", text: run.dot ? text : `${text} .`, clause: text });
    }
    run = null;
  };
  const blankBetween = (/** @type {number} */ k) => k < tokens.length - 1 && /\n[ \t]*\n/.test(source.slice(tokens[k].to, tokens[k + 1].from));
  let i = 0;
  while (i < tokens.length) {
    // A clause: up to an end `.`, a blank line, or the end of the entry.
    let j = i;
    while (j < tokens.length - 1 && !tokens[j].end && !blankBetween(j)) j++;
    const first = tokens[i], last = tokens[j];
    const clause = source.slice(first.from, last.to);
    const body = j > i ? source.slice(tokens[i + 1].from, last.to) : "";
    if (first.raw === "?-" || (first.raw === ":-" && !(j > i && DIRECTIVES.has(tokens[i + 1].raw)))) {
      flush();
      parts.push({ kind: "goal", text: last.end ? body : `${body} .`, clause });
    } else if (i === j && first.raw === ";") {
      flush();
      parts.push({ kind: "more", text: clause, clause });
    } else {
      run = { from: run?.from ?? first.from, to: last.to, dot: last.end };
    }
    if (blankBetween(j)) flush();
    i = j + 1;
  }
  flush();
  return parts;
}

/**
 * Tau's tokens with absolute offsets, and whether each ends a clause.
 * Null if the source has a lexical error (an unclosed quote, say).
 * @param {string} source
 * @returns {{raw: string, from: number, to: number, end: boolean}[] | null}
 */
function tokenize(source) {
  const raw = rawTokens(source);
  if (raw.some((/** @type {any} */ k) => k.name === "lexical")) return null;
  return raw.map((/** @type {any} */ k) => {
    const to = k.len, from = to - k.matches[0].length;
    const end = k.name === "atom" && k.matches[0] === "." && (to === source.length || /[\s%]/.test(source[to]));
    return { raw: k.matches[0], from, to, end };
  });
}

/** @param {string} source @returns {any[]} */
function rawTokens(source) {
  const t = new pl.parser.tokenizer(session.thread);
  t.new_text(source);
  return t.get_tokens(0) ?? []; // null when there are none
}

/**
 * Tau's tokenizer takes an unclosed block comment as running to the end, so
 * look in what follows the last token: only layout and comments.
 * @param {string} source
 */
function hasUnclosedComment(source) {
  const tail = source.slice(rawTokens(source).at(-1)?.len ?? 0);
  for (let i = 0; i < tail.length; i++) {
    if (tail[i] === "%") {
      i = tail.indexOf("\n", i);
      if (i === -1) return false;
    } else if (tail.startsWith("/*", i)) {
      i = tail.indexOf("*/", i + 2);
      if (i === -1) return true;
      i++;
    }
  }
  return false;
}

/**
 * Consult clauses; report each predicate they (re)defined, and Tau's warnings.
 * @param {string} text
 */
function consult(text) {
  // Once either hook exists, Tau consults (vendor/tau-prolog.js:1102, 1247) and
  // queries (:1298) through setTimeout, and every later entry would run late.
  const tokens = tokenize(text) ?? [];
  const hook = tokens.find((k, i) => (i === 0 || tokens[i - 1].end) && /^(term|goal)_expansion$/.test(k.raw));
  if (hook) return { lines: [`${hook.raw}/2 can't be defined here: Tau would run everything after it asynchronously.`], isError: true };
  const rules = session.modules.user.rules;
  const before = new Map(Object.entries(rules));
  session.thread.warnings = [];
  /** @type {any} */
  let error = null;
  session.consult(text, { ...TEXT_ONLY, success() {}, error: (/** @type {any} */ e) => (error = e) });
  const lines = output();
  let refused = false;
  for (const [indicator, clauses] of Object.entries(rules)) {
    if (before.get(indicator) === clauses || indicator.startsWith("$")) continue;
    if (isBuiltin(indicator)) {
      // Lookup only asks the user module whether it has the rules
      // (vendor/tau-prolog.js:2980), so dropping them restores the builtin.
      const user = session.modules.user;
      delete rules[indicator];
      delete user.indexed_clauses[indicator];
      delete user.non_indexable_clauses[indicator];
      lines.push(`${indicator} is built in, so it can't be redefined. To ask it, start with ?-`);
      refused = true;
    } else {
      lines.push(`${indicator}: ${clauses.length} clause${clauses.length === 1 ? "" : "s"}`);
    }
  }
  // A directive that failed (`:- use_module(library(nope)).`) is only a warning to Tau.
  let failed = false;
  for (const w of session.thread.warnings) {
    lines.push(`Warning: ${describeWarning(w)}`);
    failed ||= w.indicator === "error/2";
  }
  if (error) lines.push(pl.format_answer(error, session, { quoted: true }));
  return { lines, isError: refused || failed || !!error };
}

/** @param {any} w */
function describeWarning(w) {
  const opts = { session, quoted: true };
  if (w.indicator !== "warning/2") return w.toString(opts);
  const [what, where] = w.args;
  if (what.indicator !== "singleton_variables/2") return what.toString(opts);
  const line = where.toString().match(/line\((\d+)\)/)?.[1]; // 0-based
  return `singleton variables ${what.args[0].toString(opts)} in ${what.args[1].toString(opts)}${line ? `, line ${+line + 1}` : ""}`;
}

/** @param {string} goal */
function ask(goal) {
  pending = false;
  /** @type {any} */
  let error = null;
  session.query(goal, { success() {}, error: (/** @type {any} */ e) => (error = e) });
  if (error) return { lines: [...output(), pl.format_answer(error, session, { quoted: true })], isError: true };
  pending = true;
  return more();
}

/** Answers from the pending query: up to BATCH of them, within LIMIT inferences. */
function more() {
  if (!pending) return { lines: ["No query to ask for more: run one with ?- first."], isError: true };
  /** @type {string[]} */
  const lines = [];
  let budget = LIMIT;
  for (let n = 1; ; n++) {
    const r = nextAnswer(session.thread, budget);
    budget = r.budget;
    lines.push(...output());
    if (r.kind === "answer") {
      lines.push(`${r.text}${r.more ? " ;" : "."}`);
      if (!r.more) return done(lines, false);
      if (n === BATCH) return { lines: [...lines, "(; for more)"], isError: false };
    } else if (r.kind === "false") {
      return done([...lines, "false."], false);
    } else if (r.kind === "error") {
      return done([...lines, r.text], true);
    } else {
      // Pending stays: `;` resumes the search where it stopped.
      return { lines: [...lines, `Stopped after ${LIMIT.toLocaleString("en")} inferences; ; keeps going.`], isError: true };
    }
  }
}

/** @param {string[]} lines @param {boolean} isError */
function done(lines, isError) {
  pending = false;
  return { lines, isError };
}

/**
 * Thread.prototype.again (vendor/tau-prolog.js, modules/core.js:3188), minus
 * its setTimeout callbacks, with the inference budget passed in.
 * @param {any} thread
 * @param {number} budget
 * @returns {{kind: "answer", text: string, more: boolean, budget: number} | {kind: "false" | "limit", budget: number} | {kind: "error", text: string, budget: number}}
 */
function nextAnswer(thread, budget) {
  while (budget > 0 && thread.points.length > 0 && thread.head_point().goal !== null && !pl.type.is_error_state(thread.head_point())) {
    budget--;
    thread.step();
  }
  if (budget <= 0) return { kind: "limit", budget };
  if (thread.points.length === 0) return { kind: "false", budget };
  if (pl.type.is_error(thread.head_point().goal)) {
    const error = thread.format_error(thread.points.pop());
    thread.points = [];
    return { kind: "error", text: pl.format_answer(error, session, { quoted: true }), budget };
  }
  const answer = thread.format_success(thread.points.pop());
  return { kind: "answer", text: pl.format_answer(answer, session, { quoted: true }), more: thread.points.length > 0, budget };
}

/** What the program printed since last asked, as lines. */
function output() {
  const text = printed.replace(/\n$/, "");
  printed = "";
  return text === "" ? [] : text.split("\n");
}

/**
 * An unclosed quote or block comment: it would swallow what follows.
 * (An unclosed bracket can't: Prolog's end `.` still ends the clause.)
 * @param {string} source
 */
export function hasUnterminated(source) {
  const lexical = rawTokens(source).find((k) => k.name === "lexical");
  return lexical ? /^['"`]/.test(lexical.value) : hasUnclosedComment(source);
}

/**
 * Pasting an export reruns it entry by entry, `;` included.
 * @param {string[]} _inputs
 * @returns {string[]}
 */
export function replayCaveat(_inputs) {
  return [];
}

/**
 * learn.md comes with YAML front matter.
 * @param {string} md
 */
export function preprocessDoc(md) {
  return md.replace(/^---\n[\s\S]*?\n---\n/, "");
}
