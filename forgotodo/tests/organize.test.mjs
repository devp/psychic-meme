import { test } from "node:test";
import assert from "node:assert/strict";
import { sweepable, recyclable, raiseOnce, forgetOne, rememberOne } from "../lib/organize.js";

const items = [
  { id: "a", text: "a!!" },
  { id: "b", text: "b" },
  { id: "c", text: "c?" },
  { id: "d", text: "d?" },
  { id: "e", text: "e??", done: true },
  { id: "f", text: "f", done: true },
];
const ids = (/** @type {{ id: string }[]} */ xs) => xs.map((x) => x.id);

test("sweep takes the lowest open tier, never done items", () => {
  assert.deepEqual(ids(sweepable(items)), ["c", "d"]);
  assert.deepEqual(ids(sweepable([{ id: "x", text: "x" }, { id: "y", text: "y" }])), ["x", "y"]);
  assert.deepEqual(sweepable([{ id: "z", text: "z", done: true }]), []);
});

test("recycle takes done items", () => {
  assert.deepEqual(ids(recyclable(items)), ["e", "f"]);
});

test("raise is decay run backwards", () => {
  const walk = ["foo?"];
  for (let i = 0; i < 3; i++) walk.push(raiseOnce(walk[walk.length - 1]));
  assert.deepEqual(walk, ["foo?", "foo", "foo!", "foo!!"]);
  assert.equal(raiseOnce("huh???"), "huh");
  assert.equal(raiseOnce("wat?!"), "wat!");
  assert.equal(raiseOnce("foo ! "), "foo !!");
});

test("forget picks an open, not-yet-forgotten item", () => {
  assert.deepEqual(forgetOne(items, () => 0), { id: "a", text: "a!" });
  assert.deepEqual(forgetOne(items, () => 0.99), { id: "b", text: "b?" });
  assert.equal(forgetOne([{ id: "c", text: "c?" }]), null);
});

test("remember picks any open item", () => {
  assert.deepEqual(rememberOne(items, () => 0.99), { id: "d", text: "d" });
  assert.deepEqual(rememberOne(items, () => 0), { id: "a", text: "a!!!" });
  assert.equal(rememberOne([{ id: "f", text: "f", done: true }]), null);
});
