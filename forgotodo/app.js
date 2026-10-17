// Wiring. Everything app-shaped lives here in the open, rather than behind a
// lib -- this is the file you edit first, so it should be readable top to
// bottom with no indirection.

import { syncAppHeight } from "./lib/viewport.js";
import { theme, mode, font, icons, fit, deskclock, flash, split, lists, syncs, remote } from "./state.js";
import { Checklist, SETUP_STEPS } from "./components/checklist.js";
import { toMarkdown, fromMarkdown } from "./lib/markdown.js";
import { FORGOTTEN, dayKey, forgetChanges, fastForwardChanges, isForgotten, isSnoozed, retryOf, withTier } from "./lib/forget.js";
import { sweepable, snoozed, recyclable, forgetSome, rememberSome, shakeUp } from "./lib/organize.js";
import { ICONS, bitmapSvg } from "./lib/icons.js";
import { preferredSize, largestFitting } from "./lib/fit.js";
import { UpdateToast } from "./components/update-toast.js";
import { PROVIDERS, RemoteStorageError, userAddress, discover, authorizeURL, fromRedirect, remoteStorage } from "./lib/remotestorage.js";
import { syncList } from "./lib/sync.js";

// Components read their state from state.js, so defining them is the whole of
// it -- nothing to inject, nothing to sequence.
customElements.define("forgo-checklist", Checklist);
customElements.define("update-toast", UpdateToast);
const checklist = /** @type {Checklist} */ (document.querySelector("forgo-checklist"));

// First run: seed a few sample to-dos (and show About, further down). Hold
// Help appends them again.
const firstRun = lists.getAll().length === 0;
function appendTutorial() {
  const rec = lists.ensureActive();
  SETUP_STEPS.forEach((step) => lists.append(rec.id, step));
}
if (firstRun) {
  lists.rename(lists.ensureActive().id, "Unfiled");
  appendTutorial();
} else {
  lists.ensureActive();
}

// ---- forgetting -----------------------------------------------------------
// Lazy: catch up on however many days have passed whenever the app is opened
// or comes back to the foreground. See lib/forget.js for the rules.

/** @param {import("./lib/forget.js").ForgetChange[]} changes */
function apply(changes) {
  const rec = lists.ensureActive();
  for (const c of changes) {
    if ("remove" in c) lists.removeItem(rec.id, c.id);
    else lists.updateItem(rec.id, c.id, c.patch);
  }
}

function forget() {
  apply(forgetChanges(/** @type {any} */ (lists.ensureActive().items), dayKey()));
}
forget();
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") forget();
});

/** The user just changed the active list; Sync will push it. */
const touched = () => syncs.markDirty(lists.ensureActive().id);

// ---- shell glue -----------------------------------------------------------
// Options are just persisted scalars with a subscriber each. No lib needed;
// this is the whole of it.

const root = document.documentElement;

// "backlight" used to be its own theme; it's palo alto in dark mode now.
if (theme.get() === "backlight") {
  theme.set("palo-alto");
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
for (const [name, value] of Object.entries({ icons, fit, deskclock, flash, split })) {
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

/** @param {Element} t a [data-set-theme] swatch */
function chooseTheme(t) {
  theme.set(t.getAttribute("data-set-theme") ?? "palo-alto");
  // Choosing a theme picks its font too; the Font row can still change it.
  const tf = t.getAttribute("data-theme-font");
  if (tf) font.set(tf);
}

// Hold Themes: any swatch but the current one.
function randomTheme() {
  const others = [...document.querySelectorAll("[data-set-theme]")].filter((t) => t.getAttribute("data-set-theme") !== theme.get());
  if (others.length) chooseTheme(others[Math.floor(Math.random() * others.length)]);
}

document.addEventListener("click", (e) => {
  const el = e.target instanceof Element ? e.target : null;
  if (!el) return;
  const t = el.closest("[data-set-theme]");
  if (t) chooseTheme(t);
  const m = el.closest("[data-set-mode]");
  if (m) mode.set(m.getAttribute("data-set-mode") ?? "light");
  const f = el.closest("[data-set-font]");
  if (f) font.set(f.getAttribute("data-set-font") ?? "sans");
});

const themes = /** @type {HTMLDialogElement} */ (document.getElementById("themes-dialog"));
document.getElementById("themes-close")?.addEventListener("click", () => themes.close());
const settings = /** @type {HTMLDialogElement} */ (document.getElementById("settings-dialog"));
document.getElementById("settings-close")?.addEventListener("click", () => settings.close());
const about = /** @type {HTMLDialogElement} */ (document.getElementById("about-dialog"));
document.getElementById("about-close")?.addEventListener("click", () => about.close());
const help = /** @type {HTMLDialogElement} */ (document.getElementById("help-dialog"));
document.getElementById("help-close")?.addEventListener("click", () => help.close());
if (firstRun) about.showModal();
// Hold About: write to the author.
const mailAuthor = () => (location.href = "mailto:dev@forgreatjustice.net");

// Share: the QR page (misc/qr/) encodes whatever ?q= holds.
const shareLink = /** @type {HTMLAnchorElement | null} */ (document.getElementById("share-link"));
if (shareLink) shareLink.search = new URLSearchParams({ q: new URL(".", location.href).href }).toString();

// Install: Chromium fires beforeinstallprompt when the app is installable; until then the
// hint is plain text (no href). Safari and Firefox never fire it.
const installLink = /** @type {HTMLAnchorElement | null} */ (document.getElementById("install-link"));
/** @type {any} */ let installPrompt = null;
addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
  installLink?.setAttribute("href", "#");
});
addEventListener("appinstalled", () => {
  installPrompt = null;
  installLink?.removeAttribute("href");
});
installLink?.addEventListener("click", async (e) => {
  e.preventDefault();
  if (!installPrompt) return;
  const p = installPrompt;
  installPrompt = null;
  installLink.removeAttribute("href");
  await p.prompt();
});

// ---- desktop --------------------------------------------------------------
// Tapping the title tab lays a desktop of command icons over the list, and the
// tab shows the time while it's open.

const titleBtn = /** @type {HTMLButtonElement} */ (document.getElementById("title-btn"));
const desktop = /** @type {HTMLElement} */ (document.getElementById("desktop"));
const TITLE = titleBtn.textContent ?? "";

function openDesktop() {
  desktop.hidden = false;
  titleBtn.setAttribute("aria-expanded", "true");
  titleBtn.textContent = deskclock.get() === "on" ?
    new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) :
    "forgotodo";
  /** @type {HTMLElement|null} */ (desktop.querySelector("[data-cmd]"))?.focus();
}

function closeDesktop() {
  const hadFocus = desktop.contains(document.activeElement);
  desktop.hidden = true;
  titleBtn.setAttribute("aria-expanded", "false");
  titleBtn.textContent = TITLE;
  if (hadFocus) titleBtn.focus();
}

titleBtn.addEventListener("click", () => {
  if (checklist.editArmed) checklist.cancelEdit();
  else if (desktop.hidden) openDesktop();
  else closeDesktop();
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!desktop.hidden) closeDesktop();
  else if (checklist.editArmed) checklist.cancelEdit();
});

// Edit mode: the tab says what the next tap does, and tapping it cancels.
checklist.addEventListener("edit-armed", (e) => {
  titleBtn.textContent = /** @type {CustomEvent} */ (e).detail ? "Edit: tap a to-do" : TITLE;
});

/** @type {Record<string, () => void>} */
const COMMANDS = {
  send,
  receive: () => receiveDialog.showModal(),
  sync: () => runSync(false),
  themes: () => themes.showModal(),
  prefs: () => settings.showModal(),
  help: () => help.showModal(),
  about: () => about.showModal(),
  sweep,
  lookahead,
  recycle,
  forget: forgetCmd,
  remember,
  edit: () => checklist.armEdit(),
  shake,
  fastforward: fastForward,
};

// An icon runs its command; a tap on bare desktop just closes it.
desktop.addEventListener("click", (e) => {
  const el = e.target instanceof Element ? e.target : null;
  const cmd = el?.closest("[data-cmd]")?.getAttribute("data-cmd");
  closeDesktop();
  if (cmd) COMMANDS[cmd]?.();
});

// Press and hold: an icon with data-hold-cmd runs that instead, once held for
// HOLD_MS. Letting go over the list ticks nothing: the click goes to the
// common ancestor of press and release (browser test "the release ticks
// nothing").
const HOLD_MS = 2000;
desktop.style.setProperty("--hold-ms", HOLD_MS + "ms");
/** @type {Record<string, () => void>} */
const HOLD_COMMANDS = {
  erase,
  rememberOne: () => remember("1"),
  forgetAll,
  themes: randomTheme,
  help: () => (appendTutorial(), touched()),
  about: mailAuthor,
  disconnect,
};

desktop.addEventListener("pointerdown", (e) => {
  const btn = e.target instanceof Element ? /** @type {HTMLElement|null} */ (e.target.closest("[data-hold-cmd]")) : null;
  const cmd = btn?.getAttribute("data-hold-cmd");
  if (!btn || !cmd) return;
  btn.dataset.holding = "";
  const stop = () => {
    clearTimeout(timer);
    delete btn.dataset.holding;
    for (const type of ["pointerup", "pointercancel", "pointerleave"]) btn.removeEventListener(type, stop);
  };
  const timer = setTimeout(() => {
    stop();
    closeDesktop();
    HOLD_COMMANDS[cmd]?.();
  }, HOLD_MS);
  for (const type of ["pointerup", "pointercancel", "pointerleave"]) btn.addEventListener(type, stop);
});
desktop.addEventListener("contextmenu", (e) => {
  if (e.target instanceof Element && e.target.closest("[data-hold-cmd]")) e.preventDefault();
});

// ---- send ---------------------------------------------------------------------
// Plain text out through the share sheet (or the clipboard), plain text back
// in by pasting -- which makes it the backup too.

const sendDialog = /** @type {HTMLDialogElement} */ (document.getElementById("send-dialog"));
const sendStatus = /** @type {HTMLElement} */ (document.getElementById("send-status"));
const sendText = /** @type {HTMLTextAreaElement} */ (document.getElementById("send-text"));
document.getElementById("send-close")?.addEventListener("click", () => sendDialog.close());

async function send() {
  const rec = lists.ensureActive();
  const text = toMarkdown(rec.name, rec.items.map((i) => ({ text: i.text, done: !!i.done })));
  sendText.hidden = true;
  sendStatus.textContent = "Sending…";
  sendDialog.showModal();

  // Called straight from the tap, before any await, so it keeps the user gesture.
  if (navigator.share) {
    try {
      await navigator.share({ title: "To Do List", text });
      sendDialog.close();
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        sendDialog.close();
        return;
      }
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    sendStatus.textContent = "Copied to the clipboard. Paste it anywhere to keep a copy.";
  } catch {
    sendStatus.textContent = "Copy this text to keep a copy:";
  }
  sendText.value = text;
  sendText.hidden = false;
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
  const items = fromMarkdown(receiveInput.value);
  if (items.length === 0) {
    receiveStatus.textContent = "Nothing to receive: no [ ] or [x] lines found.";
    return;
  }
  const rec = lists.ensureActive();
  const seenDay = dayKey();
  items.forEach((item) => lists.append(rec.id, { ...item, seenDay }));
  touched();
  receiveDialog.close();
});

// ---- organize -------------------------------------------------------------
// Sweep, Recycle and Fast Forward ask first in an alert box. Forget,
// Remember and Shake Up are random, and show you their work with a blink (or,
// for Forget, a poof).

const alertDialog = /** @type {HTMLDialogElement} */ (document.getElementById("alert-dialog"));
const alertTitle = /** @type {HTMLElement} */ (document.getElementById("alert-title"));
const alertIcon = /** @type {HTMLElement} */ (document.getElementById("alert-icon"));
const alertMsg = /** @type {HTMLElement} */ (document.getElementById("alert-msg"));
const alertList = /** @type {HTMLElement} */ (document.getElementById("alert-list"));
const alertOk = /** @type {HTMLElement} */ (document.getElementById("alert-ok"));
const alertOther = /** @type {HTMLElement} */ (document.getElementById("alert-other"));
const alertCancel = /** @type {HTMLElement} */ (document.getElementById("alert-cancel"));

/**
 * @typedef {{ title: string, icon: string, message: string, items?: string[], cancel?: boolean,
 *   labels?: { ok?: string, other?: string, cancel?: string } }} AlertOpts
 */

/**
 * Show the alert; resolves true on OK. With `cancel` false it's just a notice.
 * @param {AlertOpts} opts
 * @returns {Promise<boolean>}
 */
async function ask(opts) {
  return (await alertBox(opts)) === "ok";
}

/**
 * Show the alert; resolves the button's value: "ok", "cancel", or "other" for
 * a third button, shown only when `labels.other` names it. "" is Escape.
 * @param {AlertOpts} opts
 * @returns {Promise<string>}
 */
function alertBox({ title, icon, message, items = [], cancel = true, labels = {} }) {
  alertOk.textContent = labels.ok ?? "OK";
  alertOther.textContent = labels.other ?? "";
  alertOther.hidden = !labels.other;
  alertCancel.textContent = labels.cancel ?? "Cancel";
  alertTitle.textContent = title;
  // warn-ok: innerhtml-assign -- our own static bitmaps, no user text
  alertIcon.innerHTML = bitmapSvg(ICONS[icon]);
  alertMsg.textContent = message;
  alertList.replaceChildren(...items.map((text) => Object.assign(document.createElement("li"), { textContent: text })));
  alertCancel.hidden = !cancel;
  alertDialog.returnValue = "";
  alertDialog.showModal();
  return new Promise((resolve) => {
    alertDialog.addEventListener("close", () => resolve(alertDialog.returnValue), { once: true });
  });
}

/** @param {number} n */
const todos = (n) => (n === 1 ? "1 to-do" : `${n} to-dos`);

async function sweep() {
  const rec = lists.ensureActive();
  const doomed = sweepable(/** @type {any} */ (rec.items));
  if (doomed.length === 0) {
    await ask({ title: "Sweep", icon: "sweep", message: "Nothing forgotten.", cancel: false });
    return;
  }
  const ok = await ask({
    title: "Sweep",
    icon: "sweep",
    message: `Delete ${todos(doomed.length)} you've forgotten?`,
    items: doomed.map((i) => i.text),
  });
  if (!ok) return;
  doomed.forEach((i) => lists.removeItem(rec.id, i.id));
  touched();
}

// Look Ahead only shows: what's snoozed, soonest first.
async function lookahead() {
  const asleep = snoozed(/** @type {any} */ (lists.ensureActive().items));
  await ask({
    title: "Look Ahead",
    icon: "lookahead",
    message: asleep.length ? `${todos(asleep.length)} snoozed. Each day, one > comes off.` : "Nothing snoozed.",
    items: asleep.map((i) => i.text),
    cancel: false,
  });
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
  if (!ok) return;
  done.forEach((i) => lists.removeItem(rec.id, i.id));
  touched();
}

/** @param {string} id */
const rowOf = (id) => /** @type {HTMLElement|null} */ (checklist.querySelector(`li[data-id="${CSS.escape(id)}"]`));

// app.css drops the poof and blink under reduced motion; skip the wait too.
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

/**
 * Run a one-shot CSS animation on a row; data-anim names the keyframes.
 * Resolves when it ends, or straight away if the row isn't there.
 * @param {HTMLElement|null} row
 * @param {"blink"|"poof"} anim
 * @returns {Promise<void>}
 */
function animate(row, anim) {
  if (!row || reducedMotion.matches || (anim === "blink" && flash.get() === "off")) return Promise.resolve();
  row.dataset.anim = anim;
  return new Promise((resolve) => {
    const done = () => {
      // A newer animation may have replaced this one; leave it running.
      if (row.dataset.anim === anim) delete row.dataset.anim;
      resolve();
    };
    row.addEventListener("animationend", done, { once: true });
    setTimeout(done, 1000); // in case animations never run
  });
}

/** Blink the rows with these ids, once they've rendered. @param {string[]} ids */
async function blink(ids) {
  await checklist.updateComplete;
  const rows = ids.map(rowOf).filter((r) => r !== null);
  rows[0]?.scrollIntoView({ block: "nearest" });
  rows.forEach((r) => animate(r, "blink"));
}

const pickDialog = /** @type {HTMLDialogElement} */ (document.getElementById("pick-dialog"));
const pickTitle = /** @type {HTMLElement} */ (document.getElementById("pick-title"));
const pickInput = /** @type {HTMLInputElement} */ (document.getElementById("pick-text"));

/**
 * Ask Forget or Remember how many, or what. Resolves null unless OK (or
 * Enter) closed it, so Escape cancels.
 * @param {string} title
 * @returns {Promise<string|null>}
 */
function askPick(title) {
  pickTitle.textContent = title;
  pickInput.value = "";
  pickDialog.returnValue = "";
  pickDialog.showModal();
  return new Promise((resolve) => {
    pickDialog.addEventListener("close", () => resolve(pickDialog.returnValue === "ok" ? pickInput.value : null), { once: true });
  });
}

/** @param {string} query @param {string} none */
const nothingFor = (query, none) => (/\D/.test(query.trim()) ? `Nothing matches “${query.trim()}”.` : none);

// Forget is silent on purpose: rows puff away and, unless you named them,
// you aren't told which. Hold Forget: every to-do still on the list.
async function forgetCmd() {
  const query = await askPick("Forget");
  if (query !== null) forgetBy(query);
}
function forgetAll() {
  forgetBy(String(lists.ensureActive().items.length));
}

/** @param {string} query */
async function forgetBy(query) {
  const rec = lists.ensureActive();
  const changes = forgetSome(/** @type {any} */ (rec.items), query);
  if (changes.length === 0) {
    await ask({ title: "Forget", icon: "forget", message: nothingFor(query, "Nothing left to forget."), cancel: false });
    return;
  }
  await Promise.all(changes.map((c) => animate(rowOf(c.id), "poof")));
  changes.forEach((c) => lists.updateItem(rec.id, c.id, { text: c.text }));
  touched();
}

// Held, it skips the prompt and remembers one.
/** @param {string} [held] */
async function remember(held) {
  const query = held ?? (await askPick("Remember"));
  if (query === null) return;
  const rec = lists.ensureActive();
  const changes = rememberSome(/** @type {any} */ (rec.items), query);
  if (changes.length === 0) {
    await ask({ title: "Remember", icon: "remember", message: nothingFor(query, "Nothing's forgotten."), cancel: false });
    return;
  }
  changes.forEach((c) => lists.updateItem(rec.id, c.id, { text: c.text }));
  touched();
  blink(changes.map((c) => c.id));
}

function shake() {
  const rec = lists.ensureActive();
  const moved = shakeUp(/** @type {any} */ (rec.items));
  moved.forEach((m) => lists.updateItem(rec.id, m.id, { text: m.text }));
  if (moved.length) touched();
  /** @param {string} move */
  const n = (move) => moved.filter((m) => m.move === move).length;
  const parts = [`${n("up")} up`, `${n("down")} down`];
  if (n("forgotten")) parts.push(`${n("forgotten")} forgotten`);
  if (n("remembered")) parts.push(`${n("remembered")} remembered`);
  checklist.note(moved.length ? parts.join(" · ") : "Nothing moved.");
  blink(moved.filter((m) => m.move !== "forgotten").map((m) => m.id));
}

// A day's rollover on demand. Day stamps stay put, so it's an extra day: the
// real one still comes tonight.
async function fastForward() {
  const rec = lists.ensureActive();
  const changes = fastForwardChanges(/** @type {any} */ (rec.items));
  if (changes.length === 0) {
    await ask({ title: "Fast Forward", icon: "fastforward", message: "Nothing would change.", cancel: false });
    return;
  }
  const asleep = new Set(rec.items.filter((i) => isSnoozed(i.text)).map((i) => i.id));
  const texts = changes.flatMap((c) => ("patch" in c && c.patch.text && !asleep.has(c.id) ? [c.patch.text] : []));
  const ticked = changes.filter((c) => "patch" in c && asleep.has(c.id)).length;
  const lost = texts.filter(isForgotten).length;
  const dropped = texts.length - lost;
  const cleared = changes.length - texts.length - ticked;
  const parts = [];
  if (dropped) parts.push(`${todos(dropped)} drop a tier`);
  if (ticked) parts.push(`${ticked} snoozed a day closer`);
  if (lost) parts.push(`${lost} forgotten`);
  if (cleared) parts.push(`${cleared} done cleared`);
  const ok = await ask({
    title: "Fast Forward",
    icon: "fastforward",
    message: `Tomorrow's list, today: ${parts.join(", ")}. Go ahead?`,
  });
  if (!ok) return;
  apply(changes);
  touched();
}

// ---- hold a to-do ----------------------------------------------------------
// Abort, Retry, Fail? Avert forgets; Retry snoozes a day and wakes neutral;
// Free deletes; Cancel leaves it be.

const dosDialog = /** @type {HTMLDialogElement} */ (document.getElementById("dos-dialog"));
const dosTitle = /** @type {HTMLElement} */ (document.getElementById("dos-title"));

checklist.addEventListener("row-hold", (e) => {
  const id = /** @type {CustomEvent<string>} */ (e).detail;
  const rec = lists.ensureActive();
  const item = rec.items.find((i) => i.id === id);
  if (!item) return;
  dosTitle.textContent = item.text;
  dosDialog.returnValue = "";
  dosDialog.showModal();
  dosDialog.addEventListener("close", async () => {
    if (["avert", "retry", "free"].includes(dosDialog.returnValue)) touched();
    if (dosDialog.returnValue === "avert") {
      await animate(rowOf(id), "poof");
      lists.updateItem(rec.id, id, { text: withTier(item.text, FORGOTTEN) });
    } else if (dosDialog.returnValue === "retry") {
      lists.updateItem(rec.id, id, { text: retryOf(item.text), done: false, doneDay: null, seenDay: dayKey() });
      checklist.note("Snoozed till tomorrow.");
    } else if (dosDialog.returnValue === "free") {
      await animate(rowOf(id), "poof");
      lists.removeItem(rec.id, id);
    }
  }, { once: true });
});

// ---- sync -----------------------------------------------------------------
// Record > Sync pushes, pulls or asks; opening the app pulls when it can do so
// without losing anything. The rules are in lib/sync.js, the protocol in
// lib/remotestorage.js. The first press connects: off to the storage's sign-in
// page, and back with a token in the fragment.

const connectDialog = /** @type {HTMLDialogElement} */ (document.getElementById("connect-dialog"));
const connectForm = /** @type {HTMLFormElement} */ (document.getElementById("connect-form"));
const connectInput = /** @type {HTMLInputElement} */ (document.getElementById("connect-address"));
const connectStatus = /** @type {HTMLElement} */ (document.getElementById("connect-status"));
const provider = PROVIDERS[0];
connectInput.placeholder = `you@${provider.domain}`;
document.getElementById("connect-signup")?.setAttribute("href", provider.signup);
connectDialog.addEventListener("close", () => {
  connectForm.reset();
  connectStatus.textContent = "";
});
document.getElementById("connect-cancel")?.addEventListener("click", () => connectDialog.close());

/** @returns {import("./lib/remotestorage.js").Connection|null} */
function connection() {
  try {
    const c = JSON.parse(remote.get() || "null");
    return c?.href ? c : null;
  } catch {
    return null;
  }
}

connectForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  connectStatus.textContent = "Looking it up…";
  try {
    const conn = await discover(userAddress(connectInput.value, provider));
    remote.set(JSON.stringify(conn));
    location.assign(authorizeURL({ authURL: conn.authURL, scope: "forgotodo:rw", redirectUri: location.origin + location.pathname }));
  } catch (err) {
    connectStatus.textContent = err instanceof Error ? err.message : String(err);
  }
});

/** @type {Record<import("./lib/sync.js").Outcome, string>} */
const SYNCED = {
  "in-sync": "Already in sync.",
  pulled: "Synced: got the other device's list.",
  pushed: "Synced: sent this list.",
  kept: "Left as is. Sync again to choose.",
  raced: "Another device just synced. Sync again.",
  skipped: "",
};

let syncing = false;

/** @param {boolean} quiet the check on open: pull if clean, else say nothing */
async function runSync(quiet) {
  const conn = connection();
  if (!conn?.token) {
    if (!quiet) connectDialog.showModal();
    return;
  }
  if (syncing) return;
  syncing = true;
  const rec = lists.ensureActive();
  try {
    const outcome = await syncList({
      client: remoteStorage(conn),
      ledger: syncs,
      id: rec.id,
      read: () => lists.get(rec.id),
      write: (doc) => {
        lists.clearItems(rec.id);
        doc.items.forEach((/** @type {Object} */ item) => lists.append(rec.id, item));
        forget(); // the other device may not have caught up today
      },
      choose: async () => {
        const v = await alertBox({
          title: "Sync",
          icon: "sync",
          message: "This list changed here and on another device. Keep which one?",
          labels: { ok: "This device", other: "Other device", cancel: "Neither" },
        });
        return v === "ok" ? "this" : v === "other" ? "other" : "neither";
      },
      quiet,
    });
    if (SYNCED[outcome]) checklist.note(SYNCED[outcome]);
  } catch (err) {
    if (quiet) return;
    const status = err instanceof RemoteStorageError ? err.status : -1;
    const signedOut = status === 401 || status === 403;
    if (signedOut) remote.set(JSON.stringify({ ...conn, token: undefined }));
    const message =
      status === 0 ? "Couldn't reach your storage. Offline?" :
      signedOut ? "Your storage signed this device out. Sync again to reconnect." :
      err instanceof Error ? err.message : String(err);
    await ask({ title: "Sync", icon: "sync", message, cancel: false });
  } finally {
    syncing = false;
  }
}

// Hold Sync: forget the connection and every list's base, so the next Sync
// connects afresh. The list itself stays.
async function disconnect() {
  const conn = connection();
  if (!conn) {
    await ask({ title: "Disconnect", icon: "sync", message: "Sync isn't connected.", cancel: false });
    return;
  }
  const ok = await ask({
    title: "Disconnect",
    icon: "sync",
    message: `Stop syncing with ${conn.address}? This list stays on this device.`,
  });
  if (!ok) return;
  remote.set("");
  syncs.clear();
  checklist.note("Disconnected.");
}

// Back from the sign-in page: keep the token, tidy the URL, and sync.
const redirect = fromRedirect(location.hash);
if (redirect) {
  history.replaceState(null, "", location.pathname + location.search);
  const conn = connection();
  if ("token" in redirect && conn) {
    remote.set(JSON.stringify({ ...conn, token: redirect.token }));
    runSync(false);
  } else {
    const why = "error" in redirect ? redirect.error : "start again from Sync";
    ask({ title: "Sync", icon: "sync", message: `Not connected: ${why}.`, cancel: false });
  }
} else {
  runSync(true);
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") runSync(true);
});

// ---- erase ----------------------------------------------------------------
// Hold Recycle: asks three times, then empties the list. Settings stay, and
// it's no first run: no tutorial, no About.

async function erase() {
  const steps = [
    { title: "Erase", message: "Erase every to-do on this list? Settings stay." },
    { title: "Erase", message: "Really? There's no undo. Send your list first if you want a copy." },
    { title: "Erase", message: "Last chance: erase every to-do?" },
  ];
  for (const step of steps) {
    if (!(await ask({ ...step, icon: "forget" }))) return;
  }
  lists.clearItems(lists.ensureActive().id);
  touched();
}

// ---- shrink to fit --------------------------------------------------------
// Sets --list-size on the checklist: big for a short list, smaller per to-do,
// then as small as it takes (to a floor) for the whole panel to fit unscrolled.

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

  // Updates: the toast checks for them on every launch and resume.
  document.body.append(new UpdateToast());
}
