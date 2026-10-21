// The language-specific half of app.test.mjs: inputs and what they show. lang.js has no complete().
export const LANG = {
  greeting: "Prolog (Tau)",
  value: ["?- X is 6 * 7.", "X = 42."],
  error: "?- nope.",
  printed: ["?- write(hi), X = 5.", "hi\nX = 5."],
  another: ["n(7).", "n/1: 1 clause"],
  // interpreter state doesn't survive a reload
  lastAfterReload: ["?- n(X).", "uncaught exception: error(existence_error(procedure,n/1),top_level/0)"],
  doc: "guide",
  unopenedDoc: "builtins",
  unopenedDocSections: 5, // h2s it has, at least
  exportHead: '% pizza-repl-prolog export: "first"',
  exportedError: "% ?- nope.\n",
  offline: ["?- X is 10 * 10.", "X = 100."],
};
