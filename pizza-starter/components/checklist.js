import { LitElement, html } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { lists, activity } from "../state.js";

/**
 * The seed list. These items are the actual steps to turn this starter into
 * your app -- the demo app documents itself, then you delete it.
 */
export const SETUP_STEPS = [
  { text: "Rename the app: manifest.webmanifest and <title> in index.html", done: false },
  { text: "Pick your palette: the :root and [data-theme] blocks in style.css", done: false },
  { text: "Replace icons/pizza.svg (or keep the pizza, it's not hurting anyone)", done: false },
  { text: "Run `just dev-check` - types, precache manifest and tests should pass", done: false },
  { text: "Add a second panel, to prove you understand the tab wiring", done: false },
  { text: "Delete components/checklist.js and build your thing", done: false },
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
    note((done ? "done: " : "undone: ") + itemText(this.record, itemId));
  }

  /** @param {string} itemId */
  _remove(itemId) {
    if (!this.record) return;
    note("deleted: " + itemText(this.record, itemId));
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
    note("added: " + text);
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
        <input name="text" type="text" placeholder="Add an item"
               autocomplete="off" autocapitalize="sentences" />
        <button type="submit">Add</button>
      </form>
    `;
  }
}

/**
 * Record an event for the log tab. Two app components talking through the
 * store rather than through each other.
 * @param {string} text
 */
function note(text) {
  const rec = activity.ensureActive();
  activity.append(rec.id, { text, at: Date.now() });
}

/**
 * @param {import("../lib/store.js").StoredRecord} record
 * @param {string} itemId
 * @returns {string}
 */
function itemText(record, itemId) {
  return record.items.find((i) => i.id === itemId)?.text ?? "an item";
}
