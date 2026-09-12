# The rules

Three ideas hold this together. They're more transferable than the code, and
they're the part worth keeping if you throw everything else away.

## 1. Derived vs authored, not "build vs no-build"

"No build step" as an absolute is ideology, and it breaks the first time you
want something prerendered. The useful line is different:

> A file is **derived** if its content is a function of other files' content.
> Everything else is **authored**.

- **Authored** — everything you touch in a normal session. Edit, reload, done.
- **Derived** — in this project, exactly one thing: the precache list in
  `sw.js`. The rule for derived files is **build rarely, check always**:
  regenerate only when the file set changes, and have something fail loudly
  when it's stale.
- **Neither** — one-shot scaffolding. Runs once at project creation; the
  output is authored from then on.

This isn't purity. A derived zone is fine. What isn't fine is a derived zone
you can forget about.

## 2. Check, don't generate

The precache list *could* be generated. It isn't. `tools/verify-precache.mjs`
compares it to the directory and exits nonzero on drift, and `just check` runs
it. You keep an authored service worker you can read; you don't keep the bug.

The bug it prevents is specific and nasty. `cache.addAll()` is atomic: one bad
path and *nothing* is cached, silently, on a phone with no console. This
project's `sw.js` also adds assets individually so a single bad entry degrades
instead of nuking offline entirely — but the verifier is what stops it
happening at all.

Try it: `just check-tripwire`.

## 3. The input stays dumb

`lib/viewport.js` gives you a plain `<textarea>` with Enter-to-submit and
auto-grow. That is the entire input model, deliberately.

A predecessor project in this repo hand-rolled live syntax highlighting,
autocomplete, and auto-indent on a mobile text field. It died of unfixable UX
bugs you cannot attach a debugger to, on a device you cannot inspect. A dumb
input has one failure mode. An input that rewrites itself while you type has a
combinatorial number.

If you later need a real editor, that's a different surface (and a good reason
to reach for CodeMirror) — not an upgrade to this one.

## Layer map

| layer | where | replaceable? |
|---|---|---|
| offline + installable | `sw.js`, `manifest.webmanifest` | yes — see the Workbox spike in COMPARISON.md |
| phone-first input | `lib/viewport.js` | no. Nothing else provides this. |
| persistence | `lib/store.js` | yes, but the subscribers are the point |
| component layer | `variants/*/` | **yes — that's why there are variants** |
| app shell glue | each variant's `app.js` | it's yours, that's the point |

The first three are framework-agnostic. Only the fourth changes between
variants.

## Things deliberately not here

- **A shared `lib/shell.js`.** Theme, font and active tab are each a
  `persistedValue` plus a two-line subscriber. That's ~15 lines in `app.js`
  where you can see it, not a lib that would be mostly re-export.
- **Shared CSS between variants.** Each variant must be independently
  clonable. Duplication beats a dependency you can't delete.
- **An icon generator.** `icons/pizza.svg` is hand-drawn markup. Replace it
  with a text editor.
- **A component library, a router, a state manager.** If you need them, add
  them to *your* app, not to the skeleton.
