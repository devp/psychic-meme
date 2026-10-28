import { LitElement, html, nothing } from "lit";
import { token } from "../state.js";
import { checkToken } from "../remote.js";

/** Paste a Todoist API token; saved, then tested. Fires "done". */
export class TokenSetup extends LitElement {
  static properties = { _status: { state: true }, _message: { state: true } };

  createRenderRoot() {
    return this;
  }

  constructor() {
    super();
    /** @type {""|"checking"|"pass"|"fail"} */
    this._status = "";
    this._message = "";
  }

  /** @param {SubmitEvent} e */
  async save(e) {
    e.preventDefault();
    const input = /** @type {HTMLInputElement} */ (this.querySelector("input[name=token]"));
    const value = input.value.trim();
    if (!value) return;
    token.set(value);
    input.value = "";
    this._status = "checking";
    try {
      await checkToken();
      this._status = "pass";
      this._message = "";
    } catch (err) {
      this._status = "fail";
      this._message = err instanceof Error ? err.message : String(err);
    }
  }

  done() {
    this._status = "";
    this.dispatchEvent(new CustomEvent("done"));
  }

  render() {
    const saved = Boolean(token.get());
    return html`
      <form class="setup" @submit=${(/** @type {SubmitEvent} */ e) => this.save(e)}>
        <h2>Todoist token</h2>
        <p class="dim">
          In Todoist: Settings → Integrations → Developer → copy API token. It stays on this phone
          and is sent only to Todoist.
        </p>
        <input name="token" type="password" autocomplete="off" spellcheck="false"
          placeholder=${saved ? "saved; paste to replace" : "paste token"} aria-label="Todoist API token">
        <button class="btn primary" ?disabled=${this._status === "checking"}>${this._status === "checking" ? "checking…" : "save & test"}</button>
        ${this._status === "pass" ? html`<p class="applied">✓ connected</p>` : nothing}
        ${this._status === "fail" ? html`<p class="error">✗ ${this._message}</p>` : nothing}
        ${saved && this._status !== "checking"
          ? html`<button type="button" class="btn" @click=${() => this.done()}>${this._status === "pass" ? "go" : "use the saved token"}</button>`
          : nothing}
      </form>
    `;
  }
}
