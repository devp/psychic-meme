// <update-toast>: says when a new version of the app is ready, with a button to
// load it. Built to travel: no Lit, no app state, its own styles. It talks to
// sw.js directly, so any app with the starter's sw.js can append one.
//
// sw.js answers "updated" once new files are in its cache; this page is still
// running the old ones. The toast appears right away. Ignored, the page
// reloads the next time it comes back to the foreground, if `idle()` agrees --
// never while it's in use. A new sw.js taking over counts too (it
// re-downloaded everything on install), but not the very first one, which
// replaced no worker.
//
// Colours: --toast-bg, --toast-fg, --toast-border, --toast-accent,
// --toast-accent-ink; each falls back to the starter's theme tokens.

const STYLE = `
:host {
  position: fixed;
  left: 50%;
  bottom: calc(16px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: calc(100vw - 32px);
  padding: 8px 8px 8px 14px;
  background: var(--toast-bg, var(--bg-raised, Canvas));
  color: var(--toast-fg, var(--fg, CanvasText));
  border: 1px solid var(--toast-border, var(--border, GrayText));
  border-radius: 12px;
  box-shadow: 0 4px 16px rgb(0 0 0 / 0.25);
  font-size: 14px;
}
:host([hidden]) { display: none; }
button { font: inherit; color: inherit; cursor: pointer; border: 0; border-radius: 8px; }
.reload {
  padding: 6px 12px;
  background: var(--toast-accent, var(--accent, AccentColor));
  color: var(--toast-accent-ink, var(--accent-ink, AccentColorText));
  font-weight: 600;
}
.dismiss { padding: 4px 8px; background: none; font-size: 18px; line-height: 1; }
`;

export class UpdateToast extends HTMLElement {
  /** May a resume reload the page? Replace when some input isn't saved yet. */
  idle = () => true;

  #updated = false;
  #started = false;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    // warn-ok: innerhtml-assign (constants only)
    root.innerHTML = `<style>${STYLE}</style>
      <span>A new version is ready.</span>
      <button type="button" class="reload" part="reload">Reload</button>
      <button type="button" class="dismiss" part="dismiss" aria-label="Dismiss">×</button>`;
    root.querySelector(".reload")?.addEventListener("click", () => location.reload());
    root.querySelector(".dismiss")?.addEventListener("click", () => (this.hidden = true));
    this.hidden = true;
    this.setAttribute("role", "status");
  }

  connectedCallback() {
    if (this.#started || !("serviceWorker" in navigator)) return;
    this.#started = true;
    const sw = navigator.serviceWorker;
    const hadWorker = !!sw.controller;
    sw.addEventListener("message", (e) => e.data === "updated" && this.#show());
    sw.addEventListener("controllerchange", () => hadWorker && this.#show());

    const check = () => sw.ready.then((reg) => reg.active?.postMessage("check"));
    check();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      if (!this.#updated) check();
      else if (this.idle()) location.reload();
    });
  }

  #show() {
    this.#updated = true;
    this.hidden = false;
  }
}
