import { LitElement, html } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { posts, activePost, restoreRevision } from "../state.js";
import { stats } from "../lib/gemtext.js";

/**
 * The checkpoints kept for the post being edited, newest first.
 *
 * Restoring is not destructive: state.js checkpoints the current text before
 * putting an old one back, so the button is safe to press to find out what a
 * checkpoint actually contains. That's the difference between a history you
 * use and one you're afraid of.
 */
export class PostHistory extends LitElement {
  static properties = { post: {} };

  createRenderRoot() {
    return this;
  }

  constructor() {
    super();
    /** @type {import("../state.js").Post|null} */
    this.post = null;
    /** @type {(() => void)|null} */
    this._off = null;
  }

  connectedCallback() {
    super.connectedCallback();
    const refresh = () => {
      this.post = activePost();
    };
    this._off = posts.subscribe(refresh);
    refresh();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._off) this._off();
    this._off = null;
  }

  /** @param {import("../state.js").Revision} rev */
  _restore(rev) {
    if (!this.post) return;
    restoreRevision(this.post.id, rev.id);
  }

  render() {
    const revisions = this.post ? this.post.revisions : [];
    if (revisions.length === 0) {
      return html`<p class="gem-empty">
        No checkpoints yet. One is kept whenever you come back to a post after
        a break, and whenever you press Checkpoint.
      </p>`;
    }

    return html`<ul class="revisions">
      ${repeat(
        revisions,
        (r) => r.id,
        (r, i) => this._row(r, revisions[i + 1])
      )}
    </ul>`;
  }

  /**
   * @param {import("../state.js").Revision} rev
   * @param {import("../state.js").Revision|undefined} older the one before it
   */
  _row(rev, older) {
    const words = stats(rev.text).words;
    // Against the previous checkpoint, not against now: "what did this sitting
    // change" is the question you're asking when you're looking at a list.
    const delta = older ? words - stats(older.text).words : 0;
    return html`<li class="revision">
      <div class="rev-meta">
        <span class="rev-when">${new Date(rev.at).toLocaleString()}</span>
        <span class="rev-size"
          >${rev.title || "Untitled"} · ${words} ${words === 1 ? "word" : "words"}${older
            ? html` <span class="rev-delta">${delta >= 0 ? "+" : ""}${delta}</span>`
            : ""}</span
        >
      </div>
      <button type="button" @click=${() => this._restore(rev)}>Restore</button>
    </li>`;
  }
}
