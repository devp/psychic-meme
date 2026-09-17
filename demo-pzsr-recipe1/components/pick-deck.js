import { LitElement, html, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { RECIPES, LANE_LABEL, METHOD_LABEL, METHODS, LANES, TIME_BUCKETS } from "../data/recipes.js";
import { STAPLE_BY_ID } from "../data/staples.js";
import { buildDeck, missingFor, nextOpenNight, dayStamp, NIGHTS } from "../lib/plan.js";
import {
  plan, pantry, skips,
  fMethod, fLane, fTime, fKidOk, fCookable,
  activeFilterCount, clearFilters,
  pantryMap, planItems, plannedIds, skippedIds, skipItems, note,
} from "../state.js";

/** Horizontal travel that counts as a decision rather than a fidget. */
const COMMIT_PX = 84;
/** Below this, a drag is still deciding which axis it is. */
const AXIS_PX = 8;
/** Matches the fling transition in style.css. Kept in sync by hand, once. */
const FLING_MS = 190;

/**
 * The reason this app exists: one dish, two answers, no list.
 *
 * A list of 115 dishes is the decision problem, not the solution -- reading it
 * is the part that costs twenty minutes and ends in takeout. So the deck shows
 * exactly one card and takes a yes or a no, and the filter chips above it are
 * how you narrow the pool *before* you start looking rather than while.
 *
 * Swipe right or press "Cook it" and the dish lands on the first open night --
 * the app takes the which-night decision too, because that's a second
 * decision and you can drag it later on the week tab if you actually care.
 */
export class PickDeck extends LitElement {
  static properties = { version: { type: Number } };

  // Light DOM, like everything in this app: the global stylesheet applies and
  // there's no shadow boundary between the card and the drag handlers.
  createRenderRoot() {
    return this;
  }

  constructor() {
    super();
    // Constructor, not class fields -- a field shadows Lit's accessor.
    this.version = 0;
    /** @type {(() => void)[]} */
    this._teardown = [];
    /** @type {string|null} the recipe the card currently shows */
    this._renderedId = null;
    this._dragging = false;
    this._axisKnown = false;
    this._startX = 0;
    this._startY = 0;
    this._dx = 0;
    this._flinging = false;
  }

  connectedCallback() {
    super.connectedCallback();
    const bump = () => this.version++;
    for (const store of [plan, pantry, skips]) this._teardown.push(store.subscribe(bump));
    for (const f of [fMethod, fLane, fTime, fKidOk, fCookable]) {
      this._teardown.push(f.subscribe(bump));
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._teardown.forEach((off) => off());
    this._teardown = [];
  }

  /** The deck as of right now. Recomputed per render; it's 115 items. */
  get _deck() {
    return buildDeck({
      recipes: RECIPES,
      filters: {
        method: fMethod.get(),
        lane: fLane.get(),
        time: fTime.get(),
        kidOk: fKidOk.get() === "1",
        cookable: fCookable.get() === "1",
      },
      pantry: pantryMap(),
      plannedIds: plannedIds(),
      skippedIds: skippedIds(),
      seed: dayStamp(),
    });
  }

  /**
   * The interactive card. The `:not(.peek)` matters: the decorative card
   * behind it shares the class and comes first in the DOM, so a bare
   * `.deck-card` query hands you the wrong element -- and setPointerCapture()
   * on the wrong element silently routes every pointermove away from the
   * handlers, which looks exactly like a dead swipe.
   *
   * @returns {HTMLElement|null}
   */
  get _card() {
    return this.querySelector(".deck-card:not(.peek)");
  }

  // ---- decisions ----------------------------------------------------------

  /** @param {import("../data/recipes.js").Recipe} recipe */
  _cook(recipe) {
    const picks = planItems();
    const night = nextOpenNight(picks);
    if (night === null) {
      note("week is full — clear a night first");
      return;
    }
    const rec = plan.ensureActive();
    plan.append(rec.id, { recipeId: recipe.id, night });
    note(`${NIGHTS.find((n) => n.id === night)?.label}: ${recipe.name}`);
  }

  /** @param {import("../data/recipes.js").Recipe} recipe */
  _skip(recipe) {
    const rec = skips.ensureActive();
    skips.append(rec.id, { recipeId: recipe.id, at: Date.now() });
    note(`not tonight: ${recipe.name}`);
  }

  /** Take back the last wave-off. The safety net that makes swiping cheap. */
  _undoSkip() {
    const items = skipItems();
    const last = items[items.length - 1];
    if (!last) return;
    const rec = skips.ensureActive();
    skips.removeItem(rec.id, last.id);
  }

  _clearSkips() {
    const id = skips.getActiveId();
    if (id) skips.clearItems(id);
  }

  // ---- the swipe ----------------------------------------------------------
  // Pointer events, not touch events: one code path covers finger, trackpad
  // and mouse, and setPointerCapture means a fast flick that leaves the card
  // still delivers its pointerup here instead of to whatever it landed on.

  /** @param {PointerEvent} e */
  _down(e) {
    if (this._flinging || e.button !== 0) return;
    this._dragging = true;
    this._axisKnown = false;
    this._startX = e.clientX;
    this._startY = e.clientY;
    this._dx = 0;
    const card = this._card;
    if (card) {
      card.setPointerCapture(e.pointerId);
      card.style.transition = "none";
    }
  }

  /** @param {PointerEvent} e */
  _move(e) {
    if (!this._dragging) return;
    const dx = e.clientX - this._startX;
    const dy = e.clientY - this._startY;

    // Decide the axis once, at the 8px mark. Without this, a thumb scrolling
    // the panel drags the card sideways, and `touch-action: none` on the card
    // would fix that by breaking vertical scrolling instead.
    if (!this._axisKnown) {
      if (Math.abs(dx) < AXIS_PX && Math.abs(dy) < AXIS_PX) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        this._dragging = false;
        this._paint(0);
        return;
      }
      this._axisKnown = true;
    }

    this._dx = dx;
    this._paint(dx);
  }

  /** @param {PointerEvent} e */
  _up(e) {
    if (!this._dragging) return;
    this._dragging = false;
    const card = this._card;
    if (card?.hasPointerCapture(e.pointerId)) card.releasePointerCapture(e.pointerId);

    const dx = this._dx;
    this._dx = 0;
    if (Math.abs(dx) >= COMMIT_PX) this._fling(dx > 0 ? "cook" : "skip");
    else this._paint(0, true);
  }

  /**
   * Move the card with the finger. Written straight to style rather than
   * through a reactive property: a render pass per pointermove event is 60
   * template diffs a second for something only two inline styles care about.
   *
   * @param {number} dx
   * @param {boolean} [animate] spring back rather than track
   */
  _paint(dx, animate = false) {
    const card = this._card;
    if (!card) return;
    card.style.transition = animate ? `transform ${FLING_MS}ms ease-out` : "none";
    card.style.transform = dx ? `translateX(${dx}px) rotate(${dx / 26}deg)` : "";
    const lean = Math.min(1, Math.abs(dx) / COMMIT_PX);
    const yes = /** @type {HTMLElement|null} */ (this.querySelector(".stamp-cook"));
    const no = /** @type {HTMLElement|null} */ (this.querySelector(".stamp-skip"));
    if (yes) yes.style.opacity = String(dx > 0 ? lean : 0);
    if (no) no.style.opacity = String(dx < 0 ? lean : 0);
    card.classList.toggle("leaning", Math.abs(dx) >= COMMIT_PX);
  }

  /**
   * Throw the card off-screen, then commit. The state change is deferred to
   * the end of the animation so the card you're watching leave is the card
   * that got decided -- commit first and the next dish flies out instead.
   *
   * @param {"cook"|"skip"} decision
   */
  _fling(decision) {
    const card = this._card;
    const recipe = this._deck[0];
    if (!card || !recipe) return;
    this._flinging = true;
    card.style.transition = `transform ${FLING_MS}ms ease-out, opacity ${FLING_MS}ms ease-out`;
    card.style.transform = `translateX(${decision === "cook" ? 140 : -140}%) rotate(${
      decision === "cook" ? 14 : -14
    }deg)`;
    card.style.opacity = "0";
    setTimeout(() => {
      this._flinging = false;
      if (decision === "cook") this._cook(recipe);
      else this._skip(recipe);
    }, FLING_MS);
  }

  /** Buttons and keys skip the animation; they've already been decisive. */
  /** @param {"cook"|"skip"} decision */
  _decide(decision) {
    if (this._flinging) return;
    this._fling(decision);
  }

  /** @param {KeyboardEvent} e */
  _key(e) {
    if (e.key === "ArrowRight") this._decide("cook");
    else if (e.key === "ArrowLeft") this._decide("skip");
    else return;
    e.preventDefault();
  }

  /** Reset the inline styles when a different dish takes the top slot. */
  updated() {
    const top = this._deck[0];
    const id = top?.id ?? null;
    if (id === this._renderedId) return;
    this._renderedId = id;
    const card = this._card;
    if (card) {
      card.style.transition = "none";
      card.style.transform = "";
      card.style.opacity = "";
      card.classList.remove("leaning");
    }
    this._paint(0);
  }

  // ---- render -------------------------------------------------------------

  render() {
    const deck = this._deck;
    const picks = planItems();
    const open = nextOpenNight(picks);
    return html`
      ${this._renderFilters()}
      ${open === null
        ? html`<p class="deck-empty">
            <strong>Seven nights, seven dishes.</strong> The week is planned — head to
            <em>shop</em>, or free up a night on the <em>week</em> tab.
          </p>`
        : deck.length === 0
          ? this._renderNoMatches()
          : this._renderStack(deck, open)}
      ${this._renderSkipRow()}
    `;
  }

  /**
   * Filter-first, and single-select per axis. Three chips ANDed is a pool you
   * can hold in your head; a multi-select matrix is the library again.
   */
  _renderFilters() {
    const active = activeFilterCount();
    return html`
      <div class="filters">
        ${this._chipRow("time", TIME_BUCKETS, fTime)}
        ${this._chipRow("lane", [{ id: "any", label: "any lane" }, ...LANES], fLane)}
        ${this._chipRow("method", [{ id: "any", label: "any method" }, ...METHODS], fMethod)}
        <div class="chip-row" role="group" aria-label="Constraints">
          <button
            type="button"
            class="chip toggle ${fKidOk.get() === "1" ? "on" : ""}"
            aria-pressed=${fKidOk.get() === "1"}
            @click=${() => fKidOk.set(fKidOk.get() === "1" ? "0" : "1")}
          >
            kids will eat it
          </button>
          <button
            type="button"
            class="chip toggle ${fCookable.get() === "1" ? "on" : ""}"
            aria-pressed=${fCookable.get() === "1"}
            @click=${() => fCookable.set(fCookable.get() === "1" ? "0" : "1")}
          >
            nothing to buy
          </button>
          ${active > 0
            ? html`<button type="button" class="chip clear" @click=${() => clearFilters()}>
                clear ${active}
              </button>`
            : nothing}
        </div>
      </div>
    `;
  }

  /**
   * @param {string} label
   * @param {{id: string, label: string}[]} options
   * @param {ReturnType<typeof import("../lib/store.js").persistedValue>} value
   */
  _chipRow(label, options, value) {
    const current = value.get();
    return html`<div class="chip-row" role="radiogroup" aria-label=${label}>
      ${repeat(
        options,
        (o) => o.id,
        (o) => html`<button
          type="button"
          class="chip ${current === o.id ? "on" : ""}"
          role="radio"
          aria-checked=${current === o.id}
          @click=${() => value.set(o.id)}
        >
          ${o.label}
        </button>`
      )}
    </div>`;
  }

  /**
   * @param {import("../data/recipes.js").Recipe[]} deck
   * @param {string} night
   */
  _renderStack(deck, night) {
    const top = deck[0];
    const pan = pantryMap();
    const missing = missingFor(top, pan);
    const nightLabel = NIGHTS.find((n) => n.id === night)?.label ?? night;

    return html`
      <p class="deck-count">
        ${deck.length} ${deck.length === 1 ? "dish" : "dishes"} match ·
        picking for <strong>${nightLabel}</strong>
      </p>

      <div class="deck" @keydown=${(/** @type {KeyboardEvent} */ e) => this._key(e)}>
        <!-- The card under the top one. Purely so the deck reads as a deck:
             never interactive, never swiped, and deliberately blank -- the next
             dish's name here would be a spoiler you didn't ask for, and it
             would render as a half-word behind the card that's covering it. -->
        ${deck[1] ? html`<div class="deck-card peek" aria-hidden="true"></div>` : nothing}

        <article
          class="deck-card"
          tabindex="0"
          role="group"
          aria-label=${`${top.name}. Right arrow to cook, left arrow to pass.`}
          @pointerdown=${(/** @type {PointerEvent} */ e) => this._down(e)}
          @pointermove=${(/** @type {PointerEvent} */ e) => this._move(e)}
          @pointerup=${(/** @type {PointerEvent} */ e) => this._up(e)}
          @pointercancel=${(/** @type {PointerEvent} */ e) => this._up(e)}
        >
          <div class="stamp stamp-cook" aria-hidden="true">cook it</div>
          <div class="stamp stamp-skip" aria-hidden="true">not tonight</div>

          <p class="card-meta">
            <span class="lane">${LANE_LABEL.get(top.lane)}</span>
            <span>${METHOD_LABEL.get(top.method)}</span>
            <span>${formatPrep(top.prep)}</span>
            ${top.kidOk ? html`<span class="kid">kid-safe</span>` : nothing}
          </p>

          <h3>${top.name}</h3>

          <ul class="card-staples">
            ${repeat(
              top.staples,
              (id) => id,
              (id) => {
                const status = pan.get(id) ?? "have";
                return html`<li class=${"s-" + status}>
                  ${STAPLE_BY_ID.get(id)?.name ?? id}
                </li>`;
              }
            )}
          </ul>

          ${missing.length === 0
            ? html`<p class="card-verdict ok">Everything's in the kitchen.</p>`
            : html`<p class="card-verdict short">
                Need to buy:
                ${missing.map((id) => STAPLE_BY_ID.get(id)?.name ?? id).join(", ")}
              </p>`}
        </article>
      </div>

      <div class="deck-actions">
        <button type="button" class="big no" @click=${() => this._decide("skip")}>
          Not tonight
        </button>
        <button type="button" class="big yes" @click=${() => this._decide("cook")}>
          Cook it
        </button>
      </div>
      <p class="deck-hint">Swipe the card, or use ← and → when it's focused.</p>
    `;
  }

  _renderNoMatches() {
    const skipped = skipItems().length;
    return html`<p class="deck-empty">
      <strong>Nothing left in this deck.</strong>
      ${activeFilterCount() > 0
        ? html`Loosen a filter —
            <button type="button" class="link" @click=${() => clearFilters()}>clear all</button>.`
        : nothing}
      ${skipped > 0
        ? html`Or take back the ${skipped} you passed on:
            <button type="button" class="link" @click=${() => this._clearSkips()}>reshuffle</button>.`
        : nothing}
    </p>`;
  }

  _renderSkipRow() {
    const skipped = skipItems();
    if (skipped.length === 0) return nothing;
    return html`<div class="skip-row">
      <span>${skipped.length} passed on</span>
      <button type="button" class="link" @click=${() => this._undoSkip()}>undo last</button>
      <button type="button" class="link" @click=${() => this._clearSkips()}>reshuffle all</button>
    </div>`;
  }
}

/**
 * Minutes, the way you'd say them out loud.
 * @param {number} mins
 * @returns {string}
 */
export function formatPrep(mins) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
