import { TPStoSVGString } from "tps-ninja/src/TPStoSVG.js";
import { defaults } from "tps-ninja/src/options.js";
import { withTurn, camelCase, kebabCase } from "./tps.js";

export { TPStoSVGString, withTurn };

const OWN = ["tps", "turn"];
const NOT_OPTIONS = new Set([...OWN, "id", "class", "style", "slot", "part", "title", "lang", "dir", "hidden"]);

const STYLE = `
  :host { display: inline-block; max-width: 100%; }
  svg { display: block; width: 100%; height: auto; }
  .error { font: 0.875em monospace; color: #b00020; white-space: pre-wrap; }
`;

/**
 * <tak-board tps="x6/x6/x6/x6/x6/x6 1 1" turn="white"></tak-board>
 *
 * Any other attribute is passed to tps-ninja as a render option, kebab-cased
 * (`axis-labels="false"`, `theme="discord"`, `plies="a1 f6"`). See tps-ninja's options.js.
 */
export class TakBoard extends HTMLElement {
  static observedAttributes = [...OWN, "theme", "size", "hl", ...Object.keys(defaults).map(kebabCase)];

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    if (this.isConnected) this.render();
  }

  /** Render options from attributes, as tps-ninja's TPStoSVGString takes them. */
  options() {
    /** @type {Record<string, unknown>} */
    const options = {};
    for (const { name, value } of this.attributes) {
      if (!NOT_OPTIONS.has(name)) options[camelCase(name)] = value;
    }
    // tps-ninja eval()s a string transform; hand it an array instead.
    if (typeof options.transform === "string") {
      try {
        options.transform = JSON.parse(options.transform);
      } catch {
        delete options.transform;
      }
    }
    options.tps = withTurn(this.getAttribute("tps") ?? "", this.getAttribute("turn"));
    return options;
  }

  render() {
    const root = /** @type {ShadowRoot} */ (this.shadowRoot);
    let body;
    try {
      body = TPStoSVGString(this.options());
    } catch (error) {
      const message = document.createElement("div");
      message.className = "error";
      message.textContent = `tak-board: ${error instanceof Error ? error.message : error}`;
      body = message.outerHTML;
    }
    root.innerHTML = `<style>${STYLE}</style>${body}`;
  }
}

if (!customElements.get("tak-board")) customElements.define("tak-board", TakBoard);
