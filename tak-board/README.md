# tak-board

`<tak-board>`: a web component that renders a [Tak](https://ustak.org/tak-rules/) position from
[TPS](https://ustak.org/tak-positional-system-tps/). The drawing is
[TPS-Ninja](https://github.com/gruppler/TPS-Ninja)'s SVG renderer, bundled unmodified.

[Demo](https://devpurkayastha.com/psychic-meme/tak-board/)

## Use

Copy `tak-board.js` (one file, ~77 KB, ~27 KB gzipped, no dependencies) into your app:

```html
<script type="module" src="tak-board.js"></script>
<tak-board tps="x5,2/1,1,1,1,12,x/x4,1211C,2S/x3,2C,2,x/2,2,x,1,1,x/1,2,2,2,21,2 1 16"></tak-board>
```

| attribute | |
|---|---|
| `tps` | position. A bare size (`tps="6"`) gives an empty board. |
| `turn` | `white`/`black` (or `1`/`2`): overrides the side to move in the TPS. |
| anything else | passed to TPS-Ninja as a render option, kebab-cased: `plies="3e4+ Sd6 f5"`, `theme="discord"`, `axis-labels="false"`, `unplayed-pieces="false"`, ... See [options.js](https://github.com/gruppler/TPS-Ninja/blob/v1.1.26/src/options.js). |

The board re-renders when an attribute changes. It sizes to its container width (`tak-board { width: 20rem }`).
An invalid TPS or ply renders the error message instead of a board.

The module also exports `TakBoard`, `TPStoSVGString` and `withTurn` for wrapper components.

## Build

`tak-board.js` is built from `src/` plus the `tps-ninja` npm package, with Node-only imports
(`fs`, `canvas`) swapped for browser shims in `shims/`. Nothing in TPS-Ninja is patched.

```sh
just dev-init   # pnpm install
just build      # rebuild tak-board.js; commit it
just dev-check  # tests; fails if tak-board.js is stale
just serve      # demo at http://localhost:8000
```

## License

AGPL-3.0-or-later, inherited from TPS-Ninja. See [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md).
