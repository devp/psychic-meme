# Third-party code

- **`vendor/marked.min.js`** — [marked](https://github.com/markedjs/marked), used to render
  the reference docs client-side. MIT licensed; see `vendor/marked.LICENSE.md`.
- **`vendor/lil.js`** — the Lil language interpreter, vendored unmodified from
  [JohnEarnest/Decker](https://github.com/JohnEarnest/Decker) (`js/lil.js`). `interpreter.js`
  is a from-scratch wrapper around it (modeled on Decker's own `js/repl.js`) that drops the
  Node/filesystem-specific bindings that don't apply in a browser. MIT licensed, © John
  Earnest; see `vendor/lil.LICENSE.txt`.
- **`docs/lil.md`, `docs/lilquickref.md`, `docs/lilt.md`** — the Lil language reference,
  quick reference, and Lilt CLI docs, vendored from
  [JohnEarnest/Decker](https://github.com/JohnEarnest/Decker) (`docs/`) for offline use.
  MIT licensed, © John Earnest.
