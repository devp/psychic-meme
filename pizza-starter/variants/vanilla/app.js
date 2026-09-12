// Wiring. Everything app-shaped lives here in the open, rather than behind a
// lib -- this is the file you edit first, so it should be readable top to
// bottom with no indirection.

import { syncAppHeight } from "../../lib/viewport.js";
import { persistedValue, recordStore } from "../../lib/store.js";
import { Tabs } from "./components/tabs.js";
import { Checklist, SETUP_STEPS } from "./components/checklist.js";

const NS = "pizza-starter";

Tabs.define("pizza-tabs");
Checklist.define("pizza-checklist");

// ---- state ----------------------------------------------------------------

const theme = persistedValue(NS + ":theme", "dusk");
const font = persistedValue(NS + ":font", "mono");
const tab = persistedValue(NS + ":tab", "list");
const lists = recordStore(NS + ":lists");

// First run: seed the checklist with its own setup instructions.
// A plain worked example of create() + append() -- read it, then delete it.
const firstRun = lists.getAll().length === 0;
const active = lists.ensureActive();
if (firstRun) {
  lists.rename(active.id, "Make this yours");
  SETUP_STEPS.forEach((step) => lists.append(active.id, step));
}

// ---- components -----------------------------------------------------------

// Defining an element upgrades it immediately, so setup() runs before we could
// assign anything. configure() injects the stores and re-runs setup.
const tabsEl = /** @type {Tabs} */ (document.querySelector("pizza-tabs"));
tabsEl.configure({
  store: tab,
  tabs: [
    { id: "list", label: "list" },
    { id: "about", label: "about" },
  ],
});

const checklistEl = /** @type {Checklist} */ (document.querySelector("pizza-checklist"));
checklistEl.configure({ store: lists });

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
