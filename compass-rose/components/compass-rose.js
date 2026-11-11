import { LitElement, html, svg } from "lit";

/** @typedef {import("../lib/thought.js").Category} Category */

// Points of the triangle in the SVG's own units (viewBox centred on 0,0).
// Thought at the top, then clockwise.
const R = 66;
/** @type {Record<string, {x: number, y: number, angle: number, label: string}>} */
const POINTS = {
  thought: { x: 0, y: -R, angle: 0, label: "Thought" },
  feeling: { x: R * Math.sin((2 * Math.PI) / 3), y: R / 2, angle: 120, label: "Feeling" },
  behavior: { x: -R * Math.sin((2 * Math.PI) / 3), y: R / 2, angle: 240, label: "Behavior" },
};
const SITUATION = { x: 0, y: 92 };
const REST_ANGLE = 180; // nothing to suggest: the needle settles toward the start

/**
 * <compass-rose>: the triangle as a compass. Corners are tap targets; the
 * intervention pin sits in the middle, the situation mark at the foot. The
 * needle points at `target`. Fires `pick` with detail = category, and
 * `dismiss-hint`.
 *
 * Takes plain properties and imports no app state.
 */
export class CompassRose extends LitElement {
  static properties = { target: {}, hint: {} };

  createRenderRoot() {
    return this;
  }

  constructor() {
    super();
    /** @type {Category|null} */
    this.target = null;
    /** @type {boolean} */
    this.hint = false;
    /** Cumulative needle angle, so it turns the short way round. */
    this._angle = REST_ANGLE;
  }

  /** @param {string} category */
  _pick(category) {
    this.dispatchEvent(new CustomEvent("pick", { detail: category, bubbles: true }));
  }

  /**
   * @param {string} category
   * @param {string} label
   * @param {number} x
   * @param {number} y
   * @param {number} r hit radius
   * Inside <svg>, so svg`` -- an html`` fragment would make HTML elements.
   */
  _target(category, label, x, y, r) {
    return svg`<g
      class="rose-target rose-${category}"
      role="button"
      tabindex="0"
      aria-label=${"Add " + label.toLowerCase()}
      @click=${() => this._pick(category)}
      @keydown=${(/** @type {KeyboardEvent} */ e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this._pick(category);
        }
      }}
    >
      <circle class="rose-hit" cx=${x} cy=${y} r=${r}></circle>
    </g>`;
  }

  render() {
    const center = this.target === "intervention";
    const point = this.target ? POINTS[this.target] : undefined;
    const wanted = point ? point.angle : REST_ANGLE;
    // Turn by the smallest delta from wherever the needle is now.
    const delta = ((((wanted - this._angle) % 360) + 540) % 360) - 180;
    this._angle += delta;

    const corners = Object.entries(POINTS);
    return html`
      <svg class="rose" viewBox="-110 -110 220 220" role="group" aria-label="Compass">
        <!-- decoration: rings and an eight-point rose, drawn in ink -->
        <circle class="rose-ring" r="100"></circle>
        <circle class="rose-ring faint" r="84"></circle>
        <g class="rose-star">
          ${[0, 45, 90, 135, 180, 225, 270, 315].map(
            (a) => svg`<path transform=${`rotate(${a})`} d=${a % 90 ? "M0 -60 L5 -5 L-5 -5 Z" : "M0 -96 L8 -8 L-8 -8 Z"}></path>`
          )}
        </g>
        <!-- the loop: ink routes between corners -->
        <path class="rose-route"
          d=${`M${POINTS.thought.x} ${POINTS.thought.y} L${POINTS.feeling.x} ${POINTS.feeling.y} L${POINTS.behavior.x} ${POINTS.behavior.y} Z`}></path>

        <g class="rose-needle ${point ? "" : "resting"} ${center ? "hidden" : ""}"
           style=${`transform: rotate(${this._angle}deg)`}>
          <path d="M0 -50 L7 0 L0 8 L-7 0 Z"></path>
        </g>

        ${corners.map(
          ([c, p]) => svg`
            <circle class="rose-corner ${this.target === c ? "wanted" : ""}" cx=${p.x} cy=${p.y} r="15" style=${`--c: var(--c-${c})`}></circle>
            <text class="rose-label" x=${p.x} y=${p.y + (p.y < 0 ? -21 : 28)}>${p.label}</text>`
        )}
        <circle class="rose-pin ${center ? "wanted" : ""}" r="11"></circle>
        <path class="rose-situation" d=${`M${SITUATION.x} ${SITUATION.y - 9} L${SITUATION.x + 8} ${SITUATION.y + 5} L${SITUATION.x - 8} ${SITUATION.y + 5} Z`}></path>
        <text class="rose-label small" x=${SITUATION.x + 14} y=${SITUATION.y + 4} text-anchor="start">Situation</text>

        ${corners.map(([c, p]) => this._target(c, p.label, p.x, p.y, 26))}
        ${this._target("intervention", "Intervention", 0, 0, 22)}
        ${this._target("situation", "Situation", SITUATION.x, SITUATION.y, 18)}
      </svg>
      ${this.hint
        ? html`<p class="rose-hint" role="status">
            Mapped it. What's one thing you could test?
            <button type="button" class="hint-close" aria-label="Dismiss"
              @click=${() => this.dispatchEvent(new CustomEvent("dismiss-hint", { bubbles: true }))}>×</button>
          </p>`
        : ""}
    `;
  }
}
