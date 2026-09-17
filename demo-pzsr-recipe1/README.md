# Supper Deck

A household meal planner for a kitchen that already has the recipes.

Built from [`pizza-starter`](../pizza-starter) as a demo of it: no build step,
offline-first, installable, phone-shaped.

## The problem it's pointed at

The premise is a library of 115 dishes this household already knows how to
cook, tagged by cook method, prep time and cultural lane. The library is not
the problem. Standing in the kitchen at 5:40pm *reading* the library is the
problem — and a recipe app's usual answer (search, browse, discover, save)
makes that worse, because every one of those is an invitation to keep looking.

So this app is built around three claims:

1. **Deciding is the expensive part, not cooking.** The front door is one card
   at a time with two answers. Swipe right and it lands on the first open
   night; swipe left and you won't see it again this week.
2. **You can't pick what you can't cook.** A pantry of tracked staples sits
   under everything, so a card tells you what it needs that you haven't got,
   and one chip hides everything you'd have to shop for first.
3. **The list is a consequence, not a document.** The shopping list is
   generated from whatever nights got picked plus whatever you've flagged —
   grouped by store, because the shopping routine is four different doors.

## The five tabs

| tab | what it's for |
| --- | --- |
| **tonight** | the deck. Filter chips, one card, two buttons. |
| **week** | the seven nights you've settled, and a log of tonight's decisions. |
| **pantry** | every tracked staple at `have` / `low` / `out`. |
| **shop** | the generated list, grouped by store. |
| **about** | what the app refuses to do, and why. |

## Deliberate omissions

- **No recipe text.** No steps, no quantities, no photos, no source links. You
  know how to cook these — that's the entry criterion for the library.
- **No discovery.** Nothing suggests, trends or recommends. The library is a
  closed set you curate in `data/recipes.js`.
- **No quantities on the shopping list.** Four dishes wanting onions is one
  line. How many onions is a judgement you make at the shelf; a number the app
  invented would be wrong with more confidence.
- **No multi-select filters.** One choice per axis, ANDed. A filter matrix is a
  second decision problem stacked on the first one.
- **No which-night prompt.** Picking a dish is one decision; the app takes the
  night and lets you drag it later if you care.

## Design notes

**`low` is the important pantry state.** A two-state pantry forces you to lie:
mark half an onion "have" and the deck promises a dish you can't finish; mark
it "out" and the list sends you shopping for an onion you have. `low` and `out`
both mean "put it on the list"; only `out` is a hard stop.

**The deck order is seeded by the date.** Fisher-Yates driven by a PRNG seeded
on today's date (`lib/plan.js`). The card can't reorder itself while you're
looking at it — a card that moves because state changed elsewhere is exactly
the dither this app exists to end — but tomorrow deals a different hand, and
there's no stored shuffle state to keep in sync.

**Put away closes the loop.** Ticking things off in `shop` and pressing *Put
away* flips them back to `have`. Without that, the pantry decays into fiction
by week three and the whole edifice stops being trustworthy.

**The swipe is pointer events with an axis lock.** One code path for finger,
trackpad and mouse. The card uses `touch-action: pan-y` and
`components/pick-deck.js` decides at 8px of travel whether you're swiping or
scrolling — `touch-action: none` would have fixed the drag by breaking vertical
scrolling instead.

## Where things are

```
data/recipes.js      the 115 dishes. Edit this first.
data/staples.js      the 75 tracked staples, and which store each comes from.
lib/plan.js          filtering, the deck shuffle, the shopping list. Pure.
lib/seed.js          first-run kitchen, so the app opens with something to say.
lib/store.js         localStorage + subscribers (from pizza-starter).
lib/viewport.js      the mobile keyboard fix (from pizza-starter).
state.js             every store and scalar this app has, plus views over them.
app.js               all the wiring, in the open.
components/          pick-deck, week-plan, pantry-grid, shopping-list, tabs.
components/append-log.js  a travelling component: properties in, no app imports.
tests/plan.test.mjs  the interesting logic, at `node --test` speed.
tests/browser/       the same flows in a real browser, including offline.
```

## Running it

```sh
just serve            # http://localhost:8000 -- a service worker needs http://
just dev-init         # dev tooling; nothing in node_modules ships
just dev-check        # types, precache manifest, tests
just dev-rebuild      # regenerate precache-manifest.js after editing app files
just warnings         # grep-level footgun checks, no node_modules needed
just dev-init-browser # opt in to the browser tests
```

Without `just` installed, read the `justfile` — every recipe is a one-liner.

## Making it yours

1. Replace `data/recipes.js` with your library and `data/staples.js` with what
   your kitchen actually tracks. The unit tests assert that every staple a
   dish names is tracked and every tracked staple is reachable from some dish,
   so a typo shows up as a test failure rather than a blank chip.
2. Change `STORES` to your own routine — the list groups in the order you
   declare them, which should be the order you walk.
3. Retune `lib/seed.js`, or empty it and enter your own pantry once.
4. `just dev-rebuild`, then `just dev-check`.

## Provenance

Bot-generated from a prompt, on top of `pizza-starter`. Level 6 on the
[AI usage scale](https://raw.githubusercontent.com/devp/git-llm-annotate/refs/heads/main/ai-usage-levels-by-visidata.txt)
the starter cites — same caveat, same intent to revise downward.
