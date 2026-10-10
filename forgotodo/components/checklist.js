import { LitElement, html } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { lists } from "../state.js";
import { dayKey, priorityOf, isFaded, isForgotten, isSnoozed, snoozeOf } from "../lib/forget.js";

/**
 * A first run's list is its own tutorial.
 * Walked through in tests/browser/app.test.mjs ("first-run tutorial").
 */
export const SETUP_STEPS = [
  { text: "Welcome to forgotodo... Mark this done!!!", done: false },
  { text: "First make it yours: tap the title bar, and choose from Themes…", done: false },
  { text: "Add a to-do. End it with ! and it goes above me", done: false },
  { text: "Add a to-do. End it with ? and see where it goes", done: false },
  { text: "Add a to-do for tomorrow and end it with a >. It may disappear...", done: false },
  { text: "Now tap Fast Forward: tomorrow, today", done: false },
  { text: "Did you notice that items ending with '?' are starting to fade away?", done: false },
  { text: "upload to your retro clickwheel MP3 player?", done: false },
  { text: "find AA batteries for retro pocket gaming console?", done: false },
  { text: "order some blank minidiscs from the retro shop?", done: false },
  { text: "learn cursive??", done: false },
  { text: "If you're seeing this, a day went by (or you hit Fast Foward). Good morning!>", done: false },
  { text: "What happens when you end an item with ?? - find out>", done: false },
  { text: "Remember those retro tasks... Literally, try the Remember command with the keyword 'retro'>", done: false},
  { text: "Experiment with the Forget task and other options from the menu>", done: false},
  { text: "You're done with the tutorial! POWER ON!>>", done: false },
];

export class Checklist extends LitElement {
  static properties = {
    record: {},
    // Edit: armed waits for the next tap on a row; editingId is the row open
    // for editing.
    editArmed: { type: Boolean },
    editingId: { state: true },
    _note: { state: true },
  };

  createRenderRoot() {
    return this;
  }

  constructor() {
    super();
    // Constructor, not a class field -- a field shadows Lit's accessor.
    /** @type {import("../lib/store.js").StoredRecord|null} */
    this.record = null;
    this.editArmed = false;
    /** @type {string|null} */
    this.editingId = null;
    this._note = "";
    this._noteTimer = 0;
  }

  /**
   * Show a short message in place of the count for a few seconds.
   * @param {string} text
   */
  note(text) {
    this._note = text;
    clearTimeout(this._noteTimer);
    this._noteTimer = window.setTimeout(() => (this._note = ""), 3000);
  }

  /** @param {boolean} armed */
  _setArmed(armed) {
    this.editArmed = armed;
    this.dispatchEvent(new CustomEvent("edit-armed", { detail: armed, bubbles: true }));
  }

  /** Edit mode on: the next tap on a row opens it for editing. */
  armEdit() {
    this.editingId = null;
    this._setArmed(true);
  }

  cancelEdit() {
    this.editingId = null;
    if (this.editArmed) this._setArmed(false);
  }

  /** While armed, a tap anywhere on a row edits it instead of toggling or deleting. @param {Event} e @param {string} itemId */
  _rowTap(e, itemId) {
    if (!this.editArmed) return;
    e.preventDefault();
    e.stopPropagation();
    this._setArmed(false);
    this.editingId = itemId;
  }

  /** @param {string} itemId @param {string} text */
  _save(itemId, text) {
    this.editingId = null;
    const t = text.trim();
    if (!this.record || !t) return;
    // An edit counts as attention: the decay clock starts over.
    lists.updateItem(this.record.id, itemId, { text: t, seenDay: dayKey() });
    this._noteFiled(t);
  }

  updated() {
    const field = /** @type {HTMLInputElement|null} */ (this.querySelector(".edit-field"));
    if (field && document.activeElement !== field) {
      field.focus();
      field.setSelectionRange(field.value.length, field.value.length);
    }
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
    lists.updateItem(this.record.id, itemId, { done, doneDay: done ? dayKey() : null });
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
    lists.append(this.record.id, { text, done: false, seenDay: dayKey() });
    form.reset();
    this._noteFiled(text);
  }

  /** Say where a to-do went if it isn't on the list. @param {string} text */
  _noteFiled(text) {
    const days = snoozeOf(text);
    if (days) this.note(days === 1 ? "Snoozed till tomorrow." : `Snoozed for ${days} days.`);
    else if (isForgotten(text)) this.note("Filed away, forgotten.");
  }

  render() {
    const all = this.record ? this.record.items : [];
    // Forgotten and snoozed to-dos are hidden but still counted.
    const hidden = all.filter((i) => !i.done && isForgotten(i.text)).length;
    const asleep = all.filter((i) => !i.done && isSnoozed(i.text)).length;
    // Most to least urgent; ties keep their order (sort is stable).
    const items = all
      .filter((i) => i.done || !(isForgotten(i.text) || isSnoozed(i.text)))
      .sort((a, b) => priorityOf(b.text) - priorityOf(a.text));
    const done = all.filter((i) => i.done).length;

    return html`
      <p class="count">${this._note ||
        html`${done} of ${all.length} done${hidden ? html`<span class="hidden-count"> · ${hidden} forgotten</span>` : ""}${
          asleep ? html`<span class="hidden-count"> · ${asleep} snoozed</span>` : ""}`}</p>
      <ul class=${this.editArmed ? "checklist edit-armed" : "checklist"}>
        ${repeat(
          items,
          (i) => i.id,
          (i) => html`<li data-id=${i.id}
              class=${[i.done ? "done" : "", priorityOf(i.text) > 0 ? "urgent" : "", isFaded(i.text) ? "faded" : ""].join(" ").trim()}
              @click=${{ handleEvent: (/** @type {Event} */ e) => this._rowTap(e, i.id), capture: true }}>
            ${this.editingId === i.id
              ? html`<input class="edit-field" type="text" aria-label="Edit to-do" enterkeyhint="done"
                  autocomplete="off" autocapitalize="sentences" .value=${i.text}
                  @keydown=${(/** @type {KeyboardEvent} */ e) => {
                    const t = /** @type {HTMLInputElement} */ (e.target);
                    if (e.key === "Enter") this._save(i.id, t.value);
                    if (e.key === "Escape") this.cancelEdit();
                  }}
                  @blur=${() => this.editingId === i.id && this.cancelEdit()} />`
              : html`<label>
              <input
                type="checkbox"
                .checked=${i.done}
                @change=${(/** @type {Event} */ e) =>
                  this._toggle(i.id, /** @type {HTMLInputElement} */ (e.target).checked)}
              />
              <span>${i.text}</span>
            </label>`}
            <button type="button" aria-label="Delete" @click=${() => this._remove(i.id)}>
              &times;
            </button>
          </li>`
        )}
      </ul>
      <form class="add-row" @submit=${(/** @type {SubmitEvent} */ e) => this._add(e)}>
        <input name="text" type="text" placeholder="New to do"
               autocomplete="off" autocapitalize="sentences" />
        <button type="submit" @pointerdown=${(/** @type {PointerEvent} */ e) => e.preventDefault()}>New</button>
      </form>
    `;
  }
}
