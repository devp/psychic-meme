import { ReactiveElement } from "../lib/reactive-element.js";
import { lists } from "../state.js";

/**
 * "2 of 6 done" plus the first few unfinished items; click one to tick it off.
 * The worked example for lib/reactive-element.js -- no Lit, DOM built by hand.
 * Same store as <pizza-checklist>, so ticking here updates the list tab too.
 */
export class ListSummary extends ReactiveElement {
  static properties = ["record", "limit"];

  constructor() {
    super();
    // Reactive properties: assigned here, never as class fields.
    /** @type {import("../lib/store.js").StoredRecord | null} */
    this.record = null;
    this.limit = 3;
    /** @type {(() => void) | undefined} */
    this._unsubscribe = undefined;

    // update() replaces the children, so listeners on them would be lost.
    // One listener on the element itself, for its whole life.
    this.addEventListener("click", (e) => {
      const li = e.target instanceof Element ? e.target.closest("li[data-id]") : null;
      if (li && this.record) lists.updateItem(this.record.id, li.getAttribute("data-id") ?? "", { done: true });
    });
  }

  connectedCallback() {
    super.connectedCallback(); // schedules the first update
    const refresh = () => {
      const id = lists.getActiveId();
      this.record = id ? lists.get(id) : null; // reads are fresh copies, so this always counts as a change
    };
    this._unsubscribe = lists.subscribe(refresh);
    refresh();
  }

  disconnectedCallback() {
    this._unsubscribe?.();
  }

  update() {
    // Derived values: computed at the top of update().
    const items = this.record?.items ?? [];
    const open = items.filter((i) => !i.done);

    // Attribute read once, from the HTML.
    const title = this.getAttribute("title-text") ?? "To do";
    // Reflected, so CSS can style [empty].
    this.toggleAttribute("empty", open.length === 0);

    // Rebuild the DOM. textContent, not innerHTML: no escaping to get wrong.
    const heading = document.createElement("p");
    heading.className = "count";
    heading.textContent = `${title}: ${items.length - open.length} of ${items.length} done`;
    const ul = document.createElement("ul");
    ul.className = "summary";
    for (const item of open.slice(0, this.limit)) {
      const li = document.createElement("li");
      li.dataset.id = item.id;
      li.textContent = item.text;
      ul.append(li);
    }
    this.replaceChildren(heading, ul);
  }
}
