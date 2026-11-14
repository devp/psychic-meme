// A Service (lib/types.js) made of mock/data.js. Swap this file's export for a
// real one in /service.js and the UI is none the wiser.

import { CONFIG, COLLECTIONS, SITUATIONS, LINEUPS, WEEKEND_SWAPS, GALLERIES, WORDS } from "./data.js";

/** @typedef {import("../lib/types.js").Service} Service */
/** @typedef {import("../lib/types.js").Collection} Collection */
/** @typedef {import("../lib/types.js").Situation} Situation */

// Resolved against this file, so the sprite is found wherever the page lives.
const ICONS = new URL("./icons.svg", import.meta.url).href;

/**
 * A repeatable stream of numbers in [0, 1) from a string: the same collection
 * always invents the same items in the same order.
 * @param {string} seed
 */
function random(seed) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

const TAGGED = COLLECTIONS.map(([id, title, description, tags]) => ({
  collection: /** @type {Collection} */ ({ id, title, description, curator: CONFIG.brand }),
  tags: new Set(tags.split(" ")),
}));

/** @param {string} tag */
const idsWith = (tag) => TAGGED.filter((t) => t.tags.has(tag)).map((t) => t.collection.id);

/**
 * The few collections that best fit a set of tags; never fewer than `count`.
 * @param {string[]} must any of these missing and the collection scores zero
 * @param {string[]} favor each one present is a point
 * @param {number} count
 */
function bestFor(must, favor, count) {
  return TAGGED.map((t, order) => ({
    id: t.collection.id,
    order,
    score: (must.every((tag) => t.tags.has(tag)) ? 10 : 0) + favor.filter((tag) => t.tags.has(tag)).length,
  }))
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, count)
    .map((s) => s.id);
}

/** @type {Map<string, Situation>} */
const SITUATION_BY_ID = new Map(
  SITUATIONS.map((s) => [
    s.id,
    {
      id: s.id,
      title: s.title,
      icon: `${ICONS}#${s.icon}`,
      refinements: s.refinements.map(([title, tags]) => ({
        id: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        title,
        collectionIds: bestFor([s.id], tags.split(" "), 3),
      })),
    },
  ])
);

/**
 * @param {{ delay?: number }} [options] delay: milliseconds every answer takes,
 *   so the UI's waiting states get seen. Tests pass 0.
 * @returns {Service}
 */
export function createMockService({ delay = 150 } = {}) {
  /**
   * @template T
   * @param {T} value
   * @returns {Promise<T>} a copy, late: callers can't reach back into the data
   */
  const answer = (value) =>
    new Promise((resolve) => {
      const copy = structuredClone(value);
      if (delay > 0) setTimeout(() => resolve(copy), delay);
      else resolve(copy);
    });

  /** @type {Map<string, { next: () => number, served: number }>} */
  const streams = new Map();
  /** @type {{ collectionId: string, itemId: string, vote: "up" | "down" }[]} */
  const votes = [];

  return {
    getConfig: () => answer(CONFIG),

    getConcierge(moment) {
      const weekend = moment.day === "saturday" || moment.day === "sunday";
      let ids = (LINEUPS[moment.period] ?? LINEUPS.afternoon).map((id) => (weekend && WEEKEND_SWAPS[id]) || id);
      if ((moment.day === "friday" || moment.day === "saturday") && moment.period === "evening") ids.unshift("party");
      if (moment.month === 12) ids.unshift("holiday");
      ids = [...new Set(ids)];
      return answer(ids.flatMap((id) => SITUATION_BY_ID.get(id) ?? []));
    },

    getGalleries: () => answer(GALLERIES.map(({ id, title }) => ({ id, title }))),

    getCategories(galleryId) {
      const gallery = GALLERIES.find((g) => g.id === galleryId);
      return answer((gallery?.categories ?? []).map(([tag, title]) => ({ id: tag, title, collectionIds: idsWith(tag) })));
    },

    getCollections(ids) {
      return answer(ids.flatMap((id) => TAGGED.find((t) => t.collection.id === id)?.collection ?? []));
    },

    getSimilar(collectionId) {
      const tags = TAGGED.find((t) => t.collection.id === collectionId)?.tags ?? new Set();
      const ids = bestFor([], [...tags], 4).filter((id) => id !== collectionId).slice(0, 3);
      return this.getCollections(ids);
    },

    search(query) {
      const words = query.toLowerCase().split(/\s+/).filter(Boolean);
      if (words.length === 0) return answer([]);
      return answer(
        TAGGED.filter((t) => {
          const haystack = `${t.collection.title} ${t.collection.description} ${[...t.tags].join(" ")}`.toLowerCase();
          return words.every((w) => haystack.includes(w));
        }).map((t) => t.collection)
      );
    },

    nextItem(collectionId) {
      let stream = streams.get(collectionId);
      if (!stream) streams.set(collectionId, (stream = { next: random(collectionId), served: 0 }));
      const { next } = stream;
      /** @param {string[]} list */
      const pick = (list) => list[Math.floor(next() * list.length)];
      return answer({
        id: `${collectionId}:${stream.served++}`,
        title: `${pick(WORDS.adjectives)} ${pick(WORDS.nouns)}`,
        byline: pick(WORDS.bands),
        duration: 150 + Math.floor(next() * 120),
      });
    },

    vote(collectionId, itemId, vote) {
      votes.push({ collectionId, itemId, vote });
      return answer(undefined);
    },
  };
}
