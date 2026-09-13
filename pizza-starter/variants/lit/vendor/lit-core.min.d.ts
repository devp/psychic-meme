// Types for the vendored bundle. The runtime is lit-core.min.js (built once by
// `just vendor-lit`); `lit` is a devDependency for these declarations only and
// never ships.
export * from "lit";
export { repeat } from "lit/directives/repeat.js";
