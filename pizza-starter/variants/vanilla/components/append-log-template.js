import { AppendLog } from "./append-log.js";

/**
 * STRATEGY B -- markup as a <template> in index.html.
 *
 * The host supplies a template element and a fill function. You write real
 * HTML in the HTML file: editor highlighting, formatting, no escaped quotes.
 * Filling via textContent means escaping is structural -- there is no esc()
 * here and no way to forget it.
 *
 * The tradeoff: the component no longer carries its own markup, so "travelling"
 * now means "travels, if the host provides a matching template".
 */
export class AppendLogTemplate extends AppendLog {
  constructor() {
    super();
    /** @type {HTMLTemplateElement|null} */
    this.template = null;
    /** @type {(node: DocumentFragment, item: any) => void} */
    this.fill = () => {};
  }

  /** @param {any} item @returns {Node} */
  createItem(item) {
    if (!this.template) throw new Error("AppendLogTemplate needs a `template`");
    const node = /** @type {DocumentFragment} */ (this.template.content.cloneNode(true));
    this.fill(node, item);
    return node;
  }
}
