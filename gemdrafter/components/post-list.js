import { LitElement, html } from "lit";
import { repeat } from "lit/directives/repeat.js";
import {
  posts,
  allPosts,
  trashedPosts,
  createPost,
  trashPost,
  restorePost,
  purgePost,
  emptyTrash,
  tab,
} from "../state.js";
import { localDate, fileNames, stats } from "../lib/gemtext.js";

/**
 * Every post, newest first, grouped under the month it was written in, with
 * the trash underneath it.
 *
 * An app component, so it reads state.js directly rather than taking
 * properties -- and it's the app's own, so opening, trashing and purging
 * happen here instead of being relayed to app.js through events nobody else
 * listens to.
 */
export class PostList extends LitElement {
  static properties = { items: {}, trash: {} };

  createRenderRoot() {
    return this;
  }

  constructor() {
    super();
    /** @type {import("../state.js").Post[]} */
    this.items = [];
    /** @type {import("../state.js").Post[]} */
    this.trash = [];
    /** @type {(() => void)|null} */
    this._off = null;
  }

  connectedCallback() {
    super.connectedCallback();
    const refresh = () => {
      this.items = allPosts();
      this.trash = trashedPosts();
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

  _new() {
    createPost();
    tab.set("draft");
  }

  /** @param {import("../state.js").Post} post */
  _purge(post) {
    // The one irreversible button in the app, so it's the one that asks.
    const name = post.title || "this untitled draft";
    const kept = post.revisions.length;
    const also = kept ? ` and its ${kept} checkpoint${kept === 1 ? "" : "s"}` : "";
    if (!confirm(`Delete ${name}${also} from storage? This can't be undone.`)) return;
    purgePost(post.id);
  }

  _empty() {
    const n = this.trash.length;
    if (!confirm(`Delete ${n} post${n === 1 ? "" : "s"} from storage? This can't be undone.`)) return;
    emptyTrash();
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
      ${this._trash()}
    `;
  }

  /**
   * @param {import("../state.js").Post} post
   * @param {boolean} isActive
   * @param {string} slug
   */
  _row(post, isActive, slug) {
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
        <span class="post-file">${slug}</span>
      </button>
      <button type="button" class="post-x" aria-label=${`Move ${post.title || "untitled post"} to trash`}
        @click=${() => trashPost(post.id)}>&times;</button>
    </li>`;
  }

  /**
   * The trash, which exists so that the × above can be a small decision.
   * Nothing leaves storage until you say so here.
   */
  _trash() {
    if (this.trash.length === 0) return html``;
    return html`<details class="trash">
      <summary>Trash — ${this.trash.length}</summary>
      <ul class="posts">
        ${repeat(
          this.trash,
          (p) => p.id,
          (p) => html`<li class="post trashed">
            <span class="post-open">
              <span class="post-title">${p.title || "Untitled"}</span>
              <span class="post-meta">
                written ${localDate(p.createdAt)} · thrown out ${localDate(p.deletedAt)}${p.revisions
                  .length
                  ? ` · ${p.revisions.length} checkpoints kept`
                  : ""}
              </span>
            </span>
            <button type="button" @click=${() => restorePost(p.id)}>Restore</button>
            <button type="button" class="post-x" aria-label=${`Delete ${p.title || "untitled post"} from storage`}
              @click=${() => this._purge(p)}>&times;</button>
          </li>`
        )}
      </ul>
      <div class="add-row">
        <button type="button" @click=${() => this._empty()}>Empty the trash</button>
      </div>
    </details>`;
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
