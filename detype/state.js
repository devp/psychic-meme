// This app's state, in one place.
//
// Components that belong to *this* app import from here directly. Components
// meant to travel between apps (see components/ghost-lines.js) take plain
// properties instead and know nothing about any of this.

import { persistedValue, recordStore } from "./lib/store.js";
import { dayKey } from "./lib/pages.js";

const NS = "detype";

export const theme = persistedValue(NS + ":theme", "dusk");
export const font = persistedValue(NS + ":font", "serif");
export const tab = persistedValue(NS + ":tab", "write");

/** "off" | "words" | "chars" | "lines" */
export const goalUnit = persistedValue(NS + ":goalUnit", "off");
export const goalTarget = persistedValue(NS + ":goalTarget", "750");

/**
 * One record per day. Its name is the day (YYYY-MM-DD); its items are the
 * lines, `{ text, at }`, in the order they were written.
 */
export const pages = recordStore(NS + ":pages");

/**
 * The page for a day, created on first use.
 * @param {string} [key]
 */
export function pageFor(key = dayKey()) {
  return pages.getAll().find((p) => p.name === key) ?? pages.create(key);
}

/** The tabs this app has. Add a panel in index.html, add a line here. */
export const TABS = [
  { id: "write", label: "write" },
  { id: "pages", label: "pages" },
];
