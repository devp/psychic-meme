import { tab, TABS } from "../state.js";

/** Tab strip. Renders once; the `tab` subscriber in app.js marks the active one. */
export class Tabs extends HTMLElement {
  connectedCallback() {
    this.setAttribute("role", "tablist");
    for (const t of TABS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tab";
      button.setAttribute("role", "tab");
      button.dataset.tab = t.id;
      button.textContent = t.label;
      button.addEventListener("click", () => tab.set(t.id));
      this.append(button);
    }
  }
}
