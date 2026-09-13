// Phone-first viewport handling.
//
// The one thing in this starter that no library gives you, and the reason it
// exists. Framework-agnostic on purpose: plain functions over plain elements,
// so both the vanilla and lit variants use it unchanged.

/**
 * The height actually visible to the user, which on mobile is *not*
 * window.innerHeight once the keyboard is open.
 * @returns {number}
 */
export function visibleHeight() {
  const vv = window.visualViewport;
  return vv ? vv.height : window.innerHeight;
}

/**
 * Mirror the visible viewport height into a CSS custom property.
 *
 * On mobile, opening the keyboard shrinks the *visual* viewport but not the
 * layout viewport, so a plain 100dvh column doesn't resize -- the keyboard
 * just covers the input bar and the tail of the content instead of the layout
 * making room for it. visualViewport reports the real visible height; mirror
 * it into a var that body's height reads.
 *
 * Pair this with `interactive-widget=resizes-content` in the viewport meta.
 *
 * @param {() => void} [onResize] runs after each sync -- e.g. to keep the
 *   bottom of a log pinned above the newly-raised keyboard.
 * @returns {() => void} teardown
 */
export function syncAppHeight(onResize) {
  const sync = () => {
    document.documentElement.style.setProperty("--app-height", visibleHeight() + "px");
    if (onResize) onResize();
  };
  sync();
  const vv = window.visualViewport;
  if (vv) {
    vv.addEventListener("resize", sync);
    return () => vv.removeEventListener("resize", sync);
  }
  window.addEventListener("resize", sync);
  return () => window.removeEventListener("resize", sync);
}

/**
 * Grow a textarea to fit its content, capped at a fraction of the *visible*
 * height so it can never push its own submit button off-screen.
 * @param {HTMLTextAreaElement} el
 * @param {number} [maxFraction]
 */
export function autoGrow(el, maxFraction = 0.4) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, visibleHeight() * maxFraction) + "px";
}

/**
 * Enter submits, Shift-Enter inserts a newline.
 *
 * Deliberately the whole of the input model. An earlier project in this repo
 * died of hand-rolled autocomplete, live syntax highlighting and auto-indent
 * on a mobile textarea: unfixable UX bugs you cannot attach a debugger to.
 * A dumb textarea has one failure mode. Keep it dumb.
 *
 * @param {HTMLTextAreaElement} el
 * @param {() => void} onSubmit
 * @returns {() => void} teardown
 */
export function submitOnEnter(el, onSubmit) {
  /** @param {KeyboardEvent} e */
  const handler = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };
  el.addEventListener("keydown", handler);
  return () => el.removeEventListener("keydown", handler);
}
