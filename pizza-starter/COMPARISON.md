# Variant comparison

Two axes, measured rather than argued. Filled in as each variant lands.

## Axis 1 — component layer

Line counts are **code lines** (blank and comment lines excluded), with totals
in brackets. The distinction matters: this base class reads as 120 lines but is
62 of code — the rest explains hazards, and those comments earned their place
twice over (see below).

| | vanilla (`variants/vanilla`) | lit (`variants/lit`) |
|---|---|---|
| status | **done, refined** | not started |
| dependency | none | `lit-core`, ~5KB vendored |
| `reactive-element.js` | **62** (120) | n/a |
| `state.js` | 12 (26) | — |
| `components/append-log.js` | **46** (93) | — |
| `components/checklist.js` | 82 (118) | — |
| `components/tabs.js` | 17 (24) | — |
| `app.js` | 65 (105) | — |

### The focus probe

Both variants implement the same checklist with a text input next to a live
count, because that's where the two approaches visibly diverge.

**Measured on vanilla** (automated, headless Chromium):

```
type "half-typed" into the add field, then toggle a checkbox elsewhere
  focus before toggle : the text input
  focus after toggle  : BODY
  input value after   : "" (empty)
```

Confirmed as predicted. The vanilla variant re-renders by replacing
`innerHTML`, which destroys the focused element — caret, selection and
half-typed text with it. Lit updates only the changed bindings and should
leave a focused input alone.

This is the finding, not a bug to route around. It's the clearest statement of
what ~5KB of templating actually buys: for a checklist you tick, it doesn't
matter; for anything with a live-updating view around a text field, it does.

### `<append-log>` — the appendy-aggregation pattern

46 code lines in the vanilla variant. It exists because a whole-list re-render
is wrong for a growing log in two ways that only surface after shipping:

- **`aria-live`.** A log is `role="log"` + `aria-live="polite"`. Replacing its
  innerHTML makes a screen reader re-announce the entire history every time one
  line arrives. This is the real justification.
- **Scroll.** Rebuilding throws away where the reader was.

So it appends the tail when the new array extends the old by a common prefix,
and only falls back to a full rebuild (with `aria-busy` set) on a reset or
reorder. Verified: a marked DOM node survives an append and is destroyed by a
non-prefix change; scroll stays pinned when following and doesn't move when the
reader has scrolled up.

**This is the number to watch in Phase B.** Lit's keyed `repeat()` does keyed
diffing already, so the Lit version may be a fraction of 46 lines — which would
be the clearest single statement of what the dependency buys.

### What the vanilla approach forces

- **Event delegation is mandatory, not stylistic.** Replacing `innerHTML`
  orphans every listener on a child, so listeners go on the host and dispatch
  via `closest()`. `ReactiveElement.on()` makes that the path of least
  resistance.
- **Escaping is mandatory.** Building HTML from user text means `esc()` on
  every interpolation. Lit escapes by construction.
- **Class fields silently break reactivity — twice.** Declaring a reactive
  property as a class field (`record = null`, or even a bare `record;`) creates
  an *own* property that shadows the `defineProperty` accessor, and assignments
  stop re-rendering with no error. Both times the symptom was an empty list and
  a green typecheck. Now warned about in the base class; Lit's `static
  properties` has the same hazard shape and should be checked for it.
- **Config injection used to need a `configure()` method.** Defining an element
  upgrades it instantly, so `setup()` ran before `app.js` could assign a store.
  **Resolved** by importing app state rather than injecting it (see SKELETON.md
  §4) — the method and its ceremony are gone.
- **TS can't infer `defineProperty` accessors.** Reactive properties need an
  explicit cast at the point of use, since the accessor is installed at runtime.

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
