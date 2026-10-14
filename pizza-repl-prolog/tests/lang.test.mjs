import { test } from "node:test";
import assert from "node:assert/strict";
import { lang } from "./load-lang.mjs";

test("evaluate: a query", () => {
  assert.deepEqual(lang.evaluate("?- X is 6 * 7."), { text: "X = 42.", isError: false });
});

test("evaluate: the final . is optional", () => {
  assert.deepEqual(lang.evaluate("?- X = a"), { text: "X = a.", isError: false });
});

test("evaluate: a multi-line definition reports itself, then answers", () => {
  assert.deepEqual(lang.evaluate("edge(a, b). edge(b, c).\npath(X, Y) :- edge(X, Y).\npath(X, Y) :- edge(X, Z), path(Z, Y)."), {
    text: "edge/2: 2 clauses\npath/2: 2 clauses",
    isError: false,
  });
  assert.deepEqual(lang.evaluate("?- path(a, Y)."), { text: "Y = b ;\nY = c ;\nfalse.", isError: false });
});

test("evaluate: re-entering a predicate replaces it", () => {
  lang.evaluate("color(red). color(green).");
  assert.equal(lang.evaluate("color(blue).").text, "color/1: 1 clause");
  assert.equal(lang.evaluate("?- color(C).").text, "C = blue.");
});

test("evaluate: yes, no, and printed output before the answer", () => {
  assert.equal(lang.evaluate("?- true.").text, "true.");
  assert.equal(lang.evaluate("?- fail.").text, "false.");
  assert.deepEqual(lang.evaluate('?- member(X, [a, b]), format("got ~w~n", [X]).'), {
    text: "got a\nX = a ;\ngot b\nX = b ;\nfalse.",
    isError: false,
  });
  assert.equal(lang.evaluate("?- writeln(hi), print('A b').").text, "hi\n'A b'\ntrue.");
});

test("evaluate: ; continues the last query past a batch", () => {
  const first = lang.evaluate("?- between(1, 12, X).").text.split("\n");
  assert.equal(first.length, 11);
  assert.equal(first.at(-2), "X = 10 ;");
  assert.equal(first.at(-1), "(; for more)");
  assert.deepEqual(lang.evaluate(";"), { text: "X = 11 ;\nX = 12 ;\nfalse.", isError: false });
  assert.equal(lang.evaluate(";").isError, true, "nothing left to continue");
});

test("evaluate: syntax, existence and runaway errors are errors", () => {
  const syntax = lang.evaluate("?- X = f(.");
  assert.equal(syntax.isError, true);
  assert.match(syntax.text, /syntax_error/);
  assert.equal(lang.evaluate("bad( :- .").isError, true);
  const missing = lang.evaluate("?- nope(1).");
  assert.equal(missing.isError, true);
  assert.match(missing.text, /existence_error\(procedure,nope\/1\)/);
  lang.evaluate("spin :- spin.");
  const runaway = lang.evaluate("?- spin.");
  assert.equal(runaway.isError, true);
  assert.match(runaway.text, /^Stopped after 1,000,000 inferences/);
  assert.equal(lang.evaluate("?- use_module(library(nope)).").isError, true);
  assert.equal(lang.evaluate(":- use_module(library(nope)).").isError, true);
});

test("evaluate: a query missing its ?- can't redefine a builtin", () => {
  const r = lang.evaluate("X = 1.");
  assert.equal(r.isError, true);
  assert.match(r.text, /=\/2 is built in/);
  assert.equal(lang.evaluate("?- Y = 2.").text, "Y = 2.", "= still works");
  assert.equal(lang.evaluate("member(x, [x]).").isError, true);
  assert.equal(lang.evaluate("?- member(b, [a, b]).").text, "true ;\nfalse.");
});

test("evaluate: expansion hooks are refused, so later entries stay synchronous", () => {
  assert.equal(lang.evaluate("term_expansion(a, b).").isError, true);
  assert.equal(lang.evaluate("ok(1). goal_expansion(a, b).").isError, true);
  assert.equal(lang.evaluate("hooked(1).").text, "hooked/1: 1 clause");
  assert.equal(lang.evaluate("?- hooked(X).").text, "X = 1.");
});

test("evaluate: DCGs translate (Tau after 0.3.4)", () => {
  lang.evaluate("greeting --> [hello], who.\nwho --> [world].");
  assert.equal(lang.evaluate("?- phrase(greeting, X).").text, "X = [hello,world].");
});

test("evaluate: directives, dynamic predicates, and no stdin", () => {
  assert.deepEqual(lang.evaluate(":- dynamic counter/1."), { text: "counter/1: 0 clauses", isError: false });
  lang.evaluate("?- assertz(counter(1)).");
  assert.equal(lang.evaluate("?- counter(N).").text, "N = 1.");
  assert.equal(lang.evaluate("?- read(X).").text, "X = end_of_file.");
});

test("evaluate: several queries in one entry are labelled", () => {
  assert.equal(lang.evaluate("?- X = 1.\n?- Y = 2.").text, "?- X = 1.\nX = 1.\n?- Y = 2.\nY = 2.");
});

test("evaluate: an unclosed block comment is refused", () => {
  const r = lang.evaluate("p(1). /* oops");
  assert.equal(r.isError, true);
  assert.match(r.text, /^Unclosed \/\*/);
});

test("hasUnterminated", () => {
  for (const s of ["X = 'open", 'X = "open', "p. /* open", "/* open"]) assert.equal(lang.hasUnterminated(s), true, s);
  for (const s of ["p(1).", "?- X = '/*'.", "p(. % ( unclosed paren is fine: . still ends it", "/* closed */ p.", "% /* in a line comment"]) assert.equal(lang.hasUnterminated(s), false, s);
});

test("preprocessDoc drops front matter", () => {
  assert.equal(lang.preprocessDoc("---\nname: Prolog\n---\n\nbody"), "\nbody");
  assert.equal(lang.preprocessDoc("# no front matter\n---\n"), "# no front matter\n---\n");
});
