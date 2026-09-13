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

## 4. App state is imported; travelling components take props

> **Components that belong to *this* app import app state directly.
> Components meant to travel between apps take plain properties.**

`components/checklist.js` imports `lists` from `state.js`. `components/append-log.js`
imports nothing and is fed by property from `app.js`.

This isn't a style preference, it removes a trap. Defining a custom element
upgrades it instantly, so `connectedCallback` — and therefore `setup()` — runs
*before* `app.js` could hand it a store. An earlier version of this starter
carried a `configure()` method purely to re-run setup after injection. With
nothing to inject, there's nothing to sequence, and the ceremony deletes
itself.

A travelling component can still take properties after definition, because its
`setup()` doesn't need them — which is exactly what makes it portable.

## Layer map

| layer | where | replaceable? |
|---|---|---|
| offline + installable | `sw.js`, `manifest.webmanifest` | yes — see the Workbox spike in COMPARISON.md |
| phone-first input | `lib/viewport.js` | no. Nothing else provides this. |
| persistence | `lib/store.js` | yes, but the subscribers are the point |
| component layer | `variants/*/` | **yes — that's why there are variants** |
| append-only lists | `variants/*/components/append-log.js` | it's meant to be lifted |
| app shell glue | each variant's `app.js` | it's yours, that's the point |

The first three are framework-agnostic. Only the fourth changes between
variants.

## Known hazards

Each of these is silent: no error, no failed check, often a green typecheck. They're listed
here because a comment you can grep beats a bug you rediscover.

| hazard | what actually happens | do this instead |
|---|---|---|
| A class field with the same name as a reactive property | `record = null` — or even a bare `record;` — creates an *own* property that shadows the accessor. Assignments stop re-rendering. Green typecheck, empty list, no error. **Cost two debugging sessions.** | Initialize in the constructor, where the accessor already exists |
| `height: 100vh` / `100dvh` on the app shell | The layout viewport doesn't shrink when the mobile keyboard opens, so the keyboard covers your input | `height: var(--app-height, 100dvh)` plus `syncAppHeight()` |
| Hand-rolling HTML escaping | Easy to write an incomplete one, and it drifts from the real thing | `esc()` from `reactive-element.js` |
| `addEventListener` on a child, inside a component | The next render replaces that child and the handler silently stops firing | `this.on(type, selector, fn)` — delegated from the host |
| `localStorage` outside `lib/store.js` | Throws in private mode and wherever site data is blocked | Go through the store; if you must, wrap in try/catch (as `index.html`'s pre-paint script does) |
| `font-size` under 16px on an input | iOS zooms the whole page when the field is focused | 16px or larger on anything typeable |
| Top-level `await` in your entry module | The rest of the module body is deferred past the `load` event, so a `window.addEventListener("load", ...)` registered there never fires. The service worker silently never registers: app renders fine, no errors, no offline. | Check `document.readyState === "complete"` first, then fall back to the listener |
| Rebuilding an `aria-live` region | A screen reader re-announces the entire history every time one line arrives | `<append-log>`, which appends |

Two of these are already automated rather than documented, which is the direction the rest
should go: precache drift fails `just check`, and a bare `self` in a service worker fails the
typecheck.

**TODO: `just warn`.** A stdlib-only `tools/warn.mjs` encoding the rest of this table — separate
from `just check` and advisory by default (prints, exits 0; `--strict` exits 1), with a
`// warn-ok: <rule>` escape hatch so legitimate cases are silenced with a reason. Deliberately
not built yet: it should be written after the Lit variant says which of these hazards are
universal and which are artefacts of one component layer.

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
