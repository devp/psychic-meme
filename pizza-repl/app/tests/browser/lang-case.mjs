// The language-specific half of app.test.mjs: inputs and what they show.
export const LANG = {
  greeting: "JavaScript REPL",
  value: ["1 + 2", "3"],
  error: "nope()",
  printed: ['console.log("hi"); 5', "hi\n5"],
  another: ["2 * 3", "6"],
  // interpreter state doesn't survive a reload
  lastAfterReload: ["typeof _", '"undefined"'],
  doc: "guide",
  unopenedDoc: "javascript",
  unopenedDocSections: 5, // h2s it has, at least
  exportHead: '// pizza-repl-js export: "first"',
  exportedError: "// nope()\n",
  offline: ["10 * 10", "100"],
  // Leave out if lang.js has no complete(). Typing first+more offers pick, which
  // replaces the word to give picked; then tab + Tab gives tabbed.
  completion: { first: "M", more: "at", pick: "Math", picked: "Math", tab: " + parseF", tabbed: "Math + parseFloat" },
};
