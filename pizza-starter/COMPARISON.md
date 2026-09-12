# Variant comparison

Two axes, measured rather than argued. Filled in as each variant lands.

## Axis 1 — component layer

Both variants: same app, same libs, same CSS, same 27-check browser suite, light
DOM either way. Line counts are **code lines** (blank and comment excluded),
totals in brackets.

| | vanilla | lit |
|---|---|---|
| status | **done** | **done** |
| dependency | none | `lit-core.min.js` — 17.4KB raw, **6.8KB gzipped** |
| `reactive-element.js` | 62 (120) | — |
| `state.js` | 12 (26) | 12 (26) |
| `components/tabs.js` | **17** (24) | 35 (47) |
| `components/checklist.js` | **82** (118) | 93 (126) |
| `components/append-log.js` | 46 (93) | **35** (64) |
| `app.js` | 66 (106) | 66 (106) |
| **component-layer total** | **285** | **241** |
| browser suite | 27/27 | 27/27 |

### The focus probe — decisive, and the reason to care

Same scripted interaction on both: type `half-typed` into the add field, then
toggle a checkbox elsewhere.

```
vanilla   focus before=text  after=BODY   value-after=""
lit       focus before=text  after=INPUT  value-after="half-typed"
```

Vanilla's `innerHTML` rebuild destroys the focused element, taking the caret and
the half-typed text with it. Lit updates only the changed bindings and leaves
the input alone. For a checklist you tick, this is invisible. For anything with
a live-updating view around a text field — which includes every REPL — it is the
whole ballgame.

### The counterintuitive part

Lit wins on total code, but **not** because its components are smaller. They're
*bigger*:

- `tabs.js` **17 → 35**. `ReactiveElement.track()` auto-tears-down subscriptions;
  Lit needs a matched `connectedCallback`/`disconnectedCallback` pair and a
  field to hold the unsubscribe. That boilerplate doubled the file.
- `checklist.js` **82 → 93**. Inline `@change`/`@click` bindings on each row are
  more verbose than three delegated handlers registered once.

Lit wins *only* because the 62-line base class stops existing. Net −44 code
lines for +6.8KB gzipped. If you were going to write more than a handful of
components, the per-component tax would eventually overtake the one-time base
class saving — worth knowing before treating "fewer lines" as settled.

### `<append-log>`: 46 → 35, not "nearly free"

**My prediction was wrong and the measurement corrects it.** I expected Lit's
keyed `repeat()` to make this component almost disappear. It removed two things:
the prefix comparison that decides append-vs-rebuild, and the `aria-busy` dance
(with keyed diffing, a wholesale replacement is just removed keys plus added
ones, which already announces correctly).

What it did **not** remove, because no framework knows about them:

- scroll pinning — decide "was the reader at the bottom" before the DOM changes,
  restore after (`willUpdate`/`updated` in Lit, inline in vanilla)
- setting `role="log"` and `aria-live="polite"`

So 24% smaller, not 90%. The accessibility reasoning that justifies the
component is identical in both; only the node-identity bookkeeping goes away.

### What each approach forces

| | vanilla | lit |
|---|---|---|
| escaping | `esc()` at every interpolation, by hand | by construction |
| event handlers | delegated from the host via `this.on()`, because `innerHTML` orphans child listeners | bound inline; nothing to orphan |
| markup hooks | needs `data-remove`, `data-tab` etc. **purely so delegation can find the target** | none |
| subscription teardown | `track()`, one line | manual lifecycle pair |
| reactive property declared as a class field | shadows the accessor, silently stops re-rendering | same hazard shape; both variants initialize in the constructor to avoid it |

The markup-hooks row surfaced by accident: the browser suite's selectors turned
out to encode vanilla's implementation (`button[data-remove]`, `[data-tab=...]`),
and Lit has no such attributes. The suite now selects by role and `aria-label`,
which is fairer and better testing regardless.

### Infrastructure finding

Two service workers could not share one `tsc` program: they're classic scripts,
so their top-level `const`s collide in a single global scope, and a service
worker needs `lib: WebWorker` which conflicts with the app's `lib: DOM` anyway.
Hence `tools/check-sw.mjs`, which typechecks each one in its own program.

## Axis 2 — offline layer

| | hand-rolled | Workbox |
|---|---|---|
| status | **done** | not spiked |
| authored lines | 85 (`sw.js`) + 69 (verifier) = **154** | — |
| precached payload | 13 entries | — |
| defects needing explicit code | 3 of 3 (see below) | — |

The three the hand-rolled version has to handle by hand, all of which were
live bugs in the project this was extracted from:

1. `cache.addAll()` atomicity — fixed by adding assets individually
2. `respondWith(undefined)` when nothing is cached *and* the network is gone —
   fixed with a synthetic 504
3. no `ignoreSearch`, no navigation fallback — a URL with `?utm_source=...`
   missed the cache entirely

Accept/reject criteria for the Workbox spike are in the plan. Verified working
in the hand-rolled version: offline reload, and offline reload with a query
string, both serve the app.

## Refinements applied before Phase B

So both variants are compared against the same libs:

- **`recordStore` returns copies.** It used to hand back live references
  documented as read-only. The footgun had already leaked into `checklist.js`,
  which defensively wrote `{ ...rec, items: rec.items.slice() }` because a live
  reference compares `===` to itself and never triggers a reactive setter.
  Fixing the store deleted the workaround.
- **`configure()` removed**, replaced by `state.js` + the import rule.
  Base class: 71 → **62 code lines**. Target was ≤60; it missed by two, and
  closing that gap would have meant moving `esc()` to its own file, which is
  the same code in more places. Reported rather than gamed.
- **`<append-log>` added**, as above.

The precache tripwire also proved itself in real use rather than in a drill:
adding `state.js` broke `just check` immediately with the exact missing path.
