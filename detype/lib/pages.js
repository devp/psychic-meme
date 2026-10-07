// A day's page: what it's called, what it says, how much of it there is.
//
// Pure functions over plain data -- no DOM, no storage -- so the tests can
// hold them without a browser.

/**
 * A stored line is `{ id, text, at }`. These functions only read `text`, and
 * take any record so the store's items fit without casting.
 * @typedef {Record<string, any>} Line
 */

/**
 * The day a moment belongs to, as YYYY-MM-DD in local time. Midnight is the
 * boundary: least surprise.
 * @param {Date} [d]
 * @returns {string}
 */
export function dayKey(d = new Date()) {
  const pad = (/** @type {number} */ n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * "Thursday, September 24, 2026" -- for reading, never for keys.
 * @param {string} key YYYY-MM-DD
 * @returns {string}
 */
export function dayLabel(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * A typed line as it should be kept: pasted newlines become spaces, and the
 * ends are trimmed. Empty means "don't keep it".
 * @param {string} raw
 * @returns {string}
 */
export function cleanLine(raw) {
  return raw.replace(/\s*[\r\n]+\s*/g, " ").trim();
}

/**
 * The whole day as one blob -- the thing you look back at.
 * @param {Line[]} lines
 * @returns {string}
 */
export function blob(lines) {
  return lines.map((l) => String(l.text ?? "")).join("\n");
}

/**
 * @param {Line[]} lines
 * @returns {{ words: number, chars: number, lines: number }}
 */
export function measure(lines) {
  let words = 0;
  let chars = 0;
  for (const l of lines) {
    const text = String(l.text ?? "");
    const w = text.trim().split(/\s+/).filter(Boolean);
    words += w.length;
    chars += text.length;
  }
  return { words, chars, lines: lines.length };
}

/** The units a goal can be counted in, and where each starts. */
export const GOAL_DEFAULTS = /** @type {const} */ ({ words: 750, chars: 3000, lines: 50 });

/**
 * How far along today is, 0..1. `null` when there's no goal.
 * @param {Line[]} lines
 * @param {string} unit "off" | "words" | "chars" | "lines"
 * @param {number} target
 * @returns {number|null}
 */
export function progress(lines, unit, target) {
  if (unit !== "words" && unit !== "chars" && unit !== "lines") return null;
  if (!(target > 0)) return null;
  return Math.min(1, measure(lines)[unit] / target);
}

/**
 * Every day in one text file, oldest first so it reads like a journal.
 * @param {{ name: string, items: Line[] }[]} days
 * @returns {string}
 */
export function allPagesText(days) {
  return days
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((d) => `# ${d.name}\n\n${blob(d.items)}\n`)
    .join("\n");
}

/**
 * Days grouped by month (YYYY-MM), keeping the order they came in.
 * @template {{ name: string }} D
 * @param {D[]} days
 * @returns {{ month: string, days: D[] }[]}
 */
export function byMonth(days) {
  /** @type {{ month: string, days: D[] }[]} */
  const groups = [];
  for (const d of days) {
    const month = d.name.slice(0, 7);
    const last = groups.at(-1);
    if (last?.month === month) last.days.push(d);
    else groups.push({ month, days: [d] });
  }
  return groups;
}

/**
 * "September 2026".
 * @param {string} month YYYY-MM
 * @returns {string}
 */
export function monthLabel(month) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { year: "numeric", month: "long" });
}
