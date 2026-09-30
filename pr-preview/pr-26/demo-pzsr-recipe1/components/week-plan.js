import { LitElement, html, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { RECIPE_BY_ID, LANE_LABEL, METHOD_LABEL } from "../data/recipes.js";
import { STAPLE_BY_ID } from "../data/staples.js";
import { NIGHTS, missingFor } from "../lib/plan.js";
import { plan, pantry, pantryMap, planItems, note } from "../state.js";
import { formatPrep } from "./pick-deck.js";

/**
 * Seven slots. Whatever the deck landed on, and nothing else.
 *
 * This tab is deliberately not where planning happens -- there's no dish
 * picker here, because a picker here would be the library view again and the
 * deck would stop being the front door. It only answers "what did I decide"
 * and lets you undo or shuffle a night.
 */
export class WeekPlan extends LitElement {
  static properties = { version: { type: Number } };

  createRenderRoot() {
    return this;
  }

  constructor() {
    super();
    this.version = 0;
    /** @type {(() => void)[]} */
    this._teardown = [];
  }

  connectedCallback() {
    super.connectedCallback();
    const bump = () => this.version++;
    this._teardown.push(plan.subscribe(bump), pantry.subscribe(bump));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._teardown.forEach((off) => off());
    this._teardown = [];
  }

  /** @param {string} itemId */
  _remove(itemId) {
    const id = plan.getActiveId();
    if (!id) return;
    const pick = planItems().find((p) => p.id === itemId);
    plan.removeItem(id, itemId);
    if (pick) note(`freed up: ${RECIPE_BY_ID.get(pick.recipeId)?.name ?? "a night"}`);
  }

  /**
   * Reassign a night, swapping with whatever was already there. A move that
   * silently evicted the other dish would be a decision the app made for you
   * without saying so.
   *
   * @param {string} itemId
   * @param {string} night
   */
  _moveTo(itemId, night) {
    const id = plan.getActiveId();
    if (!id) return;
    const picks = planItems();
    const moving = picks.find((p) => p.id === itemId);
    if (!moving || moving.night === night) return;
    const sitting = picks.find((p) => p.night === night);
    if (sitting) plan.updateItem(id, sitting.id, { night: moving.night });
    plan.updateItem(id, itemId, { night });
  }

  /** A fresh week is a new record, so last week's picks are still on disk. */
  _newWeek() {
    plan.create("week of " + new Date().toLocaleDateString());
    note("started a fresh week");
  }

  render() {
    const picks = planItems();
    const pan = pantryMap();
    const byNight = new Map(picks.map((p) => [p.night, p]));
    const planned = picks.length;
    const minutes = picks.reduce((n, p) => n + (RECIPE_BY_ID.get(p.recipeId)?.prep ?? 0), 0);

    return html`
      <p class="panel-note">
        ${planned} of 7 nights picked${planned > 0 ? html` · ${formatPrep(minutes)} of cooking` : nothing}
      </p>

      <ol class="nights">
        ${repeat(
          NIGHTS,
          (n) => n.id,
          (n) => this._renderNight(n, byNight.get(n.id), pan)
        )}
      </ol>

      ${planned > 0
        ? html`<div class="add-row">
            <button type="button" @click=${() => this._newWeek()}>Start a fresh week</button>
          </div>`
        : nothing}
    `;
  }

  /**
   * @param {{id: string, label: string}} night
   * @param {{id: string, recipeId: string, night: string}|undefined} pick
   * @param {Map<string, string>} pan
   */
  _renderNight(night, pick, pan) {
    const recipe = pick ? RECIPE_BY_ID.get(pick.recipeId) : undefined;
    if (!pick || !recipe) {
      return html`<li class="night open">
        <span class="night-label">${night.label}</span>
        <span class="night-empty">open</span>
      </li>`;
    }
    const missing = missingFor(recipe, pan);
    return html`<li class="night">
      <span class="night-label">${night.label}</span>
      <div class="night-dish">
        <strong>${recipe.name}</strong>
        <span class="night-meta">
          ${LANE_LABEL.get(recipe.lane)} · ${METHOD_LABEL.get(recipe.method)} ·
          ${formatPrep(recipe.prep)}
        </span>
        ${missing.length > 0
          ? html`<span class="night-missing"
              >buy: ${missing.map((id) => STAPLE_BY_ID.get(id)?.name ?? id).join(", ")}</span
            >`
          : nothing}
      </div>
      <label class="night-move">
        <span class="sr-only">Move ${recipe.name} to another night</span>
        <select
          @change=${(/** @type {Event} */ e) =>
            this._moveTo(pick.id, /** @type {HTMLSelectElement} */ (e.target).value)}
        >
          ${NIGHTS.map(
            (n) => html`<option value=${n.id} ?selected=${n.id === pick.night}>${n.label}</option>`
          )}
        </select>
      </label>
      <button type="button" class="night-x" aria-label=${"Remove " + recipe.name}
              @click=${() => this._remove(pick.id)}>&times;</button>
    </li>`;
  }
}
