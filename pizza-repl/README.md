# pizza-repl (skeleton)

The REPL shell that every `pizza-repl-<lang>` shares, as a starter of its own: copy it, write one
`lang.js`, vendor an engine and some docs. It's [pizza-starter](../pizza-starter) one level down:
`app/` is a stamped copy of pizza-starter, and each REPL is a stamped copy of `app/`.

`app/` runs as-is, as a JavaScript REPL (your browser's own `eval`), so the shell can be worked on
without any engine: `cd app && just serve`.

Apps: [lil](../pizza-repl-lil), [fennel](../pizza-repl-fennel), [prolog](../pizza-repl-prolog).
Candidates for more, and what a port has to satisfy: [PLAN.md](../pizza-repl-lil/PLAN.md).

## Quick start

- `just new-app pizza-repl-<lang>` copies `app/` to the repo root, stamped with `STARTER`.
- In the copy, replace `lang.js`, `docs/`, `NOTICE.md` and the tests listed under *The seam*.
  Add the engine to `vendor/`. Update `sw-assets.js`, `manifest.webmanifest`, `README.md`.
- `just dev-init` once, then `just dev-check`; `just warnings` until clean.
- Later, from here: `just drift pizza-repl-<lang>` shows what changed on each side since the
  last sync; `just sync pizza-repl-<lang>` (or `just sync-all`) merges shell changes in.

The scripts are pizza-starter's own (`scripts/` links to them). Shell changes from pizza-starter
reach the REPLs in two hops: `just sync pizza-repl/app` in pizza-starter/, commit, then
`just sync-all` here.

## The seam

`CORE` lists the shell: identical in every REPL, except `index.html`'s `app-ns` line. The rest is
the language's:

| Per language | What |
|---|---|
| `lang.js` | the plugin; below |
| `vendor/<engine>` | loaded by `lang.js` |
| `docs/` | Markdown, or HTML fragments |
| `index.html` | one line: `<meta name="app-ns">`, the app's name and localStorage prefix |
| `sw-assets.js`, `manifest.webmanifest`, `package.json`, `NOTICE.md`, `README.md` | |
| `scripts/warnings.local.sh` | extra files for `just warnings` to scan |
| `tests/load-lang.mjs` | runs the engine in node, then imports `lang.js` |
| `tests/lang.test.mjs`, `tests/export.test.mjs` | the engine's real behavior, and the export round-trip |
| `tests/browser/lang-case.mjs` | inputs and outputs for the shared browser test |

`tests/plugin.test.mjs` (core) checks any `lang.js` against the contract below, so a port that
gets a shape wrong fails `just dev-check` rather than loading a blank page.

## lang.js

One ES module. It may top-level `await` (to load its engine); `app.js` waits for it.

**Identity**

| Export | |
|---|---|
| `name` | short, lowercase: the export header (`;; pizza-repl-<name> export`) and the Copy button |
| `placeholder` | the input's placeholder; must evaluate without error |
| `greeting` | shown in the empty log |
| `about` | HTML for Options → About: what it is, who made the language, not affiliated |

**(1) Evaluating**

| Export | |
|---|---|
| `evaluate(source)` | `{text, isError}`, synchronously. Printed output first, then the value |
| `comment` | line-comment prefix, for the export |
| `hasUnterminated(source)` | an open string or bracket at the end: the export comments such entries out, since they'd swallow what follows |
| `replayCaveat(inputs)` | lines to warn with atop an export that won't replay faithfully (lil's `_`), or `[]` |
| `complete(source, caret)` | *optional*. `{from, items}`: candidates that replace `source.slice(from, caret)`, or `null`. With it, a strip of chips shows above the key row, Tab completes, and Options gets an on/off |

**The engine** can be JS, WebAssembly, or anything an engine reads. `lang.js` loads it at top
level with `lib/engine.js`, from `vendor/`:

| Ships as | Load with |
|---|---|
| a classic script that defines globals (UMD, lil.js) | `globalThis.x ?? (await loadScript(url))`. Guarded: `tests/load-lang.mjs` runs it in node first |
| an ES module | `await import("./vendor/engine.mjs")`. Nothing extra |
| `.wasm` | `const { instance } = await loadWasm(url, imports)`. Streams when served as `application/wasm` |
| JS glue + `.wasm` (Emscripten and the like) | the glue as either of the first two; it fetches its own `.wasm` |
| source or data the engine reads (Fennel's `fennel.lua`, a stdlib image) | `await fetchText(url)`, `await fetchBytes(url)` |

`url` is `new URL("vendor/…", import.meta.url)`. The fetching helpers read `file:` URLs from disk,
so the same `lang.js` loads under node for the unit tests. Every file goes in `sw-assets.js`, or
it's missing offline: that includes whatever a glue script fetches by itself. `just warnings`
checks `vendor/*.wasm`; add other kinds to `scripts/warnings.local.sh` (fennel adds `*.lua`).

Mind the size: the point is a thing you install and use on the subway (see PLAN.md's rubric).

**(2) Shortcuts**, two kinds:

| Export | |
|---|---|
| `keys` | the key row above the input; one tap inserts. The ⋯ key goes in the middle, and colors pair from the outside in, so make the halves mirror: `["(", "[", "{", "}", "]", ")"]` |
| `commands` | behind ⋯, a list to pick from: longer things (`,doc`, `?-`, `show`). The user's own, from Options, are listed after these |

**(3) Docs**

| Export | |
|---|---|
| `docs` | `[{id, src, label?, note?}]`, in menu order. `src` is Markdown, or an HTML fragment if it ends in `.html`; `label` defaults to `id`; `note` is HTML shown above it. Every `src` goes in `sw-assets.js` |
| `preprocessDoc(text, src)` | the doc's text before rendering: drop front matter, fix links |

Markdown is the default because the docs worth having already are: Fennel, lil and Learn X in Y
minutes all ship theirs as `.md`, so vendoring is a copy. HTML covers a language whose docs are a
website; save a fragment (no `<html>`, no scripts) and it's inserted as-is.

All docs share one tab. It shows the doc read last, labelled with its name and a ▾; tap it again
and the others drop down as chips; tap one to switch. Each doc keeps its scroll position, and ≡
jumps to a section. An older app that stored a doc's id as its tab opens on that doc.
