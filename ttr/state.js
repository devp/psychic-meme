// What persists, and only this: the token, the target config, the looked-up
// project/section ids, and the theme. The triage queue is deliberately not
// here -- it lives in memory (lib/triage.js Session), so killing the app
// mid-session loses decisions and changes nothing in Todoist.

import { persistedValue, persistedJson } from "./lib/store.js";
import { DEFAULT_CONFIG, withDefaults } from "./lib/triage.js";

// localStorage key prefix, from <meta name="app-ns"> in index.html.
const NS = document.querySelector('meta[name="app-ns"]')?.getAttribute("content") ?? "app";

export const theme = persistedValue(NS + ":theme", "dusk");
export const token = persistedValue(NS + ":token", "");

/** Targets and names. Hand-edit it in options; missing keys fall back to defaults. */
export const config = persistedJson(NS + ":config", DEFAULT_CONFIG);
export const getConfig = () => withDefaults(config.get());

/**
 * Project/section lookups from the last fetch, so a card can still say where
 * a task lives if the lookup fails underground.
 * @type {ReturnType<typeof persistedJson<ReturnType<typeof import("./lib/todoist.js").places>>>}
 */
export const placesCache = persistedJson(NS + ":places", {
  watchProjectId: /** @type {string|null} */ (null),
  agendaSections: /** @type {{ id: string, name: string }[]} */ ([]),
  projectNames: /** @type {Record<string, string>} */ ({}),
  sectionNames: /** @type {Record<string, string>} */ ({}),
});
