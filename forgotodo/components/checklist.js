import { LitElement, html } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { lists } from "../state.js";

/** Sample to-dos for a first run. */
export const SETUP_STEPS = [
  { text: "HotSync before the trip", done: false },
  { text: "Buy AAA batteries", done: false },
  { text: "Find the stylus (check the couch)", done: false },
  { text: "Beam contact card to Sam", done: false },
  { text: "Recalibrate the digitizer", done: false },
  { text: "Graffiti practice: 10 minutes", done: false },
];

export class Checklist extends LitElement {
  static properties = { record: {} };

  createRenderRoot() {
    return this;
  }

  constructor() {
    super();
    // Constructor, not a class field -- a field shadows Lit's accessor.
    /** @type {import("../lib/store.js").StoredRecord|null} */
    this.record = null;
  }

  connectedCallback() {
    super.connectedCallback();
    const refresh = () => {
      const id = lists.getActiveId();
      this.record = id ? lists.get(id) : null;
    };
    // warn-ok: subscribe-no-teardown -- this element is never removed
    lists.subscribe(refresh);
    refresh();
  }

  /** @param {string} itemId @param {boolean} done */
  _toggle(itemId, done) {
    if (!this.record) return;
    lists.updateItem(this.record.id, itemId, { done });
  }

  /** @param {string} itemId */
  _remove(itemId) {
    if (!this.record) return;
    lists.removeItem(this.record.id, itemId);
  }

  /** @param {SubmitEvent} e */
  _add(e) {
    e.preventDefault();
    const form = /** @type {HTMLFormElement} */ (e.target);
    const input = /** @type {HTMLInputElement} */ (form.elements.namedItem("text"));
    const text = input.value.trim();
    if (!text || !this.record) return;
    lists.append(this.record.id, { text, done: false });
    form.reset();
  }

  render() {
    const items = this.record ? this.record.items : [];
    const done = items.filter((i) => i.done).length;

    return html`
      <p class="count">${done} of ${items.length} done</p>
      <ul class="checklist">
        ${repeat(
          items,
          (i) => i.id,
          (i) => html`<li class=${i.done ? "done" : ""}>
            <label>
              <input
                type="checkbox"
                .checked=${i.done}
                @change=${(/** @type {Event} */ e) =>
                  this._toggle(i.id, /** @type {HTMLInputElement} */ (e.target).checked)}
              />
              <span>${i.text}</span>
            </label>
            <button type="button" aria-label="Delete" @click=${() => this._remove(i.id)}>
              &times;
            </button>
          </li>`
        )}
      </ul>
      <form class="add-row" @submit=${(/** @type {SubmitEvent} */ e) => this._add(e)}>
        <input name="text" type="text" placeholder="New to do"
               autocomplete="off" autocapitalize="sentences" />
        <button type="submit">New</button>
      </form>
    `;
  }
}
