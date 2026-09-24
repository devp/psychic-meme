// Wiring. Everything app-shaped lives here in the open, rather than behind a
// lib -- this is the file you edit first, so it should be readable top to
// bottom with no indirection.

import { syncAppHeight, autoGrow } from "./lib/viewport.js";
import { theme, font, tab, goalUnit, goalTarget, pages, pageFor } from "./state.js";
import { dayKey, cleanLine, blob, progress, allPagesText, GOAL_DEFAULTS } from "./lib/pages.js";
import { Tabs } from "./components/tabs.js";
import { GhostLines } from "./components/ghost-lines.js";
import { PagesList } from "./components/pages-list.js";

customElements.define("pizza-tabs", Tabs);
customElements.define("ghost-lines", GhostLines);
customElements.define("pages-list", PagesList);

const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));

// ---- write ----------------------------------------------------------------
// A line goes in the box; Enter lets it go. It's saved to today's page the
// moment it leaves, and on screen it only drifts up and fades.

const lineEl = /** @type {HTMLTextAreaElement} */ ($("line"));
const ghosts = /** @type {GhostLines} */ ($("ghosts"));
const hint = $("hint");
const saveWarning = $("save-warning");

/** Lines let go this sitting, for the ghosts. Not reloaded: a fresh start is the point. */
/** @type {{id: string, text: string}[]} */
let released = [];

/** @param {string} raw */
function letGo(raw) {
  const text = cleanLine(raw);
  if (!text) return; // empty Enter: nothing to keep
  const page = pageFor(dayKey());
  const item = pages.append(page.id, { text, at: Date.now() });
  released = [...released, { id: item?.id ?? String(Date.now()), text }].slice(-GhostLines.KEEP);
  ghosts.lines = released;
  hint.classList.add("gone");
  saveWarning.hidden = pages.isSaved();
}

lineEl.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.isComposing) return;
  e.preventDefault();
  letGo(lineEl.value);
  lineEl.value = "";
  autoGrow(lineEl);
});

// Some phone keyboards never send a usable Enter keydown (IME, keyCode 229);
// the newline just arrives in the value. Pasting several lines lands here too.
// Every complete line is let go; whatever follows the last newline stays.
lineEl.addEventListener("input", () => {
  if (/[\r\n]/.test(lineEl.value)) {
    const parts = lineEl.value.split(/\r?\n|\r/);
    const rest = parts.pop() ?? "";
    parts.forEach(letGo);
    lineEl.value = rest;
  }
  autoGrow(lineEl);
});

// ---- goal -----------------------------------------------------------------
// Off by default. When on: a hairline that fills and then just stays full.

const goalEl = $("goal");
const goalFill = $("goal-fill");
const goalInput = /** @type {HTMLInputElement} */ ($("goal-target"));
const goalUnitLabel = $("goal-target-unit");

function paintGoal() {
  const unit = goalUnit.get();
  const today = pages.getAll().find((p) => p.name === dayKey());
  const p = progress(today?.items ?? [], unit, Number(goalTarget.get()));
  goalEl.hidden = p === null;
  goalFill.style.width = ((p ?? 0) * 100).toFixed(1) + "%";

  goalInput.disabled = unit === "off";
  goalUnitLabel.textContent = unit === "off" ? "" : unit;
  if (document.activeElement !== goalInput) goalInput.value = goalTarget.get();
  syncChecked("[data-set-goal]", "data-set-goal", unit);
}

goalUnit.subscribe(paintGoal);
goalTarget.subscribe(paintGoal);
pages.subscribe(paintGoal);

goalInput.addEventListener("change", () => {
  const n = Math.round(Number(goalInput.value));
  if (n > 0) goalTarget.set(String(n));
  else goalInput.value = goalTarget.get();
});

// ---- pages ----------------------------------------------------------------

const pagesList = $("pages-list");

pagesList.addEventListener("page-download", (e) => {
  const day = /** @type {CustomEvent} */ (e).detail;
  download(`detype-${day.name}.txt`, blob(day.items) + "\n");
});

pagesList.addEventListener("pages-download-all", () => {
  download(`detype-all-${dayKey()}.txt`, allPagesText(pages.getAll().filter((d) => d.items.length)));
});

pagesList.addEventListener("page-delete", (e) => {
  const day = /** @type {CustomEvent} */ (e).detail;
  if (window.confirm(`Delete the page for ${day.name}? This can't be undone.`)) pages.remove(day.id);
});

/**
 * Hand the browser a text file. On phones this lands in Downloads (Android)
 * or the Files app via a preview sheet (iOS).
 * @param {string} name
 * @param {string} text
 */
function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  // In the document, because Safari won't follow a click on a detached anchor.
  document.body.append(a);
  a.click();
  a.remove();
  // Revoking immediately races the download on some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- shell glue -----------------------------------------------------------
// Theme, font and tab are just persisted scalars with a subscriber each.

const themeColor = document.querySelector('meta[name="theme-color"]');

theme.subscribe((v) => {
  document.documentElement.setAttribute("data-theme", v);
  themeColor?.setAttribute("content", getComputedStyle(document.documentElement).getPropertyValue("--bg-alt").trim());
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
  document.querySelectorAll("pizza-tabs [data-tab]").forEach((b) => {
    const on = b.getAttribute("data-tab") === v;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", String(on));
  });
  // Back to writing means back to the line, without reaching for anything.
  if (v === "write") lineEl.focus({ preventScroll: true });
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
  if (f) font.set(f.getAttribute("data-set-font") ?? "serif");
  const g = el.closest("[data-set-goal]");
  if (g) {
    const unit = g.getAttribute("data-set-goal") ?? "off";
    if (unit !== goalUnit.get() && unit in GOAL_DEFAULTS) {
      goalTarget.set(String(GOAL_DEFAULTS[/** @type {keyof typeof GOAL_DEFAULTS} */ (unit)]));
    }
    goalUnit.set(unit);
  }
});

const settings = /** @type {HTMLDialogElement} */ ($("settings-dialog"));
$("settings-btn").addEventListener("click", () => settings.showModal());
$("settings-close").addEventListener("click", () => settings.close());
settings.addEventListener("close", () => {
  if (tab.get() === "write") lineEl.focus({ preventScroll: true });
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
