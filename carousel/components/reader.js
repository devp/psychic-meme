/**
 * The reading window: a <dialog> holding an iframe at 90% of the viewport,
 * with an [x] to close and ↗ to open the link outside the app -- the way out
 * when a site refuses to be framed, which the page can't detect.
 */
export class Reader extends HTMLElement {
  connectedCallback() {
    if (this.dialog) return;
    this.dialog = document.createElement("dialog");
    this.dialog.className = "reader window";
    // warn-ok: innerhtml-assign -- static markup, nothing interpolated
    this.dialog.innerHTML = `
      <div class="titlebar">
        <span class="title"></span>
        <span class="controls">
          <a class="btn open" target="_blank" rel="noopener" aria-label="Open outside the app">↗</a>
          <button type="button" class="btn close" aria-label="Close">[x]</button>
        </span>
      </div>
      <div class="frame-wrap"></div>`;
    this.append(this.dialog);
    this.dialog.querySelector(".close")?.addEventListener("click", () => this.close());
    // Esc closes the dialog itself; drop the iframe either way so video stops.
    this.dialog.addEventListener("close", () => this.dialog?.querySelector(".frame-wrap")?.replaceChildren());
  }

  /**
   * @param {string} src what to frame
   * @param {string} url the link itself, for ↗
   * @param {string} title
   */
  show(src, url, title) {
    const d = /** @type {HTMLDialogElement} */ (this.dialog);
    const frame = document.createElement("iframe");
    frame.src = src;
    frame.title = title;
    frame.allow = "autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-write; web-share";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    /** @type {HTMLElement} */ (d.querySelector(".title")).textContent = title;
    /** @type {HTMLAnchorElement} */ (d.querySelector(".open")).href = url;
    d.querySelector(".frame-wrap")?.replaceChildren(frame);
    d.showModal();
  }

  close() {
    this.dialog?.close();
    this.dialog?.querySelector(".frame-wrap")?.replaceChildren();
  }
}
