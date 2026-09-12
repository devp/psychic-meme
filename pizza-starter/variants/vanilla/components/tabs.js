import { ReactiveElement, esc } from "../reactive-element.js";

/**
 * Tab strip bound to a persistedValue. The component owns the strip; app.js
 * owns showing/hiding the panels, so the wiring stays visible where you'd
 * look for it.
 */
export class Tabs extends ReactiveElement {
  static reactive = ["tabs", "active"];

  constructor() {
    super();
    /** @type {{id: string, label: string}[]} */
    this.tabs = [];
    /** @type {ReturnType<import("../../../lib/store.js").persistedValue>|null} */
    this.store = null;
    /** @type {string} */
    this.active = "";
  }

  setup() {
    if (this.store) {
      this.track(this.store.subscribe((v) => (this.active = v)));
    }
    this.on("click", "[data-tab]", (el) => {
      const id = el.getAttribute("data-tab");
      if (id && this.store) this.store.set(id);
    });
  }

  render() {
    this.setAttribute("role", "tablist");
    this.innerHTML = this.tabs
      .map((t) => {
        const on = t.id === this.active;
        return `<button type="button" role="tab" class="tab${on ? " active" : ""}"
          data-tab="${esc(t.id)}" aria-selected="${on}">${esc(t.label)}</button>`;
      })
      .join("");
  }
}
