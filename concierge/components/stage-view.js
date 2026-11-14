import { LitElement, html, nothing, svg } from "lit";
import { cover } from "./cover.js";

/** @typedef {import("../views.js").View} View */
/** @typedef {import("../lib/types.js").Collection} Collection */

const PLAY = svg`<path d="M8 5v14l11-7z" />`;
const PAUSE = svg`<path d="M6 5h4v14H6zM14 5h4v14h-4z" />`;

/**
 * The big area: draws one View (views.js). A travelling component: plain
 * properties in, and nothing out but links and two kinds of marked element
 * for the page to act on:
 *
 *   [data-play=<collection id>]    start this collection
 *   [data-toggle=<collection id>]  start it, or pause/resume if it's the one on
 */
export class StageView extends LitElement {
  static properties = {
    view: {},
    playingId: {},
    playing: { type: Boolean },
  };

  // Light DOM, so the page's stylesheet applies.
  createRenderRoot() {
    return this;
  }

  constructor() {
    super();
    /** @type {View | null} */
    this.view = null;
    /** @type {string | null} the collection that's on, playing or paused */
    this.playingId = null;
    this.playing = false;
  }

  /** @param {Map<string, unknown>} changed */
  updated(changed) {
    if (!changed.has("view")) return;
    const before = /** @type {View | null | undefined} */ (changed.get("view"));
    if (!this.view || before?.key === this.view.key) return;
    this.scrollTop = 0;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    this.querySelector(".stage")?.animate(
      [
        { opacity: 0, transform: "translateX(28px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 260, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" }
    );
  }

  render() {
    const view = this.view;
    if (!view) return nothing;
    return html`<div class="stage">
      ${view.feature ? this.renderFeature(view.feature) : this.renderHeading(view)}
      ${view.tiles ? html`<ul class="tiles">${view.tiles.map((t) => this.renderTile(t))}</ul>` : nothing}
      ${view.links
        ? html`<ul class="links">
            ${view.links.map((l) => html`<li><a href=${l.href}>${l.title} <span class="count">${l.count}</span></a></li>`)}
          </ul>`
        : nothing}
      ${view.cards ? this.renderCards(view) : nothing}
    </div>`;
  }

  /** @param {View} view */
  renderHeading(view) {
    return html`<header class="heading">
      ${view.back
        ? html`<a class="back" href=${view.back} aria-label="Back">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </a>`
        : nothing}
      <h1>
        <span class="heading-title">${view.title}</span>
        ${view.subtitle ? html`<span class="heading-subtitle">${view.subtitle}</span>` : nothing}
      </h1>
    </header>`;
  }

  /** @param {NonNullable<View["tiles"]>[number]} tile */
  renderTile(tile) {
    return html`<li>
      <a class="tile" href=${tile.href}>
        ${tile.icon
          ? html`<span class="tile-art">
                <svg viewBox="0 0 48 48" aria-hidden="true"><use href=${tile.icon}></use></svg>
              </span>
              <span class="tile-label">${tile.title}</span>`
          : html`<span class="tile-art tile-art--text">
              <span class="tile-title">${tile.title}</span>
              ${tile.description ? html`<span class="tile-description">${tile.description}</span>` : nothing}
            </span>`}
      </a>
    </li>`;
  }

  /** @param {View} view */
  renderCards(view) {
    const cards = view.cards ?? [];
    if (cards.length === 0) return view.empty ? html`<p class="empty">${view.empty}</p>` : nothing;
    return html`${view.cardsTitle ? html`<h2 class="cards-title">${view.cardsTitle}</h2>` : nothing}
      <ul class="cards">
        ${cards.map(
          (c) => html`<li>
            <a class="card" href="#/c/${encodeURIComponent(c.id)}" data-play=${c.id} ?data-on=${c.id === this.playingId}>
              <span class="card-art">
                ${cover(c)}
                <svg class="card-play" viewBox="0 0 24 24" aria-hidden="true">${PLAY}</svg>
              </span>
              <span class="card-title">${c.title}</span>
              <span class="card-description">${c.description}</span>
            </a>
          </li>`
        )}
      </ul>`;
  }

  /** @param {Collection} c */
  renderFeature(c) {
    const on = c.id === this.playingId && this.playing;
    return html`<article class="feature">
      <button class="feature-art" type="button" data-toggle=${c.id} aria-label=${on ? "Pause" : "Play"}>
        ${cover(c)}
        <svg class="feature-play" viewBox="0 0 24 24" aria-hidden="true">${on ? PAUSE : PLAY}</svg>
      </button>
      <div class="feature-text">
        <h1 class="heading-title">${c.title}</h1>
        <p class="feature-description">${c.description}</p>
        ${c.curator ? html`<p class="feature-curator">Curated by ${c.curator}</p>` : nothing}
        <button class="pill" type="button" data-toggle=${c.id}>
          <svg viewBox="0 0 24 24" aria-hidden="true">${on ? PAUSE : PLAY}</svg>
          ${on ? "Pause" : "Play"}
        </button>
      </div>
    </article>`;
  }
}
