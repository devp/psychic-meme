import { test } from "node:test";
import assert from "node:assert/strict";
import { createMockService } from "../mock/service.js";
import { PERIODS, DAYS } from "../lib/moment.js";

// These hold for the mock; most are what any Service should promise the UI.
const service = createMockService({ delay: 0 });

/** @param {string} day @param {string} period @param {number} [month] */
const moment = (day, period, month = 6) => ({ day, period, month, label: "" });

test("concierge: every moment offers situations, each with refinements that lead somewhere", async () => {
  for (const day of DAYS) {
    for (const { id: period } of PERIODS) {
      const situations = await service.getConcierge(moment(day, period));
      assert.ok(situations.length >= 5, `${day} ${period}: ${situations.length} situations`);
      assert.equal(new Set(situations.map((s) => s.id)).size, situations.length, `${day} ${period}: duplicate`);
      for (const s of situations) {
        assert.equal(s.refinements.length, 3, s.id);
        assert.equal(new Set(s.refinements.map((r) => r.id)).size, 3, `${s.id}: refinement ids collide`);
        for (const r of s.refinements) {
          const found = await service.getCollections(r.collectionIds);
          assert.equal(found.length, 3, `${s.id}/${r.id}`);
        }
      }
    }
  }
});

test("concierge: the lineup follows the moment", async () => {
  const ids = async (/** @type {ReturnType<typeof moment>} */ m) => (await service.getConcierge(m)).map((s) => s.id);
  assert.ok((await ids(moment("wednesday", "afternoon"))).includes("focus"));
  assert.ok(!(await ids(moment("saturday", "afternoon"))).includes("focus"), "no focusing on a Saturday");
  assert.equal((await ids(moment("friday", "evening")))[0], "party");
  assert.equal((await ids(moment("wednesday", "afternoon", 12)))[0], "holiday");
});

test("concierge: a refinement's first pick fits the situation", async () => {
  const [focus] = (await service.getConcierge(moment("wednesday", "afternoon"))).filter((s) => s.id === "focus");
  const ambient = focus.refinements.find((r) => r.id === "ambient");
  assert.equal(ambient?.collectionIds[0], "deep-focus-ambient");
});

test("galleries: every category holds at least one collection", async () => {
  const galleries = await service.getGalleries();
  assert.deepEqual(galleries.map((g) => g.id), ["activities", "genres", "moods", "decades"]);
  for (const g of galleries) {
    const categories = await service.getCategories(g.id);
    assert.ok(categories.length > 0, g.id);
    for (const c of categories) assert.ok(c.collectionIds.length > 0, `${g.id}/${c.id} is empty`);
  }
  assert.deepEqual(await service.getCategories("nope"), []);
});

test("getCollections: in the order asked, unknown ids dropped", async () => {
  const found = await service.getCollections(["sofa-soul", "nope", "funk-break"]);
  assert.deepEqual(found.map((c) => c.id), ["sofa-soul", "funk-break"]);
  assert.ok(found[0].title && found[0].description);
});

test("getSimilar: a few others, never itself", async () => {
  const similar = await service.getSimilar("dinner-party-jazz");
  assert.equal(similar.length, 3);
  assert.ok(!similar.some((c) => c.id === "dinner-party-jazz"));
});

test("search: every word must match; blank finds nothing", async () => {
  assert.ok((await service.search("jazz")).length >= 3);
  assert.deepEqual((await service.search("DINNER jazz")).map((c) => c.id).sort(), ["dinner-party-jazz", "kitchen-swing"]);
  assert.deepEqual(await service.search("   "), []);
  assert.deepEqual(await service.search("zzzz"), []);
});

test("nextItem: a new item each time, the same run for a fresh service", async () => {
  const a = await service.nextItem("sofa-soul");
  const b = await service.nextItem("sofa-soul");
  assert.notEqual(a.id, b.id);
  assert.ok(a.title && a.byline && a.duration > 0);
  const again = await createMockService({ delay: 0 }).nextItem("sofa-soul");
  assert.deepEqual(again, a);
});

test("answers are copies: changing one doesn't change the next", async () => {
  const [first] = await service.getCollections(["sofa-soul"]);
  first.title = "changed";
  const [second] = await service.getCollections(["sofa-soul"]);
  assert.equal(second.title, "Sofa Soul");
});
