import { LitElement, html, nothing } from "lit";
import { pages } from "../state.js";
import { blob, dayLabel, measure } from "../lib/pages.js";

/**
 * Every day, newest first, each as one blob of text. For looking back --
 * scrolling through for the to-do list you know you wrote down somewhere.
 *
 * Emits `page-download` and `page-delete` (detail: the day's record) and
 * `pages-download-all` rather than doing any of it itself; app.js owns files
 * and confirmation.
 */
export class PagesList extends LitElement {
  static properties = {
    _query: { state: true },
    _tick: { state: true },
  };

  createRenderRoot() {
    return this;
  }

  constructor() {
    super();
    this._query = "";
    this._tick = 0;
    /** @type {(() => void) | null} */
    this._unsub = null;
  }

  connectedCallback() {
    super.connectedCallback();
    this._unsub = pages.subscribe(() => this._tick++);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsub?.();
  }

  /**
   * @param {string} type
   * @param {import("../lib/store.js").StoredRecord} [day]
   */
  _emit(type, day) {
    this.dispatchEvent(new CustomEvent(type, { detail: day, bubbles: true }));
  }

  render() {
    const q = this._query.trim().toLowerCase();
    const days = pages
      .getAll()
      .filter((d) => d.items.length > 0)
      .sort((a, b) => b.name.localeCompare(a.name));
    const shown = q ? days.filter((d) => blob(d.items).toLowerCase().includes(q)) : days;

    return html`
      <div class="pages-tools">
        <input
          type="search"
          class="field"
          placeholder="find a word…"
          aria-label="Find a word in your pages"
          .value=${this._query}
          @input=${(/** @type {InputEvent} */ e) =>
            (this._query = /** @type {HTMLInputElement} */ (e.target).value)}
        />
        ${days.length > 0
          ? html`<button type="button" class="soft" @click=${() => this._emit("pages-download-all")}>
              download all
            </button>`
          : nothing}
      </div>
      ${days.length === 0
        ? html`<p class="quiet">Nothing here yet. Whatever you write shows up here, one page per day.</p>`
        : shown.length === 0
          ? html`<p class="quiet">No page mentions “${this._query.trim()}”.</p>`
          : nothing}
      ${shown.map((d) => {
        const { words } = measure(d.items);
        return html`
          <article class="page" aria-labelledby=${"h-" + d.name}>
            <header class="page-head">
              <h2 id=${"h-" + d.name}>${dayLabel(d.name)}</h2>
              <span class="quiet">${words} ${words === 1 ? "word" : "words"}</span>
            </header>
            <div class="page-text">${blob(d.items)}</div>
            <div class="page-actions">
              <button type="button" class="soft" @click=${() => this._emit("page-download", d)}>
                download
              </button>
              <button type="button" class="soft" @click=${() => this._emit("page-delete", d)}>
                delete
              </button>
            </div>
          </article>
        `;
      })}
    `;
  }
}
