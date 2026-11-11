import { LitElement, html } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { toolkit, toolkitRecord } from "../state.js";
import { CORNERS } from "../lib/thought.js";

/** @typedef {{ id: string, text: string, corners: string[] }} Tool */

/**
 * <toolkit-list>: your interventions, kept as you go. Tag each with the
 * corners it works from; untagged ones are offered everywhere.
 */
export class ToolkitList extends LitElement {
  static properties = { tools: {} };

  createRenderRoot() {
    return this;
  }

  constructor() {
    super();
    /** @type {Tool[]} */
    this.tools = [];
  }

  connectedCallback() {
    super.connectedCallback();
    const refresh = () => {
      this.tools = /** @type {any} */ (toolkitRecord().items);
    };
    // warn-ok: subscribe-no-teardown -- this element is never removed
    toolkit.subscribe(refresh);
    refresh();
  }

  /** @param {Tool} t @param {string} corner */
  _toggle(t, corner) {
    const corners = t.corners?.includes(corner) ? t.corners.filter((c) => c !== corner) : [...(t.corners ?? []), corner];
    toolkit.updateItem(toolkitRecord().id, t.id, { corners });
  }

  /** @param {Tool} t */
  _remove(t) {
    if (confirm(`Remove "${t.text}" from your toolkit?`)) toolkit.removeItem(toolkitRecord().id, t.id);
  }

  /** @param {SubmitEvent} e */
  _add(e) {
    e.preventDefault();
    const form = /** @type {HTMLFormElement} */ (e.target);
    const input = /** @type {HTMLInputElement} */ (form.elements.namedItem("text"));
    const text = input.value.trim();
    if (!text) return;
    toolkit.append(toolkitRecord().id, { text, corners: [] });
    form.reset();
  }

  render() {
    return html`
      <p class="panel-note">Things you might try. Your own worksheet comes first; edit this to match it.</p>
      <ul class="tools">
        ${repeat(
          this.tools,
          (t) => t.id,
          (t) => html`<li>
            <span class="tool-text">${t.text}</span>
            <span class="tool-tags">
              ${CORNERS.map((c) => html`<button type="button" class="chip" style=${`--c: var(--c-${c})`}
                  aria-pressed=${String(!!t.corners?.includes(c))} @click=${() => this._toggle(t, c)}>${c}</button>`)}
              <button type="button" class="record-x" aria-label="Remove" @click=${() => this._remove(t)}>×</button>
            </span>
          </li>`
        )}
      </ul>
      <form class="add-row" @submit=${(/** @type {SubmitEvent} */ e) => this._add(e)}>
        <input name="text" type="text" placeholder="Add something to try" autocomplete="off" autocapitalize="sentences" />
        <button type="submit" @pointerdown=${(/** @type {PointerEvent} */ e) => e.preventDefault()}>Add</button>
      </form>
    `;
  }
}
