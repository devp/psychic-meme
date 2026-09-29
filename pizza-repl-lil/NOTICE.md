# Third-party code

pizza-repl-lil is not affiliated with or endorsed by John Earnest or the Decker project. It's an
unofficial browser REPL built on his MIT-licensed Lil interpreter, and is distinct from *Lilt*,
his own command-line REPL.

- **`vendor/lit.js`** — [Lit](https://lit.dev), BSD-3-Clause (`vendor/lit.LICENSE.txt`).
- **`vendor/marked.min.js`** — [marked](https://github.com/markedjs/marked), renders the reference
  docs client-side. MIT; see `vendor/marked.LICENSE.md`.
- **`vendor/lil.js`** — the Lil interpreter, vendored unmodified from
  [JohnEarnest/Decker](https://github.com/JohnEarnest/Decker) (`js/lil.js`). `lang.js` wraps it
  the way Decker's own `js/repl.js` does, minus the Node/filesystem bindings. MIT, © John
  Earnest; see `vendor/lil.LICENSE.txt`.
- **`docs/lil.md`, `docs/lilquickref.md`, `docs/lilt.md`, `docs/decker.md`** — the Lil reference,
  quick reference, Lilt CLI docs and Decker reference, vendored from
  [JohnEarnest/Decker](https://github.com/JohnEarnest/Decker) (`docs/`). MIT, © John Earnest.
