import { test } from "node:test";
import assert from "node:assert/strict";
import { parseShare, platformOf, embedUrl, frameUrl, laneCards, READ, resolve, wrap, spin, cleanText } from "../lib/deck.js";

const share = (/** @type {Record<string,string>} */ o) => parseShare(new URLSearchParams(o));

test("parseShare: link in text, as Android sends it", () => {
  assert.deepEqual(share({ text: "look at this https://youtu.be/abc?si=x" }), {
    url: "https://youtu.be/abc?si=x",
    description: "look at this",
  });
});

test("parseShare: title wins, url param wins", () => {
  assert.deepEqual(share({ title: "A Title", url: "https://a.com/x", text: "https://b.com" }), {
    url: "https://a.com/x",
    description: "A Title",
  });
});

test("parseShare: a title that is just the URL is no description", () => {
  assert.deepEqual(share({ title: "https://a.com", text: "https://a.com" }), { url: "https://a.com", description: "" });
});

test("parseShare: no link", () => {
  assert.equal(share({ text: "hello" }), null);
  assert.equal(share({}), null);
});

test("platformOf", () => {
  assert.equal(platformOf("https://m.youtube.com/watch?v=1"), "youtube");
  assert.equal(platformOf("https://youtu.be/1"), "youtube");
  assert.equal(platformOf("https://www.instagram.com/reel/X/"), "instagram");
  assert.equal(platformOf("https://fb.watch/abc/"), "facebook");
  assert.equal(platformOf("https://notyoutube.com/"), "other");
  assert.equal(platformOf("nope"), "other");
});

test("embedUrl: youtube shapes", () => {
  const base = "https://www.youtube-nocookie.com/embed/ID?autoplay=1&playsinline=1";
  assert.equal(embedUrl("https://www.youtube.com/watch?v=ID"), base);
  assert.equal(embedUrl("https://youtu.be/ID?si=zz"), base);
  assert.equal(embedUrl("https://youtube.com/shorts/ID"), base);
  assert.equal(embedUrl("https://youtu.be/ID?t=42"), base + "&start=42");
  assert.equal(embedUrl("https://www.youtube.com/@someone"), null);
});

test("embedUrl: instagram shapes", () => {
  assert.equal(embedUrl("https://www.instagram.com/p/ABC/?igsh=1"), "https://www.instagram.com/p/ABC/embed/captioned/");
  assert.equal(embedUrl("https://instagram.com/reels/ABC"), "https://www.instagram.com/reel/ABC/embed/captioned/");
  assert.equal(embedUrl("https://www.instagram.com/someone/reel/ABC/"), "https://www.instagram.com/reel/ABC/embed/captioned/");
  assert.equal(embedUrl("https://www.instagram.com/someone/"), null);
});

test("embedUrl: facebook video vs post", () => {
  assert.match(embedUrl("https://www.facebook.com/x/videos/123/") ?? "", /plugins\/video\.php\?href=https%3A%2F%2F/);
  assert.match(embedUrl("https://fb.watch/abc/") ?? "", /video\.php/);
  assert.match(embedUrl("https://www.facebook.com/share/r/abc/") ?? "", /video\.php/);
  assert.match(embedUrl("https://www.facebook.com/x/posts/1") ?? "", /post\.php/);
});

test("frameUrl: modes", () => {
  assert.equal(frameUrl("https://youtu.be/ID", "open"), null);
  assert.equal(frameUrl("https://youtu.be/ID", "page"), "https://youtu.be/ID");
  assert.match(frameUrl("https://youtu.be/ID", "embed") ?? "", /nocookie/);
  assert.equal(frameUrl("https://example.com/", "embed"), "https://example.com/");
});

/** @param {Partial<import("../lib/deck.js").Card>} c */
const card = (c) => ({ url: "", description: "", comment: null, readAt: null, lane: null, from: null, addedAt: 0, id: "", ...c });
const cards = [
  card({ id: "c", addedAt: 3, lane: "music" }),
  card({ id: "a", addedAt: 1 }),
  card({ id: "b", addedAt: 2, readAt: 9 }),
  card({ id: "d", addedAt: 4, lane: "music", readAt: 9 }),
];
const ids = (/** @type {any[]} */ l) => l.map((c) => c.id).join("");

test("laneCards: unread, oldest first, filtered by lane", () => {
  assert.equal(ids(laneCards(cards, "")), "ac");
  assert.equal(ids(laneCards(cards, "music")), "c");
  assert.equal(ids(laneCards(cards, "nope")), "");
});

test("laneCards: keeps the card being looked at even once read", () => {
  assert.equal(ids(laneCards(cards, "", "b")), "abc");
  assert.equal(ids(laneCards(cards, "music", "b")), "c");
});

test("laneCards: READ is everything read, and keeps one just marked unread", () => {
  assert.equal(ids(laneCards(cards, READ)), "bd");
  assert.equal(ids(laneCards(cards, READ, "c")), "bcd");
});

test("resolve: exact, then next added, then wrap", () => {
  const list = laneCards(cards, "");
  assert.equal(resolve(list, { id: "c", at: 3 }), 1);
  assert.equal(resolve(list, { id: "b", at: 2 }), 1);
  assert.equal(resolve(list, { id: "z", at: 99 }), 0);
  assert.equal(resolve(list, null), 0);
  assert.equal(resolve([], null), -1);
});

test("wrap", () => {
  assert.equal(wrap(0, -1, 3), 2);
  assert.equal(wrap(2, 1, 3), 0);
  assert.equal(wrap(0, 1, 0), -1);
});

test("spin never lands where it started", () => {
  for (const r of [0, 0.3, 0.5, 0.99]) assert.notEqual(spin(1, 3, () => r), 1);
  assert.equal(spin(0, 1), 0);
});

test("cleanText", () => {
  assert.equal(cleanText("  hi \n"), "hi");
  assert.equal(cleanText(" \n "), null);
});
