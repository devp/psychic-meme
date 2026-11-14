import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, format } from "../lib/router.js";

/** @type {import("../lib/router.js").Route[]} */
const ROUTES = [
  { name: "concierge" },
  { name: "concierge", situation: "focus" },
  { name: "concierge", situation: "focus", refinement: "ambient" },
  { name: "browse", gallery: "genres" },
  { name: "browse", gallery: "genres", category: "jazz" },
  { name: "collection", id: "dinner-party-jazz" },
  { name: "search", query: "rock & roll / 50%" },
  { name: "recent" },
];

test("format then parse gives the route back", () => {
  for (const route of ROUTES) assert.deepEqual(parse(format(route)), route, format(route));
});

test("format: readable hashes", () => {
  assert.equal(format({ name: "concierge" }), "#/");
  assert.equal(format({ name: "concierge", situation: "focus", refinement: "ambient" }), "#/for/focus/ambient");
  assert.equal(format({ name: "collection", id: "a b" }), "#/c/a%20b");
});

test("parse: anything unrecognized is the concierge", () => {
  for (const hash of ["", "#", "#/", "#/nope", "#/browse", "#/c", "#/search/", "#/%E0%A4%A"]) {
    assert.deepEqual(parse(hash), { name: "concierge" }, hash);
  }
});
