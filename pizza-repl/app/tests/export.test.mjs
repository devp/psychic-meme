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

test("export round-trips: pasted back, it reruns and ends on the same value", () => {
  const session = record(["var p = 3", "(p", "nope()", 'console.log("mid")', "function g(x) { return x * 2 }", "g(p)"]);
  assert.equal(session.items.at(-1)?.output, "6");
  const rerun = lang.evaluate(exportSession(session, lang));
  assert.equal(rerun.isError, false, rerun.text);
  assert.equal(rerun.text.split("\n").at(-1), "6");
  assert.ok(rerun.text.includes("mid"), "logs still happen");
});

test("export comments out errors, keeps their record", () => {
  const out = exportSession(record(["(1", "nope()", "7"]), lang);
  assert.match(out, /^\/\/ \(this errored/m);
  assert.match(out, /^\/\/ \(1$/m);
  assert.match(out, /^\/\/ nope\(\)$/m);
  assert.match(out, /^7\n\/\/ => 7$/m);
});

test("export warns about _", () => {
  assert.match(exportSession(record(["1", "_ + 1"]), lang), /Heads up/);
  assert.doesNotMatch(exportSession(record(["var my_x = 1"]), lang), /Heads up/);
});
