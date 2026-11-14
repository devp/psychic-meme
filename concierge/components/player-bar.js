import { LitElement, html, nothing, svg } from "lit";
import { cover } from "./cover.js";

/** @typedef {import("../lib/player.js").PlayerState} PlayerState */

const ICONS = {
  play: svg`<path d="M8 5v14l11-7z" />`,
  pause: svg`<path d="M6 5h4v14H6zM14 5h4v14h-4z" />`,
  skip: svg`<path d="M5 5v14l10-7zM17 5h2.5v14H17z" />`,
  // One thumb; "down" is the same drawing turned over in CSS.
  thumb: svg`<path d="M2 10h4v11H2zM8 21h9.3a2 2 0 0 0 1.9-1.4l2.6-7.5A2 2 0 0 0 19.9 9.5H15l.8-4.3a2.3 2.3 0 0 0-2.3-2.7L8 10z" />`,
};

/** @param {number} seconds */
function clock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * What's on, along the bottom. A travelling component: give it a PlayerState
 * (lib/player.js); it asks for things by event and changes nothing itself.
 *
 *   toggle  play/pause
 *   skip
 *   vote    detail: "up" | "down"
 *
 * Hidden until `state.collection` is set.
 */
export class PlayerBar extends LitElement {
  static properties = {
    state: {},
  };

  createRenderRoot() {
    return this;
  }

  constructor() {
    super();
    /** @type {PlayerState | null} */
    this.state = null;
  }

  /**
   * @param {string} type
   * @param {string} [detail]
   */
  _ask(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));
  }

  render() {
    const s = this.state;
    this.hidden = !s?.collection;
    if (!s?.collection) return nothing;
    const { collection, item, playing, position, vote } = s;
    const progress = item ? Math.min(100, (position / item.duration) * 100) : 0;
    return html`<div class="player-progress"><span style="width: ${progress}%"></span></div>
      <a class="player-now" href="#/c/${encodeURIComponent(collection.id)}">
        ${cover(collection)}
        <span class="player-text">
          <span class="player-title">${item ? item.title : "Finding the next one…"}</span>
          <span class="player-byline">${item ? `${item.byline} · ` : ""}${collection.title}</span>
        </span>
      </a>
      <span class="player-time">${item ? `${clock(position)} / ${clock(item.duration)}` : ""}</span>
      <div class="player-controls" role="group" aria-label="Player">
        <button type="button" class="thumb-down" aria-label="Thumbs down" aria-pressed=${vote === "down"} ?disabled=${!item} @click=${() => this._ask("vote", "down")}>
          <svg viewBox="0 0 24 24" aria-hidden="true">${ICONS.thumb}</svg>
        </button>
        <button type="button" aria-label="Thumbs up" aria-pressed=${vote === "up"} ?disabled=${!item} @click=${() => this._ask("vote", "up")}>
          <svg viewBox="0 0 24 24" aria-hidden="true">${ICONS.thumb}</svg>
        </button>
        <button type="button" class="player-toggle" aria-label=${playing ? "Pause" : "Play"} @click=${() => this._ask("toggle")}>
          <svg viewBox="0 0 24 24" aria-hidden="true">${playing ? ICONS.pause : ICONS.play}</svg>
        </button>
        <button type="button" aria-label="Skip" ?disabled=${!item} @click=${() => this._ask("skip")}>
          <svg viewBox="0 0 24 24" aria-hidden="true">${ICONS.skip}</svg>
        </button>
      </div>`;
  }
}
