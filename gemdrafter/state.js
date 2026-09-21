// This app's state, in one place.
//
// One record store (the posts) and four persisted scalars (theme, font, tab,
// and the capsule title that heads the generated index). Components that
// belong to this app import from here; components meant to travel -- see
// components/gem-preview.js -- take properties and know nothing about any of
// it.

import { persistedValue, recordStore } from "./lib/store.js";

const NS = "gemdrafter";

export const theme = persistedValue(NS + ":theme", "dusk");
export const font = persistedValue(NS + ":font", "mono");
export const tab = persistedValue(NS + ":tab", "draft");

/** Heads the generated index.gmi. Your capsule's name, not the app's. */
export const capsuleTitle = persistedValue(NS + ":capsule", "My Gemlog");

/**
 * The posts. A post's body is the record's single item, `{ text }`.
 *
 * recordStore holds records *of items*, and a post is one blob of text rather
 * than a list of anything, so the body rides in items[0] and everything goes
 * through the accessors below -- activePost(), setBody() -- rather than
 * touching items directly. The alternative was adding a field to
 * StoredRecord, which means forking lib/store.js away from pizza-starter for
 * the sake of one string -- and the day the starter's store grows a fix, that
 * fork is what stops you taking it.
 *
 * @type {ReturnType<typeof recordStore>}
 */
export const posts = recordStore(NS + ":posts");

/** The tabs this app has. Add a panel in index.html, add a line here. */
export const TABS = [
  { id: "draft", label: "draft" },
  { id: "preview", label: "preview" },
  { id: "posts", label: "posts" },
  { id: "index", label: "index" },
  { id: "about", label: "about" },
];

/**
 * @typedef {Object} Post
 * @property {string} id
 * @property {string} title
 * @property {string} body
 * @property {number} createdAt
 * @property {number} updatedAt
 */

/**
 * @param {import("./lib/store.js").StoredRecord} rec
 * @returns {Post}
 */
function toPost(rec) {
  return {
    id: rec.id,
    title: rec.name,
    body: typeof rec.items[0]?.text === "string" ? rec.items[0].text : "",
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
  };
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
  return posts
    .getAll()
    .map(toPost)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * The posts that belong in index.gmi: everything with something in it.
 *
 * The app always hands you an open draft, so there is usually a blank post
 * sitting at the top of the list. Linking to it from the capsule index would
 * publish an empty file called untitled.gmi, which is not what an empty
 * textarea means.
 *
 * @returns {Post[]}
 */
export function postsForIndex() {
  return allPosts().filter((p) => p.title.trim() !== "" || p.body.trim() !== "");
}

/** @returns {Post|null} */
export function activePost() {
  const id = posts.getActiveId();
  const rec = id ? posts.get(id) : null;
  return rec ? toPost(rec) : null;
}

/**
 * The post being edited, creating an empty one if there isn't one. Called on
 * boot and by the new-post button; nothing else needs it.
 * @returns {Post}
 */
export function ensurePost() {
  const current = activePost();
  return current ?? createPost();
}

/**
 * @param {string} [title]
 * @returns {Post}
 */
export function createPost(title = "") {
  const rec = posts.create(title);
  posts.append(rec.id, { text: "" });
  return toPost(posts.get(rec.id) ?? rec);
}

/**
 * @param {string} id
 * @param {string} text
 */
export function setBody(id, text) {
  const rec = posts.get(id);
  if (!rec) return;
  if (rec.items.length === 0) posts.append(id, { text });
  else posts.updateItem(id, rec.items[0].id, { text });
}

/**
 * @param {string} id
 * @param {string} title
 */
export function setTitle(id, title) {
  posts.rename(id, title);
}

/**
 * Hand the editor its successor *before* the delete, not after.
 *
 * The store notifies from inside remove(), with the active id already cleared,
 * so a subscriber that reacts to "no active post" by opening a blank one --
 * which is what app.js does, and should do -- would get a blank draft every
 * time you deleted the post you were reading. Choosing the successor first
 * means remove() never clears the active id while there is still a post to
 * show it.
 *
 * Deleting the last post is the one case that does leave nothing active, and
 * there a blank draft is the right answer.
 *
 * @param {string} id
 */
export function removePost(id) {
  if (posts.getActiveId() === id) {
    const next = allPosts().find((p) => p.id !== id);
    if (next) posts.setActive(next.id);
  }
  posts.remove(id);
}
