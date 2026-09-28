// This app's state, in one place.
//
// Components import from here directly; nothing is injected.

import { persistedValue, recordStore } from "./lib/store.js";

const NS = "forgotodo";

export const theme = persistedValue(NS + ":theme", "palm");
export const mode = persistedValue(NS + ":mode", "light"); // light | dark | system
export const font = persistedValue(NS + ":font", "pixel");
export const icons = persistedValue(NS + ":icons", "on");
export const fit = persistedValue(NS + ":fit", "off");
export const lists = recordStore(NS + ":lists");

