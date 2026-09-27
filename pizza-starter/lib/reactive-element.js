// A small reactive custom-element base class. Assign a declared property and
// the element re-renders -- once, however many you assigned in a row.
//
//   class Counter extends ReactiveElement {
//     static properties = ["count"];
//     constructor() { super(); this.count = 0; }  // not a class field; see below
//     update() { this.textContent = String(this.count); }
//   }
//   customElements.define("x-counter", Counter);
//
// How it works:
//   1. `static properties` lists names. The first instance turns each into a
//      getter/setter on the prototype (_finalize).
//   2. A setter stores the value and, if it changed, calls requestUpdate().
//   3. requestUpdate schedules one update() on a microtask: after the code that
//      assigned finishes, before the browser paints. Ten assignments = one update.
//
// Class-field footgun: `count = 0;` as a class field defines an own property on
// the instance that hides the setter on the prototype, so assignments stop
// triggering updates. Assign in the constructor. (`just warnings` checks for
// this: class-field-shadow.)
//
// Not doing, on purpose (YAGNI). Compared with Lit's ReactiveElement:
//   - No templating or DOM diffing. update() writes the DOM itself, usually by
//     rebuilding it, so focus and scroll inside the element are lost on each
//     update. Use Lit when that matters (see components/append-log.js).
//   - One hook, update(). No shouldUpdate/willUpdate/firstUpdated/updated:
//     compute derived values at the top of update(); guard first-time work
//     with a flag of your own.
//   - update() isn't told what changed; it redraws everything.
//   - No updateComplete promise. To wait for an update in a test:
//     `await Promise.resolve()`.
//   - Changed = !Object.is. Mutating an array or object in place isn't seen;
//     assign a new one, or call requestUpdate() yourself.
//   - Attributes are not properties here: nothing is observed, converted or
//     reflected. The two cases so far, by hand:
//       read once:  `this.getAttribute("label")` in update() or connectedCallback
//       reflect:    `this.toggleAttribute("open", this.open)` in update()
//     If one must follow later setAttribute calls, add the platform's own
//     `static observedAttributes = [...]` and `attributeChangedCallback` to
//     that subclass.
//   - An update that throws is reported (uncaught error) and not retried; the
//     next assignment schedules a fresh one.

export class ReactiveElement extends HTMLElement {
  /** @type {string[]} */
  static properties = [];

  /** @type {string[]} own and inherited property names, set by _finalize */
  static _names;

  /** Define this class's accessors, once; a parent's first. */
  static _finalize() {
    // hasOwn, not just truthy: a subclass would otherwise see its parent's.
    if (Object.hasOwn(this, "_names") && this._names) return;
    if (this === ReactiveElement) return void (this._names = []);
    const parent = /** @type {typeof ReactiveElement} */ (Object.getPrototypeOf(this));
    parent._finalize();
    // A parent's accessors are already on the parent's prototype, which this
    // class inherits; only this class's own names need defining.
    const own = Object.hasOwn(this, "properties") ? this.properties : [];
    this._names = [...parent._names, ...own];

    for (const name of own) {
      Object.defineProperty(this.prototype, name, {
        get() {
          return this._values[name];
        },
        set(value) {
          if (Object.is(value, this._values[name])) return;
          this._values[name] = value;
          this.requestUpdate();
        },
        configurable: true,
        enumerable: true,
      });
    }
  }

  /** @type {Record<string, unknown>} */
  _values = {};
  _pending = false;

  constructor() {
    super();
    const ctor = /** @type {typeof ReactiveElement} */ (this.constructor);
    ctor._finalize();
    // An element can exist before its class is defined (parsed from HTML, or
    // created by other code), and get properties assigned then. Those land on
    // the instance as plain properties and hide the setters -- the element
    // renders them once, then silently ignores every later assignment. Move
    // them back through the setters.
    const self = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (this));
    for (const name of ctor._names) {
      if (Object.hasOwn(this, name)) {
        const value = self[name];
        delete self[name];
        self[name] = value;
      }
    }
  }

  // First render happens once the element is in the document. Subclasses that
  // override this must call super.connectedCallback().
  connectedCallback() {
    this.requestUpdate();
  }

  /** Schedule one update(). Setters call this; call it after in-place mutation. */
  requestUpdate() {
    if (this._pending) return;
    this._pending = true;
    queueMicrotask(() => {
      this._pending = false;
      // Off-page: skip. connectedCallback asks again when it's attached.
      if (this.isConnected) this.update();
    });
  }

  /** Write the DOM from the current properties. Override this. */
  update() {}
}
