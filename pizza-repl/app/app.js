// Wiring. Everything app-shaped lives here in the open, rather than behind a
// lib -- this is the file you edit first, so it should be readable top to
// bottom with no indirection.
//
// Nothing in here knows the language: that's all lang.js, the plugin. See
// ../README.md (in pizza-repl/) for what it exports.

import { html } from "lit";
import { syncAppHeight, autoGrow, submitOnEnter } from "./lib/viewport.js";
import { exportSession } from "./lib/export.js";
import { theme, font, tab, doc, caretAction, suggestPref, commandsPref, sessions } from "./state.js";
import * as lang from "./lang.js";
import { Tabs } from "./components/tabs.js";
import { AppendLog } from "./components/append-log.js";
import { DocView } from "./components/doc-view.js";
import { SessionList } from "./components/session-list.js";
import { UpdateToast } from "./components/update-toast.js";

customElements.define("repl-tabs", Tabs);
customElements.define("append-log", AppendLog);
customElements.define("doc-view", DocView);
customElements.define("session-list", SessionList);
customElements.define("update-toast", UpdateToast);

/** @template {HTMLElement} T @param {string} id @returns {T} */
const byId = (id) => /** @type {T} */ (document.getElementById(id));

/** @typedef {{id: string, input: string, output: string, isError: boolean}} Entry */

// ---- repl -----------------------------------------------------------------

const output = /** @type {AppendLog} */ (byId("output"));
const form = /** @type {HTMLFormElement} */ (byId("input-form"));
const input = /** @type {HTMLTextAreaElement} */ (byId("input"));
input.placeholder = lang.placeholder;
output.dataset.empty = lang.greeting;
// warn-ok: innerhtml-assign -- lang.js's own text, not user input
byId("about-lang").innerHTML = lang.about;

const activeId = () => sessions.ensureActive().id;

/**
 * Tapping an entry's caret copies its input and/or, in the live log, refills
 * the input box -- the usual reason to tap is "run that again" -- per the
 * caretAction option (default: both). Filling only happens when the box is
 * empty, so it never clobbers work in progress. Saved sessions in the dialog
 * always just copy: there's no input behind the dialog to fill.
 * @param {boolean} live
 */
const renderEntry = (live) => (/** @type {Entry} */ e) =>
  html`<div class="entry">
    <div class="prompt">
      <button type="button" class="copy-caret" title=${live ? "Copy / reuse" : "Copy"}
        aria-label=${live ? "Copy this input, and reuse it if the input box is empty" : "Copy this input"}
        @click=${(/** @type {Event} */ ev) => {
          const action = live ? caretAction.get() : "copy";
          if (action !== "fill") copyText(e.input, /** @type {HTMLElement} */ (ev.currentTarget));
          if (action !== "copy" && input.value.trim() === "") {
            input.value = e.input;
            autoGrow(input);
            suggest();
          }
        }}>&gt;</button>
      <span class="prompt-text">${e.input}</span>
    </div>
    <div class="result ${e.isError ? "error" : ""}">${e.output}</div>
  </div>`;
output.renderItem = renderEntry(true);

const sessionList = /** @type {SessionList} */ (byId("session-list"));

const paint = () => {
  const id = activeId();
  output.items = sessions.get(id)?.items ?? [];
  sessionList.sessions = sessions.getAll();
  sessionList.activeId = id;
};
sessions.subscribe(paint);
paint();

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const source = input.value;
  if (source.trim() === "") return;
  const { text, isError } = lang.evaluate(source);
  sessions.append(activeId(), { input: source, output: text, isError });
  input.value = "";
  autoGrow(input);
  suggest();
  input.focus();
  // Your own entry is always followed, even if you'd scrolled up to read.
  output.updateComplete.then(() => (output.scrollTop = output.scrollHeight));
});
submitOnEnter(input, () => form.requestSubmit());
input.addEventListener("input", () => autoGrow(input));
// Tapping Run would move focus off the textarea and drop the keyboard.
byId("run-btn").addEventListener("pointerdown", (e) => e.preventDefault());
// Key row: lang.keys, plus a gray middle key that pops up the language's
// command shortcuts. Tapping a key would move focus off the textarea and drop
// the keyboard, so keep it there. Everything inserts at the caret (replacing any
// selection).
/** @param {string} text */
const insertAtCaret = (text) => {
  input.focus();
  input.setRangeText(text, input.selectionStart, input.selectionEnd, "end");
  autoGrow(input);
  suggest();
};
const keyRow = byId("key-row");
{
  const half = Math.ceil(lang.keys.length / 2);
  /** @param {string} key @param {number} i */
  const keyButton = (key, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.ins = key;
    // Pairs share a color: 1 at the edges, inward from there.
    b.className = `k-${(Math.min(i, lang.keys.length - 1 - i) % 3) + 1}`;
    b.setAttribute("aria-label", "Insert " + key);
    b.textContent = key;
    return b;
  };
  const more = document.createElement("button");
  more.type = "button";
  more.id = "commands-btn";
  more.className = "k-more";
  more.setAttribute("aria-label", "Command shortcuts");
  more.setAttribute("aria-haspopup", "dialog");
  more.textContent = "⋯";
  const keys = lang.keys.map(keyButton);
  keyRow.replaceChildren(...keys.slice(0, half), more, ...keys.slice(half));
}
keyRow.addEventListener("pointerdown", (e) => e.preventDefault());
keyRow.addEventListener("click", (e) => {
  const b = /** @type {HTMLElement} */ (e.target).closest("button[data-ins]");
  if (b instanceof HTMLElement) insertAtCaret(b.dataset.ins ?? "");
});

// Completions: a strip of chips above the key row for the word at the caret,
// from lang.complete() when the language has one. Tapping a chip replaces the
// word; so does Tab on a keyboard when there's one candidate, else Tab extends
// to their common prefix. The strip keeps its height while on, so the log
// doesn't jump as you type.
/** @type {((source: string, caret: number) => {from: number, items: string[]} | null) | undefined} */
const complete = /** @type {any} */ (lang).complete;
const MIN_CHARS = 2;
const MAX_CHIPS = 20;
const suggestRow = byId("suggest-row");
/** @type {{from: number, items: string[]} | null} */
let suggestion = null;

function suggest() {
  const caret = input.selectionStart;
  const r = complete && suggestPref.get() === "on" && caret === input.selectionEnd ? complete(input.value, caret) : null;
  suggestion = r && caret - r.from >= MIN_CHARS && r.items.length ? r : null;
  suggestRow.replaceChildren(
    ...(suggestion?.items.slice(0, MAX_CHIPS) ?? []).map((item) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "suggest-item";
      b.textContent = item;
      return b;
    })
  );
  suggestRow.scrollLeft = 0;
}

/** @param {string} text replaces the word at the caret */
function acceptSuggestion(text) {
  if (!suggestion) return;
  input.focus();
  input.setRangeText(text, suggestion.from, input.selectionStart, "end");
  autoGrow(input);
  suggest();
}

if (complete) {
  byId("suggest-section").hidden = false;
  suggestPref.subscribe((v) => {
    suggestRow.hidden = v !== "on";
    syncChecked("[data-set-suggest]", "data-set-suggest", v);
    suggest();
  });
  input.addEventListener("input", suggest);
  document.addEventListener("selectionchange", () => document.activeElement === input && suggest());
  suggestRow.addEventListener("pointerdown", (e) => e.preventDefault()); // keep the keyboard up
  suggestRow.addEventListener("click", (e) => {
    const b = /** @type {HTMLElement} */ (e.target).closest(".suggest-item");
    if (b) acceptSuggestion(b.textContent ?? "");
  });
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || e.shiftKey || !suggestion) return;
    e.preventDefault();
    const { items } = suggestion;
    acceptSuggestion(items.length === 1 ? items[0] : commonPrefix(items));
  });
}

/** @param {string[]} items */
function commonPrefix(items) {
  let p = items[0];
  for (const s of items) while (!s.startsWith(p)) p = p.slice(0, -1);
  return p;
}

const commandsDialog = /** @type {HTMLDialogElement} */ (byId("commands-dialog"));
const commandsList = byId("commands-list");
const commandsField = /** @type {HTMLInputElement} */ (byId("commands-field"));
if (lang.commands.length) byId("commands-hint").textContent = `Comma-separated, listed after ${lang.commands.join("  ")}`;
commandsField.addEventListener("input", () => commandsPref.set(commandsField.value));
commandsPref.subscribe((v) => {
  if (commandsField.value !== v) commandsField.value = v;
  const custom = v.split(",").map((c) => c.trim()).filter(Boolean);
  commandsList.replaceChildren(
    ...[...lang.commands, ...custom].map((cmd) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "command-item";
      b.textContent = cmd;
      b.addEventListener("click", () => {
        commandsDialog.close();
        insertAtCaret(cmd);
      });
      return b;
    })
  );
});
byId("commands-btn").addEventListener("click", () => commandsDialog.showModal());

const newSession = () => sessions.create("");
byId("new-session-btn").addEventListener("click", newSession);
byId("settings-new-session-btn").addEventListener("click", newSession);
byId("clear-output-btn").addEventListener("click", () => sessions.clearItems(activeId()));

// ---- a saved session ------------------------------------------------------

const sessionDialog = /** @type {HTMLDialogElement} */ (byId("session-dialog"));
const sessionName = /** @type {HTMLInputElement} */ (byId("session-name"));
const sessionView = /** @type {AppendLog} */ (byId("session-view"));
const exportBtn = byId("session-export-btn");
exportBtn.title = `Copy as ${lang.name}`;
exportBtn.setAttribute("aria-label", `Copy as commented ${lang.name}`);
sessionView.renderItem = renderEntry(false);
sessionView.dataset.empty = "(empty)";
/** @type {string|null} */
let viewingId = null;

sessionList.addEventListener("open", (e) => {
  const s = sessions.get(/** @type {CustomEvent<string>} */ (e).detail);
  if (!s) return;
  viewingId = s.id;
  sessionName.value = s.name;
  sessionView.items = s.items;
  sessionDialog.showModal();
});

sessionName.addEventListener("change", () => {
  if (viewingId) sessions.rename(viewingId, sessionName.value.trim());
});

exportBtn.addEventListener("click", (e) => {
  const s = viewingId && sessions.get(viewingId);
  if (!s) return;
  copyText(exportSession(/** @type {any} */ (s), lang), /** @type {HTMLElement} */ (e.currentTarget));
});

byId("session-delete-btn").addEventListener("click", () => {
  if (!viewingId || !confirm("Delete this saved session? This can't be undone.")) return;
  sessions.remove(viewingId); // the active one? paint's ensureActive starts a fresh one
  viewingId = null;
  sessionDialog.close();
});

// ---- docs -----------------------------------------------------------------

// One tab for every doc in lang.docs. It shows the one you read last and is
// labelled with it; tapping it again drops down the rest as chips. Each doc
// keeps its own scroll position, which the shared panel would otherwise lose.
const docsPanel = byId("docs-panel");
const docMenu = byId("doc-menu");
/** @type {Map<string, {page: HTMLElement, view: DocView, label: string, scroll: number}>} */
const docPages = new Map();
for (const d of lang.docs) {
  const page = document.createElement("div");
  page.className = "doc-page";
  page.dataset.doc = d.id;
  page.hidden = true;
  if (d.note) {
    const note = document.createElement("p");
    note.className = "doc-note";
    // warn-ok: innerhtml-assign -- lang.js's own text, not user input
    note.innerHTML = d.note;
    page.append(note);
  }
  const view = /** @type {DocView} */ (document.createElement("doc-view"));
  view.setAttribute("src", d.src);
  view.preprocess = lang.preprocessDoc;
  page.append(view);
  docsPanel.append(page);
  docPages.set(d.id, { page, view, label: d.label ?? d.id, scroll: 0 });
}
const docsTab = () => document.querySelector('repl-tabs [data-tab="docs"]');
if (docPages.size === 0) {
  docsPanel.remove();
  docsTab()?.remove();
}

// Older versions had a tab per doc, so a stored tab may be a doc's id.
if (docPages.has(tab.get())) {
  doc.set(tab.get());
  tab.set("docs");
} else if (!document.querySelector(`.panel[data-panel="${CSS.escape(tab.get())}"]`)) tab.set("repl");

const currentDoc = () => (docPages.has(doc.get()) ? doc.get() : lang.docs[0]?.id ?? "");

/** @returns {DocView|null} */
const activeDoc = () => (tab.get() === "docs" ? docPages.get(currentDoc())?.view ?? null : null);

const docMenuOpen = () => !docMenu.hidden;
/** @param {boolean} open */
function showDocMenu(open) {
  docMenu.hidden = !open;
  docsTab()?.setAttribute("aria-expanded", String(open));
  if (open) /** @type {HTMLElement | null} */ (docMenu.querySelector('[aria-current="true"]'))?.focus();
}
for (const [id, { label }] of docPages) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "doc-chip";
  chip.setAttribute("role", "menuitemradio");
  chip.dataset.doc = id;
  chip.textContent = label;
  chip.addEventListener("click", () => {
    showDocMenu(false);
    doc.set(id);
  });
  docMenu.append(chip);
}
document.querySelector("repl-tabs")?.addEventListener("reselect", (e) => {
  if (/** @type {CustomEvent<string>} */ (e).detail === "docs") showDocMenu(!docMenuOpen());
});
// Dismiss by tapping anywhere else, or Escape. The docs tab itself toggles.
document.addEventListener("pointerdown", (e) => {
  const t = /** @type {Element} */ (e.target);
  if (docMenuOpen() && !docMenu.contains(t) && !t.closest?.('[data-tab="docs"]')) showDocMenu(false);
});
docMenu.addEventListener("keydown", (e) => {
  if (e.key === "Escape") showDocMenu(false);
});

/** Show the current doc, load it if it's new, and relabel the tab. */
function paintDoc() {
  const id = currentDoc();
  for (const [key, p] of docPages) p.page.hidden = key !== id;
  for (const chip of docMenu.querySelectorAll(".doc-chip")) {
    chip.setAttribute("aria-current", String(/** @type {HTMLElement} */ (chip).dataset.doc === id));
    chip.setAttribute("aria-checked", String(/** @type {HTMLElement} */ (chip).dataset.doc === id));
  }
  const p = docPages.get(id);
  const t = docsTab();
  if (t && p) {
    const caret = document.createElement("span");
    caret.className = "caret";
    caret.setAttribute("aria-hidden", "true");
    caret.textContent = "▾";
    t.replaceChildren(p.label, caret);
    t.setAttribute("aria-haspopup", "menu");
    t.setAttribute("aria-label", `Docs: ${p.label}. Tap again for the others`);
  }
  if (p && tab.get() === "docs") {
    p.view.load();
    docsPanel.scrollTop = p.scroll;
  }
}
doc.subscribe(paintDoc);
docsPanel.addEventListener("scroll", () => {
  const p = tab.get() === "docs" && docPages.get(currentDoc());
  if (p) p.scroll = docsPanel.scrollTop;
});

const docIndexBtn = byId("doc-index-btn");
const docIndexDialog = /** @type {HTMLDialogElement} */ (byId("doc-index-dialog"));
const docIndexList = byId("doc-index-list");

docIndexBtn.addEventListener("click", () => {
  const view = activeDoc();
  const items = view?.headings ?? [];
  docIndexList.replaceChildren(
    ...items.map((item) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `doc-index-item level-${item.level}`;
      b.textContent = item.text;
      b.addEventListener("click", () => {
        // Long docs: jump, don't smooth-scroll the whole way.
        view?.querySelector("#" + CSS.escape(item.id))?.scrollIntoView({ block: "start" });
        docIndexDialog.close();
      });
      return b;
    })
  );
  if (items.length === 0) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = "No sections found.";
    docIndexList.append(p);
  }
  docIndexDialog.showModal();
});

// ---- shell glue -----------------------------------------------------------

theme.subscribe((v) => {
  document.documentElement.setAttribute("data-theme", v);
  syncChecked("[data-set-theme]", "data-set-theme", v);
});

caretAction.subscribe((v) => syncChecked("[data-set-caret]", "data-set-caret", v));

font.subscribe((v) => {
  document.documentElement.setAttribute("data-font", v);
  syncChecked("[data-set-font]", "data-set-font", v);
});

let firstTab = true;
tab.subscribe((v) => {
  document.querySelectorAll(".panel").forEach((p) => {
    p.classList.toggle("active", p.getAttribute("data-panel") === v);
  });
  document.querySelectorAll("repl-tabs [data-tab]").forEach((b) => {
    const on = b.getAttribute("data-tab") === v;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", String(on));
  });
  showDocMenu(false);
  paintDoc();
  docIndexBtn.hidden = !activeDoc();
  // Not on launch: focusing pops the phone keyboard over whatever you came back to.
  if (v === "repl" && !firstTab) input.focus();
  firstTab = false;
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
  const c = el.closest("[data-set-caret]");
  if (c) caretAction.set(c.getAttribute("data-set-caret") ?? "both");
  const sg = el.closest("[data-set-suggest]");
  if (sg) suggestPref.set(sg.getAttribute("data-set-suggest") ?? "on");
  if (el.closest("[data-close]")) el.closest("dialog")?.close();
});

const settings = /** @type {HTMLDialogElement} */ (byId("settings-dialog"));
byId("settings-btn").addEventListener("click", () => settings.showModal());

// Share: the QR page (misc/qr/) encodes whatever ?q= holds.
const shareLink = /** @type {HTMLAnchorElement | null} */ (document.getElementById("share-link"));
if (shareLink) shareLink.search = new URLSearchParams({ q: new URL(".", location.href).href }).toString();

/**
 * Copy, then flash ✓ or ✕ on the button. The fallback covers pages without the
 * async Clipboard API, e.g. served over plain http to a phone on the LAN.
 * @param {string} text
 * @param {HTMLElement} btn
 */
function copyText(text, btn) {
  const flash = (/** @type {boolean} */ ok) => {
    const original = btn.textContent;
    btn.textContent = ok ? "✓" : "✕";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove("copied");
    }, 900);
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => flash(true), () => flash(false));
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.append(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {}
  ta.remove();
  flash(ok);
}

// ---- phone ----------------------------------------------------------------

// Keep the latest entry above the keyboard as it opens.
syncAppHeight(() => {
  if (tab.get() === "repl") output.scrollTop = output.scrollHeight;
});

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
  const toast = new UpdateToast();
  // A half-typed entry isn't saved until it's run; wait for a resume without one.
  toast.idle = () => input.value === "";
  document.body.append(toast);
}
