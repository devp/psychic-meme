// This app's state, in one place. Components import from here directly.

import { persistedValue, persistedJson, recordStore } from "./lib/store.js";
import { cleanText } from "./lib/deck.js";

// localStorage key prefix, from <meta name="app-ns"> in index.html.
const NS = document.querySelector('meta[name="app-ns"]')?.getAttribute("content") ?? "app";

export const theme = persistedValue(NS + ":theme", "dulles");

/** The lane being browsed; "" is all unread. */
export const lane = persistedValue(NS + ":lane", "");
/** @type {ReturnType<typeof persistedJson<string[]>>} */
export const lanes = persistedJson(NS + ":lanes", /** @type {string[]} */ ([]));
/** Who sent a link. Same pick-or-create list as lanes. */
export const people = persistedJson(NS + ":people", /** @type {string[]} */ ([]));
/** Reading position per lane. */
export const positions = persistedJson(NS + ":positions", /** @type {Record<string, import("./lib/deck.js").Position>} */ ({}));
/** How to render each platform. */
export const modes = persistedJson(NS + ":modes", /** @type {Record<string, import("./lib/deck.js").RenderMode>} */ ({
  youtube: "embed",
  instagram: "embed",
  facebook: "embed",
}));

// The deck is one record in a recordStore; its items are the cards.
export const deck = recordStore(NS + ":deck");
const deckId = deck.ensureActive().id;

/** @typedef {import("./lib/deck.js").Card} Card */

/** @returns {Card[]} */
export function cards() {
  return /** @type {Card[]} */ (/** @type {unknown} */ (deck.get(deckId)?.items ?? []));
}

/**
 * @param {{ url: string, description: string }} link
 * @returns {Card}
 */
export function addCard({ url, description }) {
  const card = { url, description, comment: null, addedAt: Date.now(), readAt: null, lane: null, from: null };
  return /** @type {Card} */ (deck.append(deckId, card));
}

/**
 * @param {string} id
 * @param {Partial<Card>} patch
 */
export function patchCard(id, patch) {
  deck.updateItem(deckId, id, patch);
}

/** @param {string} id */
export function removeCard(id) {
  deck.removeItem(deckId, id);
}

/** @param {string} id @param {string} text */
export function setComment(id, text) {
  patchCard(id, { comment: cleanText(text) });
}

/**
 * @param {string} name
 * @param {typeof lanes} list
 */
export function addName(name, list) {
  const n = name.trim();
  if (n && !list.get().includes(n)) list.set([...list.get(), n]);
}
