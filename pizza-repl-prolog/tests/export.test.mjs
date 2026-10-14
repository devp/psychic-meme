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

test("export round-trips: pasted back, it reruns entry by entry and ends on the same answers", () => {
  const session = record([
    "n(1). n(2)",
    "n(3)", // replaces n/1: the replay must too
    "?- n(X)",
    "sq(X, Y) :- n(X), Y is X * X.",
    "?- between(1, 15, X)",
    ";",
    "?- nope(1).",
    "x = 'open",
    "?- writeln(mid)",
    "?- sq(3, Y).",
  ]);
  assert.equal(session.items.at(-1)?.output, "Y = 9.");
  assert.equal(session.items[5].output.split("\n").at(-2), "X = 15 ;");
  const rerun = lang.evaluate(exportSession(session, lang));
  assert.equal(rerun.isError, false, rerun.text);
  const lines = rerun.text.split("\n");
  assert.equal(lines.at(-1), "Y = 9.", "definitions replay faithfully");
  assert.ok(lines.includes("mid"), "prints still happen");
  assert.ok(lines.includes("X = 15 ;"), "; continues the replayed query");
  assert.deepEqual(lines.slice(lines.indexOf("?- n(X)") + 1, lines.indexOf("?- n(X)") + 2), ["X = 3."], "n/1 was replaced, not appended to");
});

test("export comments out errors, keeps their record", () => {
  const out = exportSession(record(["x = 'open", "?- nope.", "?- X = 7."]), lang);
  assert.match(out, /^% \(this errored/m);
  assert.match(out, /^% x = 'open$/m);
  assert.match(out, /^% \?- nope\.$/m);
  assert.match(out, /^% ERROR: uncaught exception/m);
  assert.match(out, /^\?- X = 7\.\n% => X = 7\.$/m);
});

test("export header names the app and session", () => {
  const out = exportSession({ name: "", items: [] }, lang, new Date(0));
  assert.equal(out.split("\n")[0], '% pizza-repl-prolog export: "Untitled session" -- 1970-01-01T00:00:00.000Z');
});
