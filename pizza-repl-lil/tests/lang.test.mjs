import { test } from "node:test";
import assert from "node:assert/strict";
import { lang } from "./load-lang.mjs";

test("evaluate: a plain value", () => {
  assert.deepEqual(lang.evaluate("1+2"), { text: "3", isError: false });
});

test("evaluate: a multi-line definition, then a call", () => {
  assert.equal(lang.evaluate('on greet name do "hi ", name end').isError, false);
  assert.deepEqual(lang.evaluate('greet["w"]'), { text: '("hi ","w")', isError: false });
});

test("evaluate: printed output comes before the value", () => {
  assert.deepEqual(lang.evaluate('print["hi"]\n5'), { text: "hi\n5", isError: false });
});

test("evaluate: _ is the last result", () => {
  lang.evaluate("20");
  assert.equal(lang.evaluate("_+1").text, "21");
});

test("evaluate: a syntax error is an error, with its position", () => {
  const r = lang.evaluate("1+");
  assert.equal(r.isError, true);
  assert.match(r.text, /^\(1:3\) /);
});

test("hasUnterminated", () => {
  for (const s of ['"hello', "show[1,2", "(1+2", '"esc \\" still open']) assert.equal(lang.hasUnterminated(s), true, s);
  for (const s of ["1+2", 'show["a]"]', '# comment with " and [\n1', '"\\\\"']) assert.equal(lang.hasUnterminated(s), false, s);
});

test("replayCaveat: only for a standalone _", () => {
  assert.equal(lang.replayCaveat(["my_var+1", "_x:2"]).length, 0);
  assert.ok(lang.replayCaveat(["1", "_+1"]).length > 0);
});

test("preprocessDoc drops Decker's site-build markup", () => {
  const md = "title:Lil\n{{TOC}}\n# Lil\n![shot](images/x.png)\ntext\n";
  assert.equal(lang.preprocessDoc(md), "# Lil\ntext\n");
});
