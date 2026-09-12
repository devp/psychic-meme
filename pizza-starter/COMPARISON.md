# Variant comparison

Two axes, measured rather than argued. Filled in as each variant lands.

## Axis 1 — component layer

| | vanilla (`variants/vanilla`) | lit (`variants/lit`) |
|---|---|---|
| status | **done** | not started |
| dependency | none | `lit-core`, ~5KB vendored |
| `reactive-element.js` | 134 lines | n/a |
| `components/checklist.js` | 97 lines | — |
| `components/tabs.js` | 41 lines | — |
| `app.js` | 103 lines | — |

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

### What the vanilla approach forces

- **Event delegation is mandatory, not stylistic.** Replacing `innerHTML`
  orphans every listener on a child, so listeners go on the host and dispatch
  via `closest()`. `ReactiveElement.on()` makes that the path of least
  resistance.
- **Escaping is mandatory.** Building HTML from user text means `esc()` on
  every interpolation. Lit escapes by construction.
- **Config injection needs an explicit `configure()`.** Defining a custom
  element upgrades it instantly, so `connectedCallback` — and `setup()` —
  fires before `app.js` can assign a store. Found the hard way: the first
  build rendered an empty checklist because nothing had subscribed.

## Axis 2 — offline layer

| | hand-rolled | Workbox |
|---|---|---|
| status | **done** | not spiked |
| authored lines | 85 (`sw.js`) + 69 (verifier) = **154** | — |
| precached payload | 11 entries | — |
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
