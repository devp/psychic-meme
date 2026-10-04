// Wiring. Everything app-shaped lives here in the open, rather than behind a
// lib -- this is the file you edit first, so it should be readable top to
// bottom with no indirection.

import { syncAppHeight } from "./lib/viewport.js";
import { theme, mode, font, icons, fit, lists } from "./state.js";
import { Checklist, SETUP_STEPS } from "./components/checklist.js";
import { toBeamText, fromBeamText } from "./lib/beam.js";
import { dayKey, forgetChanges } from "./lib/forget.js";
import { sweepable, recyclable, forgetOne, rememberOne } from "./lib/organize.js";
import { ICONS, bitmapSvg } from "./lib/icons.js";
import { preferredSize, largestFitting } from "./lib/fit.js";

// Components read their state from state.js, so defining them is the whole of
// it -- nothing to inject, nothing to sequence.
customElements.define("forgo-checklist", Checklist);

// First run: seed a few sample to-dos.
if (lists.getAll().length === 0) {
  const seeded = lists.ensureActive();
  lists.rename(seeded.id, "Unfiled");
  SETUP_STEPS.forEach((step) => lists.append(seeded.id, step));
} else {
  lists.ensureActive();
}

// ---- forgetting -----------------------------------------------------------
// Lazy: catch up on however many days have passed whenever the app is opened
// or comes back to the foreground. See lib/forget.js for the rules.

function forget() {
  const rec = lists.ensureActive();
  for (const c of forgetChanges(/** @type {any} */ (rec.items), dayKey())) {
    if ("remove" in c) lists.removeItem(rec.id, c.id);
    else lists.updateItem(rec.id, c.id, c.patch);
  }
}
forget();
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") forget();
});

// ---- shell glue -----------------------------------------------------------
// Options are just persisted scalars with a subscriber each. No lib needed;
// this is the whole of it.

const root = document.documentElement;

// "backlight" used to be its own theme; it's palm in dark mode now.
if (theme.get() === "backlight") {
  theme.set("palm");
  mode.set("dark");
}

theme.subscribe((v) => {
  root.setAttribute("data-theme", v);
  syncChecked("[data-set-theme]", "data-set-theme", v);
  syncThemeColor();
});

// Every theme has a light and a dark scheme; mode picks one, or follows the
// system. Keep in step with the pre-paint script in index.html.
const darkQuery = matchMedia("(prefers-color-scheme: dark)");
function applyScheme() {
  const m = mode.get();
  const dark = m === "dark" || (m === "system" && darkQuery.matches);
  root.setAttribute("data-scheme", dark ? "dark" : "light");
  syncThemeColor();
}
mode.subscribe((v) => {
  syncChecked("[data-set-mode]", "data-set-mode", v);
  applyScheme();
});
darkQuery.addEventListener("change", applyScheme);

/** The browser chrome matches the screen. */
function syncThemeColor() {
  const bg = getComputedStyle(root).getPropertyValue("--bg").trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg);
}

font.subscribe((v) => {
  root.setAttribute("data-font", v);
  syncChecked("[data-set-font]", "data-set-font", v);
});

// On/off options: a checkbox each in Options, a data- attribute on <html>.
for (const [name, value] of Object.entries({ icons, fit })) {
  const box = /** @type {HTMLInputElement|null} */ (document.querySelector(`[data-toggle="${name}"]`));
  box?.addEventListener("change", () => value.set(box.checked ? "on" : "off"));
  value.subscribe((v) => {
    root.setAttribute("data-" + name, v);
    if (box) box.checked = v === "on";
  });
}

// Pixel icons go in once; the icons option only shows or hides them.
document.querySelectorAll("[data-icon]").forEach((el) => {
  const rows = ICONS[el.getAttribute("data-icon") ?? ""];
  if (rows) el.insertAdjacentHTML("afterbegin", bitmapSvg(rows));
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
  const m = el.closest("[data-set-mode]");
  if (m) mode.set(m.getAttribute("data-set-mode") ?? "light");
  const f = el.closest("[data-set-font]");
  if (f) font.set(f.getAttribute("data-set-font") ?? "pixel");
});

const settings = /** @type {HTMLDialogElement} */ (document.getElementById("settings-dialog"));
document.getElementById("settings-close")?.addEventListener("click", () => settings.close());

// Share: the QR page (misc/qr/) encodes whatever ?q= holds.
const shareLink = /** @type {HTMLAnchorElement | null} */ (document.getElementById("share-link"));
if (shareLink) shareLink.search = new URLSearchParams({ q: new URL(".", location.href).href }).toString();

// ---- desktop --------------------------------------------------------------
// Tapping the title tab lays a desktop of command icons over the list, and the
// tab shows the time while it's open.

const titleBtn = /** @type {HTMLButtonElement} */ (document.getElementById("title-btn"));
const desktop = /** @type {HTMLElement} */ (document.getElementById("desktop"));
const TITLE = titleBtn.textContent ?? "";

function openDesktop() {
  desktop.hidden = false;
  titleBtn.setAttribute("aria-expanded", "true");
  titleBtn.textContent = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  /** @type {HTMLElement|null} */ (desktop.querySelector("[data-cmd]"))?.focus();
}

function closeDesktop() {
  const hadFocus = desktop.contains(document.activeElement);
  desktop.hidden = true;
  titleBtn.setAttribute("aria-expanded", "false");
  titleBtn.textContent = TITLE;
  if (hadFocus) titleBtn.focus();
}

titleBtn.addEventListener("click", () => (desktop.hidden ? openDesktop() : closeDesktop()));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !desktop.hidden) closeDesktop();
});

/** @type {Record<string, () => void>} */
const COMMANDS = {
  beam,
  receive: () => receiveDialog.showModal(),
  prefs: () => settings.showModal(),
  sweep,
  recycle,
  forget: () => nudge("forget"),
  remember: () => nudge("remember"),
};

// An icon runs its command; a tap on bare desktop just closes it.
desktop.addEventListener("click", (e) => {
  const el = e.target instanceof Element ? e.target : null;
  const cmd = el?.closest("[data-cmd]")?.getAttribute("data-cmd");
  closeDesktop();
  if (cmd) COMMANDS[cmd]?.();
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
  const seenDay = dayKey();
  items.forEach((item) => lists.append(rec.id, { ...item, seenDay }));
  receiveDialog.close();
});

// ---- organize -------------------------------------------------------------
// Sweep and Recycle delete, so they ask first, Palm-alert style. Forget and
// Remember are one random step each way, and blink the row they touched.

const alertDialog = /** @type {HTMLDialogElement} */ (document.getElementById("alert-dialog"));
const alertTitle = /** @type {HTMLElement} */ (document.getElementById("alert-title"));
const alertIcon = /** @type {HTMLElement} */ (document.getElementById("alert-icon"));
const alertMsg = /** @type {HTMLElement} */ (document.getElementById("alert-msg"));
const alertList = /** @type {HTMLElement} */ (document.getElementById("alert-list"));
const alertCancel = /** @type {HTMLElement} */ (document.getElementById("alert-cancel"));

/**
 * Show the alert; resolves true on OK. With `cancel` false it's just a notice.
 * @param {{ title: string, icon: string, message: string, items?: string[], cancel?: boolean }} opts
 * @returns {Promise<boolean>}
 */
function ask({ title, icon, message, items = [], cancel = true }) {
  alertTitle.textContent = title;
  // warn-ok: innerhtml-assign -- our own static bitmaps, no user text
  alertIcon.innerHTML = bitmapSvg(ICONS[icon]);
  alertMsg.textContent = message;
  alertList.replaceChildren(...items.map((text) => Object.assign(document.createElement("li"), { textContent: text })));
  alertCancel.hidden = !cancel;
  alertDialog.returnValue = "";
  alertDialog.showModal();
  return new Promise((resolve) => {
    alertDialog.addEventListener("close", () => resolve(alertDialog.returnValue === "ok"), { once: true });
  });
}

/** @param {number} n */
const todos = (n) => (n === 1 ? "1 to-do" : `${n} to-dos`);

async function sweep() {
  const rec = lists.ensureActive();
  const doomed = sweepable(/** @type {any} */ (rec.items));
  if (doomed.length === 0) {
    await ask({ title: "Sweep", icon: "sweep", message: "Nothing to sweep.", cancel: false });
    return;
  }
  const all = doomed.length === rec.items.filter((i) => !i.done).length;
  const ok = await ask({
    title: "Sweep",
    icon: "sweep",
    message: all
      ? `They're all equally urgent. Delete all ${todos(doomed.length)}?`
      : `Delete the ${todos(doomed.length)} at the lowest priority?`,
    items: doomed.map((i) => i.text),
  });
  if (ok) doomed.forEach((i) => lists.removeItem(rec.id, i.id));
}

async function recycle() {
  const rec = lists.ensureActive();
  const done = recyclable(/** @type {any} */ (rec.items));
  if (done.length === 0) {
    await ask({ title: "Recycle", icon: "recycle", message: "Nothing's done yet.", cancel: false });
    return;
  }
  const ok = await ask({
    title: "Recycle",
    icon: "recycle",
    message: `Delete ${todos(done.length)} you've finished? (They'd go tomorrow anyway.)`,
    items: done.map((i) => i.text),
  });
  if (ok) done.forEach((i) => lists.removeItem(rec.id, i.id));
}

/** @param {"forget"|"remember"} which */
async function nudge(which) {
  const rec = lists.ensureActive();
  const change = (which === "forget" ? forgetOne : rememberOne)(/** @type {any} */ (rec.items));
  if (!change) {
    await ask({
      title: which === "forget" ? "Forget" : "Remember",
      icon: which,
      message: which === "forget" ? "Everything open is already forgotten." : "Nothing open to remember.",
      cancel: false,
    });
    return;
  }
  lists.updateItem(rec.id, change.id, { text: change.text });
  await checklist.updateComplete;
  const row = /** @type {HTMLElement|null} */ (checklist.querySelector(`li[data-id="${CSS.escape(change.id)}"]`));
  if (!row) return;
  row.scrollIntoView({ block: "nearest" });
  row.dataset.flash = which;
  row.addEventListener("animationend", () => delete row.dataset.flash, { once: true });
}

// ---- shrink to fit --------------------------------------------------------
// Sets --list-size on the checklist: big for a short list, smaller per to-do,
// then as small as it takes (to a floor) for the whole panel to fit unscrolled.

const checklist = /** @type {Checklist} */ (document.querySelector("forgo-checklist"));
const panel = /** @type {HTMLElement} */ (document.querySelector('[data-panel="list"]'));
// The panel's height with the keyboard down. Fitting to the keyboard-up height
// would shrink everything each time you start typing.
let roomy = 0;

async function refit() {
  if (fit.get() !== "on") {
    checklist.style.removeProperty("--list-size");
    return;
  }
  await checklist.updateComplete;
  const typing = document.activeElement?.closest(".add-row");
  if (!typing || !roomy) roomy = panel.clientHeight;
  const n = checklist.querySelectorAll(".checklist li").length;
  largestFitting(preferredSize(n), (px) => {
    checklist.style.setProperty("--list-size", px + "px");
    return panel.scrollHeight <= roomy;
  });
}

lists.subscribe(refit);
fit.subscribe(refit);
font.subscribe(refit);
document.fonts.ready.then(refit);
new ResizeObserver(refit).observe(panel);

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

  // Updates. sw.js answers "updated" once new files are in its cache; this page
  // is still running the old ones. Reload the next time the app comes back to
  // the foreground -- never while it's in use, so nobody loses half-typed text.
  // A new sw.js taking over counts too (it re-downloaded everything on
  // install), but not the very first one, which replaced no worker.
  const sw = navigator.serviceWorker;
  let updated = false;
  const hadWorker = !!sw.controller;
  sw.addEventListener("message", (e) => (updated ||= e.data === "updated"));
  sw.addEventListener("controllerchange", () => (updated ||= hadWorker));

  const check = () => sw.ready.then((reg) => reg.active?.postMessage("check"));
  check();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (updated) location.reload();
    else check();
  });
}
