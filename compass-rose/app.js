// Wiring. Everything app-shaped lives here in the open, rather than behind a
// lib -- this is the file you edit first, so it should be readable top to
// bottom with no indirection.

import { syncAppHeight } from "./lib/viewport.js";
import { theme, font, motion, tab, toolkitRecord } from "./state.js";
import { Tabs } from "./components/tabs.js";
import { CompassRose } from "./components/compass-rose.js";
import { RecordView } from "./components/record-view.js";
import { RecordList } from "./components/record-list.js";
import { ToolkitList } from "./components/toolkit-list.js";
import { UpdateToast } from "./components/update-toast.js";

// First run: offer the toolkit's neutral starters. Before the components, so
// they read a seeded toolkit.
toolkitRecord();

// Components read their state from state.js, so defining them is the whole of
// it -- nothing to inject, nothing to sequence.
customElements.define("cr-tabs", Tabs);
customElements.define("compass-rose", CompassRose);
customElements.define("record-view", RecordView);
customElements.define("record-list", RecordList);
customElements.define("toolkit-list", ToolkitList);
customElements.define("update-toast", UpdateToast);

// ---- shell glue -----------------------------------------------------------
// Theme, font and tab are just persisted scalars with a subscriber each.

const themeColor = document.querySelector('meta[name="theme-color"]');
const syncThemeColor = () => {
  const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
  if (bg && themeColor) themeColor.setAttribute("content", bg);
};
matchMedia("(prefers-color-scheme: light)").addEventListener("change", syncThemeColor);

theme.subscribe((v) => {
  document.documentElement.setAttribute("data-theme", v);
  syncChecked("[data-set-theme]", "data-set-theme", v);
  syncThemeColor();
});

font.subscribe((v) => {
  document.documentElement.setAttribute("data-font", v);
  syncChecked("[data-set-font]", "data-set-font", v);
});

// Motion: one switch for every transition in app.css, which all live under
// :root[data-moving]. "auto" follows the device and keeps following it.
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const syncMotion = () => {
  const v = motion.get();
  const moving = v === "unfurl" || (v !== "still" && !reduceMotion.matches);
  document.documentElement.toggleAttribute("data-moving", moving);
  syncChecked("[data-set-motion]", "data-set-motion", v);
};
reduceMotion.addEventListener("change", syncMotion);
motion.subscribe(syncMotion);

tab.subscribe((v) => {
  // A tab id from an older version (or a typo) falls back to the list.
  if (!document.querySelector(`.panel[data-panel="${v}"]`)) return tab.set("records");
  document.querySelectorAll(".panel").forEach((p) => {
    p.classList.toggle("active", p.getAttribute("data-panel") === v);
  });
  document.querySelectorAll("cr-tabs [data-tab]").forEach((b) => {
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
  if (t) theme.set(t.getAttribute("data-set-theme") ?? "auto");
  const f = el.closest("[data-set-font]");
  if (f) font.set(f.getAttribute("data-set-font") ?? "serif");
  const m = el.closest("[data-set-motion]");
  if (m) motion.set(m.getAttribute("data-set-motion") ?? "auto");
});

const settings = /** @type {HTMLDialogElement} */ (document.getElementById("settings-dialog"));
document.getElementById("settings-btn")?.addEventListener("click", () => settings.showModal());
document.getElementById("settings-close")?.addEventListener("click", () => settings.close());

// Share: the QR page (misc/qr/) encodes whatever ?q= holds. Only opened if tapped.
const shareLink = /** @type {HTMLAnchorElement | null} */ (document.getElementById("share-link"));
if (shareLink) shareLink.search = new URLSearchParams({ q: new URL(".", location.href).href }).toString();

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

  // Updates: the toast checks for them on every launch and resume. It won't
  // reload under you while a line is half-typed.
  const toast = new UpdateToast();
  toast.idle = () => {
    const active = document.activeElement;
    return !(active instanceof HTMLInputElement && active.value.trim());
  };
  document.body.append(toast);
}
