# pizza-repl-<lang>: candidate engines

Runs decker-lil today. This is the shortlist for "more stuff in the future," plus
what a port actually has to satisfy. Intended as a dispatch doc: each candidate
below should be enough to start a thread cold.

## Before vendoring anything: check the licence

**Apart from Fennel, none of these have been licence-checked.** A pizza-repl doesn't link to an engine,
it *vendors the file into this repo and ships it offline* — so the licence has to
permit redistribution, and `NOTICE.md` needs an entry the way lil.js and marked do.

| engine | artifact | licence |
|---|---|---|
| Tau Prolog | JS lib | ❓ unchecked |
| Forth | pick an impl first | ❓ unchecked |
| oK | JS, JohnEarnest | ❓ unchecked (Decker is MIT; oK is a separate repo — verify) |
| Kiki | `smallandnearlysilent.com/kiki/kiki.js` | ❓ **unchecked, and not obviously stated** — Dev flagged this one specifically |
| OCaml (js_of_ocaml) | compiled toplevel | ❓ unchecked (OCaml is LGPL-with-exception; the *build* matters) |
| SCI / Scittle | JS build | ❓ unchecked |
| Fennel + Fengari | two artifacts, two licences | ✅ done: pizza-repl-fennel (all MIT) |

Also worth confirming per engine: is there a **redistributable doc corpus**? The
docs tabs are a real part of this app's value, and lil only worked out because
Decker ships `lil.md` as markdown in the same MIT repo. An engine whose docs are
a website with no reusable source is a worse fit than its runtime suggests.

## The seam

A port is a copy of a sibling app with the language layer swapped. Only these
differ between pizza-repl-lil and pizza-repl-fennel (`diff -r` to check):

- `lang.js`: `name`, `comment`, `placeholder`, `greeting`,
  `evaluate(source) -> {text, isError}` (synchronous), `hasUnterminated`,
  `replayCaveat`, `preprocessDoc`. An engine that loads async can top-level
  await in here; app.js waits for it.
- `vendor/` engine files, `docs/`, `NOTICE.md`, `README.md`.
- `index.html`: title, app-ns, doc tabs, about text, the engine's `<script>`.
- `sw.js` `ASSETS`, `manifest.webmanifest`, `package.json` name.
- Tests: `tests/lang.test.mjs`, `tests/export.test.mjs`, `tests/load-lang.mjs`
  (runs the engine in node), and the `LANG` block atop `tests/browser/app.test.mjs`.

## Rubric

1. **Runs in JS/WASM** — table stakes.
2. **Synchronous** — anything async needs `evaluate` to return a Promise, and
   entries to be appended-then-updated. Contained (~30 lines around `addEntry`),
   but it's a real change, not config.
3. **Value-oriented** — text in, text out. Anything whose point is a display or a
   document needs a *stage*, which is a feature, not an adapter.
4. **Small enough to vendor.** lil.js is 190KB. A multi-MB runtime doesn't just
   bloat the repo, it breaks the premise of a thing you install and use on the
   subway.
5. **Typeable on a phone keyboard.** Underrated and decisive. `,` and `.` are on
   the alpha layer; parens and most symbols cost a layer switch.

## Candidates

### oK — K in JS, by John Earnest
Same author and same vanilla-JS-globals style as lil.js, so it should drop into
the existing seam with the least invention. Sync, small, pure ASCII, expression-
oriented. **Best choice for the isolation run** precisely because it's boring —
anything that hurts here is the seam's fault, not the language's.
Unknowns: licence; whether a reusable reference doc exists.

### Tau Prolog
The only candidate that's REPL-*native* — a query prompt is the actual interface,
not a bolt-on. ASCII, phone-typable, and the biggest paradigm shift per keystroke
on this list. Puzzle/logic work is game-adjacent in the small way that's wanted.
Unknowns: licence; whether queries are sync or callback-driven (**check early —
if it's callback/iterator-based, this is the one that forces the async refactor**);
how backtracking/multiple solutions should present in a transcript, which is a
genuine UI design question rather than a port detail.

### Kiki
Charming, has its own docs and REPL, JS at `smallandnearlysilent.com/kiki/kiki.js`.
APL-family but with **ASCII digraphs** (`2 :* 3 :+ 1`) rather than glyphs, which is
exactly the phone-friendly property; right-to-left evaluation. Docs exist as
learn/ref/idiom panes, so there may be a corpus to reuse.
Unknowns: **licence is the blocker** — Dev to confirm before anything else. Also
whether the JS exposes a callable eval entry point or is welded to its own page.

### Forth
Best phone ergonomics of anything here: short words, space-delimited, no shift key.
Many small JS implementations, so this is a "choose the impl" task as much as a
port. Stack output display is a small design question (show the stack after each
entry?).
Unknowns: licence; which impl; **docs are the weak spot** — likely writing a
glossary rather than vendoring one.

### SCI / Scittle — Clojure in the browser
The correct "babashka in the browser." (Babashka itself is a GraalVM native binary
and is *not* an option.) Real Clojure semantics, good error messages.
Unknowns: licence; artifact size — likely the largest here, check against filter 4;
sync vs async eval.

### Fennel via Fengari
Two layers — Fennel compiles to Lua, Fengari is a Lua VM in JS — so two artifacts
and two licences. Lisp syntax with Lua semantics.
**Done: pizza-repl-fennel.** Both MIT; about 520KB together (fengari-web 220KB,
fennel.lua 300KB). Errors land via `fennel.repl`'s `onError` kinds (Parse, Compile,
Runtime).

### OCaml via js_of_ocaml
The strongest typed-FP option, because the constraint in that family isn't the
language, it's *does the compiler run in-browser offline* — which rules out the
server-backed Haskell/PureScript playgrounds. Real HM inference, real teaching.
Unknowns: licence of the specific toplevel build; size (expect the largest on this
list by some margin); and it fights filter 5 hardest — typed FP on a phone is a lot
of `->` and `|>`.

## Sequencing

Fennel went first, not oK: it established the seam above. Next: copy
pizza-repl-fennel (or -lil, whichever engine is closer), swap the layer.
Tau Prolog and Forth are the interesting ones (new paradigms, cheap), Kiki is
gated on licence, SCI and OCaml are the size-risk pair.

## Definition of done for a port

- `evaluate(source)` returns `{text, isError}` for: a plain value, a multi-line
  definition, something that prints, and a syntax error.
- Errors render as errors — no silent successes on broken input.
- The engine and its docs are vendored, cached by `sw.js`, and work offline.
- `NOTICE.md` credits it, with the licence named.
- The transcript export round-trips: paste it back, run it, get the same thing.
  Note the export has language-specific assumptions (`comment`, `hasUnterminated`,
  `replayCaveat` in lang.js) — a port
  that skips these will look fine and then corrupt replays, which is exactly the
  bug that shipped in #16.
- `just dev-check` green: `tests/lang.test.mjs` and `tests/export.test.mjs` assert
  real engine behavior, including the export round-trip.

## Parked

- Paren-typing workaround for Lisps (`,,` / `..` → `(` `)`, or similar). Not now —
  revisit only if paren entry proves to be the actual constraint in practice.
