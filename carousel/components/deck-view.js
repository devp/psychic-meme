import { LitElement, html } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { cards, deck, lane, lanes, positions, setComment } from "../state.js";
import { laneCards, resolve, wrap, spin, hostOf, platformOf } from "../lib/deck.js";

/** @typedef {import("../lib/deck.js").Card} Card */

const SWIPE = 50; // px before a drag counts as a swipe
const HOLD = 550; // ms before a press counts as a long press
const LABELS = { youtube: "video", instagram: "gram", facebook: "fb", other: "link" };

/**
 * The deck: lane strip, the current card, prev/next. Fires `read` and `edit`
 * (detail: the card) for app.js to handle.
 *
 * Gestures on the card: swipe left/right moves through the lane, swipe up/down
 * changes lane, tap reads, long press edits.
 */
export class DeckView extends LitElement {
  static properties = { _tick: { state: true }, _dir: { state: true } };

  createRenderRoot() {
    return this;
  }

  constructor() {
    super();
    this._tick = 0;
    /** Which way the last move went, for the slide-in animation. */
    this._dir = "";
    /** The card on screen. laneCards keeps it even once read, so it doesn't vanish under you. */
    /** @type {string|null} */
    this.keepId = null;
    /** @type {{ x: number, y: number, timer: number, held: boolean, onControl: boolean } | null} */
    this.press = null;
    /** @type {number|undefined} */
    this.commentTimer = undefined;
  }

  connectedCallback() {
    super.connectedCallback();
    const refresh = () => this._tick++;
    // warn-ok: subscribe-no-teardown -- this element is never removed
    for (const s of [lane, lanes, positions, deck]) s.subscribe(refresh);
  }

  /** The lane's cards and where we are in them. */
  view() {
    const l = lane.get();
    const list = laneCards(cards(), l, this.keepId);
    const index = resolve(list, positions.get()[l]);
    return { list, index, card: list[index] ?? null };
  }

  /** @param {Card} card */
  remember(card) {
    this.keepId = card.id;
    positions.set({ ...positions.get(), [lane.get()]: { id: card.id, at: card.addedAt } });
  }

  /** @param {number} delta */
  step(delta) {
    const { list, index } = this.view();
    if (!list.length) return;
    this._dir = delta > 0 ? "next" : "prev";
    // remember() moves keepId on, so a card read here drops out behind us.
    this.remember(list[wrap(index, delta, list.length)]);
  }

  /** @param {number} delta */
  changeLane(delta) {
    const all = ["", ...lanes.get()];
    this.pickLane(all[wrap(Math.max(0, all.indexOf(lane.get())), delta, all.length)], delta);
  }

  /** @param {string} name @param {number} [delta] */
  pickLane(name, delta = 1) {
    this._dir = delta > 0 ? "up" : "down";
    this.keepId = null;
    lane.set(name);
    this._tick++;
  }

  /** SPIN: flick through a few random cards, slowing down, and stop on one. */
  spin() {
    const { list } = this.view();
    if (list.length < 2 || this.classList.contains("spinning")) return;
    this.classList.add("spinning");
    const start = this.view().index;
    let index = start;
    const delays = [40, 50, 60, 80, 100, 130, 170, 220, 300];
    const tickOnce = () => {
      const delay = delays.shift();
      // The last tick never lands back where the spin started.
      index = delay ? spin(index, list.length) : spin(start, list.length);
      this._dir = "spin";
      this.remember(list[index]);
      if (delay) setTimeout(tickOnce, delay);
      else this.classList.remove("spinning");
    };
    tickOnce();
  }

  current() {
    return this.view().card;
  }

  // ---- gestures -----------------------------------------------------------

  /** @param {PointerEvent} e */
  down(e) {
    // On the comment box a swipe still swipes, but a tap or hold is the box's.
    const onControl = e.target instanceof Element && !!e.target.closest("textarea, button, a, input, select");
    const card = this.current();
    this.press = {
      x: e.clientX,
      y: e.clientY,
      held: false,
      onControl,
      timer: window.setTimeout(() => {
        if (!this.press || !card || onControl) return;
        this.press.held = true;
        navigator.vibrate?.(15);
        this.fire("edit", card);
      }, HOLD),
    };
  }

  /** @param {PointerEvent} e */
  move(e) {
    const p = this.press;
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) clearTimeout(p.timer);
  }

  /** @param {PointerEvent} e */
  up(e) {
    const p = this.press;
    this.press = null;
    if (!p) return;
    clearTimeout(p.timer);
    if (p.held) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy)) this.step(dx < 0 ? 1 : -1);
    else if (Math.abs(dy) > SWIPE) this.changeLane(dy < 0 ? 1 : -1);
    else if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && !p.onControl) {
      const card = this.current();
      if (card) this.fire("read", card);
    }
  }

  cancel() {
    if (this.press) clearTimeout(this.press.timer);
    this.press = null;
  }

  /** @param {string} type @param {Card} card */
  fire(type, card) {
    this.dispatchEvent(new CustomEvent(type, { detail: card, bubbles: true }));
  }

  /** @param {Card} card @param {Event} e */
  comment(card, e) {
    const text = /** @type {HTMLTextAreaElement} */ (e.target).value;
    clearTimeout(this.commentTimer);
    if (e.type === "input") this.commentTimer = window.setTimeout(() => setComment(card.id, text), 400);
    else setComment(card.id, text);
  }

  // ---- render -------------------------------------------------------------

  render() {
    const { list, index, card } = this.view();
    if (card) this.keepId = card.id;
    const all = cards();
    const current = lane.get();
    const count = (/** @type {string} */ l) => laneCards(all, l).length;

    return html`
      <nav class="lanes" aria-label="Lanes">
        ${["", ...lanes.get()].map(
          (l) => html`<button type="button" class="lane-chip" aria-pressed=${String(l === current)} @click=${() => this.pickLane(l)}>
            ${l || "all unread"} <span class="n">${count(l)}</span>
          </button>`
        )}
      </nav>

      <div class="stage"
        @pointerdown=${this.down} @pointermove=${this.move} @pointerup=${this.up}
        @pointercancel=${this.cancel} @pointerleave=${this.cancel}
        @contextmenu=${(/** @type {Event} */ e) => e.preventDefault()}>
        ${card
          ? repeat([card], (c) => c.id, (c) => this.renderCard(c, index, list.length))
          : html`<div class="empty window">
              <div class="titlebar"><span>${current || "all unread"}</span></div>
              <p>Nothing unread here.</p>
              <p class="dim">Share a link to carousel from any app${current ? ", or swipe to another lane" : ""}.</p>
            </div>`}
      </div>

      <div class="deck-nav">
        <button type="button" class="btn" aria-label="Previous" @click=${() => this.step(-1)}>‹ prev</button>
        <span class="pos">${list.length ? `${index + 1} / ${list.length}` : "0 / 0"}</span>
        <button type="button" class="btn" aria-label="Next" @click=${() => this.step(1)}>next ›</button>
      </div>
    `;
  }

  /** @param {Card} c @param {number} index @param {number} length */
  renderCard(c, index, length) {
    const platform = platformOf(c.url);
    const host = hostOf(c.url);
    const added = new Date(c.addedAt);
    return html`<article class="card window ${this._dir}" data-platform=${platform} data-id=${c.id}>
      <div class="titlebar">
        <span>${LABELS[platform]} · ${host}</span>
        <span>${index + 1}/${length}</span>
      </div>
      <div class="card-body">
        <h2 class="desc">${c.description || host + new URL(c.url).pathname}</h2>
        <p class="meta">
          <time datetime=${added.toISOString()} title=${added.toLocaleString()}>added ${ago(c.addedAt)}</time>
          ${c.from ? html` · from <b>${c.from}</b>` : ""}
          ${c.lane ? html` · <span class="lane-tag">${c.lane}</span>` : ""}
          ${c.readAt ? html` · <span class="read-tag">read</span>` : ""}
        </p>
        <textarea class="comment" rows="2" placeholder="comment…" aria-label="Comment"
          .value=${c.comment ?? ""}
          @input=${(/** @type {Event} */ e) => this.comment(c, e)}
          @change=${(/** @type {Event} */ e) => this.comment(c, e)}></textarea>
      </div>
      <p class="hint">tap to read · hold to edit · swipe ↔ cards · ↕ lanes</p>
    </article>`;
  }
}

/** @param {number} t */
function ago(t) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(t).toLocaleDateString();
}
