import { LitElement, html } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { parse } from "../lib/gemtext.js";

/**
 * Renders gemtext the way a client would.
 *
 * A travelling component: it takes a `text` property, imports no app state,
 * and depends on nothing but the parser. Point it at any gemtext -- a draft,
 * a fetched page, a changelog -- and it renders.
 *
 * Escaping is by construction: every interpolation below goes through a Lit
 * template, so a draft containing `<script>` renders as the six characters
 * somebody typed. That is the reason this doesn't build a string of HTML,
 * which is the obvious way to write a markup renderer and the wrong one.
 */
export class GemPreview extends LitElement {
  static properties = {
    text: {},
    linkTarget: {},
  };

  // Light DOM: the app's stylesheet applies, and the preview looks like the
  // rest of the app without a second copy of the theme tokens.
  createRenderRoot() {
    return this;
  }

  constructor() {
    super();
    /** @type {string} */
    this.text = "";
    /** Where a clicked link goes. "_blank" for a real client-ish feel. */
    this.linkTarget = "_blank";
  }

  render() {
    const blocks = parse(this.text);
    if (blocks.length === 0 || (blocks.length === 1 && blocks[0].type === "text" && !blocks[0].text)) {
      return html`<p class="gem-empty">Nothing to preview yet.</p>`;
    }
    // Index as key: blocks have no identity of their own, and a keyed repeat
    // over a re-parsed document would be pretending otherwise.
    return html`${repeat(
      blocks,
      (_, i) => i,
      (b) => this._block(b)
    )}`;
  }

  /** @param {import("../lib/gemtext.js").Block} b */
  _block(b) {
    switch (b.type) {
      case "heading":
        if (b.level === 1) return html`<h1 class="gem-h1">${b.text}</h1>`;
        if (b.level === 2) return html`<h2 class="gem-h2">${b.text}</h2>`;
        return html`<h3 class="gem-h3">${b.text}</h3>`;

      case "link":
        return html`<p class="gem-link">
          <a href=${b.url || "#"} target=${this.linkTarget} rel="noopener noreferrer"
            >${b.label || b.url}</a
          ><span class="gem-scheme">${scheme(b.url)}</span>
        </p>`;

      case "list":
        return html`<ul class="gem-list">
          ${repeat(
            b.items,
            (_, i) => i,
            (item) => html`<li>${item}</li>`
          )}
        </ul>`;

      case "quote":
        return html`<blockquote class="gem-quote">
          ${repeat(
            b.lines,
            (_, i) => i,
            (line) => html`<p>${line}</p>`
          )}
        </blockquote>`;

      case "pre":
        // The alt text is what a screen reader or a text-only client gets
        // instead of the ASCII art, so it belongs on the element, not beside it.
        return html`<pre
          class=${b.closed ? "gem-pre" : "gem-pre unclosed"}
          aria-label=${b.alt || "preformatted text"}
          title=${b.alt}
        ><code>${b.lines.join("\n")}</code></pre>`;

      default:
        return b.text ? html`<p class="gem-text">${b.text}</p>` : html`<div class="gem-blank"></div>`;
    }
  }
}

/**
 * The scheme, shown beside every link, because in gemspace half of them don't
 * open in the browser you're previewing in and you want to know which half.
 * @param {string} url
 * @returns {string}
 */
function scheme(url) {
  const match = /^([a-z][a-z0-9+.-]*):/i.exec(url.trim());
  if (match) return match[1].toLowerCase();
  return url.trim() ? "relative" : "?";
}
