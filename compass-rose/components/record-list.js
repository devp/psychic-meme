import { LitElement, html, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { records, tab } from "../state.js";
import { fromStored, isResolved, titleOf } from "../lib/thought.js";
import { chronoTextAll, markdownGraphAll } from "../lib/export.js";
import { copyText, flash } from "./copy.js";

/** @typedef {import("../lib/thought.js").ThoughtRecord} ThoughtRecord */

/** <record-list>: every record, newest first. Tap one to open it. */
export class RecordList extends LitElement {
  static properties = { all: {} };

  createRenderRoot() {
    return this;
  }

  constructor() {
    super();
    /** @type {ThoughtRecord[]} */
    this.all = [];
  }

  connectedCallback() {
    super.connectedCallback();
    // Newest first by when it was started, not last touched: a record you
    // add to later stays where you'd look for it.
    const refresh = () => {
      this.all = records
        .getAll()
        .map(fromStored)
        .sort((a, b) => b.createdAt - a.createdAt);
    };
    // warn-ok: subscribe-no-teardown -- this element is never removed
    records.subscribe(refresh);
    refresh();
  }

  _new() {
    records.create("");
    tab.set("record");
  }

  /** @param {string} id */
  _open(id) {
    records.setActive(id);
    tab.set("record");
  }

  /** @param {ThoughtRecord} r */
  _delete(r) {
    if (!confirm(`Delete "${titleOf(r)}" and its ${r.entries.length} entries? This can't be undone.`)) return;
    records.remove(r.id);
  }

  /** @param {Event} e @param {"timeline"|"map"} which */
  async _copyAll(e, which) {
    const button = /** @type {HTMLElement} */ (e.currentTarget);
    const text = which === "timeline" ? chronoTextAll(this.all) : markdownGraphAll(this.all);
    flash(button, await copyText(text));
  }

  render() {
    const active = records.getActiveId();
    return html`
      <button type="button" class="primary wide" @click=${() => this._new()}>New record</button>
      ${this.all.length
        ? html`<ul class="records">
              ${repeat(
                this.all,
                (r) => r.id,
                (r) => html`<li class=${r.id === active ? "active" : ""}>
                  <button type="button" class="record-open" @click=${() => this._open(r.id)}>
                    <span class="record-title">${titleOf(r)}</span>
                    <span class="record-meta">
                      ${new Date(r.createdAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                      · ${r.entries.length} ${r.entries.length === 1 ? "entry" : "entries"}
                      ${isResolved(r) ? html`· resolved` : nothing}
                    </span>
                  </button>
                  <button type="button" class="record-x" aria-label="Delete record" @click=${() => this._delete(r)}>×</button>
                </li>`
              )}
            </ul>
            <div class="export-row">
              <button type="button" @click=${(/** @type {Event} */ e) => this._copyAll(e, "timeline")}>Copy all: timeline</button>
              <button type="button" @click=${(/** @type {Event} */ e) => this._copyAll(e, "map")}>Copy all: map</button>
            </div>`
        : html`<p class="empty">No records yet. They stay on this device.</p>`}
    `;
  }
}
