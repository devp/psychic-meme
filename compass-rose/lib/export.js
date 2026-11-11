// Plain-text exports, for pasting into notes or a therapist's worksheet.
// Pure: records in, strings out (tests/export.test.mjs).
//
// mermaid-utils/ in this repo is CLI tasks only (build/watch .mmd files); it
// has no label escaping, so mermaidLabel() is here.

import { chronological, titleOf } from "./thought.js";

/** @typedef {import("./thought.js").ThoughtRecord} ThoughtRecord */
/** @typedef {import("./thought.js").Entry} Entry */

/** @param {number} n */
const pad = (n) => String(n).padStart(2, "0");
/** @param {number} ts local date, YYYY-MM-DD */
const day = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
/** @param {number} ts local time, HH:MM */
const clock = (ts) => {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
/** @param {string} s */
const oneLine = (s) => s.replace(/\s*[\r\n]+\s*/g, " ").trim();
/** @param {string} s */
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** @param {Entry} e text plus a resolution's feel, if any */
function body(e) {
  const text = oneLine(e.text);
  const feel = e.feel ? `(feels ${e.feel})` : "";
  return [text, feel].filter(Boolean).join(" ");
}

// ---- 1. chronological fast text -------------------------------------------

/**
 * One line per entry, oldest first. The first line, and the first line of
 * each new day, carries the date; the rest carry the time.
 *
 *   2026-11-11 Situation: Presenting to the team tomorrow
 *   14:02 [thought] I'm going to mess this up
 *
 * @param {ThoughtRecord} rec
 */
export function chronoText(rec) {
  let lastDay = "";
  return chronological(rec.entries)
    .map((e) => {
      const d = day(e.ts);
      if (d !== lastDay) {
        lastDay = d;
        return `${d} ${capital(e.category)}: ${body(e)}`.trimEnd();
      }
      return `${clock(e.ts)} [${e.category}] ${body(e)}`.trimEnd();
    })
    .join("\n");
}

/**
 * Every record, oldest first, separated by a blank line.
 * @param {ThoughtRecord[]} recs
 */
export function chronoTextAll(recs) {
  return recs
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(chronoText)
    .filter(Boolean)
    .join("\n\n");
}

// ---- 2. markdown: mermaid graph + outline ---------------------------------

/**
 * Text safe inside a double-quoted Mermaid label: `n1["..."]`.
 * Mermaid's entity codes are `#name;` or `#number;`, so `#` itself goes first.
 * Backticks are escaped too: inside the label they'd switch on Mermaid's
 * markdown strings, and three in a row would close the mermaid code fence.
 * @param {string} text
 */
export function mermaidLabel(text) {
  return oneLine(text)
    .replace(/#/g, "#35;")
    .replace(/"/g, "#quot;")
    .replace(/</g, "#lt;")
    .replace(/>/g, "#gt;")
    .replace(/`/g, "#96;");
}

/**
 * A fenced mermaid flowchart. Ids n1, n2, ... follow chronological order; they're
 * stable within one export only.
 * @param {ThoughtRecord} rec
 */
export function mermaid(rec) {
  const entries = chronological(rec.entries);
  const ids = new Map(entries.map((e, i) => [e.id, `n${i + 1}`]));
  const lines = ["flowchart TD"];
  for (const e of entries) lines.push(`  ${ids.get(e.id)}["${e.category}: ${mermaidLabel(body(e))}"]`);
  for (const c of rec.connections) {
    const from = ids.get(c.from);
    const to = ids.get(c.to);
    if (from && to) lines.push(`  ${from} --> ${to}`);
  }
  return "```mermaid\n" + lines.join("\n") + "\n```";
}

/**
 * Nested list, following connections from each root (an entry nothing led
 * to), oldest first. An entry already printed shows as `(back to) ...`
 * instead of recursing, so loops end and every entry appears in full once.
 * Entries reachable only around a loop, with no root, start their own branch.
 * @param {ThoughtRecord} rec
 */
export function outline(rec) {
  const entries = chronological(rec.entries);
  const byId = new Map(entries.map((e) => [e.id, e]));
  const order = new Map(entries.map((e, i) => [e.id, i]));
  /** @type {Map<string, string[]>} */
  const children = new Map();
  const hasParent = new Set();
  for (const c of rec.connections) {
    if (!byId.has(c.from) || !byId.has(c.to)) continue;
    children.set(c.from, [...(children.get(c.from) ?? []), c.to]);
    hasParent.add(c.to);
  }
  for (const list of children.values()) list.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));

  const printed = new Set();
  /** @type {string[]} */
  const lines = [];
  /** @param {Entry} e */
  const label = (e) => `**${e.category}** ${body(e)}`.trimEnd();

  /** @param {string} id @param {number} depth */
  function walk(id, depth) {
    const e = /** @type {Entry} */ (byId.get(id));
    const indent = "  ".repeat(depth);
    if (printed.has(id)) {
      lines.push(`${indent}- (back to) ${label(e)}`);
      return;
    }
    printed.add(id);
    lines.push(`${indent}- ${label(e)}`);
    for (const child of children.get(id) ?? []) walk(child, depth + 1);
  }

  for (const e of entries) if (!hasParent.has(e.id)) walk(e.id, 0);
  for (const e of entries) if (!printed.has(e.id)) walk(e.id, 0);
  return lines.join("\n");
}

/**
 * The two-part markdown: a Mermaid graph, then the same as an outline for
 * places that don't render Mermaid.
 * @param {ThoughtRecord} rec
 * @param {number} [level] heading level for the two parts
 */
export function markdownGraph(rec, level = 2) {
  const h = "#".repeat(level);
  return `${h} Graph\n\n${mermaid(rec)}\n\n${h} Outline\n\n${outline(rec)}\n`;
}

/**
 * Every record, oldest first, each under its own title.
 * @param {ThoughtRecord[]} recs
 */
export function markdownGraphAll(recs) {
  return recs
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((r) => `# ${oneLine(titleOf(r))}\n\n${markdownGraph(r, 2)}`)
    .join("\n");
}
