import { LitElement, html, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { STAPLES, KINDS, STORE_BY_ID } from "../data/staples.js";
import { PANTRY_STATES } from "../lib/plan.js";
import { pantry, pantryMap, note } from "../state.js";

/**
 * What's in the kitchen, as three-state rows.
 *
 * "low" exists because it's the state a real kitchen is mostly in, and a
 * two-state pantry forces you to lie: mark half an onion "have" and the deck
 * promises a dish you can't finish; mark it "out" and the list sends you
 * shopping for an onion you have. So: have / low / out, where low and out both
 * mean "put it on the list" but only "out" is a hard stop.
 *
 * The toggle is a segmented control rather than a cycle button. A cycle needs
 * you to read the current state before you can predict what a tap does, which
 * is exactly the tax this app is trying not to charge.
 */
export class PantryGrid extends LitElement {
  static properties = { version: { type: Number }, onlyShort: { type: Boolean } };

  createRenderRoot() {
    return this;
  }

  constructor() {
    super();
    this.version = 0;
    this.onlyShort = false;
    /** @type {(() => void)[]} */
    this._teardown = [];
  }

  connectedCallback() {
    super.connectedCallback();
    this._teardown.push(pantry.subscribe(() => this.version++));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._teardown.forEach((off) => off());
    this._teardown = [];
  }

  /**
   * @param {string} stapleId
   * @param {string} status
   */
  _set(stapleId, status) {
    const id = pantry.getActiveId();
    if (!id) return;
    const rec = pantry.get(id);
    const row = rec?.items.find((i) => i.stapleId === stapleId);
    if (row) {
      if (row.status === status) return;
      pantry.updateItem(id, row.id, { status });
    } else {
      pantry.append(id, { stapleId, status });
    }
    note(`${STAPLES.find((s) => s.id === stapleId)?.name ?? stapleId} → ${status}`);
  }

  render() {
    const pan = pantryMap();
    const short = STAPLES.filter((s) => (pan.get(s.id) ?? "have") !== "have");

    return html`
      <p class="panel-note">
        ${short.length} of ${STAPLES.length} staples are low or out.
        ${short.length > 0 ? html`They're already on the <em>shop</em> list.` : nothing}
      </p>

      <div class="chip-row">
        <button
          type="button"
          class="chip toggle ${this.onlyShort ? "on" : ""}"
          aria-pressed=${this.onlyShort}
          @click=${() => (this.onlyShort = !this.onlyShort)}
        >
          only what's short
        </button>
      </div>

      ${KINDS.map((kind) => {
        const rows = STAPLES.filter(
          (s) => s.kind === kind.id && (!this.onlyShort || (pan.get(s.id) ?? "have") !== "have")
        );
        if (rows.length === 0) return nothing;
        return html`
          <h3 class="kind-head">${kind.label}</h3>
          <ul class="pantry">
            ${repeat(rows, (s) => s.id, (s) => this._renderRow(s, pan.get(s.id) ?? "have"))}
          </ul>
        `;
      })}
    `;
  }

  /**
   * @param {import("../data/staples.js").Staple} staple
   * @param {string} status
   */
  _renderRow(staple, status) {
    return html`<li class=${"p-" + status}>
      <div class="p-name">
        <span>${staple.name}</span>
        <span class="p-store">${STORE_BY_ID.get(staple.store)?.name ?? staple.store}</span>
      </div>
      <div class="p-states" role="radiogroup" aria-label=${staple.name}>
        ${PANTRY_STATES.map(
          (s) => html`<button
            type="button"
            role="radio"
            class=${"p-state " + (status === s ? "on " + s : "")}
            aria-checked=${status === s}
            @click=${() => this._set(staple.id, s)}
          >
            ${s}
          </button>`
        )}
      </div>
    </li>`;
  }
}
