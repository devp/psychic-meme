# concierge

An homage to the Songza web player of 2014, and its Concierge: *It's Wednesday Afternoon. Play music for…*

It asked what you were doing, offered a few things that fit, and got out of the way. This rebuilds that interface in spirit, over made-up data, so it can be pointed at something other than music.

Built from [pizza-starter](../pizza-starter): no build step, works offline.

## Try it

`just serve`, then http://localhost:8000.

| Add to the URL | To |
|---|---|
| `?period=night` | see another time's lineup and sky: `morning`, `late-morning`, `afternoon`, `evening`, `night`, `late-night` |
| `?day=saturday` | see another day's lineup |
| `?speed=60` | make the mock player's items end while you watch |

## What it does

- **Concierge**: three questions deep. The moment picks the situations; a situation offers three refinements; a refinement offers three stations.
- **Browse**: the same stations by activity, genre, mood and decade.
- **Search**, as you type.
- **A station page**, with similar stations under it.
- **A player** along the bottom: play/pause, skip, thumbs up and down (down skips). It plays nothing. It counts time.
- **Recent**: the stations you played, kept in localStorage. The only thing kept.

## Where things are

The UI never imports `mock/`. Everything it knows about the subject comes through two exports in `service.js`.

| File | What it is |
|---|---|
| `lib/types.js` | The data contract: `Service`, `Engine`, and the shapes they deal in. Start here. |
| `service.js` | The one file that knows the data is mocked. |
| `mock/` | The mock: `data.js` (stations, situations, lineups, galleries), `service.js`, `engine.js`, `icons.svg`. |
| `views.js` | A route in, one screen's worth of data out (a `View`). No DOM. |
| `components/stage-view.js` | Draws a `View`: heading, tiles, links, cards, a featured collection. |
| `components/side-nav.js`, `player-bar.js` | The rail and the player. Properties in, events out. |
| `lib/router.js`, `moment.js`, `player.js` | The URL hash as data; day and period from a `Date`; what's on. No DOM. |
| `app.js` | The wiring. |
| `theme.css` | Every colour, and the sky for each period. |

## Making it about something else

The nouns in the code are not musical on purpose: a *situation* leads to *refinements*, which lead to *collections*, which serve *items*.

1. Write a `Service` (`lib/types.js`). `getConfig()` supplies the words: brand, the prompt under the heading ("Play music for"), what collections are called ("stations").
2. Write an `Engine` if items take time: `mock/engine.js` is the shape, an `<audio>` element is the usual body. If they don't, the player bar may not be for you.
3. Point `service.js` at them. Delete `mock/` and take its files out of `sw-assets.js`.

`tests/mock-service.test.mjs` is mostly what any `Service` should promise the UI; it's a start on a test for yours.

## Checks

`just dev-init` once, then `just dev-check` (typecheck, tests). `just dev-init-browser` adds the browser tests. `just warnings` needs nothing.
