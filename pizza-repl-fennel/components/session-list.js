import { LitElement, html } from "lit";
import { repeat } from "lit/directives/repeat.js";

/**
 * Saved sessions, newest first. Takes plain properties, imports no app state;
 * tapping a row fires `open` with the session id as `detail`.
 */
export class SessionList extends LitElement {
  static properties = { sessions: {}, activeId: {} };

  createRenderRoot() {
    return this;
  }

  constructor() {
    super();
    /** @type {import("../lib/store.js").StoredRecord[]} */
    this.sessions = [];
    /** @type {string|null} */
    this.activeId = null;
  }

  /** @param {string} id */
  _open(id) {
    this.dispatchEvent(new CustomEvent("open", { detail: id }));
  }

  render() {
    if (this.sessions.length === 0) return html`<p class="hint">No sessions yet.</p>`;
    return repeat(
      this.sessions,
      (s) => s.id,
      (s) => {
        const current = s.id === this.activeId;
        const n = s.items.length;
        return html`<button type="button" class="session-row ${current ? "current" : ""}" @click=${() => this._open(s.id)}>
          <span class="session-name">${s.name || "Untitled session"}</span>
          <span class="session-meta">${current ? "current · " : ""}${n} ${n === 1 ? "entry" : "entries"} · ${formatDate(s.updatedAt)}</span>
        </button>`;
      }
    );
  }
}

/** @param {number} ts */
function formatDate(ts) {
  return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
