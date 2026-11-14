import { LitElement, html, nothing } from "lit";

/**
 * The left rail: search, the brand, and the ways in. A travelling component:
 * plain properties in, events out.
 *
 *   search  detail: the query, as typed (debounced), and again on Enter
 *   about   the About button was pressed
 */
export class SideNav extends LitElement {
  static properties = {
    brand: {},
    searchPlaceholder: {},
    galleries: {},
    active: {},
    hasRecent: { type: Boolean },
  };

  createRenderRoot() {
    return this;
  }

  constructor() {
    super();
    this.brand = "";
    this.searchPlaceholder = "Search";
    /** @type {{ id: string, title: string }[]} */
    this.galleries = [];
    /** @type {string} "concierge", "recent", "search" or "browse/<gallery id>" */
    this.active = "concierge";
    this.hasRecent = false;
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    this._debounce = undefined;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this._debounce);
  }

  /** @param {Map<string, unknown>} changed */
  updated(changed) {
    // Leaving the search results clears the box, so it never shows a stale query.
    if (changed.has("active") && changed.get("active") === "search") {
      const input = this.querySelector("input");
      if (input) input.value = "";
    }
  }

  /**
   * @param {string} query
   * @param {number} wait
   */
  _search(query, wait) {
    clearTimeout(this._debounce);
    this._debounce = setTimeout(() => {
      this.dispatchEvent(new CustomEvent("search", { detail: query.trim(), bubbles: true }));
    }, wait);
  }

  /**
   * @param {string} key
   * @param {string} href
   * @param {string} label
   */
  _link(key, href, label) {
    const current = this.active === key;
    return html`<a class="nav-link" href=${href} aria-current=${current ? "page" : nothing}>${label}</a>`;
  }

  render() {
    return html`<form
        class="nav-search"
        role="search"
        @submit=${(/** @type {SubmitEvent} */ e) => {
          e.preventDefault();
          this._search(this.querySelector("input")?.value ?? "", 0);
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5" /></svg>
        <input
          type="search"
          name="q"
          autocomplete="off"
          aria-label=${this.searchPlaceholder}
          placeholder=${this.searchPlaceholder}
          @input=${(/** @type {InputEvent} */ e) => this._search(/** @type {HTMLInputElement} */ (e.target).value, 250)}
        />
      </form>
      <a class="brand" href="#/">${this.brand}</a>
      <nav class="nav-links" aria-label="Main">
        ${this._link("concierge", "#/", "Concierge")}
        <span class="nav-label">Browse</span>
        ${this.galleries.map((g) => this._link(`browse/${g.id}`, `#/browse/${encodeURIComponent(g.id)}`, g.title))}
        ${this.hasRecent ? this._link("recent", "#/recent", "Recent") : nothing}
        <button class="nav-about" type="button" aria-haspopup="dialog" @click=${() => this.dispatchEvent(new CustomEvent("about", { bubbles: true }))}>
          About
        </button>
      </nav>`;
  }
}
