import { LitElement, html, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { records, toolkit, toolkitRecord } from "../state.js";
import {
  CORNERS,
  causedBy,
  causes,
  chronological,
  connect,
  connectionsWithout,
  disconnect,
  fromStored,
  isResolved,
  needle,
  titleOf,
} from "../lib/thought.js";
import { chronoText, markdownGraph } from "../lib/export.js";
import { copyText, flash } from "./copy.js";

/** @typedef {import("../lib/thought.js").Category} Category */
/** @typedef {import("../lib/thought.js").Entry} Entry */
/** @typedef {import("../lib/thought.js").Feel} Feel */
/** @typedef {import("../lib/thought.js").ThoughtRecord} ThoughtRecord */

/**
 * What the composer at the bottom is doing.
 * - new: a plain entry, connected to nothing
 * - causes / causedBy: a new (or existing) entry linked to `src`
 * - intervene: an intervention, linked from `src` if there is one
 * @typedef {{ kind: "new" } | { kind: "causes" | "causedBy", src: string } | { kind: "intervene", src?: string }} Mode
 */

/** @type {Category[]} */
const ADDABLE = ["situation", "thought", "feeling", "behavior", "intervention", "resolution"];

/** @type {Record<Category, string>} */
export const LABEL = {
  situation: "Situation",
  thought: "Thought",
  feeling: "Feeling",
  behavior: "Behavior",
  intervention: "Intervention",
  resolution: "Resolve",
};

/** Suggested category for "what does it cause?": the next corner round. @type {Record<Category, Category>} */
const NEXT = {
  situation: "thought",
  thought: "feeling",
  feeling: "behavior",
  behavior: "thought",
  intervention: "thought",
  resolution: "thought",
};

/** Suggested category for "what causes it?". @type {Record<Category, Category>} */
const PREV = {
  situation: "situation",
  thought: "situation",
  feeling: "thought",
  behavior: "feeling",
  intervention: "thought",
  resolution: "intervention",
};

/** @type {Feel[]} */
const FEELS = ["less", "same", "more"];

/** @param {number} ts */
const hhmm = (ts) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** @param {string} s @param {number} n */
const clip = (s, n = 40) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/**
 * <record-view>: the active record. Compass on top, entries in time order,
 * and a composer pinned to the bottom for one-handed entry.
 */
export class RecordView extends LitElement {
  static properties = {
    record: {},
    mode: {},
    category: {},
    feel: {},
    selected: {},
    saveToToolkit: {},
    tools: {},
  };

  createRenderRoot() {
    return this;
  }

  constructor() {
    super();
    // Constructor, not class fields -- a field shadows Lit's accessor.
    /** @type {ThoughtRecord|null} */
    this.record = null;
    /** @type {Mode} */
    this.mode = { kind: "new" };
    /** @type {Category} */
    this.category = "situation";
    /** @type {Feel|null} */
    this.feel = null;
    /** @type {string|null} */
    this.selected = null;
    /** @type {boolean} */
    this.saveToToolkit = false;
    /** @type {{id: string, text: string, corners: string[]}[]} */
    this.tools = [];
  }

  connectedCallback() {
    super.connectedCallback();
    const refresh = () => {
      const id = records.getActiveId();
      const stored = id ? records.get(id) : null;
      this.record = stored ? fromStored(stored) : null;
      this.tools = /** @type {any} */ (toolkitRecord().items);
    };
    // warn-ok: subscribe-no-teardown -- this element is never removed
    records.subscribe(refresh);
    // warn-ok: subscribe-no-teardown -- this element is never removed
    toolkit.subscribe(refresh);
    refresh();
    // A record the composer last started with situation keeps nudging toward a thought.
    if (this.record?.entries.length) this.category = NEXT[chronological(this.record.entries).at(-1)?.category ?? "situation"];
  }

  /** @returns {ThoughtRecord} */
  _ensureRecord() {
    if (this.record) return this.record;
    const created = records.create("");
    records.patch(created.id, { connections: [] });
    return fromStored(/** @type {any} */ (records.get(created.id)));
  }

  /** @param {string} id */
  _entry(id) {
    return this.record?.entries.find((e) => e.id === id);
  }

  _focusInput() {
    this.updateComplete.then(() => {
      /** @type {HTMLInputElement|null} */ (this.querySelector(".composer input[name=text]"))?.focus();
    });
  }

  /** Compass tap or category chip. @param {Category} category */
  _pick(category) {
    this.category = category;
    if (category === "intervention") {
      this.mode = { kind: "intervene", ...(this.mode.kind !== "new" && "src" in this.mode && this.mode.src ? { src: this.mode.src } : {}) };
    } else if (this.mode.kind === "intervene") {
      this.mode = { kind: "new" };
    }
    if (category !== "resolution") this.feel = null;
    this._focusInput();
  }

  /** @param {Mode} mode @param {Category} category */
  _startFrom(mode, category) {
    this.mode = mode;
    this.category = category;
    this.selected = null;
    this._focusInput();
  }

  _cancelMode() {
    this.mode = { kind: "new" };
    if (this.category === "intervention") this.category = "thought";
  }

  /** @param {SubmitEvent} e */
  _submit(e) {
    e.preventDefault();
    const form = /** @type {HTMLFormElement} */ (e.target);
    const input = /** @type {HTMLInputElement} */ (form.elements.namedItem("text"));
    if (this._add(input.value.trim())) form.reset();
  }

  /**
   * @param {string} text
   * @returns {boolean} whether an entry was added
   */
  _add(text) {
    const category = this.category;
    if (!text && !(category === "resolution")) return false;
    const rec = this._ensureRecord();
    /** @type {Record<string, any>} */
    const entry = { category, text, ts: Date.now() };
    if (category === "resolution" && this.feel) entry.feel = this.feel;
    const item = records.append(rec.id, entry);
    if (!item) return false;

    const mode = this.mode;
    let link = null;
    if (mode.kind === "causes") link = causes(mode.src, item.id);
    if (mode.kind === "causedBy") link = causedBy(mode.src, item.id);
    if (mode.kind === "intervene" && mode.src) link = causes(mode.src, item.id);
    if (link) {
      const fresh = fromStored(/** @type {any} */ (records.get(rec.id)));
      records.patch(rec.id, { connections: connect(fresh, link) });
    }

    if (category === "intervention" && this.saveToToolkit && text) {
      const src = mode.kind === "intervene" && mode.src ? this._entry(mode.src) : undefined;
      const corners = src && CORNERS.includes(src.category) ? [src.category] : [];
      toolkit.append(toolkitRecord().id, { text, corners });
    }
    this.saveToToolkit = false;

    // Keep the chain going, quietly: after an entry, the composer asks what it
    // led to. ✕ in the composer stops that.
    if (category === "resolution") {
      this.mode = { kind: "new" };
      this.category = "thought";
      this.feel = null;
    } else if (mode.kind === "new" && category !== "intervention") {
      this.category = NEXT[category];
    } else {
      this.mode = { kind: "causes", src: item.id };
      this.category = NEXT[category];
    }
    this._focusInput();
    return true;
  }

  /** Connect the composer's source to an existing entry. @param {string} otherId */
  _linkExisting(otherId) {
    const rec = this.record;
    const mode = this.mode;
    if (!rec || (mode.kind !== "causes" && mode.kind !== "causedBy")) return;
    const link = mode.kind === "causes" ? causes(mode.src, otherId) : causedBy(mode.src, otherId);
    records.patch(rec.id, { connections: connect(rec, link) });
    this.mode = { kind: "new" };
  }

  /** @param {string} toolText */
  _useTool(toolText) {
    this.category = "intervention";
    this._add(toolText);
  }

  /** @param {Entry} e */
  _delete(e) {
    const rec = this.record;
    if (!rec) return;
    if (!confirm(`Delete this ${e.category}?\n\n${e.text}`)) return;
    records.patch(rec.id, { connections: connectionsWithout(rec, e.id) });
    records.removeItem(rec.id, e.id);
    this.selected = null;
    if ("src" in this.mode && this.mode.src === e.id) this.mode = { kind: "new" };
  }

  /** @param {string} from @param {string} to */
  _disconnect(from, to) {
    const rec = this.record;
    if (rec) records.patch(rec.id, { connections: disconnect(rec, { from, to }) });
  }

  _dismissHint() {
    if (this.record) records.patch(this.record.id, { hintDismissedAt: Date.now() });
  }

  _newRecord() {
    records.create("");
    this.mode = { kind: "new" };
    this.category = "situation";
    this.selected = null;
    this._focusInput();
  }

  /** @param {Event} e @param {"timeline"|"map"} which */
  async _copy(e, which) {
    const button = /** @type {HTMLElement} */ (e.currentTarget);
    if (!this.record) return;
    const text = which === "timeline" ? chronoText(this.record) : markdownGraph(this.record);
    flash(button, await copyText(text));
  }

  // ---- render ---------------------------------------------------------------

  /** @param {ThoughtRecord} rec @param {Entry} e */
  _renderEntry(rec, e) {
    const byId = new Map(rec.entries.map((x) => [x.id, x]));
    const out = rec.connections.filter((c) => c.from === e.id && byId.has(c.to));
    const inc = rec.connections.filter((c) => c.to === e.id && byId.has(c.from));
    const open = this.selected === e.id;
    const stop = (/** @type {Event} */ ev) => ev.stopPropagation();
    /** @param {string} from @param {string} to @param {string} arrow @param {Entry} other */
    const route = (from, to, arrow, other) => html`<span class="route" style=${`--c: var(--c-${other.category})`}>
      ${arrow} ${clip(other.text || LABEL[other.category])}
      ${open
        ? html`<button type="button" class="route-x" aria-label="Remove connection"
            @click=${(/** @type {Event} */ ev) => { stop(ev); this._disconnect(from, to); }}>×</button>`
        : nothing}
    </span>`;

    return html`<li class="entry ${open ? "open" : ""}" style=${`--c: var(--c-${e.category})`}
        data-category=${e.category}
        @click=${() => (this.selected = open ? null : e.id)}>
      <div class="entry-line">
        <time>${hhmm(e.ts)}</time>
        <span class="cat">${e.category}</span>
        <span class="entry-text">${e.text}${e.feel ? html` <em>(feels ${e.feel})</em>` : nothing}</span>
      </div>
      ${out.length || inc.length
        ? html`<div class="routes">
            ${inc.map((c) => route(c.from, c.to, "←", /** @type {Entry} */ (byId.get(c.from))))}
            ${out.map((c) => route(c.from, c.to, "→", /** @type {Entry} */ (byId.get(c.to))))}
          </div>`
        : nothing}
      ${open
        ? html`<div class="entry-actions" @click=${stop}>
            <button type="button" @click=${() => this._startFrom({ kind: "causes", src: e.id }, NEXT[e.category])}>What does it cause?</button>
            <button type="button" @click=${() => this._startFrom({ kind: "causedBy", src: e.id }, PREV[e.category])}>What causes it?</button>
            <button type="button" class="act-intervene" @click=${() => this._startFrom({ kind: "intervene", src: e.id }, "intervention")}>Intervene</button>
            <button type="button" class="act-delete" @click=${() => this._delete(e)}>Delete</button>
          </div>`
        : nothing}
    </li>`;
  }

  _renderComposer() {
    const rec = this.record;
    const mode = this.mode;
    const src = "src" in mode && mode.src ? this._entry(mode.src) : undefined;
    const prompt =
      mode.kind === "causes" && src ? html`What did <q>${clip(src.text, 32)}</q> lead to?`
      : mode.kind === "causedBy" && src ? html`What led to <q>${clip(src.text, 32)}</q>?`
      : mode.kind === "intervene" && src ? html`Something to try about <q>${clip(src.text, 32)}</q>`
      : mode.kind === "intervene" ? html`Something to try`
      : null;

    const srcCorner = src && CORNERS.includes(src.category) ? src.category : null;
    const tools = mode.kind === "intervene"
      ? this.tools.filter((t) => !srcCorner || !t.corners?.length || t.corners.includes(srcCorner))
      : [];
    const others = (mode.kind === "causes" || mode.kind === "causedBy") && rec
      ? chronological(rec.entries).filter((e) => e.id !== mode.src)
      : [];
    const placeholder = this.category === "resolution" ? "How it settled (optional)" : `${LABEL[this.category]}…`;

    return html`<div class="composer">
      ${prompt
        ? html`<div class="composer-prompt">
            <span>${prompt}</span>
            <button type="button" class="hint-close" aria-label="Stop linking" @click=${() => this._cancelMode()}>×</button>
          </div>`
        : nothing}
      ${others.length
        ? html`<div class="chip-row" aria-label="Or connect to an existing entry">
            <span class="chip-note">or link:</span>
            ${others.map((o) => html`<button type="button" class="chip existing" style=${`--c: var(--c-${o.category})`}
                @click=${() => this._linkExisting(o.id)}>${clip(o.text || o.category, 24)}</button>`)}
          </div>`
        : nothing}
      ${tools.length
        ? html`<div class="chip-row" aria-label="From your toolkit">
            ${tools.map((t) => html`<button type="button" class="chip tool" @click=${() => this._useTool(t.text)}>${t.text}</button>`)}
          </div>`
        : nothing}
      ${this.category === "resolution"
        ? html`<div class="chip-row" role="radiogroup" aria-label="How does it feel now? (optional)">
            <span class="chip-note">feels:</span>
            ${FEELS.map((f) => html`<button type="button" class="chip" role="radio" aria-checked=${String(this.feel === f)}
                @click=${() => (this.feel = this.feel === f ? null : f)}>${f}</button>`)}
          </div>`
        : nothing}
      <div class="chip-row cats" role="radiogroup" aria-label="Category">
        ${ADDABLE.map((c) => html`<button type="button" class="chip cat-chip" role="radio" data-cat=${c}
            style=${`--c: var(--c-${c})`} aria-checked=${String(this.category === c)}
            @click=${() => this._pick(c)}>${LABEL[c]}</button>`)}
      </div>
      <form class="add-row" @submit=${(/** @type {SubmitEvent} */ e) => this._submit(e)}>
        <input name="text" type="text" placeholder=${placeholder} autocomplete="off" autocapitalize="sentences" enterkeyhint="done" />
        <button type="submit" @pointerdown=${(/** @type {PointerEvent} */ e) => e.preventDefault()}>Add</button>
      </form>
      ${this.category === "intervention" && mode.kind === "intervene"
        ? html`<label class="save-tool"><input type="checkbox" .checked=${this.saveToToolkit}
            @change=${(/** @type {Event} */ e) => (this.saveToToolkit = /** @type {HTMLInputElement} */ (e.target).checked)} />
            Save to toolkit</label>`
        : nothing}
    </div>`;
  }

  render() {
    const rec = this.record;
    const entries = rec ? chronological(rec.entries) : [];
    const n = rec ? needle(rec) : { target: /** @type {Category} */ ("thought"), hint: false };

    return html`
      <div class="record-head">
        ${rec
          ? html`<input class="title" type="text" aria-label="Title (optional)"
              placeholder=${entries.length ? titleOf(rec) : "Title (optional)"}
              .value=${rec.name}
              @change=${(/** @type {Event} */ e) => records.rename(rec.id, /** @type {HTMLInputElement} */ (e.target).value.trim())} />
            ${isResolved(rec) ? html`<span class="badge">resolved</span>` : nothing}`
          : html`<span class="muted">New record</span>`}
        <button type="button" class="small-btn" @click=${() => this._newRecord()}>New</button>
      </div>

      <compass-rose .target=${n.target} .hint=${n.hint}
        @pick=${(/** @type {CustomEvent} */ e) => this._pick(e.detail)}
        @dismiss-hint=${() => this._dismissHint()}></compass-rose>

      ${entries.length
        ? html`<ol class="timeline">${repeat(entries, (e) => e.id, (e) => this._renderEntry(/** @type {ThoughtRecord} */ (rec), e))}</ol>
            <div class="export-row">
              <button type="button" @click=${(/** @type {Event} */ e) => this._copy(e, "timeline")}>Copy timeline</button>
              <button type="button" @click=${(/** @type {Event} */ e) => this._copy(e, "map")}>Copy map (Markdown)</button>
            </div>`
        : html`<p class="empty">Start wherever you notice first: tap a point on the compass, or type below.</p>`}

      ${this._renderComposer()}
    `;
  }
}
