import { LitElement, html, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { STAPLES, STORES } from "../data/staples.js";
import { RECIPE_BY_ID } from "../data/recipes.js";
import { buildShoppingList } from "../lib/plan.js";
import { plan, pantry, cart, pantryMap, planItems, cartIds, note } from "../state.js";

/**
 * The week's list, grouped by store.
 *
 * Generated, never edited: it's the union of what the picked nights need and
 * what you've flagged for restocking, so the way to change the list is to
 * change the plan or the pantry. An editable list would immediately disagree
 * with both, and then you'd have three sources of truth and trust none.
 *
 * No quantities. Four dishes wanting onions is one line -- how many onions is
 * a judgement you make at the shelf, and an invented number would just be
 * wrong more confidently.
 */
export class ShoppingList extends LitElement {
  static properties = { version: { type: Number }, copied: { type: Boolean } };

  createRenderRoot() {
    return this;
  }

  constructor() {
    super();
    this.version = 0;
    this.copied = false;
    /** @type {(() => void)[]} */
    this._teardown = [];
  }

  connectedCallback() {
    super.connectedCallback();
    const bump = () => this.version++;
    this._teardown.push(plan.subscribe(bump), pantry.subscribe(bump), cart.subscribe(bump));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._teardown.forEach((off) => off());
    this._teardown = [];
  }

  /** @returns {import("../lib/plan.js").ShoppingGroup[]} */
  get _groups() {
    const picks = planItems()
      .map((p) => RECIPE_BY_ID.get(p.recipeId))
      .filter((r) => r !== undefined);
    return buildShoppingList({
      picks: /** @type {import("../data/recipes.js").Recipe[]} */ (picks),
      pantry: pantryMap(),
      staples: STAPLES,
      stores: STORES,
    });
  }

  /** @param {string} stapleId */
  _toggle(stapleId) {
    const rec = cart.ensureActive();
    const row = cart.get(rec.id)?.items.find((i) => i.stapleId === stapleId);
    if (row) cart.removeItem(rec.id, row.id);
    else cart.append(rec.id, { stapleId });
  }

  /**
   * Unpacking the bags, in one tap: everything you ticked is now on hand, and
   * the cart empties. This is the loop that keeps the pantry honest -- without
   * it you'd re-toggle 12 staples by hand and stop bothering by week three.
   */
  _restocked() {
    const inCart = cartIds();
    if (inCart.size === 0) return;
    const pantryId = pantry.getActiveId();
    const rec = pantryId ? pantry.get(pantryId) : null;
    if (rec && pantryId) {
      for (const row of rec.items) {
        if (inCart.has(row.stapleId)) pantry.updateItem(pantryId, row.id, { status: "have" });
      }
    }
    const cartId = cart.getActiveId();
    if (cartId) cart.clearItems(cartId);
    note(`put away ${inCart.size} ${inCart.size === 1 ? "item" : "items"}`);
  }

  /** Plain text, because the list's other home is a text to whoever's out. */
  _copy() {
    const text = this._groups
      .map((g) => `${g.store.name}\n` + g.lines.map((l) => `- ${l.name}`).join("\n"))
      .join("\n\n");
    navigator.clipboard?.writeText(text).then(
      () => {
        this.copied = true;
        setTimeout(() => (this.copied = false), 1600);
      },
      () => {
        /* clipboard denied -- the list is still on screen */
      }
    );
  }

  render() {
    const groups = this._groups;
    const inCart = cartIds();
    const total = groups.reduce((n, g) => n + g.lines.length, 0);

    if (total === 0) {
      return html`<p class="deck-empty">
        <strong>Nothing to buy.</strong> Every staple the week needs is on hand. Flag
        something on the <em>pantry</em> tab and it shows up here.
      </p>`;
    }

    return html`
      <p class="panel-note">
        ${total} ${total === 1 ? "item" : "items"} across
        ${groups.length} ${groups.length === 1 ? "store" : "stores"} ·
        ${inCart.size} in the cart
      </p>

      ${repeat(
        groups,
        (g) => g.store.id,
        (g) => html`
          <h3 class="kind-head">
            ${g.store.name}
            <span class="store-note">${g.store.note}</span>
          </h3>
          <ul class="shop">
            ${repeat(g.lines, (l) => l.stapleId, (l) => this._renderLine(l, inCart.has(l.stapleId)))}
          </ul>
        `
      )}

      <div class="add-row">
        <button type="button" @click=${() => this._copy()}>
          ${this.copied ? "Copied" : "Copy as text"}
        </button>
        <button
          type="button"
          class="primary-inline"
          ?disabled=${inCart.size === 0}
          @click=${() => this._restocked()}
        >
          Put away ${inCart.size || ""}
        </button>
      </div>
    `;
  }

  /**
   * @param {import("../lib/plan.js").ShoppingLine} line
   * @param {boolean} checked
   */
  _renderLine(line, checked) {
    return html`<li class=${checked ? "got" : ""}>
      <label>
        <input type="checkbox" .checked=${checked} @change=${() => this._toggle(line.stapleId)} />
        <span class="shop-name">${line.name}</span>
      </label>
      <span class=${"shop-status " + line.status}>${line.status}</span>
      <span class="shop-why">
        ${line.restockOnly
          ? "restock"
          : line.forDishes.length === 1
            ? line.forDishes[0]
            : `${line.forDishes[0]} +${line.forDishes.length - 1}`}
      </span>
    </li>`;
  }
}
