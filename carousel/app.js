// Wiring. Everything app-shaped lives here in the open, rather than behind a
// lib -- this is the file you edit first, so it should be readable top to
// bottom with no indirection.

import { syncAppHeight } from "./lib/viewport.js";
import { theme, modes, cards, addCard, patchCard, removeCard, deck } from "./state.js";
import { parseShare, platformOf, frameUrl, hostOf } from "./lib/deck.js";
import { DeckView } from "./components/deck-view.js";
import { Reader } from "./components/reader.js";
import { CardEditor } from "./components/card-editor.js";
import { UpdateToast } from "./components/update-toast.js";

customElements.define("cr-deck", DeckView);
customElements.define("cr-reader", Reader);
customElements.define("cr-editor", CardEditor);
customElements.define("update-toast", UpdateToast);

const deckEl = /** @type {DeckView} */ (document.querySelector("cr-deck"));
const reader = /** @type {Reader} */ (document.querySelector("cr-reader"));
const editor = /** @type {CardEditor} */ (document.querySelector("cr-editor"));

/** @typedef {import("./lib/deck.js").Card} Card */

// ---- share target ---------------------------------------------------------
// manifest.webmanifest's share_target opens ./?title=&text=&url=.

/** @param {{ url: string, description: string }} link */
function add(link) {
  const dupe = cards().find((c) => c.url === link.url);
  if (dupe) return toast(dupe.readAt ? "already in the deck (read)" : "already in the deck");
  const card = addCard(link);
  toast("added: " + (link.description || hostOf(link.url)));
  if (!link.description) lookUpTitle(card);
}

/**
 * Fill in a card's description from its title, if it's still blank by then.
 * @param {Card} card
 */
async function lookUpTitle(card) {
  patchCard(card.id, { titleTriedAt: Date.now() });
  const title = await fetchTitle(card.url);
  if (title && !cards().find((c) => c.id === card.id)?.description) patchCard(card.id, { description: title });
}

// Retry cards still without a title -- shared offline, or the lookup had
// nothing then -- once a day each, on launch and when the network comes back.
// Opening one (below) retries it right away.
const DAY = 86400_000;
async function retryTitles() {
  if (!navigator.onLine) return;
  const due = cards().filter((c) => !c.description && Date.now() - (c.titleTriedAt ?? 0) > DAY);
  for (const c of due) await lookUpTitle(c);
}
window.addEventListener("online", retryTitles);

/**
 * The page title, via noembed.com: a public oEmbed proxy that sends CORS
 * headers (checked 2026-10-17), which the sites themselves don't. Covers
 * YouTube and many others; Instagram and Facebook need an app token, so those
 * keep whatever the share sheet sent.
 * @param {string} url
 * @returns {Promise<string>}
 */
async function fetchTitle(url) {
  try {
    const res = await fetch("https://noembed.com/embed?url=" + encodeURIComponent(url), { signal: AbortSignal.timeout(8000) });
    const json = await res.json();
    return typeof json.title === "string" ? json.title.trim() : "";
  } catch {
    return "";
  }
}

const shared = parseShare(new URLSearchParams(location.search));
if (location.search) history.replaceState(null, "", location.pathname);
if (shared) add(shared);
retryTitles();

// ---- reading --------------------------------------------------------------

deckEl.addEventListener("read", (e) => {
  const card = /** @type {Card} */ (/** @type {CustomEvent} */ (e).detail);
  if (!card.readAt) patchCard(card.id, { readAt: Date.now() });
  if (!card.description) lookUpTitle(card);
  const src = frameUrl(card.url, modes.get()[platformOf(card.url)] ?? "page");
  if (src) reader.show(src, card.url, card.description || hostOf(card.url));
  else window.open(card.url, "_blank", "noopener");
});

deckEl.addEventListener("edit", (e) => editor.edit(/** @type {CustomEvent} */ (e).detail));

document.getElementById("spin-btn")?.addEventListener("click", () => deckEl.spin());

document.addEventListener("keydown", (e) => {
  if (document.querySelector("dialog[open]") || (e.target instanceof Element && e.target.closest("textarea, input, select"))) return;
  const card = deckEl.current();
  /** @type {Record<string, () => void>} */
  const keys = {
    ArrowLeft: () => deckEl.step(-1),
    ArrowRight: () => deckEl.step(1),
    ArrowUp: () => deckEl.changeLane(-1),
    ArrowDown: () => deckEl.changeLane(1),
    Enter: () => card && deckEl.fire("read", card),
    e: () => card && deckEl.fire("edit", card),
    s: () => deckEl.spin(),
    r: () => deckEl.toggleShow(),
  };
  if (keys[e.key]) {
    e.preventDefault();
    keys[e.key]();
  }
});

// ---- toast ----------------------------------------------------------------

/** @param {string} text */
function toast(text) {
  const el = document.createElement("div");
  el.className = "toast window";
  el.setAttribute("role", "status");
  el.textContent = text;
  document.body.append(el);
  setTimeout(() => el.remove(), 3000);
}

// ---- options --------------------------------------------------------------

theme.subscribe((v) => {
  document.documentElement.setAttribute("data-theme", v);
  syncChecked("[data-set-theme]", "data-set-theme", v);
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
  const t = e.target instanceof Element ? e.target.closest("[data-set-theme]") : null;
  if (t) theme.set(t.getAttribute("data-set-theme") ?? "dulles");
});

// Render mode per platform: <select data-mode="youtube"> etc.
modes.subscribe((m) => {
  document.querySelectorAll("select[data-mode]").forEach((s) => {
    const sel = /** @type {HTMLSelectElement} */ (s);
    sel.value = m[sel.dataset.mode ?? ""] ?? "embed";
  });
});
document.querySelectorAll("select[data-mode]").forEach((s) =>
  s.addEventListener("change", () => {
    const sel = /** @type {HTMLSelectElement} */ (s);
    modes.set({ ...modes.get(), [sel.dataset.mode ?? ""]: /** @type {any} */ (sel.value) });
  })
);

document.getElementById("add-form")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const input = /** @type {HTMLInputElement} */ (document.getElementById("add-url"));
  const link = parseShare(new URLSearchParams({ text: input.value }));
  if (!link) return toast("no link in that");
  add(link);
  input.value = "";
});

/**
 * @param {string} name
 * @param {Card[]} list
 */
function download(name, list) {
  const body = JSON.stringify({ app: "carousel", exportedAt: new Date().toISOString(), cards: list }, null, 2);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([body], { type: "application/json" }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);
document.getElementById("export-all")?.addEventListener("click", () => download(`carousel-${stamp()}.json`, cards()));
document.getElementById("export-read")?.addEventListener("click", () =>
  download(`carousel-read-${stamp()}.json`, cards().filter((c) => c.readAt))
);

// Delete read: the first tap asks, a second within 4s deletes.
const deleteRead = /** @type {HTMLButtonElement} */ (document.getElementById("delete-read"));
let armed = 0;
deleteRead.addEventListener("click", () => {
  const read = cards().filter((c) => c.readAt);
  if (!read.length) return toast("nothing read yet");
  if (Date.now() - armed > 4000) {
    armed = Date.now();
    deleteRead.textContent = `really delete ${read.length} read?`;
    setTimeout(() => (deleteRead.textContent = "delete read"), 4000);
    return;
  }
  armed = 0;
  read.forEach((c) => removeCard(c.id));
  deleteRead.textContent = "delete read";
  toast(`deleted ${read.length}`);
});

const paintCounts = () => {
  const all = cards();
  const el = document.getElementById("deck-counts");
  if (el) el.textContent = `${all.length} cards, ${all.filter((c) => c.readAt).length} read`;
};
deck.subscribe(paintCounts);
paintCounts();

const settings = /** @type {HTMLDialogElement} */ (document.getElementById("settings-dialog"));
document.getElementById("settings-btn")?.addEventListener("click", () => settings.showModal());
document.getElementById("settings-close")?.addEventListener("click", () => settings.close());

// Share: the QR page (misc/qr/) encodes whatever ?q= holds.
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

  // Updates: the toast checks for them on every launch and resume. Not while
  // reading or editing: a reload would drop that.
  const updates = new UpdateToast();
  updates.idle = () => !document.querySelector("dialog[open]") && !(document.activeElement instanceof HTMLTextAreaElement);
  document.body.append(updates);
}
