// This app's state, in one place. Everything is in localStorage, on this
// device only: no backend, no accounts, no analytics.

import { persistedValue, recordStore } from "./lib/store.js";

// localStorage key prefix, from <meta name="app-ns"> in index.html.
const NS = document.querySelector('meta[name="app-ns"]')?.getAttribute("content") ?? "app";

export const theme = persistedValue(NS + ":theme", "auto");
export const font = persistedValue(NS + ":font", "sans");
export const tab = persistedValue(NS + ":tab", "records");

/** Thought records. Each record's items are its entries; `connections` sits beside them. */
export const records = recordStore(NS + ":records");

/** The toolkit: one record whose items are `{text, corners}`. */
export const toolkit = recordStore(NS + ":toolkit");

/** Neutral starters, offered once. Delete or edit freely; your own worksheet comes first. */
export const TOOLKIT_STARTERS = [
  { text: "What evidence do I have, for and against?", corners: ["thought"] },
  { text: "What would I say to a friend thinking this?", corners: ["thought"] },
  { text: "Name the feeling, and where it sits in my body", corners: ["feeling"] },
  { text: "Three slow breaths", corners: ["feeling"] },
  { text: "Do one small different thing for five minutes", corners: ["behavior"] },
];

/** The toolkit record, seeded with the starters on first run. */
export function toolkitRecord() {
  if (toolkit.getAll().length === 0) {
    const rec = toolkit.create("toolkit");
    TOOLKIT_STARTERS.forEach((s) => toolkit.append(rec.id, s));
  }
  return toolkit.ensureActive();
}
