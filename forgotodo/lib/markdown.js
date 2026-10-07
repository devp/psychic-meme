// Beam format: a Markdown task list, one to-do per line as `- [ ] text` or
// `- [x] text`. Anything else (the header line, blank lines, notes) is ignored
// on receive; the leading `- ` is optional there.

/**
 * @param {string} name
 * @param {{ text: string, done: boolean }[]} items
 * @returns {string}
 */
export function toBeamText(name, items) {
  const lines = items.map((i) => (i.done ? "- [x] " : "- [ ] ") + i.text);
  return ["To Do List: " + (name || "Unfiled"), ...lines].join("\n") + "\n";
}

/**
 * @param {string} text
 * @returns {{ text: string, done: boolean }[]}
 */
export function fromBeamText(text) {
  /** @type {{ text: string, done: boolean }[]} */
  const items = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:[-*]\s+)?\[([ xX])\]\s+(.*\S)\s*$/);
    if (m) items.push({ text: m[2], done: m[1] !== " " });
  }
  return items;
}
