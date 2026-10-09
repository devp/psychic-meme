import { test } from "node:test";
import assert from "node:assert/strict";
import { sweepable, snoozed, recyclable, raiseOnce, forgetOne, rememberOne, forgetSome, rememberSome, shakeUp } from "../lib/organize.js";

const items = [
  { id: "a", text: "a!!" },
  { id: "b", text: "b" },
  { id: "c", text: "c?" },
  { id: "d", text: "d?" },
  { id: "g", text: "g??" },
  { id: "h", text: "h???" },
  { id: "e", text: "e??", done: true },
  { id: "f", text: "f", done: true },
];
const ids = (/** @type {{ id: string }[]} */ xs) => xs.map((x) => x.id);
/** A random() that hands back these rolls in turn. @param {number[]} rolls */
const rolls = (rolls) => () => rolls.shift() ?? 0.99;

test("sweep takes the forgotten, never done items", () => {
  assert.deepEqual(ids(sweepable(items)), ["g", "h"]);
  assert.deepEqual(sweepable([{ id: "x", text: "x?" }]), []);
});

test("recycle takes done items", () => {
  assert.deepEqual(ids(recyclable(items)), ["e", "f"]);
});

test("raise is decay run backwards", () => {
  const walk = ["foo??"];
  for (let i = 0; i < 4; i++) walk.push(raiseOnce(walk[walk.length - 1]));
  assert.deepEqual(walk, ["foo??", "foo?", "foo", "foo!", "foo!!"]);
  assert.equal(raiseOnce("huh???"), "huh?");
  assert.equal(raiseOnce("wat?!"), "wat!");
});

test("forget takes one from the lowest tier still showing, straight to forgotten", () => {
  assert.deepEqual(forgetOne(items, () => 0), { id: "c", text: "c??" });
  assert.deepEqual(forgetOne(items, () => 0.99), { id: "d", text: "d??" });
  assert.deepEqual(forgetOne([{ id: "a", text: "a!" }, { id: "b", text: "b!!" }]), { id: "a", text: "a??" });
  assert.equal(forgetOne([{ id: "g", text: "g??" }]), null);
});

test("remember brings one forgotten back at neutral", () => {
  assert.deepEqual(rememberOne(items, () => 0), { id: "g", text: "g" });
  assert.deepEqual(rememberOne(items, () => 0.99), { id: "h", text: "h" });
  assert.equal(rememberOne([{ id: "c", text: "c?" }]), null);
});

test("shake up: 40% down, 25% up, 35% stays; forgotten can rise but not sink", () => {
  const open = [
    { id: "a", text: "a" },
    { id: "b", text: "b" },
    { id: "c", text: "c" },
    { id: "d", text: "d?" },
    { id: "g", text: "g??" },
    { id: "h", text: "h??" },
    { id: "f", text: "f", done: true },
  ];
  assert.deepEqual(shakeUp(open, rolls([0.4, 0.39, 0.65, 0.39, 0.1, 0.64])), [
    { id: "a", text: "a!", move: "up" },
    { id: "b", text: "b?", move: "down" },
    { id: "d", text: "d??", move: "forgotten" },
    { id: "h", text: "h?", move: "remembered" },
  ]);
});

test("snoozed to-dos sleep through Forget, Remember, Sweep and Shake Up", () => {
  const items = [
    { id: "z", text: "z?>" },
    { id: "y", text: "y??>>" },
    { id: "a", text: "a" },
  ];
  assert.deepEqual(forgetOne(items, () => 0), { id: "a", text: "a??" });
  assert.equal(rememberOne(items), null);
  assert.deepEqual(sweepable(items), []);
  assert.deepEqual(shakeUp(items, () => 0), [{ id: "a", text: "a?", move: "down" }]);
});

test("look ahead: snoozed, soonest first, done ones left out", () => {
  const items = [
    { id: "a", text: "a>>>" },
    { id: "b", text: "b!>" },
    { id: "c", text: "c" },
    { id: "d", text: "d>", done: true },
  ];
  assert.deepEqual(snoozed(items).map((i) => i.id), ["b", "a"]);
});

test("forget some: blank is one, a number is that many, lowest tiers first", () => {
  const open = [
    { id: "a", text: "a!" },
    { id: "b", text: "b" },
    { id: "c", text: "c?" },
    { id: "g", text: "g??" },
  ];
  assert.deepEqual(forgetSome(open, " ", () => 0), [{ id: "c", text: "c??" }]);
  assert.deepEqual(forgetSome(open, "2", () => 0), [{ id: "c", text: "c??" }, { id: "b", text: "b??" }]);
  assert.equal(forgetSome(open, "99", () => 0).length, 3, "stops when nothing's left");
  assert.deepEqual(forgetSome(open, "0"), []);
});

test("forget some by phrase: every visible match, any case", () => {
  const open = [
    { id: "a", text: "Call Mom!" },
    { id: "b", text: "call the bank" },
    { id: "c", text: "call?? again" },
    { id: "d", text: "recall??" },
    { id: "e", text: "call dad", done: true },
  ];
  assert.deepEqual(forgetSome(open, " CALL "), [
    { id: "a", text: "Call Mom??" },
    { id: "b", text: "call the bank??" },
    { id: "c", text: "call?? again??" },
  ]);
});

test("remember some: a number of random picks, or every forgotten match", () => {
  assert.deepEqual(rememberSome(items, "", () => 0), [{ id: "g", text: "g" }]);
  assert.deepEqual(rememberSome(items, "5", () => 0), [{ id: "g", text: "g" }, { id: "h", text: "h" }]);
  assert.deepEqual(rememberSome(items, "H"), [{ id: "h", text: "h" }]);
  assert.deepEqual(rememberSome(items, "e"), [], "done items stay done");
});

test("phrases skip snoozed to-dos too", () => {
  assert.deepEqual(forgetSome([{ id: "a", text: "call>" }, { id: "b", text: "call" }], "call"), [{ id: "b", text: "call??" }]);
});
