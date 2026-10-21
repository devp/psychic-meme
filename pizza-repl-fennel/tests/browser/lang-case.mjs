// The language-specific half of app.test.mjs: inputs and what they show.
export const LANG = {
  greeting: "Fennel REPL",
  value: ["(+ 1 2)", "3"],
  error: "(nope)",
  printed: ["(print :hi) 5", "hi\n5"],
  another: ["(* 2 3)", "6"],
  // interpreter state doesn't survive a reload
  lastAfterReload: ["*1", "nil"],
  doc: "reference",
  unopenedDoc: "lua",
  unopenedDocSections: 5, // h2s it has, at least
  exportHead: ';; pizza-repl-fennel export: "first"',
  exportedError: ";; (nope)\n",
  offline: ["(* 10 10)", "100"],
  // Typing first+more offers pick, which replaces the word to give picked;
  // then tab + Tab gives tabbed.
  completion: { first: "(s", more: "tr", pick: "string", picked: "(string", tab: ".forma", tabbed: "(string.format" },
};
