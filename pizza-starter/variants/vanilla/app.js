// Wiring. Everything app-shaped lives here in the open, rather than behind a
// lib -- this is the file you edit first, so it should be readable top to
// bottom with no indirection.

import { syncAppHeight } from "../../lib/viewport.js";
import { theme, font, tab, lists, activity } from "./state.js";
import { Tabs } from "./components/tabs.js";
import { Checklist, SETUP_STEPS } from "./components/checklist.js";
import { AppendLog } from "./components/append-log.js";

// Components read their state from state.js, so defining them is the whole of
// it -- nothing to inject, nothing to sequence.
Tabs.define("pizza-tabs");
Checklist.define("pizza-checklist");
AppendLog.define("append-log");

// First run: seed the checklist with its own setup instructions.
// A plain worked example of create() + append() -- read it, then delete it.
if (lists.getAll().length === 0) {
  const seeded = lists.ensureActive();
  lists.rename(seeded.id, "Make this yours");
  SETUP_STEPS.forEach((step) => lists.append(seeded.id, step));
} else {
  lists.ensureActive();
}

// ---- the travelling component ---------------------------------------------
// append-log knows nothing about this app, so it's fed by property. Assigning
// after definition is fine precisely because its setup() needs no state --
// which is the whole reason travelling components take props.

const logEl = /** @type {AppendLog} */ (document.getElementById("activity-log"));
logEl.renderItem = (/** @type {any} */ item) =>
  `<div class="log-entry"><time>${new Date(item.at).toLocaleTimeString()}</time> ${item.text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")}</div>`;

const activityRecord = activity.ensureActive();
const paintLog = () => {
  logEl.items = activity.get(activityRecord.id)?.items ?? [];
};
activity.subscribe(paintLog);
paintLog();

document.getElementById("clear-log")?.addEventListener("click", () => {
  activity.clearItems(activityRecord.id);
});

// ---- shell glue -----------------------------------------------------------
// Theme, font and tab are just persisted scalars with a subscriber each. No
// lib needed; this is the whole of it.

theme.subscribe((v) => {
  document.documentElement.setAttribute("data-theme", v);
  syncChecked("[data-set-theme]", "data-set-theme", v);
});

font.subscribe((v) => {
  document.documentElement.setAttribute("data-font", v);
  syncChecked("[data-set-font]", "data-set-font", v);
});

tab.subscribe((v) => {
  document.querySelectorAll(".panel").forEach((p) => {
    p.classList.toggle("active", p.getAttribute("data-panel") === v);
  });
});

/**
 * @param {string} selector
 * @param {string} attr
 * @param {string} value
 */
function syncChecked(selector, attr, value) {
  document.querySelectorAll(selector).forEach((b) => {
    b.setAttribute("aria-checked", String(b.getAttribute(attr) === value));
  });
}

document.addEventListener("click", (e) => {
  const el = e.target instanceof Element ? e.target : null;
  if (!el) return;
  const t = el.closest("[data-set-theme]");
  if (t) theme.set(t.getAttribute("data-set-theme") ?? "dusk");
  const f = el.closest("[data-set-font]");
  if (f) font.set(f.getAttribute("data-set-font") ?? "mono");
});

const settings = /** @type {HTMLDialogElement} */ (document.getElementById("settings-dialog"));
document.getElementById("settings-btn")?.addEventListener("click", () => settings.showModal());
document.getElementById("settings-close")?.addEventListener("click", () => settings.close());

// ---- phone ----------------------------------------------------------------

syncAppHeight();

// ---- offline --------------------------------------------------------------

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      /* not fatal -- the app still works, it just won't survive the subway */
    });
  });
}
