import { ReactiveElement, esc } from "../reactive-element.js";
import { tab, TABS } from "../state.js";

/**
 * Tab strip. app.js owns showing and hiding the panels, so the wiring stays
 * visible where you'd look for it.
 */
export class Tabs extends ReactiveElement {
  static reactive = ["active"];

  setup() {
    this.track(tab.subscribe((v) => (this.active = v)));
    this.on("click", "[data-tab]", (el) => tab.set(el.getAttribute("data-tab") ?? ""));
  }

  render() {
    this.setAttribute("role", "tablist");
    this.innerHTML = TABS.map((t) => {
      const on = t.id === this.active;
      return `<button type="button" role="tab" class="tab${on ? " active" : ""}"
        data-tab="${esc(t.id)}" aria-selected="${on}">${esc(t.label)}</button>`;
    }).join("");
  }
}
