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
lines for +6.8KB gzipped.

But "Lit's components are bigger" is too flat, and the direction depends on
component *shape*:

| | vanilla | lit | favours |
|---|---|---|---|
| `tabs.js` | 17 | 35 | vanilla by 18 |
| `checklist.js` | 82 | 93 | vanilla by 11 |
| `append-log.js` | 46 | **35** | **lit by 11** |
| components only | **145** | **163** | vanilla by 18 |

Subscription-heavy components favour vanilla, because `track()` collapses a
constructor field plus a `connectedCallback`/`disconnectedCallback` pair into
one line. List-rendering components favour Lit, because `repeat()` replaces
hand-written identity bookkeeping. Net across these three is ~6 lines per
component in vanilla's favour against a 62-line base class — so on the order of
ten components before vanilla pulls ahead on raw lines, with high variance, and
one of three already going the other way. Don't plan on that number; it depends
entirely on what you build.

The deeper point: the base class isn't overhead Lit avoids, it's *amortised
boilerplate tuned to these exact components*. `track()` exists because
subscription teardown was repeating. A general-purpose library can't know that
every component here subscribes to one store and wants automatic cleanup.

One more line of Lit's total is a parity choice rather than a cost: three lines
per component of `createRenderRoot() { return this; }`, opting out of shadow DOM
so the global stylesheet applies. Taking Lit's default would remove nine lines
and change the comparison.

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

Independent of the component layer: whichever wins applies to either variant.
Spiked against `variants/_spike-workbox` (the vanilla component layer with a
Workbox service worker), so the only variable is the offline strategy.

| | hand-rolled | Workbox |
|---|---|---|
| authored code lines | `sw.js` 60 + verifier 50 = **110** | `sw.js` 8 + generator 42 = **50** |
| shipped runtime added | 0 | `vendor/workbox.js` — 17.1KB raw, **5.9KB gzipped** |
| derived files | none (the list is authored, and checked) | `precache-manifest.js` (55 lines, generated) |
| browser suite | 27/27 | 27/27 |
| staleness tripwire | verifier compares list to disk | `--check` regenerates and diffs |

**Criterion 1 — authored lines: Workbox wins decisively.** 110 → 50, a 55%
reduction, with the service worker itself down to 8 lines of actual logic.

**Criterion 2 — runtime: passes.** +5.9KB gzipped and behaviourally equivalent;
both pass all 27 checks including offline reload and offline-with-query-string.

**Criterion 4 — clone-and-go: passes as written, but the criterion missed
something.** The manifest is committed, so a fresh clone runs before `npm i`,
and `npm` was already needed for `just check`. What the criterion didn't capture
is the weight: `workbox-build` is required for `just check`'s `--check` mode, and
adding it takes `node_modules` from **34MB to 112MB** and the lockfile to **357
packages**. For a skeleton whose entire premise is lowering activation energy,
that is a real cost even though it doesn't block a clone.

### Criterion 3 — and the result reverses my prior

I expected Workbox to fix the `cache.addAll` atomicity defect by construction.
**It has the defect.** Tested by putting one non-existent path in each precache
list and loading the page:

```
hand-rolled   sw=active  cacheEntries=13  offlineItems=6   => DEGRADED, offline still works
workbox       sw=none    cacheEntries=0   offlineItems=0   => DEAD, no offline at all
```

Workbox's `precacheAndRoute` rejects the install if any single entry fails, which
is precisely the failure the hand-rolled worker was rewritten to avoid — silent,
total, on a phone with no console.

Scored honestly, Workbox gets **2 of 3 free** and regresses on the third:

| defect | hand-rolled | Workbox |
|---|---|---|
| `addAll` atomicity | fixed by hand (adds individually) | **present** |
| `respondWith(undefined)` on a cache miss with no network | fixed by hand (synthetic 504) | free |
| no `ignoreSearch` / navigation fallback | fixed by hand | free (`NavigationRoute`) |

The fair mitigation: Workbox generates the list from disk, so a path that
doesn't exist can't normally get into it. The risk narrows to a file deleted
after generation, or a partial deploy. But when it does happen the failure is
total rather than partial, and nothing tells you.

One cost that doesn't show in the line count: `importScripts()` globals aren't
typed, so the spike needs a hand-written `sw-globals.d.ts` declaring `workbox`
and `self.__PRECACHE`, plus `workbox-precaching`/`workbox-routing` as
devDependencies purely for those types. The hand-rolled worker needs nothing.

### Verdict: not a clean loss, so the spike is kept for you to choose

It was to be deleted if it lost. It doesn't lose — it halves the authored code
and passes everything — so `variants/_spike-workbox/` stays until you pick. The
tradeoff is real in both directions:

- **Workbox** if you value less code to own and correct-by-default routing:
  55% fewer authored lines, and a service worker that is 8 lines of logic.
- **Hand-rolled** if you value degrading rather than dying when the precache
  list is wrong, shipping nothing you didn't write, and a 34MB `node_modules`
  instead of 112MB.

My read, for what it's worth: the line-count win is real and the routing is
genuinely better, but two of the three costs — atomic-fail and 75MB of
dev-dependency — cut against exactly what this skeleton is for. I'd keep the
hand-rolled worker and steal Workbox's two good ideas, both of which are already
in it (individual adds, navigation fallback). But it's close enough that it's
your call, which is why the spike is still on disk.

One thing the spike changed for the better regardless: generation alone would
have *lost* the incumbent's tripwire, so `--check` regenerates and diffs. Any
derived file needs that, which is the build-rarely/check-usually rule doing its
job rather than being recited.


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

## Axis 3 — how an item becomes DOM

All three share one base class (41 code lines: prefix-append, scroll pinning,
`role`/`aria-live`/`aria-busy`). They override exactly one method,
`createItem(item)`, so the measurement isolates the only real variable.
Selectable at runtime with `?log=string|template|fetch`.

**All three pass 27/27, and all three escape correctly** — a
`<img src=x onerror=alert(1)>` typed into the add field rendered as literal text
with 0 injected nodes in every case.

| | A: string in JS | B: `<template>` in index.html | C: own `.html`, fetched |
|---|---|---|---|
| subclass | 11 | 14 | 15 |
| host helper | 5 (`renderItem`) | 6 (`fill`) | 6 (`fill`) |
| markup | — | 6 lines HTML | 4 lines HTML |
| **authored total** | **16** | **26** | **25** |
| extra network request | none | none | **one, blocking** |
| HTML written as HTML | no | **yes** | **yes** |
| escaping | `esc()`, by discipline | `textContent`, structural | `textContent`, structural |
| markup travels with component | yes | **no** — host supplies it | **yes** |

### Reading the numbers

A is smallest, and that is not the point. Its 16 lines include an `esc()` call
you must remember every time, forever; B and C cannot forget, because
`textContent` never parses markup. Ten lines is a cheap price for deleting a
category of bug — the same trade Lit makes on axis 1.

B and C are within a line of each other and differ only on *where the markup
lives*:

- **B** puts it in `index.html`. No extra request, real HTML, but the component
  no longer carries its own markup — it "travels, if the host supplies a
  matching template".
- **C** puts it next to the component and fetches it via `import.meta.url`, so
  `append-log-fetch.js` and `append-log-entry.html` move together. Genuine
  isolation, at the cost of one request on the critical path.

That request is worth being precise about. The fetch happens at **module load**
under top-level await, not at render, so the module graph blocks until the
template is parsed and every instance then renders synchronously — no loading
state, no flash. After first install it comes from the precache in ~0ms. A cold
first load pays one round trip before anything paints.

### The hazard this turned up

Top-level await in the entry module **defers the rest of that module past the
`load` event**. The service worker registration sat in
`window.addEventListener("load", ...)`, that listener was attached too late to
ever fire, and offline silently stopped working — while the app rendered
perfectly and threw no errors. Exactly the failure profile this project keeps
running into: green everywhere, broken on the subway.

Fixed by checking `document.readyState === "complete"` first, applied to all
three variants since any of them is one `await` away from the same trap. Added
to the known-hazards table.

### If you want HTML-as-HTML without the request

Worth knowing before choosing: VS Code with the lit-html extension, or a
`/* html */` comment before the backtick, syntax-highlights HTML inside a
template literal. That makes a fourth shape — markup as a tagged string in the
component's own module — which travels, costs no request, and reads as HTML in
the editor. It loses only the structural escaping, which is the expensive half.
