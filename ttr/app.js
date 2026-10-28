// Wiring. Everything app-shaped lives here in the open, rather than behind a
// lib -- this is the file you edit first, so it should be readable top to
// bottom with no indirection.

import { syncAppHeight } from "./lib/viewport.js";
import { theme, token, config, getConfig } from "./state.js";
import { DEFAULT_CONFIG, withDefaults, addBucket } from "./lib/triage.js";
import { TokenSetup } from "./components/setup.js";
import { TargetPicker } from "./components/picker.js";
import { TriageSession } from "./components/session.js";
import { UpdateToast } from "./components/update-toast.js";

customElements.define("ttr-setup", TokenSetup);
customElements.define("ttr-picker", TargetPicker);
customElements.define("ttr-session", TriageSession);
customElements.define("update-toast", UpdateToast);

const setup = /** @type {TokenSetup} */ (document.querySelector("ttr-setup"));
const picker = /** @type {TargetPicker} */ (document.querySelector("ttr-picker"));
const session = /** @type {TriageSession} */ (document.querySelector("ttr-session"));

// ---- screens --------------------------------------------------------------
// setup -> picker <-> session. Which one shows is in memory only: a relaunch
// always lands on the picker (or setup, without a token).

/** @param {"setup"|"picker"|"session"} name */
function show(name) {
  setup.hidden = name !== "setup";
  picker.hidden = name !== "picker";
  session.hidden = name !== "session";
  if (name === "picker") picker.refresh();
}

setup.addEventListener("done", () => show("picker"));
picker.addEventListener("pick", (e) => {
  show("session");
  session.start(/** @type {CustomEvent} */ (e).detail, { reuse: true });
});
session.addEventListener("exit", () => show("picker"));

show(token.get() ? "picker" : "setup");

// Back on the picker after a trip underground: recount.
window.addEventListener("online", () => {
  if (!picker.hidden) picker.refresh();
});

// ---- options --------------------------------------------------------------

theme.subscribe((v) => {
  document.documentElement.setAttribute("data-theme", v);
  syncChecked("[data-set-theme]", "data-set-theme", v);
  // theme-color follows the theme's background, for the phone's status bar.
  const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
  if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg);
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
  if (t) theme.set(t.getAttribute("data-set-theme") ?? "dusk");
});

const settings = /** @type {HTMLDialogElement} */ (document.getElementById("settings-dialog"));
const configText = /** @type {HTMLTextAreaElement} */ (document.getElementById("config-text"));
const configNote = /** @type {HTMLElement} */ (document.getElementById("config-note"));

document.getElementById("settings-btn")?.addEventListener("click", () => {
  configText.value = JSON.stringify(getConfig(), null, 2);
  configNote.textContent = "";
  settings.showModal();
});
document.getElementById("settings-close")?.addEventListener("click", () => settings.close());

document.getElementById("token-btn")?.addEventListener("click", () => {
  settings.close();
  show("setup");
});

document.getElementById("config-save")?.addEventListener("click", () => {
  try {
    const next = withDefaults(JSON.parse(configText.value));
    // Fail here rather than mid-session.
    [...next.dateBuckets, ...next.watchBuckets].forEach((b) => addBucket("2026-01-01", b));
    if (!next.targets.every((t) => t && typeof t.name === "string" && typeof t.query === "string" && Array.isArray(t.verbs))) {
      throw new Error("each target needs name, query and verbs");
    }
    if (!Array.isArray(next.switchProjects) || !next.switchProjects.every((n) => typeof n === "string")) {
      throw new Error("switchProjects is a list of project names");
    }
    config.set(next);
    configNote.textContent = "saved";
    if (!picker.hidden) picker.refresh();
  } catch (e) {
    configNote.textContent = e instanceof Error ? e.message : String(e);
  }
});

document.getElementById("config-reset")?.addEventListener("click", () => {
  configText.value = JSON.stringify(DEFAULT_CONFIG, null, 2);
  configNote.textContent = "not saved yet";
});

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

  // Updates: the toast checks for them on every launch and resume. Not
  // mid-session: a reload would drop the queued decisions.
  const updates = new UpdateToast();
  updates.idle = () => session.hidden && !document.querySelector("dialog[open]");
  document.body.append(updates);
}
