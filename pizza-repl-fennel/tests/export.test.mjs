import { test } from "node:test";
import assert from "node:assert/strict";
import { lang } from "./load-lang.mjs";
import { exportSession } from "../lib/export.js";

/** Run inputs through the real evaluator, the way the REPL records them. */
function record(/** @type {string[]} */ inputs) {
  return {
    name: "t",
    items: inputs.map((input) => {
      const r = lang.evaluate(input);
      return { input, output: r.text, isError: r.isError };
    }),
  };
}

test("export round-trips: pasted back, it reruns entry by entry and ends on the same values", () => {
  const session = record(["(local a (+ 1 2))", "(* a 10)", "(local b *1)", "(+ 1", "(nope)", '(print "mid")', "(fn f [x] (* x 2))", "(f b)"]);
  assert.equal(session.items.at(-1)?.output, "60");
  const rerun = lang.evaluate(exportSession(session, lang));
  assert.equal(rerun.isError, false, rerun.text);
  const lines = rerun.text.split("\n");
  assert.equal(lines.at(-1), "60", "locals and *1 replay faithfully");
  assert.ok(lines.includes("mid"), "prints still happen");
});

test("export comments out errors, keeps their record", () => {
  const out = exportSession(record(["(+ 1", "(nope)", "7"]), lang);
  assert.match(out, /^;; \(this errored/m);
  assert.match(out, /^;; \(\+ 1$/m);
  assert.match(out, /^;; ERROR: Incomplete/m);
  assert.match(out, /^;; \(nope\)$/m);
  assert.match(out, /^7\n;; => 7$/m);
  assert.doesNotMatch(out, /Heads up/);
});

test("export header names the app and session", () => {
  const out = exportSession({ name: "", items: [] }, lang, new Date(0));
  assert.equal(out.split("\n")[0], ';; pizza-repl-fennel export: "Untitled session" -- 1970-01-01T00:00:00.000Z');
});
