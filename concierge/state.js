// What this app remembers between visits. Everything else is asked of the
// service again on each load.

import { persistedValue } from "./lib/store.js";

// localStorage key prefix, from <meta name="app-ns"> in index.html.
const NS = document.querySelector('meta[name="app-ns"]')?.getAttribute("content") ?? "app";

const RECENT_MAX = 12;
const recentRaw = persistedValue(NS + ":recent", "[]");

/** Ids of the collections played lately, newest first. */
export const recent = {
  /** @returns {string[]} */
  get() {
    try {
      const ids = JSON.parse(recentRaw.get());
      return Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : [];
    } catch {
      return [];
    }
  },
  /** @param {string} id */
  add(id) {
    const ids = [id, ...recent.get().filter((other) => other !== id)].slice(0, RECENT_MAX);
    recentRaw.set(JSON.stringify(ids));
  },
  /**
   * @param {(ids: string[]) => void} fn called immediately, then on every change
   * @returns {() => void} unsubscribe
   */
  subscribe(fn) {
    return recentRaw.subscribe(() => fn(recent.get()));
  },
};
