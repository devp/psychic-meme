// This app's state, in one place.
//
// Components that belong to *this* app import from here directly. Components
// meant to travel between apps (see components/append-log.js) take plain
// properties instead and know nothing about any of this.
//
// That split is what removes an ordering trap: defining a custom element
// upgrades it immediately, so connectedCallback runs before app.js could hand
// it anything. With nothing to inject, there's nothing to sequence.

import { persistedValue, recordStore } from "./lib/store.js";

// localStorage key prefix, from <meta name="app-ns"> in index.html.
const NS = document.querySelector('meta[name="app-ns"]')?.getAttribute("content") ?? "app";

export const theme = persistedValue(NS + ":theme", "dusk");
export const font = persistedValue(NS + ":font", "mono");
export const tab = persistedValue(NS + ":tab", "list");
export const lists = recordStore(NS + ":lists");
export const activity = recordStore(NS + ":activity");
