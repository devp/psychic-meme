import { ReactiveElement, esc } from "../reactive-element.js";

/**
 * The seed list. These items are the actual steps to turn this starter into
 * your app -- the demo app documents itself, then you delete it.
 *
 * Lives here rather than in app.js so that deleting this file takes the
 * scaffolding copy with it.
 */
export const SETUP_STEPS = [
  { text: "Rename the app: manifest.webmanifest, <title>, and CACHE in sw.js", done: false },
  { text: "Pick your palette: the :root and [data-theme] blocks in style.css", done: false },
  { text: "Replace icons/pizza.svg (or keep the pizza, it's not hurting anyone)", done: false },
  { text: "Run `just check` - typecheck and precache list should both pass", done: false },
  { text: "Add a second panel, to prove you understand the tab wiring", done: false },
  { text: "Delete components/checklist.js and build your thing", done: false },
];

export class Checklist extends ReactiveElement {
  static reactive = ["record"];

  constructor() {
    super();
    /** @type {import("../../../lib/store.js").StoredRecord|null} */
    this.record = null;
    /** @type {any} */
    this.store = null;
  }

  setup() {
    const refresh = () => {
      if (!this.store) return;
      const id = this.store.getActiveId();
      // reassign to a fresh object so the reactive setter sees a new value --
      // the store hands back live references, which compare equal to themselves
      const rec = id ? this.store.get(id) : null;
      this.record = rec ? { ...rec, items: rec.items.slice() } : null;
    };
    if (this.store) this.track(this.store.subscribe(refresh));
    refresh();

    this.on("change", "input[type=checkbox]", (el) => {
      const id = el.getAttribute("data-id");
      if (id && this.record) {
        this.store.updateItem(this.record.id, id, {
          done: /** @type {HTMLInputElement} */ (el).checked,
        });
      }
    });

    this.on("click", "button[data-remove]", (el) => {
      const id = el.getAttribute("data-remove");
      if (id && this.record) this.store.removeItem(this.record.id, id);
    });

    this.on("submit", "form", (el, e) => {
      e.preventDefault();
      const input = /** @type {HTMLInputElement|null} */ (
        el.querySelector("input[name=text]")
      );
      const text = input ? input.value.trim() : "";
      if (!text || !this.record) return;
      this.store.append(this.record.id, { text, done: false });
    });
  }

  render() {
    const items = this.record ? this.record.items : [];
    const done = items.filter((i) => i.done).length;

    this.innerHTML = `
      <p class="count">${done} of ${items.length} done</p>
      <ul class="checklist">
        ${items
          .map(
            (i) => `<li class="${i.done ? "done" : ""}">
              <label>
                <input type="checkbox" data-id="${esc(i.id)}" ${i.done ? "checked" : ""}>
                <span>${esc(i.text)}</span>
              </label>
              <button type="button" data-remove="${esc(i.id)}" aria-label="Delete">&times;</button>
            </li>`
          )
          .join("")}
      </ul>
      <form class="add-row">
        <input name="text" type="text" placeholder="Add an item"
               autocomplete="off" autocapitalize="sentences">
        <button type="submit">Add</button>
      </form>
    `;
    // Note: the add field above is rebuilt on every render, so toggling a
    // checkbox while typing loses your caret. That is the point -- it's the
    // probe for comparing this variant against the lit one, which updates
    // only the changed nodes and leaves a focused input alone.
  }
}
