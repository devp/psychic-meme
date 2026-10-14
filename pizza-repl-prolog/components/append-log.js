import { LitElement, html } from "lit";
import { repeat } from "lit/directives/repeat.js";

/**
 * An append-only log: chat, REPL transcript, build output, event feed.
 * A travelling component: takes plain properties, imports no app state.
 *
 * Keyed `repeat()` does the identity work. Existing entries keep their DOM nodes because the key says they're the
 * same item, so a screen reader on this `aria-live` region only hears what's
 * actually new. No prefix comparison, no manual append path, no aria-busy
 * dance -- a wholesale replacement is just a diff that removes old keys and
 * adds new ones, which announces correctly on its own.
 *
 * Scroll pinning is still hand-written: no framework knows whether the reader
 * was following along or had scrolled up to re-read something.
 */
export class AppendLog extends LitElement {
  static properties = {
    items: {},
    renderItem: {},
  };

  // Light DOM: the global stylesheet applies and aria-live works without a shadow boundary.
  createRenderRoot() {
    return this;
  }

  constructor() {
    super();
    /** @type {{id: string}[]} */
    this.items = [];
    /** @type {(item: any) => unknown} */
    this.renderItem = (item) => html`<div class="log-entry">${item.text ?? ""}</div>`;
    this._wasAtBottom = true;
  }

  connectedCallback() {
    super.connectedCallback();
    this.setAttribute("role", "log");
    this.setAttribute("aria-live", "polite");
  }

  /** Decide before the DOM changes. */
  willUpdate() {
    this._wasAtBottom = this.scrollHeight - this.scrollTop - this.clientHeight < 8;
  }

  /** Follow new entries only if they were already following. */
  updated() {
    if (this._wasAtBottom) this.scrollTop = this.scrollHeight;
  }

  render() {
    return html`${repeat(
      this.items,
      (item) => item.id,
      (item) => this.renderItem(item)
    )}`;
  }
}
