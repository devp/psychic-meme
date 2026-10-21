// The language-specific half of app.test.mjs: inputs and what they show. lang.js has no complete().
export const LANG = {
  greeting: "lil REPL",
  value: ["1+2", "3"],
  error: "1+",
  printed: ['print["hi"]\n5', "hi\n5"],
  another: ["2*3", "6"],
  // interpreter state doesn't survive a reload
  lastAfterReload: ["_", ""],
  doc: "lil",
  unopenedDoc: "decker",
  unopenedDocSections: 5, // h2s it has, at least
  exportHead: '# pizza-repl-lil export: "first"',
  exportedError: "# 1+\n",
  offline: ["10*10", "100"],
};
