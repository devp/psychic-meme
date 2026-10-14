// Writes docs/builtins.md: every predicate the REPL preloads, by module, as the
// vendored engine has them. Rerun after updating vendor/tau-prolog.js.
//
//   node scripts/builtins-doc.mjs
import { writeFileSync } from "node:fs";
import "../tests/load-lang.mjs";

const pl = /** @type {any} */ (globalThis).pl;
const LIBRARIES = ["lists", "format", "charsio", "random", "statistics"];

/** @param {string[]} indicators */
const list = (indicators) =>
  [...new Set(indicators)]
    .filter((i) => !/^[$_]/.test(i))
    .sort((a, b) => a.localeCompare(b, "en"))
    .map((i) => `\`${i}\``)
    .join(", ");

const md = [
  "# Builtins",
  "",
  "Every predicate this REPL starts with, by where it comes from. Names only: for",
  "what one does, the ISO standard and SWI-Prolog's manual mostly agree with Tau.",
  "",
  "## system",
  "",
  "Built into the engine.",
  "",
  list(Object.keys(pl.modules.system.rules)),
  "",
  ...LIBRARIES.flatMap((m) => [`## ${m}`, "", `library(${m}), preloaded.`, "", list(pl.modules[m].exports), ""]),
  "## compat",
  "",
  "SWI-Prolog staples Tau lacks, defined in lang.js.",
  "",
  list(["writeln/1", "print/1", "plus/3", "memberchk/2"]),
  "",
];
writeFileSync(new URL("../docs/builtins.md", import.meta.url), md.join("\n"));
