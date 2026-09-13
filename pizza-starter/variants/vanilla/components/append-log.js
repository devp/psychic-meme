import { ReactiveElement, esc } from "../reactive-element.js";

/**
 * An append-only log: chat, REPL transcript, build output, event feed.
 *
 * A *travelling* component -- plain properties, no app state imported, so it
 * lifts into another project unchanged.
 *
 * It exists because a naive re-render is wrong for growing lists in two ways
 * that only show up once you've shipped:
 *
 *   1. ACCESSIBILITY. A log is `role="log"` with `aria-live="polite"`, so
 *      replacing its innerHTML makes a screen reader re-announce the entire
 *      history every time one line arrives. Appending announces only what's
 *      new. This is the real reason the component exists.
 *   2. SCROLL. Rebuilding resets scroll position, yanking you away from what
 *      you were reading.
 *
 * Everything below is shared by all three item-creation strategies. Subclasses
 * override exactly one method -- createItem() -- which is the only thing that
 * actually differs between them. See append-log-template.js and
 * append-log-fetch.js, and COMPARISON.md axis 3.
 */
export class AppendLog extends ReactiveElement {
  static reactive = ["items"];

  constructor() {
    super();
    /** @type {{id: string}[]} */
    this.items = [];
    /** @type {string[]} ids currently painted, in order */
    this._painted = [];
  }

  setup() {
    this.setAttribute("role", "log");
    this.setAttribute("aria-live", "polite");
  }

  /**
   * Turn one item into DOM. The only thing the three strategies differ on.
   * @param {any} item
   * @returns {Node}
   */
  createItem(item) {
    throw new Error("createItem must be implemented");
  }

  /** @param {{id: string}[]} items */
  _appendItems(items) {
    const frag = document.createDocumentFragment();
    for (const item of items) frag.appendChild(this.createItem(item));
    this.appendChild(frag);
  }

  /** Within a few px of the bottom counts as "following along". */
  _isAtBottom() {
    return this.scrollHeight - this.scrollTop - this.clientHeight < 8;
  }

  render() {
    const items = /** @type {{id: string}[]} */ (this.items ?? []);
    const ids = items.map((i) => i.id);

    // Was the reader pinned to the bottom? Decide before mutating.
    const wasAtBottom = this._isAtBottom();

    const isAppend =
      this._painted.length <= ids.length && this._painted.every((id, i) => ids[i] === id);

    if (isAppend) {
      this._appendItems(items.slice(this._painted.length));
    } else {
      this.setAttribute("aria-busy", "true");
      this.replaceChildren();
      this._appendItems(items);
      this.removeAttribute("aria-busy");
    }

    this._painted = ids;

    if (wasAtBottom) this.scrollTop = this.scrollHeight;
  }
}

/**
 * STRATEGY A -- markup as a string in JS.
 *
 * Host supplies `renderItem(item) -> HTML string`. Simple and self-contained;
 * the cost is that every interpolation must be escaped by hand, forever, and
 * the markup isn't HTML as far as your editor is concerned.
 */
export class AppendLogString extends AppendLog {
  constructor() {
    super();
    /** @type {(item: any) => string} */
    this.renderItem = (item) => `<div class="log-entry">${esc(item.text ?? "")}</div>`;
  }

  /** @param {any} item @returns {Node} */
  createItem(item) {
    const tpl = document.createElement("template");
    tpl.innerHTML = this.renderItem(item).trim();
    return tpl.content;
  }
}
