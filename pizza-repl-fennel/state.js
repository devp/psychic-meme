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
// What tapping a log entry's caret does: "both" | "copy" | "fill".
export const caretAction = persistedValue(NS + ":caret-action", "both");
// Completion strip above the key row, for languages whose lang.js has complete(): "on" | "off".
export const suggestPref = persistedValue(NS + ":suggest", "on");
// Comma-separated command shortcuts, listed after the language's own.
export const commandsPref = persistedValue(NS + ":commands", "");
// "repl" | "docs" | "log". Older versions stored a doc's id here; app.js moves it to `doc`.
export const tab = persistedValue(NS + ":tab", "repl");
// The doc the docs tab shows: an id from lang.docs. Blank means the first.
export const doc = persistedValue(NS + ":doc", "");
// Each item is one REPL entry: { input, output, isError }.
export const sessions = recordStore(NS + ":sessions");
