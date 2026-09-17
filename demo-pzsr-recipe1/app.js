// Wiring. Everything app-shaped lives here in the open, rather than behind a
// lib -- this is the file you read first, top to bottom, with no indirection.

import { html } from "lit";
import { syncAppHeight } from "./lib/viewport.js";
import { seedPantry } from "./lib/seed.js";
import { buildShoppingList, countLines } from "./lib/plan.js";
import { STAPLES, STORES } from "./data/staples.js";
import { RECIPE_BY_ID } from "./data/recipes.js";
import {
  theme, font, tab,
  plan, pantry, cart, skips, activity,
  pantryMap, planItems,
} from "./state.js";
import { Tabs } from "./components/tabs.js";
import { PickDeck } from "./components/pick-deck.js";
import { WeekPlan } from "./components/week-plan.js";
import { PantryGrid } from "./components/pantry-grid.js";
import { ShoppingList } from "./components/shopping-list.js";
import { AppendLog } from "./components/append-log.js";

// Components read their own state from state.js, so defining them is the whole
// of it -- nothing to inject, nothing to sequence.
customElements.define("supper-tabs", Tabs);
customElements.define("pick-deck", PickDeck);
customElements.define("week-plan", WeekPlan);
customElements.define("pantry-grid", PantryGrid);
customElements.define("shopping-list", ShoppingList);
customElements.define("append-log", AppendLog);

// ---- first run ------------------------------------------------------------
// The pantry gets a plausible mid-week kitchen (see lib/seed.js); everything
// else just needs an active record to append into.

seedPantry(pantry);
plan.ensureActive();
cart.ensureActive();
skips.ensureActive();

// ---- the travelling component ---------------------------------------------
// append-log knows nothing about this app, so it's fed by property. renderItem
// returns a Lit template, so interpolated text is escaped by construction.

const logEl = /** @type {AppendLog} */ (document.getElementById("decision-log"));
logEl.renderItem = (/** @type {any} */ item) =>
  html`<div class="log-entry">
    <time>${new Date(item.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>
    ${item.text}
  </div>`;

const logRecord = activity.ensureActive();
const paintLog = () => {
  logEl.items = (activity.get(logRecord.id)?.items ?? []).slice().reverse();
};
activity.subscribe(paintLog);
paintLog();

document.getElementById("clear-log")?.addEventListener("click", () => {
  activity.clearItems(logRecord.id);
});

// ---- tab badges -----------------------------------------------------------
// The two numbers you'd otherwise change tabs to find out: how many nights are
// settled, and how long the list is. Derived from the same pure functions the
// panels use, so they can't disagree with what you see when you get there.

const tabsEl = /** @type {Tabs} */ (document.querySelector("supper-tabs"));
const paintBadges = () => {
  const picks = planItems()
    .map((p) => RECIPE_BY_ID.get(p.recipeId))
    .filter((r) => r !== undefined);
  tabsEl.setBadge("week", picks.length);
  tabsEl.setBadge(
    "shop",
    countLines(
      buildShoppingList({
        picks: /** @type {import("./data/recipes.js").Recipe[]} */ (picks),
        pantry: pantryMap(),
        staples: STAPLES,
        stores: STORES,
      })
    )
  );
};
plan.subscribe(paintBadges);
pantry.subscribe(paintBadges);
paintBadges();

// ---- shell glue -----------------------------------------------------------
// Theme, font and tab are just persisted scalars with a subscriber each.

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
  document.querySelectorAll("supper-tabs [data-tab]").forEach((b) => {
    const on = b.getAttribute("data-tab") === v;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", String(on));
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
  if (f) font.set(f.getAttribute("data-set-font") ?? "sans");
});

const settings = /** @type {HTMLDialogElement} */ (document.getElementById("settings-dialog"));
document.getElementById("settings-btn")?.addEventListener("click", () => settings.showModal());
document.getElementById("settings-close")?.addEventListener("click", () => settings.close());

// Nuclear option, behind a confirm: the demo seeds a kitchen, and you'll want
// to throw it away once you've entered your own.
document.getElementById("reset-all")?.addEventListener("click", () => {
  if (!confirm("Forget the plan, the pantry and the list?")) return;
  for (const store of [plan, pantry, cart, skips, activity]) {
    for (const rec of store.getAll()) store.remove(rec.id);
  }
  location.reload();
});

// ---- phone ----------------------------------------------------------------

syncAppHeight();

// ---- offline --------------------------------------------------------------

if ("serviceWorker" in navigator) {
  const register = () =>
    navigator.serviceWorker.register("sw.js").catch(() => {
      /* not fatal -- the app still works, it just won't survive the subway */
    });

  // Not simply addEventListener("load", ...). Any top-level await in this
  // module defers the rest of its body past the load event, so a load listener
  // registered here would never fire and offline would silently never work.
  // Check readyState first and this stays correct either way.
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
