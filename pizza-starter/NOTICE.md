# Third-party code

- **`variants/lit/vendor/lit-core.min.js`** — [Lit](https://lit.dev) 3.3.3, © Google LLC,
  BSD-3-Clause. Bundled from the npm `lit` package with esbuild (`just vendor-lit`) into a
  single file so it can be vendored and served offline with no build step. Contains
  `LitElement`, `html`, `css`, `nothing`, `svg`, and the `repeat` directive.

- **`variants/_spike-workbox/vendor/workbox.js`** — [Workbox](https://developer.chrome.com/docs/workbox)
  7.4.1, © Google LLC, MIT. Bundled from `workbox-precaching`, `workbox-routing` and
  `workbox-strategies` (`just vendor-workbox`). Part of the offline-layer spike; see
  COMPARISON.md for whether it survives.

License headers are preserved inline in both bundles.

`lit`, `workbox-precaching` and `workbox-routing` also appear in `devDependencies`, for their
TypeScript declarations only. `workbox-build` is a devDependency for generating the precache
manifest. Nothing from `node_modules` ships.

The `variants/vanilla/` tree has no third-party code at all.
