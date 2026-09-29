import { tab } from "../state.js";

/**
 * Tab strip, one tab per `.panel[data-panel]` in the page; `data-label` overrides
 * the label. Renders once; the `tab` subscriber in app.js marks the active one.
 */
export class Tabs extends HTMLElement {
  connectedCallback() {
    this.setAttribute("role", "tablist");
    for (const panel of document.querySelectorAll(".panel[data-panel]")) {
      const id = panel.getAttribute("data-panel") ?? "";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tab";
      button.setAttribute("role", "tab");
      button.dataset.tab = id;
      button.textContent = panel.getAttribute("data-label") ?? id;
      button.addEventListener("click", () => tab.set(id));
      this.append(button);
    }
  }
}
