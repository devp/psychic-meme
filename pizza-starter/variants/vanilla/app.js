// Wiring. Everything app-shaped lives here in the open, rather than behind a
// lib -- this is the file you edit first, so it should be readable top to
// bottom with no indirection.

import { syncAppHeight } from "../../lib/viewport.js";
import { theme, font, tab, lists, activity } from "./state.js";
import { Tabs } from "./components/tabs.js";
import { Checklist, SETUP_STEPS } from "./components/checklist.js";
import { esc } from "./reactive-element.js";

// Components read their state from state.js, so defining them is the whole of
// it -- nothing to inject, nothing to sequence.
Tabs.define("pizza-tabs");
Checklist.define("pizza-checklist");

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
// append-log knows nothing about this app, so it's fed by property. Three
// interchangeable item-rendering strategies, selected with ?log= so they can be
// measured against the same suite. See COMPARISON.md axis 3.

const strategy = new URLSearchParams(location.search).get("log") ?? "string";

/** Shared by the two template strategies: fill a clone, escaping structurally. */
const fillEntry = (/** @type {DocumentFragment} */ node, /** @type {any} */ item) => {
  const time = node.querySelector("time");
  const text = node.querySelector(".text");
  if (time) time.textContent = new Date(item.at).toLocaleTimeString();
  if (text) text.textContent = item.text;
};

/** @type {any} */
let logEl;

if (strategy === "template") {
  const { AppendLogTemplate } = await import("./components/append-log-template.js");
  AppendLogTemplate.define("append-log");
  logEl = document.getElementById("activity-log");
  logEl.template = document.getElementById("log-entry-tpl");
  logEl.fill = fillEntry;
} else if (strategy === "fetch") {
  const { AppendLogFetch } = await import("./components/append-log-fetch.js");
  AppendLogFetch.define("append-log");
  logEl = document.getElementById("activity-log");
  logEl.fill = fillEntry;
} else {
  const { AppendLogString } = await import("./components/append-log.js");
  AppendLogString.define("append-log");
  logEl = document.getElementById("activity-log");
  logEl.renderItem = (/** @type {any} */ item) =>
    `<div class="log-entry"><time>${new Date(item.at).toLocaleTimeString()}</time> ${esc(
      item.text
    )}</div>`;
}

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
  const register = () =>
    navigator.serviceWorker.register("sw.js").catch(() => {
      /* not fatal -- the app still works, it just won't survive the subway */
    });

  // Not simply addEventListener("load", ...). This module uses top-level await
  // (the dynamic import above), which defers the rest of its body past the load
  // event -- so a load listener registered here would never fire and offline
  // would silently never work. Found the hard way. Check readyState first.
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
