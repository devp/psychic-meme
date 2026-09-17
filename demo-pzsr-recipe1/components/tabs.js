import { tab, TABS } from "../state.js";

/**
 * Tab strip. Renders once; the `tab` subscriber in app.js marks the active
 * one, and setBadge() keeps the counts current.
 *
 * The badges are the reason this isn't just five buttons: "week 4" and
 * "shop 11" answer the two questions you'd otherwise switch tabs to ask.
 */
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
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.hidden = true;
      button.append(badge);
      button.addEventListener("click", () => tab.set(t.id));
      this.append(button);
    }
  }

  /**
   * @param {string} tabId
   * @param {number} count zero hides the badge
   */
  setBadge(tabId, count) {
    const badge = this.querySelector(`[data-tab="${tabId}"] .badge`);
    if (!(badge instanceof HTMLElement)) return;
    badge.textContent = String(count);
    badge.hidden = count === 0;
  }
}
