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
 * serving what it cached in memory at first import. Each test that needs a
 * clean slate takes its own.
 * @param {string} query
 * @returns {Promise<typeof state>}
 */
async function reimport(query) {
  data.clear();
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
 * The store stamps createdAt with Date.now(), and some tests are about
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

test("a post round-trips title, body and slug", async () => {
  const s = await reimport(`roundtrip=${Date.now()}`);
  const post = s.createPost("Hello Gemini");
  s.saveDraft(post.id, { title: "Hello Gemini", body: "# Hello\n\nthe body", slug: "hello" });
  const read = s.activePost();
  assert.equal(read?.title, "Hello Gemini");
  assert.equal(read?.body, "# Hello\n\nthe body");
  assert.equal(read?.slug, "hello");
  assert.equal(s.slugOf(/** @type {any} */ (read)), "hello");
});

test("an empty post has an empty body, not undefined", async () => {
  const s = await reimport(`empty=${Date.now()}`);
  s.createPost();
  assert.equal(s.activePost()?.body, "");
  assert.equal(s.activePost()?.slug, "");
  assert.equal(s.activePost()?.revisions.length, 0);
});

test("saveDraft reports whether it actually wrote", async () => {
  const s = await reimport(`dirty=${Date.now()}`);
  const post = s.createPost("t");
  assert.equal(s.saveDraft(post.id, { title: "t", body: "a", slug: "" }), true);
  assert.equal(s.saveDraft(post.id, { title: "t", body: "a", slug: "" }), false);
  assert.equal(s.saveDraft(post.id, { title: "t", body: "a", slug: "s" }), true);
});

test("posts list newest-written first, and an edit does not reorder them", async () => {
  const s = await reimport(`order=${Date.now()}`);
  const a = s.createPost("older");
  const b = s.createPost("newer");
  backdate(a.id, Date.UTC(2026, 0, 1));
  backdate(b.id, Date.UTC(2026, 5, 1));

  const fresh = await import(`../state.js?backdated=${Date.now()}`);
  assert.deepEqual(titles(fresh), ["newer", "older"]);

  // Touching the old one makes it the most recently *updated*, which is the
  // ordering this app deliberately does not use.
  fresh.saveDraft(a.id, { title: "older", body: "a typo, fixed years later", slug: "" });
  assert.deepEqual(titles(fresh), ["newer", "older"]);
  assert.equal(fresh.posts.getAll()[0].name, "older", "updatedAt order really did change");
});

test("a blank draft is not in the index, but is in the list", async () => {
  const s = await reimport(`blank=${Date.now()}`);
  const written = s.createPost("written");
  s.saveDraft(written.id, { title: "written", body: "something", slug: "" });
  s.createPost();
  s.createPost("titled but empty");

  assert.equal(s.allPosts().length, 3);
  // Sorted, because all three were created in the same millisecond and the
  // tie-break isn't the thing under test.
  assert.deepEqual(
    s.postsForIndex().map((p) => p.title).sort(),
    ["titled but empty", "written"]
  );
});

// ---- checkpoints -----------------------------------------------------------

test("a checkpoint is kept when you come back to a post, not while you type", async () => {
  const s = await reimport(`idle=${Date.now()}`);
  const post = s.createPost("draft");
  const t0 = Date.now();

  s.saveDraft(post.id, { title: "draft", body: "first thought", slug: "" }, t0);
  s.saveDraft(post.id, { title: "draft", body: "first thought, refined", slug: "" }, t0 + 1000);
  assert.equal(s.activePost()?.revisions.length, 0, "typing does not checkpoint");

  // Come back an hour later: what it was before this sitting is worth keeping.
  s.saveDraft(post.id, { title: "draft", body: "a whole new direction", slug: "" }, t0 + 3_600_000);
  const revisions = s.activePost()?.revisions ?? [];
  assert.equal(revisions.length, 1);
  assert.equal(revisions[0].text, "first thought, refined", "it keeps the pre-edit state");
  assert.equal(s.activePost()?.body, "a whole new direction");
});

test("checkpoint(): manual, deduplicated, and never of nothing", async () => {
  const s = await reimport(`manual=${Date.now()}`);
  const post = s.createPost();
  assert.equal(s.checkpoint(post.id), false, "an empty post has nothing to keep");

  s.saveDraft(post.id, { title: "t", body: "words", slug: "" });
  assert.equal(s.checkpoint(post.id), true);
  assert.equal(s.checkpoint(post.id), false, "pressing it twice keeps one");
  assert.equal(s.activePost()?.revisions.length, 1);

  s.saveDraft(post.id, { title: "t", body: "more words", slug: "" });
  assert.equal(s.checkpoint(post.id), true);
  assert.deepEqual(
    s.activePost()?.revisions.map((r) => r.text),
    ["more words", "words"],
    "newest first"
  );
});

test("history is capped, and it drops the oldest", async () => {
  const s = await reimport(`cap=${Date.now()}`);
  const post = s.createPost("t");
  for (let i = 0; i < 25; i++) {
    s.saveDraft(post.id, { title: "t", body: `version ${i}`, slug: "" });
    s.checkpoint(post.id);
  }
  const revisions = s.activePost()?.revisions ?? [];
  assert.equal(revisions.length, 20);
  assert.equal(revisions[0].text, "version 24");
  assert.equal(revisions[19].text, "version 5");
});

test("restoring is itself undoable", async () => {
  const s = await reimport(`restore=${Date.now()}`);
  const post = s.createPost("first title");
  s.saveDraft(post.id, { title: "first title", body: "the good version", slug: "keeper" });
  s.checkpoint(post.id);
  s.saveDraft(post.id, { title: "second title", body: "ruined it", slug: "wrecked" });

  const good = s.activePost()?.revisions[0];
  assert.ok(good);
  assert.equal(s.restoreRevision(post.id, good.id), true);

  const after = s.activePost();
  assert.equal(after?.body, "the good version");
  assert.equal(after?.title, "first title", "a restore brings the title back too");
  assert.equal(after?.slug, "keeper", "and the slug, so the URL doesn't move");
  assert.equal(after?.revisions[0].text, "ruined it", "the mistake is now in the history");
});

test("restoreRevision: an unknown id changes nothing", async () => {
  const s = await reimport(`badrev=${Date.now()}`);
  const post = s.createPost("t");
  s.saveDraft(post.id, { title: "t", body: "body", slug: "" });
  assert.equal(s.restoreRevision(post.id, "nope"), false);
  assert.equal(s.activePost()?.body, "body");
  assert.equal(s.activePost()?.revisions.length, 0, "a failed restore doesn't checkpoint");
});

// ---- trash -----------------------------------------------------------------

test("trash keeps the post, its dates and its history", async () => {
  const s = await reimport(`trash=${Date.now()}`);
  const keep = s.createPost("keep");
  const drop = s.createPost("drop");
  s.saveDraft(drop.id, { title: "drop", body: "words worth keeping", slug: "dropped" });
  s.checkpoint(drop.id);

  s.trashPost(drop.id);
  assert.deepEqual(titles(s), ["keep"]);
  assert.equal(s.postsForIndex().find((p) => p.id === drop.id), undefined, "and out of the index");

  const trashed = s.trashedPosts();
  assert.equal(trashed.length, 1);
  assert.equal(trashed[0].createdAt, drop.createdAt, "same post, not a copy");
  assert.equal(trashed[0].body, "words worth keeping");
  assert.equal(trashed[0].revisions.length, 1);

  s.restorePost(drop.id);
  assert.equal(s.trashedPosts().length, 0);
  const back = s.allPosts().find((p) => p.id === drop.id);
  assert.equal(back?.body, "words worth keeping");
  assert.equal(back?.slug, "dropped");
  assert.equal(back?.revisions.length, 1, "the history came back with it");
});

test("trashing the open post hands the editor a live one, not a blank", async () => {
  const s = await reimport(`handover=${Date.now()}`);
  const keep = s.createPost("keep");
  const open = s.createPost("open");
  assert.equal(s.activePost()?.id, open.id);

  s.trashPost(open.id);
  assert.equal(s.activePost()?.id, keep.id);
  assert.equal(s.allPosts().length, 1, "no stray blank draft appeared");
});

test("a subscriber that opens a blank post can't be tricked into one", async () => {
  // app.js reacts to "nothing active" by opening a blank draft. The store
  // notifies from *inside* the write, so this is the arrangement that made a
  // stray Untitled post appear every time you deleted the post you were on.
  const s = await reimport(`subscriber=${Date.now()}`);
  s.posts.subscribe(() => {
    if (!s.activePost()) s.ensurePost();
  });

  const keep = s.createPost("keep");
  const drop = s.createPost("drop");
  s.saveDraft(drop.id, { title: "drop", body: "x", slug: "" });

  s.trashPost(drop.id);
  assert.deepEqual(titles(s), ["keep"]);
  assert.equal(s.activePost()?.id, keep.id);

  s.purgePost(keep.id);
  assert.deepEqual(titles(s), [""], "the last post out leaves exactly one blank draft");
});

test("purge is the only thing that takes a post out of storage", async () => {
  const s = await reimport(`purge=${Date.now()}`);
  const keep = s.createPost("keep");
  const doomed = s.createPost("doomed");
  s.saveDraft(doomed.id, { title: "doomed", body: "gone", slug: "" });
  s.checkpoint(doomed.id);
  s.trashPost(doomed.id);

  const stored = () => JSON.parse(data.get("gemdrafter:posts:records") ?? "[]");
  assert.equal(stored().length, 2, "trash is still storage");

  s.purgePost(doomed.id);
  assert.equal(stored().length, 1);
  assert.equal(stored()[0].id, keep.id);
  assert.equal(s.trashedPosts().length, 0);
});

test("emptying the trash purges every trashed post and nothing else", async () => {
  const s = await reimport(`empty-trash=${Date.now()}`);
  const keep = s.createPost("keep");
  const a = s.createPost("a");
  const b = s.createPost("b");
  s.trashPost(a.id);
  s.trashPost(b.id);

  assert.equal(s.emptyTrash(), 2);
  assert.deepEqual(titles(s), ["keep"]);
  assert.equal(JSON.parse(data.get("gemdrafter:posts:records") ?? "[]").length, 1);
  assert.equal(s.activePost()?.id, keep.id);
});
