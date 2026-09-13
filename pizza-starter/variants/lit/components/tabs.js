import { LitElement, html } from "../vendor/lit-core.min.js";
import { tab, TABS } from "../state.js";

/** Tab strip. app.js owns showing and hiding the panels. */
export class Tabs extends LitElement {
  static properties = { active: {} };

  createRenderRoot() {
    return this;
  }

  constructor() {
    super();
    // Initialized here, not as a class field: a field would shadow the
    // accessor Lit installs on the prototype. Same hazard as the vanilla
    // variant's -- see SKELETON.md.
    /** @type {string} */
    this.active = "";
    /** @type {(() => void)|null} */
    this._off = null;
  }

  connectedCallback() {
    super.connectedCallback();
    this.setAttribute("role", "tablist");
    this._off = tab.subscribe((v) => (this.active = v));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._off?.();
  }

  render() {
    return html`${TABS.map(
      (t) => html`<button
        type="button"
        role="tab"
        class="tab ${t.id === this.active ? "active" : ""}"
        aria-selected=${t.id === this.active}
        @click=${() => tab.set(t.id)}
      >
        ${t.label}
      </button>`
    )}`;
  }
}
