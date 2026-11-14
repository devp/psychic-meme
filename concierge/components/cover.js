import { html } from "lit";

/** @typedef {import("../lib/types.js").Collection} Collection */

/**
 * A hue from a string, so a collection without artwork always gets the same
 * color.
 * @param {string} text
 * @returns {number} 0-359
 */
export function hueOf(text) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

/**
 * A collection's square artwork: its `cover` image, or one drawn from its id.
 * Decorative; the title is always printed beside it.
 * @param {Collection} collection
 */
export function cover(collection) {
  return collection.cover
    ? html`<span class="cover"><img src=${collection.cover} alt="" loading="lazy" /></span>`
    : html`<span class="cover cover--drawn" style="--cover-hue: ${hueOf(collection.id)}"></span>`;
}
