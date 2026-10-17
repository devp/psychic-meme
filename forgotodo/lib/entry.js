// New to-do entry. Dictation says "semicolon" where typing would hit Enter
// again, so `milk; eggs; bread` is three to-dos.

/**
 * The to-dos one entry adds, in order: split on `;`, blanks dropped.
 * @param {string} text
 * @returns {string[]}
 */
export function splitEntry(text) {
  return text.split(/\s*;\s*/).map((s) => s.trim()).filter(Boolean);
}
