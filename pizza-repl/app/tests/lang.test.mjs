import { test } from "node:test";
import assert from "node:assert/strict";
import { lang } from "./load-lang.mjs";

test("a value", () => {
  assert.deepEqual(lang.evaluate("1 + 2"), { text: "3", isError: false });
  assert.deepEqual(lang.evaluate("'hi'"), { text: '"hi"', isError: false });
  assert.deepEqual(lang.evaluate("[1, {a: 2}]"), { text: '[1,{"a":2}]', isError: false });
});

test("var and function persist; _ is the last value", () => {
  lang.evaluate("var a = 20; function f(x) { return x + 1 }");
  assert.equal(lang.evaluate("f(a)").text, "21");
  assert.equal(lang.evaluate("_ * 2").text, "42");
});

test("console.log comes before the value", () => {
  assert.deepEqual(lang.evaluate('console.log("hi", 1); 5'), { text: "hi 1\n5", isError: false });
});

test("errors are errors, with what printed first", () => {
  assert.deepEqual(lang.evaluate('console.log("x"); nope()'), { text: "x\nReferenceError: nope is not defined", isError: true });
  assert.equal(lang.evaluate("1 +").isError, true);
  assert.equal(lang.evaluate("throw 3").text, "Uncaught 3");
});

test("hasUnterminated: brackets, strings, templates, block comments", () => {
  for (const s of ["(1", "[1, {", '"abc', "`x ${1}", "/* no end", "f(')')("]) assert.equal(lang.hasUnterminated(s), true, s);
  for (const s of ["(1)", "'(' + \")\"", "// (", "/* ( */ 1", "`)`", "x = '\\''"]) assert.equal(lang.hasUnterminated(s), false, s);
});

test("complete: globals and keywords, not after a dot", () => {
  assert.ok(lang.complete("Mat", 3)?.items.includes("Math"));
  assert.ok(lang.complete("x = typ", 7)?.items.includes("typeof"));
  assert.equal(lang.complete("Math.fl", 7), null);
  assert.equal(lang.complete("'Mat", 4), null, "not in a string");
});
