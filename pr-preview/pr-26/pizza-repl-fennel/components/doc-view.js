/**
 * A vendored markdown doc, rendered with vendor/marked.min.js (a classic
 * script, loaded by index.html) the first time `load()` is called -- the
 * big references cost nothing until their tab is opened.
 *
 * `headings` is a flat h2/h3 outline with stable ids, for a jump-to-section
 * list: an installed app has no browser chrome, so no find-in-page.
 *
 *   <doc-view src="docs/x.md"></doc-view>   el.preprocess = (md) => md
 */
export class DocView extends HTMLElement {
  constructor() {
    super();
    /** @type {(md: string) => string} */
    this.preprocess = (md) => md;
    /** @type {{id: string, text: string, level: number}[]} */
    this.headings = [];
    /** @type {Promise<void> | null} */
    this._loading = null;
  }

  /** Idempotent. Resolves once rendered, or once the error is shown. */
  load() {
    this._loading ??= this._render();
    return this._loading;
  }

  async _render() {
    this.replaceChildren(status("loading…"));
    try {
      const res = await fetch(this.getAttribute("src") ?? "");
      if (!res.ok) throw new Error("HTTP " + res.status);
      const md = await res.text();
      // warn-ok: innerhtml-assign -- vendored docs, rendered by marked; not user input
      this.innerHTML = /** @type {any} */ (globalThis).marked.parse(this.preprocess(md));
      this.headings = outline(this);
    } catch (err) {
      this._loading = null; // let a later visit retry
      this.replaceChildren(
        status(
          `Couldn’t load this reference (${err instanceof Error ? err.message : err}). ` +
            "If you’re offline and this app hasn’t finished caching yet, reconnect once and revisit.",
          true
        )
      );
    }
  }
}

/** @param {string} text @param {boolean} [error] */
function status(text, error = false) {
  const p = document.createElement("p");
  p.className = error ? "doc-status error" : "doc-status";
  p.textContent = text;
  return p;
}

/** @param {HTMLElement} root */
function outline(root) {
  /** @type {Set<string>} */
  const used = new Set();
  /** @type {{id: string, text: string, level: number}[]} */
  const items = [];
  for (const h of root.querySelectorAll("h2, h3")) {
    const text = (h.textContent ?? "").trim();
    if (!text) continue;
    const base = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "section";
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    h.id = id;
    items.push({ id, text, level: h.tagName === "H2" ? 2 : 3 });
  }
  return items;
}
