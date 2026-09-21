import { test } from "node:test";
import assert from "node:assert/strict";

// state.js builds its stores at import time, so localStorage has to exist
// before the import, which is why this one is dynamic. Node has no
// localStorage without --localstorage-file.
/** @type {Map<string, string>} */
const data = new Map();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (/** @type {string} */ k) => (data.has(k) ? data.get(k) : null),
    setItem: (/** @type {string} */ k, /** @type {string} */ v) => data.set(k, String(v)),
    removeItem: (/** @type {string} */ k) => data.delete(k),
  },
});

const state = await import("../state.js");

/**
 * A fresh copy of the module, so the store re-reads localStorage instead of
 * serving what it cached in memory at first import.
 * @param {string} query
 * @returns {Promise<typeof state>}
 */
function reimport(query) {
  return import(`../state.js?${query}`);
}

/**
 * @param {typeof state} mod
 * @returns {string[]}
 */
function titles(mod) {
  return mod.allPosts().map((p) => p.title);
}

/**
 * The store stamps createdAt with Date.now(), and these tests are about
 * ordering, so they backdate afterwards -- through the same localStorage the
 * store reads, since there's no API for it and there shouldn't be.
 * @param {string} id
 * @param {number} createdAt
 */
function backdate(id, createdAt) {
  const raw = JSON.parse(data.get("gemdrafter:posts:records") ?? "[]");
  for (const rec of raw) if (rec.id === id) rec.createdAt = createdAt;
  data.set("gemdrafter:posts:records", JSON.stringify(raw));
}

test("a post round-trips title and body", () => {
  const post = state.createPost("Hello Gemini");
  state.setBody(post.id, "# Hello\n\nthe body");
  const read = state.activePost();
  assert.equal(read?.title, "Hello Gemini");
  assert.equal(read?.body, "# Hello\n\nthe body");
  state.removePost(post.id);
});

test("an empty post has an empty body, not undefined", () => {
  const post = state.createPost();
  assert.equal(state.activePost()?.body, "");
  state.removePost(post.id);
});

test("posts list newest-written first, and an edit does not reorder them", async () => {
  const a = state.createPost("older");
  const b = state.createPost("newer");
  backdate(a.id, Date.UTC(2026, 0, 1));
  backdate(b.id, Date.UTC(2026, 5, 1));

  // Re-import with the backdated records in place: the store caches in memory.
  const fresh = await reimport(`backdated=${Date.now()}`);
  assert.deepEqual(titles(fresh), ["newer", "older"]);

  // Touching the old one makes it the most recently *updated*, which is the
  // ordering this app deliberately does not use.
  fresh.setBody(a.id, "a typo, fixed years later");
  assert.deepEqual(titles(fresh), ["newer", "older"]);
  assert.equal(fresh.posts.getAll()[0].name, "older", "updatedAt order really did change");

  fresh.removePost(a.id);
  fresh.removePost(b.id);
});

test("a blank draft is not in the index, but is in the list", async () => {
  const fresh = await reimport(`blank=${Date.now()}`);
  const written = fresh.createPost("written");
  fresh.setBody(written.id, "something");
  const blank = fresh.createPost();
  const titled = fresh.createPost("titled but empty");

  assert.equal(fresh.allPosts().length, 3);
  // Sorted, because all three were created in the same millisecond and the
  // tie-break isn't the thing under test.
  assert.deepEqual(
    fresh.postsForIndex().map((p) => p.title).sort(),
    ["titled but empty", "written"]
  );

  [written, blank, titled].forEach((p) => fresh.removePost(p.id));
});

test("deleting the open post opens the next one, not a blank", async () => {
  const fresh = await reimport(`delete=${Date.now()}`);
  const keep = fresh.createPost("keep");
  const drop = fresh.createPost("drop");
  assert.equal(fresh.activePost()?.id, drop.id);
  fresh.removePost(drop.id);
  assert.equal(fresh.activePost()?.id, keep.id);

  // ...and deleting the last one leaves the editor something to open.
  fresh.removePost(keep.id);
  assert.equal(fresh.activePost(), null);
  assert.equal(fresh.ensurePost().body, "");
  fresh.removePost(fresh.activePost()?.id ?? "");
});

test("a subscriber that opens a blank post can't be tricked into one", async () => {
  // app.js reacts to "nothing active" by opening a blank draft. The store
  // notifies from *inside* remove(), so this is the arrangement that made a
  // stray Untitled post appear every time you deleted the post you were on.
  const fresh = await reimport(`subscriber=${Date.now()}`);
  const off = fresh.posts.subscribe(() => {
    if (!fresh.activePost()) fresh.ensurePost();
  });

  const keep = fresh.createPost("keep");
  const drop = fresh.createPost("drop");
  fresh.removePost(drop.id);

  assert.deepEqual(titles(fresh), ["keep"]);
  assert.equal(fresh.activePost()?.id, keep.id);

  // Deleting the last one is the case where a blank *is* what you want.
  fresh.removePost(keep.id);
  assert.deepEqual(titles(fresh), [""]);
  off();
  fresh.removePost(fresh.activePost()?.id ?? "");
});
