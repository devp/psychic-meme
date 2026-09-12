// A ~40-line reactive base class over plain custom elements.
//
// Deliberate non-goals: rendering performance and style isolation. These are
// toy apps; a full innerHTML rebuild of a few dozen nodes is free, and light
// DOM means the global stylesheet just works.
//
// That choice has one hard consequence: replacing innerHTML orphans every
// listener attached to a child. So listeners go on the host and dispatch by
// closest() -- use on() below and you can't get this wrong.

export class ReactiveElement extends HTMLElement {
  /**
   * Property names that trigger a re-render when assigned.
   *
   * WARNING: never also declare one of these as a class field. `record = null`
   * (or even a bare `record;`) creates an *own* property that shadows the
   * accessor installed below, and assignments silently stop re-rendering.
   * Initialize in the constructor instead -- by then the accessor exists, so
   * the assignment goes through it. This has bitten twice.
   *
   * @type {string[]}
   */
  static reactive = [];

  /** @param {string} tag */
  static define(tag) {
    for (const name of this.reactive) {
      Object.defineProperty(this.prototype, name, {
        get() {
          return this._props[name];
        },
        /** @param {any} value */
        set(value) {
          if (this._props[name] === value) return;
          this._props[name] = value;
          this.schedule();
        },
        configurable: true,
      });
    }
    customElements.define(tag, this);
  }

  constructor() {
    super();
    /** @type {Record<string, any>} */
    this._props = {};
    /** @type {Array<() => void>} */
    this._teardowns = [];
    this._dirty = false;
  }

  connectedCallback() {
    this.setup();
    // setup() often subscribes to a store that fires immediately, which already
    // scheduled a render -- don't do it twice.
    if (!this._dirty) this.render();
  }

  disconnectedCallback() {
    this._teardowns.forEach((fn) => fn());
    this._teardowns = [];
  }

  /** Subscribe to stores here; anything registered is torn down on removal. */
  setup() {}

  /** Override. Typically `this.innerHTML = ...`. */
  render() {}

  /**
   * Register a cleanup function -- pass the unsubscribe a store hands back.
   * @param {() => void} fn
   */
  track(fn) {
    this._teardowns.push(fn);
  }

  /**
   * Delegated event binding. Survives innerHTML replacement because the
   * listener lives on the host, not on the children being replaced.
   * @param {string} type
   * @param {string} selector
   * @param {(el: Element, e: Event) => void} handler
   */
  on(type, selector, handler) {
    /** @param {Event} e */
    const listener = (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const match = target.closest(selector);
      if (match && this.contains(match)) handler(match, e);
    };
    this.addEventListener(type, listener);
    this.track(() => this.removeEventListener(type, listener));
  }

  /** Coalesce N assignments in one turn into a single render. */
  schedule() {
    if (this._dirty) return;
    this._dirty = true;
    queueMicrotask(() => {
      this._dirty = false;
      if (this.isConnected) this.render();
    });
  }
}

/**
 * Escape text for interpolation into an innerHTML string.
 * Not optional: item text comes from the user.
 * @param {unknown} value
 * @returns {string}
 */
export function esc(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c
  );
}
