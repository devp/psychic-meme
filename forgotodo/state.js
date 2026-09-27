// This app's state, in one place.
//
// Components import from here directly; nothing is injected.

import { persistedValue, recordStore } from "./lib/store.js";

const NS = "forgotodo";

export const theme = persistedValue(NS + ":theme", "palm");
export const font = persistedValue(NS + ":font", "pixel");
export const lists = recordStore(NS + ":lists");

