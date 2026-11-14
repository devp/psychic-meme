import { test } from "node:test";
import assert from "node:assert/strict";
import { createPlayer } from "../lib/player.js";
import { createMockEngine } from "../mock/engine.js";

const A = { id: "a", title: "A", description: "" };
const B = { id: "b", title: "B", description: "" };

function setup() {
  /** @type {string[]} */
  const votes = [];
  let served = 0;
  const service = {
    nextItem: async (/** @type {string} */ id) => ({ id: `${id}:${served++}`, title: "t", byline: "b", duration: 10 }),
    vote: async (/** @type {string} */ _c, /** @type {string} */ itemId, /** @type {string} */ vote) => void votes.push(`${itemId} ${vote}`),
  };
  // interval 0: time only passes when the test says so.
  const engine = createMockEngine({ interval: 0 });
  const player = createPlayer({ service, engine });
  return { player, engine, votes };
}
// Let the player's un-awaited advance() finish.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test("play: starts the collection and loads its first item", async () => {
  const { player } = setup();
  /** @type {(string | null)[]} */
  const seen = [];
  player.subscribe((s) => seen.push(s.item?.id ?? null));
  assert.deepEqual(seen, [null], "subscribe calls back at once");
  await player.play(A);
  assert.equal(player.state.collection?.id, "a");
  assert.equal(player.state.item?.id, "a:0");
  assert.equal(player.state.playing, true);
  assert.equal(seen.at(-1), "a:0");
});

test("time passes, and the item running out brings the next", async () => {
  const { player, engine } = setup();
  await player.play(A);
  engine.advance(4);
  assert.equal(player.state.position, 4);
  engine.advance(6);
  await settle();
  assert.equal(player.state.item?.id, "a:1");
  assert.equal(player.state.position, 0);
  assert.equal(player.state.playing, true);
});

test("toggle pauses and resumes; play() of the same collection only resumes", async () => {
  const { player } = setup();
  await player.play(A);
  player.toggle();
  assert.equal(player.state.playing, false);
  await player.play(A);
  assert.equal(player.state.playing, true);
  assert.equal(player.state.item?.id, "a:0", "same item, not restarted");
});

test("skip while paused stays paused", async () => {
  const { player } = setup();
  await player.play(A);
  player.toggle();
  await player.skip();
  assert.equal(player.state.item?.id, "a:1");
  assert.equal(player.state.playing, false);
});

test("vote: up sticks, again takes it back, down skips", async () => {
  const { player, votes } = setup();
  await player.play(A);
  await player.vote("up");
  assert.equal(player.state.vote, "up");
  await player.vote("up");
  assert.equal(player.state.vote, null);
  await player.vote("down");
  assert.equal(player.state.item?.id, "a:1");
  assert.equal(player.state.vote, null, "the vote was on the last item");
  assert.deepEqual(votes, ["a:0 up", "a:0 down"]);
});

test("switching collections: a slow answer for the old one is dropped", async () => {
  const { player } = setup();
  const first = player.play(A);
  const second = player.play(B);
  await Promise.all([first, second]);
  assert.equal(player.state.collection?.id, "b");
  assert.equal(player.state.item?.id.slice(0, 2), "b:");
});

test("nothing on: toggle, skip and vote do nothing", async () => {
  const { player } = setup();
  player.toggle();
  await player.skip();
  await player.vote("up");
  assert.deepEqual(player.state, { collection: null, item: null, playing: false, position: 0, vote: null });
});
