#!/usr/bin/env node
// Typecheck each service worker in its own tsc program.
//
// Two reasons this isn't a shared tsconfig:
//   1. A service worker needs `lib: WebWorker`, which conflicts with `lib: DOM`
//      that the app code needs -- so it can't share the main config either way.
//   2. Service workers are classic scripts, not modules, so their top-level
//      `const`s live in one global scope. Put two of them in the same program
//      and every shared name collides.
//
//   node scripts/check-sw.mjs sw.js

import { spawnSync } from "node:child_process";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: node scripts/check-sw.mjs <sw.js>...");
  process.exit(2);
}

let failed = false;
for (const file of files) {
  const r = spawnSync(
    "npx",
    ["tsc", "--noEmit", "--allowJs", "--checkJs", "--strict",
     "--target", "ES2022", "--module", "ESNext", "--moduleResolution", "bundler",
     "--lib", "ES2022,WebWorker", file],
    { stdio: "inherit", shell: false }
  );
  if (r.status !== 0) failed = true;
  else console.log(`✓ ${file} typechecks`);
}
process.exit(failed ? 1 : 0);
