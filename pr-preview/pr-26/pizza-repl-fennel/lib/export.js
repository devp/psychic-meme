// A session as plain source: each input verbatim, with what it produced
// trailing as comments. Comments are inert, so the result pastes straight back
// in and reruns -- and the recorded output is right there to compare against.
//
// Entries that failed, or that leave a string or bracket open, get their input
// commented out too. Left live they'd break the replay: an unclosed block
// swallows everything after it looking for its end, `1+` grabs the next
// statement as its operand.

/**
 * @typedef {Object} ExportLang
 * @property {string} name
 * @property {string} comment line-comment prefix
 * @property {(source: string) => boolean} hasUnterminated
 * @property {(inputs: string[]) => string[]} replayCaveat lines to warn with, or none
 */

/**
 * @param {{name: string, items: {input: string, output: string, isError: boolean}[]}} session
 * @param {ExportLang} lang
 * @param {Date} [now]
 * @returns {string}
 */
export function exportSession(session, lang, now = new Date()) {
  const c = lang.comment;
  const out = [
    `${c} pizza-repl-${lang.name} export: "${session.name || "Untitled session"}" -- ${now.toISOString()}`,
    `${c} Lines starting with ${c} are comments (inert). The => lines show what`,
    `${c} this produced last time, for comparing against a rerun.`,
  ];
  const caveat = lang.replayCaveat(session.items.map((e) => e.input));
  if (caveat.length) out.push(c, ...caveat.map((l) => `${c} ${l}`));
  out.push("");

  for (const e of session.items) {
    if (e.isError || lang.hasUnterminated(e.input)) {
      out.push(
        e.isError
          ? `${c} (this errored -- commented out so it can't break the replay)`
          : `${c} (unterminated string or bracket: fine on its own, but it would swallow what follows -- commented out)`
      );
      for (const line of e.input.split("\n")) out.push(`${c} ${line}`);
      if (e.output !== "") out.push(`${c} ${e.isError ? "ERROR" : "was"}: ${e.output.split("\n").join(" / ")}`);
    } else {
      out.push(e.input);
      if (e.output !== "") {
        const lines = e.output.split("\n");
        lines.forEach((line, i) => out.push(`${c} ${i === lines.length - 1 ? "=> " : ""}${line}`));
      }
    }
    out.push("");
  }
  return out.join("\n");
}
