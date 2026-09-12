// This app's state, in one place.
//
// Components that belong to *this* app import from here directly. Components
// meant to travel between apps (see components/append-log.js) take plain
// properties instead and know nothing about any of this.
//
// That split is what removes an ordering trap: defining a custom element
// upgrades it immediately, so connectedCallback runs before app.js could hand
// it anything. With nothing to inject, there's nothing to sequence.

import { persistedValue, recordStore } from "../../lib/store.js";

const NS = "pizza-starter";

export const theme = persistedValue(NS + ":theme", "dusk");
export const font = persistedValue(NS + ":font", "mono");
export const tab = persistedValue(NS + ":tab", "list");
export const lists = recordStore(NS + ":lists");
export const activity = recordStore(NS + ":activity");

/** The tabs this app has. Add a panel in index.html, add a line here. */
export const TABS = [
  { id: "list", label: "list" },
  { id: "log", label: "log" },
  { id: "about", label: "about" },
];
