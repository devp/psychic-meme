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

test("complete: globals, fields, special forms, commands", () => {
  assert.deepEqual(lang.complete("(str", 4), { from: 1, items: ["string"] });
  assert.deepEqual(lang.complete("(string.fo", 10), { from: 1, items: ["string.format"] });
  assert.ok(lang.complete("(ea", 3)?.items.includes("each"));
  assert.deepEqual(lang.complete(",he", 3), { from: 0, items: [",help"] });
  assert.ok(lang.complete("(+ 1 2) (str", 12)?.items.includes("string"), "a later form");
  assert.ok(lang.complete("(str x)", 4)?.items.includes("string"), "caret mid-input");
});

test("complete: locals from earlier entries, without disturbing *1", () => {
  lang.evaluate("(+ 40 2)");
  lang.evaluate("(local completeme 1)");
  lang.evaluate("(+ 41 1)");
  assert.deepEqual(lang.complete("(completem", 10)?.items, ["completeme"]);
  assert.equal(lang.evaluate("*1").text, "42");
});

test("complete: nothing in strings, comments, keywords, numbers", () => {
  for (const s of ['"(str', "1 ; (str", "(print :str", "(+ 12", "(- -1", "(+ +2", "(* .5", "(- -.5"]) assert.equal(lang.complete(s, s.length), null, s);
  assert.ok(lang.complete("(->", 3)?.items.includes("->>"), "a symbol that starts with - still completes");
  assert.equal(lang.complete("(string", 7)?.items.includes("string"), false, "the fragment itself isn't offered");
});

test("preprocessDoc sends relative links to fennel-lang.org", () => {
  const md = "[a](tutorial#modules) [b](api.md#repl) [c](/macros.md) [d](https://x.org/y) [e](#here)";
  assert.equal(
    lang.preprocessDoc(md),
    "[a](https://fennel-lang.org/tutorial#modules) [b](https://fennel-lang.org/api#repl) [c](https://fennel-lang.org/macros) [d](https://x.org/y) [e](#here)"
  );
});

test("preprocessDoc drops leading front matter only", () => {
  assert.equal(lang.preprocessDoc("---\nname: fennel\n---\n\nbody\n---\n"), "\nbody\n---\n");
});
