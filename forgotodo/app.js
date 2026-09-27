// Wiring. Everything app-shaped lives here in the open, rather than behind a
// lib -- this is the file you edit first, so it should be readable top to
// bottom with no indirection.

import { syncAppHeight } from "./lib/viewport.js";
import { theme, font, lists } from "./state.js";
import { Checklist, SETUP_STEPS } from "./components/checklist.js";
import { toBeamText, fromBeamText } from "./lib/beam.js";

// Components read their state from state.js, so defining them is the whole of
// it -- nothing to inject, nothing to sequence.
customElements.define("forgo-checklist", Checklist);

// First run: seed a few sample to-dos.
// A plain worked example of create() + append() -- read it, then delete it.
if (lists.getAll().length === 0) {
  const seeded = lists.ensureActive();
  lists.rename(seeded.id, "Unfiled");
  SETUP_STEPS.forEach((step) => lists.append(seeded.id, step));
} else {
  lists.ensureActive();
}

// ---- shell glue -----------------------------------------------------------
// Theme and font are just persisted scalars with a subscriber each. No
// lib needed; this is the whole of it.

theme.subscribe((v) => {
  document.documentElement.setAttribute("data-theme", v);
  syncChecked("[data-set-theme]", "data-set-theme", v);
});

font.subscribe((v) => {
  document.documentElement.setAttribute("data-font", v);
  syncChecked("[data-set-font]", "data-set-font", v);
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
  if (t) theme.set(t.getAttribute("data-set-theme") ?? "palm");
  const f = el.closest("[data-set-font]");
  if (f) font.set(f.getAttribute("data-set-font") ?? "pixel");
});

const settings = /** @type {HTMLDialogElement} */ (document.getElementById("settings-dialog"));
document.getElementById("settings-close")?.addEventListener("click", () => settings.close());

// ---- menu bar -------------------------------------------------------------
// Tapping the title tab opens the Palm menu bar, and the tab shows the time
// while it's open.

const titleBtn = /** @type {HTMLButtonElement} */ (document.getElementById("title-btn"));
const menubar = /** @type {HTMLElement} */ (document.getElementById("menubar"));
const scrim = /** @type {HTMLElement} */ (document.getElementById("menu-scrim"));
const TITLE = titleBtn.textContent ?? "";

/** @param {string} name */
function showMenu(name) {
  menubar.querySelectorAll("[data-menu]").forEach((b) => {
    b.setAttribute("aria-expanded", String(b.getAttribute("data-menu") === name));
  });
  menubar.querySelectorAll("[data-menu-items]").forEach((m) => {
    /** @type {HTMLElement} */ (m).hidden = m.getAttribute("data-menu-items") !== name;
  });
}

function openMenu() {
  showMenu("record");
  menubar.hidden = scrim.hidden = false;
  titleBtn.setAttribute("aria-expanded", "true");
  titleBtn.textContent = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  /** @type {HTMLElement|null} */ (menubar.querySelector('[role="menuitem"]'))?.focus();
}

function closeMenu() {
  menubar.hidden = scrim.hidden = true;
  titleBtn.setAttribute("aria-expanded", "false");
  titleBtn.textContent = TITLE;
}

titleBtn.addEventListener("click", () => (menubar.hidden ? openMenu() : closeMenu()));
scrim.addEventListener("click", closeMenu);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !menubar.hidden) closeMenu();
});

/** @type {Record<string, () => void>} */
const COMMANDS = {
  beam,
  receive: () => receiveDialog.showModal(),
  prefs: () => settings.showModal(),
};

menubar.addEventListener("click", (e) => {
  const el = e.target instanceof Element ? e.target : null;
  const title = el?.closest("[data-menu]");
  if (title) return showMenu(title.getAttribute("data-menu") ?? "record");
  const cmd = el?.closest("[data-cmd]")?.getAttribute("data-cmd");
  if (!cmd) return;
  closeMenu();
  COMMANDS[cmd]?.();
});

// ---- beam -----------------------------------------------------------------
// Plain text out through the share sheet (or the clipboard), plain text back
// in by pasting -- which makes it the backup too.

const beamDialog = /** @type {HTMLDialogElement} */ (document.getElementById("beam-dialog"));
const beamStatus = /** @type {HTMLElement} */ (document.getElementById("beam-status"));
const beamText = /** @type {HTMLTextAreaElement} */ (document.getElementById("beam-text"));
document.getElementById("beam-close")?.addEventListener("click", () => beamDialog.close());

async function beam() {
  const rec = lists.ensureActive();
  const text = toBeamText(rec.name, rec.items.map((i) => ({ text: i.text, done: !!i.done })));
  beamText.hidden = true;
  beamStatus.textContent = "Beaming…";
  beamDialog.showModal();

  // Called straight from the tap, before any await, so it keeps the user gesture.
  if (navigator.share) {
    try {
      await navigator.share({ title: "To Do List", text });
      beamDialog.close();
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        beamDialog.close();
        return;
      }
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    beamStatus.textContent = "Copied to the clipboard. Paste it anywhere to keep a copy.";
  } catch {
    beamStatus.textContent = "Copy this text to keep a copy:";
  }
  beamText.value = text;
  beamText.hidden = false;
}

const receiveDialog = /** @type {HTMLDialogElement} */ (document.getElementById("receive-dialog"));
const receiveForm = /** @type {HTMLFormElement} */ (document.getElementById("receive-form"));
const receiveInput = /** @type {HTMLTextAreaElement} */ (document.getElementById("receive-text"));
const receiveStatus = /** @type {HTMLElement} */ (document.getElementById("receive-status"));

receiveDialog.addEventListener("close", () => {
  receiveForm.reset();
  receiveStatus.textContent = "";
});
document.getElementById("receive-cancel")?.addEventListener("click", () => receiveDialog.close());

receiveForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const items = fromBeamText(receiveInput.value);
  if (items.length === 0) {
    receiveStatus.textContent = "Nothing to receive: no [ ] or [x] lines found.";
    return;
  }
  const rec = lists.ensureActive();
  items.forEach((item) => lists.append(rec.id, item));
  receiveDialog.close();
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
