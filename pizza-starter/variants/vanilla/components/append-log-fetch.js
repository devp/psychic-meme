import { AppendLog } from "./append-log.js";

/**
 * STRATEGY C -- markup in its own file, fetched by the component.
 *
 * The fetch happens at MODULE LOAD, not render: top-level await blocks this
 * module until the template is parsed, so by the time anything calls
 * customElements.define() every instance renders synchronously. No loading
 * state, no flash, no async connectedCallback.
 *
 * import.meta.url is what makes it isolate: the path resolves relative to this
 * file, so append-log-fetch.js and append-log-entry.html travel together and
 * work wherever they land.
 *
 * The cost is one request on the critical path -- top-level await blocks the
 * module graph, so nothing paints until the HTML arrives. Served from the
 * precache after first install; a cold first load pays a round trip.
 */
const res = await fetch(new URL("./append-log-entry.html", import.meta.url));
const TPL = document.createElement("template");
TPL.innerHTML = (await res.text()).trim();

export class AppendLogFetch extends AppendLog {
  constructor() {
    super();
    /** @type {(node: DocumentFragment, item: any) => void} */
    this.fill = () => {};
  }

  /** @param {any} item @returns {Node} */
  createItem(item) {
    const node = /** @type {DocumentFragment} */ (TPL.content.cloneNode(true));
    this.fill(node, item);
    return node;
  }
}
