import { test } from "node:test";
import assert from "node:assert/strict";
import { ICONS, bitmapSvg } from "../lib/icons.js";

/** @param {string} svg */
const pathOf = (svg) => svg.match(/ d="([^"]*)"/)?.[1];

test("bitmapSvg: one run per stretch of pixels, sized to the widest row", () => {
  const svg = bitmapSvg(["##.#", "...."]);
  assert.match(svg, /viewBox="0 0 4 2"/);
  assert.match(svg, /class="icon"/);
  assert.equal(pathOf(svg), "M0 0h2v1h-2zM3 0h1v1h-1z");
});

test("bitmapSvg: + is dithered on a checkerboard", () => {
  assert.equal(pathOf(bitmapSvg(["++++", "++++"])), "M0 0h1v1h-1zM2 0h1v1h-1zM1 1h1v1h-1zM3 1h1v1h-1z");
});

test("every desktop command has a 10x10 icon", () => {
  for (const name of ["beam", "receive", "sweep", "recycle", "forget", "remember", "prefs", "edit", "shake", "fastforward"]) {
    const rows = ICONS[name];
    assert.ok(rows, name);
    assert.equal(rows.length, 10, name);
    assert.ok(rows.every((r) => r.length === 10 && /^[#+.]+$/.test(r)), name);
  }
});
