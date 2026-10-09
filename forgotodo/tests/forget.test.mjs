import { test } from "node:test";
import assert from "node:assert/strict";
import { dayKey, daysBetween, priorityOf, decayOnce, forgetChanges, fastForwardChanges, tierOf, withTier, isFaded, isForgotten, snoozeOf, isSnoozed } from "../lib/forget.js";

test("priority comes from the trailing run", () => {
  assert.equal(priorityOf("foo!!"), 2);
  assert.equal(priorityOf("foo! "), 1);
  assert.equal(priorityOf("what?"), -1);
  assert.equal(priorityOf("what??"), -2);
  assert.equal(priorityOf("foo"), 0);
  assert.equal(priorityOf("wat?!"), 0);
  assert.equal(priorityOf("a!b"), 0);
});

test("decay walks down to forgotten and stays there", () => {
  const walk = ["foo!!"];
  for (let i = 0; i < 5; i++) walk.push(decayOnce(walk[walk.length - 1]));
  assert.deepEqual(walk, ["foo!!", "foo!", "foo", "foo?", "foo??", "foo??"]);
  assert.equal(decayOnce("wat?!?!?!?"), "wat?");
  assert.equal(decayOnce("huh???"), "huh???", "typed-in ??? is already forgotten");
  assert.equal(decayOnce("foo !"), "foo");
  assert.equal(decayOnce("foo  "), "foo?");
});

test("tiers: faded at ?, forgotten from ?? down", () => {
  assert.deepEqual(["a!", "a", "a?", "a??", "a????"].map(tierOf), [1, 0, -1, -2, -2]);
  assert.ok(isFaded("a?") && !isFaded("a??") && !isFaded("a"));
  assert.ok(isForgotten("a??") && isForgotten("a???") && !isForgotten("a?"));
  assert.equal(withTier("a?!", 2), "a!!");
  assert.equal(withTier("a!!", -5), "a??");
  assert.equal(withTier("a?? ", 0), "a");
});

test("day keys and differences", () => {
  assert.equal(dayKey(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
  assert.equal(daysBetween("2026-03-07", "2026-03-09"), 2); // across US DST start
  assert.equal(daysBetween("2026-12-31", "2027-01-01"), 1);
  assert.equal(daysBetween("2026-09-27", "2026-09-27"), 0);
});

test("forgetChanges: decay, catch-up, purge, and stamping", () => {
  const today = "2026-09-27";
  const changes = forgetChanges(
    [
      { id: "a", text: "a!!", seenDay: "2026-09-25" },
      { id: "b", text: "b", seenDay: "2026-09-20" },
      { id: "c", text: "c", done: true, doneDay: "2026-09-26" },
      { id: "d", text: "d", done: true, doneDay: today },
      { id: "e", text: "e!" },
      { id: "f", text: "f", done: true },
      { id: "g", text: "g!", seenDay: today },
      { id: "h", text: "h?", seenDay: "2026-09-26" },
      { id: "i", text: "i??", seenDay: "2026-09-20" },
    ],
    today
  );
  assert.deepEqual(changes, [
    { id: "a", patch: { text: "a", seenDay: today } },
    { id: "b", patch: { text: "b??", seenDay: today } },
    { id: "c", remove: true },
    { id: "e", patch: { seenDay: today } },
    { id: "f", patch: { doneDay: today } },
    { id: "h", patch: { text: "h??", seenDay: today } },
    { id: "i", patch: { seenDay: today } },
  ]);
});

test("fast forward: one more day, now, leaving the day stamps alone", () => {
  const changes = fastForwardChanges([
    { id: "a", text: "a!", seenDay: "2026-09-27" },
    { id: "b", text: "b?", seenDay: "2026-09-27" },
    { id: "c", text: "c??", seenDay: "2026-09-27" },
    { id: "d", text: "d", done: true, doneDay: "2026-09-27" },
  ]);
  assert.deepEqual(changes, [
    { id: "a", patch: { text: "a" } },
    { id: "b", patch: { text: "b??" } },
    { id: "d", remove: true },
  ]);
});

test("snooze grammar: the trailing run decides", () => {
  assert.deepEqual(["a>", "a>>>", "a >> ", "a!>", "a??>", "a>!", "a>?", "a>b", "a", ">"].map(snoozeOf), [1, 3, 2, 1, 1, 0, 0, 0, 0, 1]);
  assert.ok(isSnoozed("a!>") && !isSnoozed("a>!"));
  assert.equal(priorityOf("a!!>"), 0, "a snoozed to-do has no priority while asleep");
  assert.equal(priorityOf("a>!"), 1, "> before the tail is just text");
  assert.ok(!isForgotten("a??>") && !isFaded("a?>"), "snoozed is neither faded nor forgotten");
});

test("snooze: a > a day, then the tier underneath decays as usual", () => {
  const walk = ["a!>>"];
  for (let i = 0; i < 5; i++) walk.push(decayOnce(walk[walk.length - 1]));
  assert.deepEqual(walk, ["a!>>", "a!>", "a!", "a", "a?", "a??"]);
  assert.equal(decayOnce("a >> "), "a >");
  assert.equal(decayOnce("a?>"), "a?", "wakes faded");
});

test("snooze: catch-up and fast forward take off a > per day", () => {
  const today = "2026-09-27";
  assert.deepEqual(forgetChanges([{ id: "a", text: "a>>>", seenDay: "2026-09-25" }], today), [
    { id: "a", patch: { text: "a>", seenDay: today } },
  ]);
  assert.deepEqual(forgetChanges([{ id: "a", text: "a!>", seenDay: "2026-09-24" }], today), [
    { id: "a", patch: { text: "a?", seenDay: today } },
  ]);
  assert.deepEqual(fastForwardChanges([{ id: "a", text: "a>" }]), [{ id: "a", patch: { text: "a" } }]);
});
