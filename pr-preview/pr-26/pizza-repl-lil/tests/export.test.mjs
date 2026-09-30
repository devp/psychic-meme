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

test("export round-trips: pasted back, it runs clean and ends on the same value", () => {
  const session = record(["a:1+2", "b:a*10", "1+", '"open', 'print["mid"]', "on f x do x*2 end", "f[b]"]);
  const exported = exportSession(session, lang);
  const rerun = lang.evaluate(exported);
  assert.equal(rerun.isError, false, rerun.text);
  const last = session.items.at(-1);
  assert.equal(rerun.text.split("\n").at(-1), last?.output);
  assert.match(rerun.text, /^mid$/m, "prints still happen");
});

test("export comments out errors and unterminated input, keeps their record", () => {
  const out = exportSession(record(["1+", '"open', "7"]), lang);
  assert.match(out, /^# \(this errored/m);
  assert.match(out, /^# 1\+$/m);
  assert.match(out, /^# ERROR: \(1:3\) /m);
  assert.match(out, /^# \(unterminated/m);
  assert.match(out, /^# "open$/m);
  assert.match(out, /^7\n# => 7$/m);
});

test("export warns about _ only when it's used", () => {
  assert.doesNotMatch(exportSession(record(["1"]), lang), /Heads up/);
  assert.match(exportSession(record(["1", "_+1"]), lang), /^# Heads up/m);
});

test("export header names the app and session", () => {
  const out = exportSession({ name: "", items: [] }, lang, new Date(0));
  assert.equal(out.split("\n")[0], '# pizza-repl-lil export: "Untitled session" -- 1970-01-01T00:00:00.000Z');
});
