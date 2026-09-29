import { test } from "node:test";
import assert from "node:assert/strict";
import { lang } from "./load-lang.mjs";

test("evaluate: a plain value", () => {
  assert.deepEqual(lang.evaluate("(+ 1 2)"), { text: "3", isError: false });
});

test("evaluate: a multi-line definition, then a call", () => {
  assert.equal(lang.evaluate("(fn sq [n]\n  (* n n))").isError, false);
  assert.deepEqual(lang.evaluate("(sq 7)"), { text: "49", isError: false });
});

test("evaluate: locals persist between entries", () => {
  lang.evaluate("(local x 10)");
  assert.deepEqual(lang.evaluate("(* x 2)"), { text: "20", isError: false });
});

test("evaluate: *1 is the last value", () => {
  lang.evaluate("(+ 20 1)");
  assert.equal(lang.evaluate("*1").text, "21");
});

test("evaluate: printed output and values interleave in order", () => {
  assert.deepEqual(lang.evaluate("(print :hi) 5 (print :bye)"), { text: "hi\n5\nbye", isError: false });
});

test("evaluate: multiple values share a line", () => {
  assert.equal(lang.evaluate("(values 1 :a)").text, '1\t"a"');
});

test("evaluate: compile, parse and runtime errors are errors", () => {
  const compile = lang.evaluate("(nope)");
  assert.equal(compile.isError, true);
  assert.match(compile.text, /Compile error: unknown identifier: nope/);
  assert.doesNotMatch(compile.text, /\u001b/, "no ANSI escapes");
  const parse = lang.evaluate(")");
  assert.equal(parse.isError, true);
  assert.match(parse.text, /Parse error/);
  const runtime = lang.evaluate("(error :boom)");
  assert.equal(runtime.isError, true);
  assert.match(runtime.text, /^Runtime error: .*boom/);
});

test("evaluate: incomplete input errors without costing the repl its locals", () => {
  lang.evaluate("(local kept 1)");
  const r = lang.evaluate("(+ 1");
  assert.equal(r.isError, true);
  assert.match(r.text, /^Incomplete/);
  assert.deepEqual(lang.evaluate("kept"), { text: "1", isError: false });
});

test("evaluate: ,help is the repl's own", () => {
  assert.match(lang.evaluate(",help").text, /repl commands/);
});

test("hasUnterminated", () => {
  for (const s of ["(+ 1", "[1 2", "{:a", '"open', '"esc \\" still open']) assert.equal(lang.hasUnterminated(s), true, s);
  for (const s of ["(+ 1 2)", '(.. ")" "(")', "; ( in a comment\n1", "(+ 1 2))"]) assert.equal(lang.hasUnterminated(s), false, s);
});

test("preprocessDoc sends relative links to fennel-lang.org", () => {
  const md = "[a](tutorial#modules) [b](api.md#repl) [c](/macros.md) [d](https://x.org/y) [e](#here)";
  assert.equal(
    lang.preprocessDoc(md),
    "[a](https://fennel-lang.org/tutorial#modules) [b](https://fennel-lang.org/api#repl) [c](https://fennel-lang.org/macros) [d](https://x.org/y) [e](#here)"
  );
});
