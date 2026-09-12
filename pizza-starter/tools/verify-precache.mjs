#!/usr/bin/env node
// Check, don't generate.
//
// The precache list in sw.js is the only thing in this project derived from
// other files. Rather than a build step that rewrites sw.js, this compares the
// hand-maintained list against what's actually on disk and fails loudly when
// they drift. You keep an authored service worker; you don't keep the bug.
//
//   node tools/verify-precache.mjs variants/vanilla

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const variant = process.argv[2];
if (!variant) {
  console.error("usage: node tools/verify-precache.mjs <variant-dir>");
  process.exit(2);
}

const root = new URL("..", import.meta.url).pathname;
const variantDir = join(root, variant);
const libDir = join(root, "lib");

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const posix = (/** @type {string} */ p) => p.split(sep).join("/");

const onDisk = new Set([
  "./",
  ...walk(variantDir)
    .map((f) => posix(relative(variantDir, f)))
    .filter((f) => f !== "sw.js"),
  ...readdirSync(libDir)
    .filter((f) => f.endsWith(".js"))
    .map((f) => `../../lib/${f}`),
]);

const src = readFileSync(join(variantDir, "sw.js"), "utf8");
const block = src.match(/const ASSETS = \[([\s\S]*?)\];/);
if (!block) {
  console.error(`✗ ${variant}/sw.js: no 'const ASSETS = [...]' block found`);
  process.exit(1);
}
const declared = new Set([...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]));

const missing = [...onDisk].filter((f) => !declared.has(f)).sort();
const extra = [...declared].filter((f) => !onDisk.has(f)).sort();

if (missing.length === 0 && extra.length === 0) {
  console.log(`✓ ${variant}/sw.js precache list matches disk (${declared.size} entries)`);
  process.exit(0);
}

console.error(`✗ ${variant}/sw.js precache list is stale\n`);
if (missing.length) {
  console.error("  on disk but not precached (these break offline):");
  missing.forEach((f) => console.error(`    + ${f}`));
}
if (extra.length) {
  console.error("  precached but missing from disk (these abort the install):");
  extra.forEach((f) => console.error(`    - ${f}`));
}
process.exit(1);
