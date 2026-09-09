# Third-party code

pizza-repl is not affiliated with or endorsed by John Earnest or the Decker project. It's an
unofficial browser REPL built on his MIT-licensed Lil interpreter, and is distinct from *Lilt*,
his own command-line REPL.

- **`vendor/marked.min.js`** — [marked](https://github.com/markedjs/marked), used to render
  the reference docs client-side. MIT licensed; see `vendor/marked.LICENSE.md`.
- **`vendor/lil.js`** — the Lil language interpreter, vendored unmodified from
  [JohnEarnest/Decker](https://github.com/JohnEarnest/Decker) (`js/lil.js`). `interpreter.js`
  is a from-scratch wrapper around it (modeled on Decker's own `js/repl.js`) that drops the
  Node/filesystem-specific bindings that don't apply in a browser. MIT licensed, © John
  Earnest; see `vendor/lil.LICENSE.txt`.
- **`docs/lil.md`, `docs/lilquickref.md`, `docs/lilt.md`, `docs/decker.md`** — the Lil language
  reference, quick reference, Lilt CLI docs, and the Decker platform reference, vendored from
  [JohnEarnest/Decker](https://github.com/JohnEarnest/Decker) (`docs/`) for offline use.
  MIT licensed, © John Earnest.
