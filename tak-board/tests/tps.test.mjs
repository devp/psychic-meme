import { test } from "node:test";
import assert from "node:assert/strict";
import { withTurn, camelCase, kebabCase } from "../src/tps.js";

const TPS = "x5,2/1,1,1,1,12,x/x4,1211C,2S/x3,2C,2,x/2,2,x,1,1,x/1,2,2,2,21,2 1 16";

test("withTurn: names and numbers set the side to move", () => {
  assert.equal(withTurn(TPS, "black"), TPS.replace(" 1 16", " 2 16"));
  assert.equal(withTurn(TPS, 2), TPS.replace(" 1 16", " 2 16"));
  assert.equal(withTurn(TPS.replace(" 1 16", " 2 16"), "White"), TPS);
});

test("withTurn: missing or unknown turn leaves the TPS alone", () => {
  for (const turn of [null, undefined, "", "red", 3]) assert.equal(withTurn(TPS, turn), TPS);
});

test("withTurn: only touches the side-to-move field, not the board", () => {
  assert.equal(withTurn("1,2/x2 1 2", "black"), "1,2/x2 2 2");
  assert.equal(withTurn("6", "black"), "6");
});

test("camelCase / kebabCase round-trip option names", () => {
  assert.equal(camelCase("unplayed-pieces"), "unplayedPieces");
  assert.equal(kebabCase("unplayedPieces"), "unplayed-pieces");
  assert.equal(camelCase(kebabCase("axisLabelsSmall")), "axisLabelsSmall");
});
