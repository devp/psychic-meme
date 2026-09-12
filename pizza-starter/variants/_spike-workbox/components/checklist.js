import { ReactiveElement, esc } from "../reactive-element.js";
import { lists, activity } from "../state.js";

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
    // Assigned through the accessor (define() installed it before upgrade), so
    // this does NOT create an own property. Declaring `record = null` as a
    // class field would -- see the warning in reactive-element.js.
    /** @type {import("../../../lib/store.js").StoredRecord|null} */
    this.record = null;
  }

  setup() {
    const refresh = () => {
      const id = lists.getActiveId();
      this.record = id ? lists.get(id) : null;
    };
    this.track(lists.subscribe(refresh));
    refresh();

    this.on("change", "input[type=checkbox]", (el) => {
      const id = el.getAttribute("data-id");
      if (id && this.record) {
        const done = /** @type {HTMLInputElement} */ (el).checked;
        lists.updateItem(this.record.id, id, { done });
        note((done ? "done: " : "undone: ") + itemText(this.record, id));
      }
    });

    this.on("click", "button[data-remove]", (el) => {
      const id = el.getAttribute("data-remove");
      if (id && this.record) {
        note("deleted: " + itemText(this.record, id));
        lists.removeItem(this.record.id, id);
      }
    });

    this.on("submit", "form", (el, e) => {
      e.preventDefault();
      const input = /** @type {HTMLInputElement|null} */ (
        el.querySelector("input[name=text]")
      );
      const text = input ? input.value.trim() : "";
      if (!text || !this.record) return;
      lists.append(this.record.id, { text, done: false });
      note("added: " + text);
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

/**
 * Record an event for the log tab. Two app components talking through the
 * store rather than through each other.
 * @param {string} text
 */
function note(text) {
  const rec = activity.ensureActive();
  activity.append(rec.id, { text, at: Date.now() });
}

/**
 * @param {import("../../../lib/store.js").StoredRecord} record
 * @param {string} itemId
 * @returns {string}
 */
function itemText(record, itemId) {
  return record.items.find((i) => i.id === itemId)?.text ?? "an item";
}
