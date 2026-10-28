import { LitElement, html } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { lanes, people, patchCard, removeCard, addName } from "../state.js";
import { cleanText } from "../lib/deck.js";

/** @typedef {import("../lib/deck.js").Card} Card */

const NEW = "\u0000new";

/** Edit a card: description, link, lane, from, read. Opened by `edit(card)`. */
export class CardEditor extends LitElement {
  static properties = { card: { state: true }, _new: { state: true }, _confirm: { state: true } };

  createRenderRoot() {
    return this;
  }

  constructor() {
    super();
    /** @type {Card|null} */
    this.card = null;
    /** Which pick-or-create fields are showing their "new" input. */
    /** @type {Record<string, boolean>} */
    this._new = {};
    this._confirm = false;
    /** Bumped per open, to key the form: a fresh form drops edits from a cancelled open. */
    this.opened = 0;
  }

  /** @param {Card} card */
  async edit(card) {
    this.card = card;
    this.opened++;
    this._new = {};
    this._confirm = false;
    await this.updateComplete;
    this.querySelector("dialog")?.showModal();
  }

  close() {
    this.querySelector("dialog")?.close();
  }

  /** @param {SubmitEvent} e */
  save(e) {
    e.preventDefault();
    const card = this.card;
    if (!card) return;
    const f = new FormData(/** @type {HTMLFormElement} */ (e.target));
    const str = (/** @type {string} */ k) => String(f.get(k) ?? "");
    const pick = (/** @type {string} */ k, /** @type {typeof lanes} */ list) => {
      const v = this._new[k] ? cleanText(str(k + "-new")) : str(k) || null;
      if (v) addName(v, list);
      return v;
    };
    patchCard(card.id, {
      description: str("description").trim(),
      url: str("url").trim() || card.url,
      lane: pick("lane", lanes),
      from: pick("from", people),
      readAt: f.has("read") ? (card.readAt ?? Date.now()) : null,
    });
    this.close();
  }

  remove() {
    if (!this.card) return;
    if (!this._confirm) {
      this._confirm = true;
      return;
    }
    removeCard(this.card.id);
    this.close();
  }

  /**
   * A dropdown of names plus "new…", which swaps in a text field.
   * @param {string} name
   * @param {string} label
   * @param {string[]} options
   * @param {string|null} value
   */
  pickOrCreate(name, label, options, value) {
    if (this._new[name])
      return html`<label>${label}
        <span class="row"><input name="${name}-new" placeholder="new ${label}" autofocus>
        <button type="button" class="btn" @click=${() => (this._new = { ...this._new, [name]: false })}>cancel</button></span>
      </label>`;
    return html`<label>${label}
      <select name=${name} @change=${(/** @type {Event} */ e) => {
        if (/** @type {HTMLSelectElement} */ (e.target).value === NEW) this._new = { ...this._new, [name]: true };
      }}>
        <option value="" ?selected=${!value}>—</option>
        ${options.map((o) => html`<option ?selected=${o === value}>${o}</option>`)}
        <option value=${NEW}>new ${label}…</option>
      </select>
    </label>`;
  }

  render() {
    const c = this.card;
    return html`<dialog class="editor settings window">
      <div class="titlebar"><span>edit card</span>
        <button type="button" class="btn close" aria-label="Close" @click=${() => this.close()}>[x]</button></div>
      ${repeat(c ? [c] : [], () => this.opened, (c) => html`<form @submit=${this.save}>
            <label>description <textarea name="description" rows="3" .value=${c.description}></textarea></label>
            <label>link <input name="url" type="url" .value=${c.url}></label>
            ${this.pickOrCreate("lane", "lane", lanes.get(), c.lane)}
            ${this.pickOrCreate("from", "from", people.get(), c.from)}
            <label class="check"><input type="checkbox" name="read" ?checked=${!!c.readAt}> read</label>
            <div class="row">
              <button type="button" class="btn danger" @click=${this.remove}>${this._confirm ? "really delete?" : "delete"}</button>
              <button class="btn primary">save</button>
            </div>
          </form>`)}
    </dialog>`;
  }
}
