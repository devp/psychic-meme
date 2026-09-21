import { LitElement, html } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { posts, allPosts, createPost, removePost, tab } from "../state.js";
import { localDate, fileNames, stats } from "../lib/gemtext.js";

/**
 * Every post, newest first, grouped under the month it was written in.
 *
 * An app component, so it reads state.js directly rather than taking
 * properties -- and it's the app's own, so opening and deleting happen here
 * instead of being relayed to app.js through events nobody else listens to.
 */
export class PostList extends LitElement {
  static properties = { items: {} };

  createRenderRoot() {
    return this;
  }

  constructor() {
    super();
    /** @type {import("../state.js").Post[]} */
    this.items = [];
    /** @type {(() => void)|null} */
    this._off = null;
  }

  connectedCallback() {
    super.connectedCallback();
    const refresh = () => {
      this.items = allPosts();
    };
    this._off = posts.subscribe(refresh);
    refresh();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._off) this._off();
    this._off = null;
  }

  /** @param {string} id */
  _open(id) {
    posts.setActive(id);
    tab.set("draft");
  }

  /** @param {import("../state.js").Post} post */
  _remove(post) {
    const name = post.title || "this untitled draft";
    if (!confirm(`Delete ${name}? There is no undo.`)) return;
    removePost(post.id);
  }

  _new() {
    createPost();
    tab.set("draft");
  }

  render() {
    const activeId = posts.getActiveId();
    const names = fileNames(this.items);
    const months = groupByMonth(this.items);

    return html`
      <div class="list-head">
        <p class="panel-note">
          ${this.items.length} ${this.items.length === 1 ? "post" : "posts"}, newest written first
        </p>
        <button type="button" class="primary" @click=${() => this._new()}>New post</button>
      </div>

      ${months.length === 0
        ? html`<p class="gem-empty">No posts yet. Start one.</p>`
        : repeat(
            months,
            (m) => m.key,
            (m) => html`
              <h2 class="month-head">${m.label}</h2>
              <ul class="posts">
                ${repeat(
                  m.posts,
                  (p) => p.id,
                  (p) => this._row(p, p.id === activeId, names.get(p.id) ?? "")
                )}
              </ul>
            `
          )}
    `;
  }

  /**
   * @param {import("../state.js").Post} post
   * @param {boolean} isActive
   * @param {string} file
   */
  _row(post, isActive, file) {
    const s = stats(post.body);
    const edited = post.updatedAt - post.createdAt > 60_000;
    return html`<li class=${isActive ? "post active" : "post"}>
      <button type="button" class="post-open" @click=${() => this._open(post.id)}>
        <span class="post-title">${post.title || "Untitled"}</span>
        <span class="post-meta">
          ${localDate(post.createdAt)} · ${s.words} ${s.words === 1 ? "word" : "words"}${s.links
            ? html` · ${s.links} ${s.links === 1 ? "link" : "links"}`
            : ""}${edited ? html` · edited ${localDate(post.updatedAt)}` : ""}
        </span>
        <span class="post-file">${file}</span>
      </button>
      <button type="button" class="post-x" aria-label=${`Delete ${post.title || "untitled post"}`}
        @click=${() => this._remove(post)}>&times;</button>
    </li>`;
  }
}

/**
 * @param {import("../state.js").Post[]} items newest first
 * @returns {{ key: string, label: string, posts: import("../state.js").Post[] }[]}
 */
function groupByMonth(items) {
  /** @type {{ key: string, label: string, posts: import("../state.js").Post[] }[]} */
  const out = [];
  for (const post of items) {
    const key = localDate(post.createdAt).slice(0, 7);
    const last = out[out.length - 1];
    if (last && last.key === key) last.posts.push(post);
    else
      out.push({
        key,
        label: new Date(post.createdAt).toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
        }),
        posts: [post],
      });
  }
  return out;
}
