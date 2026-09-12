# Third-party code

- **`variants/lit/vendor/lit-core.min.js`** — [Lit](https://lit.dev) 3.3.3, © Google LLC,
  BSD-3-Clause. Bundled from the npm `lit` package with esbuild (`just vendor-lit`) into a
  single file so it can be vendored and served offline with no build step. Contains
  `LitElement`, `html`, `css`, `nothing`, `svg`, and the `repeat` directive. The license header
  is preserved inline in the bundle.

`lit` also appears in `devDependencies`, for its TypeScript declarations only
(`variants/lit/vendor/lit-core.min.d.ts` re-exports them). Nothing from `node_modules` ships.

The `variants/vanilla/` tree has no third-party code at all.
