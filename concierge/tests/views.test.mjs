import { test } from "node:test";
import assert from "node:assert/strict";
import { viewFor } from "../views.js";
import { createMockService } from "../mock/service.js";

const service = createMockService({ delay: 0 });
const context = {
  service,
  config: await service.getConfig(),
  moment: { day: "wednesday", period: "afternoon", month: 6, label: "Wednesday Afternoon" },
  recentIds: ["sofa-soul"],
};
/** @param {import("../lib/router.js").Route} route */
const view = (route) => viewFor(route, context);

test("concierge: three steps, each one leading to the next", async () => {
  const home = await view({ name: "concierge" });
  assert.equal(home.title, "It's Wednesday Afternoon");
  assert.equal(home.subtitle, "Play music for");
  assert.equal(home.back, undefined);
  const focus = home.tiles?.find((t) => t.title === "Focusing (No Lyrics)");
  assert.equal(focus?.href, "#/for/focus");
  assert.ok(focus?.icon?.includes("#monitor"));

  const refine = await view({ name: "concierge", situation: "focus" });
  assert.equal(refine.back, "#/");
  assert.deepEqual(refine.tiles?.map((t) => t.href), ["#/for/focus/ambient", "#/for/focus/classical", "#/for/focus/instrumental-beats"]);

  const pick = await view({ name: "concierge", situation: "focus", refinement: "ambient" });
  assert.equal(pick.back, "#/for/focus");
  assert.equal(pick.subtitle, "Ambient");
  assert.equal(pick.cards?.length, 3);
});

test("browse: categories, then a category's collections", async () => {
  const genres = await view({ name: "browse", gallery: "genres" });
  const jazz = genres.links?.find((l) => l.title === "Jazz");
  assert.equal(jazz?.href, "#/browse/genres/jazz");
  const shelf = await view({ name: "browse", gallery: "genres", category: "jazz" });
  assert.equal(shelf.back, "#/browse/genres");
  assert.equal(shelf.cards?.length, jazz?.count);
});

test("collection: featured, with similar ones under it", async () => {
  const v = await view({ name: "collection", id: "sofa-soul" });
  assert.equal(v.feature?.title, "Sofa Soul");
  assert.equal(v.cardsTitle, "Similar stations");
  assert.ok((v.cards?.length ?? 0) > 0);
});

test("search and recent: cards, and something to say when there are none", async () => {
  assert.ok(((await view({ name: "search", query: "jazz" })).cards?.length ?? 0) > 0);
  const none = await view({ name: "search", query: "zzzz" });
  assert.deepEqual(none.cards, []);
  assert.match(none.empty ?? "", /zzzz/);
  assert.deepEqual((await view({ name: "recent" })).cards?.map((c) => c.id), ["sofa-soul"]);
});

test("a route that leads nowhere gets the concierge", async () => {
  for (const route of /** @type {import("../lib/router.js").Route[]} */ ([
    { name: "concierge", situation: "nope" },
    { name: "concierge", situation: "bedtime" }, // real, but not offered on a Wednesday afternoon
    { name: "browse", gallery: "nope" },
    { name: "collection", id: "nope" },
  ])) {
    assert.equal((await view(route)).key, "concierge", JSON.stringify(route));
  }
});
