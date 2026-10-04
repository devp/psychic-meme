# Third-party code

`tak-board.js` is a bundle that includes:

- **[TPS-Ninja](https://github.com/gruppler/TPS-Ninja)** 1.1.26 (commit `dea8ce4`), by Craig Laparo, AGPL-3.0 (`LICENSE`).
  Unmodified; its `fs` and `canvas` imports are redirected at build time to `shims/`.
  TPS-Ninja is also the rendering library behind [PTN Ninja](https://github.com/gruppler/PTN-Ninja), by the same author.
- **[lodash-es](https://lodash.com/)** 4.18.1, a TPS-Ninja dependency, MIT. Copyright OpenJS Foundation and other contributors.

tak-board itself (`src/`, `shims/`, `scripts/`) is AGPL-3.0-or-later, as a derivative work of TPS-Ninja.
Corresponding source for the bundle: this directory, with versions pinned in `pnpm-lock.yaml`.
