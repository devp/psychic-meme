import { LitElement, html } from "lit";
import { repeat } from "lit/directives/repeat.js";

/**
 * The last few lines you let go of, fading as they rise. Not for reading --
 * just enough to feel the flow. A travelling component: takes `lines`
 * ({id, text}[]), imports no app state.
 *
 * Keyed `repeat()` matters here for more than speed: a line keeps its DOM
 * node as it ages, so the CSS opacity transition between ages actually runs
 * instead of the node being replaced at its new opacity.
 */
export class GhostLines extends LitElement {
  static properties = {
    lines: {},
  };

  /** How many lines linger at all. Older ones are gone from the DOM. */
  static KEEP = 3;

  // Light DOM, so the global stylesheet (and its themes) apply.
  createRenderRoot() {
    return this;
  }

  constructor() {
    super();
    /** @type {{id: string, text: string}[]} */
    this.lines = [];
  }

  connectedCallback() {
    super.connectedCallback();
    // Fading text is decoration; the words are already saved.
    this.setAttribute("aria-hidden", "true");
  }

  render() {
    const shown = this.lines.slice(-GhostLines.KEEP);
    return html`${repeat(
      shown,
      (l) => l.id,
      (l, i) => html`<p class="ghost" data-age=${shown.length - 1 - i}>${l.text}</p>`
    )}`;
  }
}
