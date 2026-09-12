import { ReactiveElement, esc } from "../reactive-element.js";

/**
 * An append-only log: chat, REPL transcript, build output, event feed.
 *
 * This is a *travelling* component -- it takes plain properties and imports no
 * app state, so it can be lifted into another project unchanged.
 *
 * It exists because a naive re-render is wrong for growing lists in two ways
 * that only show up once you've shipped:
 *
 *   1. ACCESSIBILITY. A log is `role="log"` with `aria-live="polite"`, so
 *      replacing its innerHTML makes a screen reader re-announce the entire
 *      history every time one line arrives. Appending announces only what's
 *      new. This is the real reason the component exists.
 *   2. SCROLL. Rebuilding resets scroll position, yanking you to the top (or
 *      bottom) while you were reading back through it.
 *
 * So: if the new array extends the old by a common prefix, only the tail is
 * appended and existing nodes are never touched. Anything else -- a reset, a
 * reorder, a load of a different session -- falls back to a full rebuild with
 * `aria-busy` set so it isn't announced as a flood of new messages.
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
   * Override in a subclass, or assign as a property -- an own property shadows
   * this method, which is the intended way to use it without subclassing.
   * @param {any} item
   * @returns {string} HTML for one entry
   */
  renderItem(item) {
    return `<div class="log-entry">${esc(item.text ?? "")}</div>`;
  }

  /** @param {{id: string}[]} items */
  _appendItems(items) {
    const frag = document.createDocumentFragment();
    for (const item of items) {
      const tpl = document.createElement("template");
      tpl.innerHTML = this.renderItem(item).trim();
      frag.append(...tpl.content.childNodes);
    }
    this.appendChild(frag);
  }

  /** Within a few px of the bottom counts as "following along". */
  _isAtBottom() {
    return this.scrollHeight - this.scrollTop - this.clientHeight < 8;
  }

  render() {
    // Explicit: the reactive accessor is installed with defineProperty, so TS
    // can't infer the property's type from the constructor assignment.
    const items = /** @type {{id: string}[]} */ (this.items ?? []);
    const ids = items.map((i) => i.id);

    // Was the reader pinned to the bottom? Decide before mutating.
    const wasAtBottom = this._isAtBottom();

    const isAppend =
      this._painted.length <= ids.length &&
      this._painted.every((id, i) => ids[i] === id);

    if (isAppend) {
      this._appendItems(items.slice(this._painted.length));
    } else {
      this.setAttribute("aria-busy", "true");
      this.replaceChildren();
      this._appendItems(items);
      this.removeAttribute("aria-busy");
    }

    this._painted = ids;

    // Follow new entries only if they were already following.
    if (wasAtBottom) this.scrollTop = this.scrollHeight;
  }
}
