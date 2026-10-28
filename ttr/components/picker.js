import { LitElement, html, nothing } from "lit";
import { config, getConfig } from "../state.js";
import { snapshot, knownCount } from "../remote.js";

/** @typedef {import("../lib/triage.js").Target} Target */

/**
 * The saved targets, each with its current count. Fires "pick" with the
 * target. Call `refresh()` whenever it comes back on screen.
 */
export class TargetPicker extends LitElement {
  static properties = { _counts: { state: true }, _error: { state: true }, _loading: { state: true } };

  createRenderRoot() {
    return this;
  }

  constructor() {
    super();
    /** @type {Record<string, number|null>} keyed by query */
    this._counts = {};
    this._error = "";
    this._loading = false;
    /** @type {(() => void)|null} */
    this._unsub = null;
  }

  connectedCallback() {
    super.connectedCallback();
    this._unsub = config.subscribe(() => this.requestUpdate());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsub?.();
  }

  /** Count every target, in parallel; each fetch is also the snapshot a pick reuses. */
  async refresh() {
    const targets = getConfig().targets;
    this._counts = Object.fromEntries(targets.map((t) => [t.query, knownCount(t)]));
    this._loading = true;
    this._error = "";
    await Promise.all(
      targets.map(async (t) => {
        try {
          const tasks = await snapshot(t);
          this._counts = { ...this._counts, [t.query]: tasks.length };
        } catch (e) {
          this._error = e instanceof Error ? e.message : String(e);
        }
      })
    );
    this._loading = false;
  }

  /** @param {Target} target */
  pick(target) {
    this.dispatchEvent(new CustomEvent("pick", { detail: target }));
  }

  render() {
    const targets = getConfig().targets;
    return html`
      <ul class="targets">
        ${targets.map((t) => {
          const n = this._counts[t.query];
          return html`<li>
            <button type="button" class="target" @click=${() => this.pick(t)}>
              <span class="target-name">${t.name}</span>
              <span class="target-query dim">${t.query}</span>
              <span class="target-count">${n ?? (this._loading ? "…" : "?")}</span>
            </button>
          </li>`;
        })}
      </ul>
      ${this._error ? html`<p class="error">${this._error}</p>` : nothing}
      <button type="button" class="btn" ?disabled=${this._loading} @click=${() => this.refresh()}>${this._loading ? "counting…" : "refresh counts"}</button>
    `;
  }
}
