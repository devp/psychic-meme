// This app's state, in one place.
//
// One record store (the posts) and four persisted scalars (theme, font, tab,
// and the capsule title that heads the generated index). Components that
// belong to this app import from here; components meant to travel -- see
// components/gem-preview.js -- take properties and know nothing about any of
// it.

import { persistedValue, recordStore } from "./lib/store.js";
import { postSlug } from "./lib/gemtext.js";

const NS = "gemdrafter";

export const theme = persistedValue(NS + ":theme", "dusk");
export const font = persistedValue(NS + ":font", "mono");
export const tab = persistedValue(NS + ":tab", "draft");

/** Heads the generated index.gmi. Your capsule's name, not the app's. */
export const capsuleTitle = persistedValue(NS + ":capsule", "My Gemlog");

/**
 * Where these posts end up, shown beside the slug so the URL you're choosing
 * is visible while you choose it. Display only -- this app never talks to it.
 */
export const journalHost = persistedValue(NS + ":host", "devp.smol.pub");

/**
 * The posts, and their history.
 *
 * A record's own fields are fixed by the store -- id, name, createdAt,
 * updatedAt, items -- and items are free-form, so this app's shape rides in
 * them:
 *
 *   items[0]    the head: { kind: "head", text, slug, deletedAt }
 *               the working copy, plus the post-level fields the record
 *               itself has nowhere to put.
 *   items[1..]  checkpoints: { kind: "rev", text, title, slug, at }, oldest
 *               first, capped at MAX_REVISIONS.
 *
 * The alternative was adding fields to StoredRecord, which forks lib/store.js
 * away from pizza-starter -- and the day the starter's store grows a fix, that
 * fork is what stops you taking it. Nothing outside this file knows the
 * encoding: everything goes through the accessors below.
 *
 * @type {ReturnType<typeof recordStore>}
 */
export const posts = recordStore(NS + ":posts");

/**
 * How long the post has to sit untouched before the next edit is treated as a
 * new sitting and the previous state is worth keeping.
 *
 * Five minutes, because the thing you want back is "what it was before I
 * started messing with it this evening", not every keystroke. A checkpoint per
 * save would be a log; a checkpoint per sitting is a history you can read.
 */
const IDLE_MS = 5 * 60_000;

/** Enough to walk back a bad week. Oldest go first. */
const MAX_REVISIONS = 20;

/** The tabs this app has. Add a panel in index.html, add a line here. */
export const TABS = [
  { id: "draft", label: "draft" },
  { id: "preview", label: "preview" },
  { id: "posts", label: "posts" },
  { id: "index", label: "index" },
  { id: "about", label: "about" },
];

/**
 * @typedef {Object} Revision
 * @property {string} id
 * @property {string} text
 * @property {string} title
 * @property {string} slug
 * @property {number} at
 */

/**
 * @typedef {Object} Post
 * @property {string} id
 * @property {string} title
 * @property {string} body
 * @property {string} slug what you set; empty means "derive it from the title"
 * @property {number} deletedAt 0 for a live post
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {Revision[]} revisions newest first
 */

/**
 * @param {import("./lib/store.js").StoredRecord} rec
 * @returns {Post}
 */
function toPost(rec) {
  const head = rec.items[0] ?? {};
  return {
    id: rec.id,
    title: rec.name,
    body: typeof head.text === "string" ? head.text : "",
    slug: typeof head.slug === "string" ? head.slug : "",
    deletedAt: typeof head.deletedAt === "number" ? head.deletedAt : 0,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
    // Stored oldest-first (append order); read newest-first, which is the
    // only order anyone wants to look at history in.
    revisions: rec.items
      .slice(1)
      .map((i) => ({
        id: i.id,
        text: typeof i.text === "string" ? i.text : "",
        title: typeof i.title === "string" ? i.title : "",
        slug: typeof i.slug === "string" ? i.slug : "",
        at: typeof i.at === "number" ? i.at : 0,
      }))
      .reverse(),
  };
}

/** @returns {Post[]} every post, live and trashed, newest written first */
function everyPost() {
  return posts
    .getAll()
    .map(toPost)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Newest first by when it was *written*.
 *
 * Not store.getAll()'s order, which is by updatedAt: fixing a typo in a
 * year-old post would walk it back to the top of the list and of the index,
 * and a reader who has seen it would be told it's new.
 *
 * @returns {Post[]}
 */
export function allPosts() {
  return everyPost().filter((p) => !p.deletedAt);
}

/** @returns {Post[]} what's in the trash, most recently thrown out first */
export function trashedPosts() {
  return everyPost()
    .filter((p) => p.deletedAt)
    .sort((a, b) => b.deletedAt - a.deletedAt);
}

/**
 * The posts that belong in index.gmi: everything with something in it.
 *
 * The app always hands you an open draft, so there is usually a blank post
 * sitting at the top of the list. Linking to it from the capsule index would
 * publish an empty file, which is not what an empty textarea means.
 *
 * @returns {Post[]}
 */
export function postsForIndex() {
  return allPosts().filter((p) => p.title.trim() !== "" || p.body.trim() !== "");
}

/** @returns {Post|null} the post being edited; never a trashed one */
export function activePost() {
  const id = posts.getActiveId();
  const rec = id ? posts.get(id) : null;
  if (!rec) return null;
  const post = toPost(rec);
  return post.deletedAt ? null : post;
}

/**
 * The post being edited, creating an empty one if there isn't one. Called on
 * boot and by the new-post button; nothing else needs it.
 * @returns {Post}
 */
export function ensurePost() {
  return activePost() ?? createPost();
}

/**
 * @param {string} [title]
 * @returns {Post}
 */
export function createPost(title = "") {
  const rec = posts.create(title);
  posts.append(rec.id, { kind: "head", text: "", slug: "", deletedAt: 0 });
  return toPost(posts.get(rec.id) ?? rec);
}

/**
 * The autosave entry point: whatever the editor currently holds.
 *
 * Returns whether it wrote anything, so the caller can say "saved" honestly
 * rather than every time a timer fires.
 *
 * @param {string} id
 * @param {{ title: string, body: string, slug: string }} draft
 * @param {number} [now]
 * @returns {boolean}
 */
export function saveDraft(id, draft, now = Date.now()) {
  const rec = posts.get(id);
  if (!rec) return false;
  const post = toPost(rec);
  if (post.title === draft.title && post.body === draft.body && post.slug === draft.slug) {
    return false;
  }

  // Checkpoint what's *stored* before overwriting it, if it has been sitting
  // long enough to count as a previous sitting. Deliberately before the write:
  // the state worth keeping is the one you're about to walk away from.
  if (now - rec.updatedAt > IDLE_MS) checkpoint(id);

  const head = posts.get(id)?.items[0];
  if (head) posts.updateItem(id, head.id, { text: draft.body, slug: draft.slug });
  else posts.append(id, { kind: "head", text: draft.body, slug: draft.slug, deletedAt: 0 });
  if (draft.title !== post.title) posts.rename(id, draft.title);
  return true;
}

/**
 * Keep the current state as a checkpoint. A no-op when there's nothing to
 * keep, or when the newest checkpoint already says the same thing -- pressing
 * the button twice should not fill the list with the same post.
 *
 * @param {string} id
 * @returns {boolean} whether a checkpoint was added
 */
export function checkpoint(id) {
  const rec = posts.get(id);
  if (!rec) return false;
  const post = toPost(rec);
  if (post.body.trim() === "" && post.title.trim() === "") return false;

  const newest = post.revisions[0];
  if (newest && newest.text === post.body && newest.title === post.title && newest.slug === post.slug) {
    return false;
  }

  posts.append(id, {
    kind: "rev",
    text: post.body,
    title: post.title,
    slug: post.slug,
    at: Date.now(),
  });

  // Drop from the old end. items[1] is the oldest checkpoint; items[0] is the
  // head and is never a candidate.
  let items = posts.get(id)?.items ?? [];
  while (items.length - 1 > MAX_REVISIONS) {
    posts.removeItem(id, items[1].id);
    items = posts.get(id)?.items ?? [];
  }
  return true;
}

/**
 * Put a checkpoint back into the editor. The restore is itself checkpointed
 * first, so restoring the wrong one costs nothing.
 *
 * @param {string} id
 * @param {string} revisionId
 * @returns {boolean}
 */
export function restoreRevision(id, revisionId) {
  const rec = posts.get(id);
  if (!rec) return false;
  const rev = rec.items.find((i) => i.id === revisionId && i.kind === "rev");
  if (!rev) return false;

  checkpoint(id);
  const head = posts.get(id)?.items[0];
  if (!head) return false;
  posts.updateItem(id, head.id, { text: rev.text ?? "", slug: rev.slug ?? "" });
  posts.rename(id, rev.title ?? "");
  return true;
}

/**
 * Move the editor off a post that's about to stop being editable.
 *
 * The store notifies from inside the write, so by the time anyone hears about
 * a delete, the active post has to already be one that can be shown. A
 * subscriber that reacts to "nothing active" by opening a blank draft -- which
 * is what app.js does, and should do -- would otherwise hand you a blank one
 * every time you threw something away.
 *
 * @param {string} id
 */
function handOverActive(id) {
  if (posts.getActiveId() !== id) return;
  const next = allPosts().find((p) => p.id !== id);
  if (next) posts.setActive(next.id);
  else createPost();
}

/**
 * Delete, the reversible kind. The post keeps its id, its dates and its whole
 * history, so restoring it puts it back where it was rather than at the top.
 *
 * @param {string} id
 * @param {number} [at]
 */
export function trashPost(id, at = Date.now()) {
  const rec = posts.get(id);
  if (!rec) return;
  handOverActive(id);
  const head = posts.get(id)?.items[0];
  if (head) posts.updateItem(id, head.id, { deletedAt: at });
  else posts.append(id, { kind: "head", text: "", slug: "", deletedAt: at });
}

/** @param {string} id */
export function restorePost(id) {
  const head = posts.get(id)?.items[0];
  if (!head) return;
  // 0 rather than a delete: updateItem merges a patch, and there is no shape
  // of patch that removes a key.
  posts.updateItem(id, head.id, { deletedAt: 0 });
}

/**
 * Delete, the real kind: the record and its history leave storage. Nothing
 * else in this app can undo it, which is why only the trash offers it.
 *
 * @param {string} id
 */
export function purgePost(id) {
  handOverActive(id);
  posts.remove(id);
}

/** @returns {number} how many posts were purged */
export function emptyTrash() {
  const doomed = trashedPosts();
  doomed.forEach((p) => purgePost(p.id));
  return doomed.length;
}

/**
 * What this post is called at the far end -- on smol.pub, the URL.
 * @param {Post} post
 * @returns {string}
 */
export function slugOf(post) {
  return postSlug(post);
}
