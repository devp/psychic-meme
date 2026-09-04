# lilt-repl

A browser-based, offline-friendly REPL for [Lil](https://beyondloom.com/decker/lil.html),
the scripting language behind [Decker](https://beyondloom.com/decker/). Built as a mobile-first
alternative to the [Lilt](https://beyondloom.com/decker/lilt.html) command-line REPL, optimized
for a phone in portrait mode.

Open `index.html` (or the deployed URL) and start typing lil expressions. It's a static site with
no build step and no server-side component -- everything, including the interpreter and the
language reference docs, is vendored locally so it keeps working after the first load, even
offline (add it to your home screen for the full effect).

## What's here

- `index.html`, `style.css`, `app.js` -- the REPL shell: tabs, themes, the input/output log.
- `interpreter.js` + `vendor/lil.js` -- wraps the vendored Lil interpreter (from
  [JohnEarnest/Decker](https://github.com/JohnEarnest/Decker)) for browser use.
- `transcripts.js` -- autosaves REPL sessions to `localStorage`; the "log" tab lets you name,
  view, and delete them.
- `docs/`, `docs.js`, `vendor/marked.min.js` -- the Lil language reference, quick reference, and
  Lilt CLI docs, rendered client-side for offline reading.
- `manifest.webmanifest`, `sw.js`, `icons/` -- installable/offline support.

See `NOTICE.md` for third-party attributions.
