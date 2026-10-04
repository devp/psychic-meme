// Wiring. Everything app-shaped lives here in the open, rather than behind a
// lib -- this is the file you edit first, so it should be readable top to
// bottom with no indirection.
//
// Nothing in here knows the language: that's all lang.js.

import { html } from "lit";
import { syncAppHeight, autoGrow, submitOnEnter } from "./lib/viewport.js";
import { exportSession } from "./lib/export.js";
import { theme, font, tab, sessions } from "./state.js";
import * as lang from "./lang.js";
import { Tabs } from "./components/tabs.js";
import { AppendLog } from "./components/append-log.js";
import { DocView } from "./components/doc-view.js";
import { SessionList } from "./components/session-list.js";

customElements.define("repl-tabs", Tabs);
customElements.define("append-log", AppendLog);
customElements.define("doc-view", DocView);
customElements.define("session-list", SessionList);

/** @template {HTMLElement} T @param {string} id @returns {T} */
const byId = (id) => /** @type {T} */ (document.getElementById(id));

/** @typedef {{id: string, input: string, output: string, isError: boolean}} Entry */

// ---- repl -----------------------------------------------------------------

const output = /** @type {AppendLog} */ (byId("output"));
const form = /** @type {HTMLFormElement} */ (byId("input-form"));
const input = /** @type {HTMLTextAreaElement} */ (byId("input"));
input.placeholder = lang.placeholder;
output.dataset.empty = lang.greeting;

const activeId = () => sessions.ensureActive().id;

/**
 * Tapping an entry's caret copies its input. In the live log it also refills
 * the input box -- the usual reason to tap is "run that again" -- but only
 * when the box is empty, so it never clobbers work in progress.
 * @param {boolean} live
 */
const renderEntry = (live) => (/** @type {Entry} */ e) =>
  html`<div class="entry">
    <div class="prompt">
      <button type="button" class="copy-caret" title=${live ? "Copy / reuse" : "Copy"}
        aria-label=${live ? "Copy this input, and reuse it if the input box is empty" : "Copy this input"}
        @click=${(/** @type {Event} */ ev) => {
          copyText(e.input, /** @type {HTMLElement} */ (ev.currentTarget));
          if (live && input.value.trim() === "") {
            input.value = e.input;
            autoGrow(input);
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
  input.focus();
  // Your own entry is always followed, even if you'd scrolled up to read.
  output.updateComplete.then(() => (output.scrollTop = output.scrollHeight));
});
submitOnEnter(input, () => form.requestSubmit());
input.addEventListener("input", () => autoGrow(input));
// Tapping Run would move focus off the textarea and drop the keyboard.
byId("run-btn").addEventListener("pointerdown", (e) => e.preventDefault());

const newSession = () => sessions.create("");
byId("new-session-btn").addEventListener("click", newSession);
byId("settings-new-session-btn").addEventListener("click", newSession);
byId("clear-output-btn").addEventListener("click", () => sessions.clearItems(activeId()));

// ---- a saved session ------------------------------------------------------

const sessionDialog = /** @type {HTMLDialogElement} */ (byId("session-dialog"));
const sessionName = /** @type {HTMLInputElement} */ (byId("session-name"));
const sessionView = /** @type {AppendLog} */ (byId("session-view"));
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

byId("session-export-btn").addEventListener("click", (e) => {
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

for (const doc of document.querySelectorAll("doc-view")) {
  /** @type {DocView} */ (doc).preprocess = lang.preprocessDoc;
}

/** @returns {DocView|null} */
const activeDoc = () => document.querySelector(".panel.active doc-view");

const docIndexBtn = byId("doc-index-btn");
const docIndexDialog = /** @type {HTMLDialogElement} */ (byId("doc-index-dialog"));
const docIndexList = byId("doc-index-list");

docIndexBtn.addEventListener("click", () => {
  const doc = activeDoc();
  const items = doc?.headings ?? [];
  docIndexList.replaceChildren(
    ...items.map((item) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `doc-index-item level-${item.level}`;
      b.textContent = item.text;
      b.addEventListener("click", () => {
        // Long docs: jump, don't smooth-scroll the whole way.
        doc?.querySelector("#" + CSS.escape(item.id))?.scrollIntoView({ block: "start" });
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
  const doc = activeDoc();
  doc?.load();
  docIndexBtn.hidden = !doc;
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

  // Updates. sw.js answers "updated" once new files are in its cache; this page
  // is still running the old ones. Reload the next time the app comes back to
  // the foreground -- never while it's in use, and not while the input holds a
  // half-typed entry, which isn't saved until it's run.
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
    if (updated && input.value === "") location.reload();
    else check();
  });
}
