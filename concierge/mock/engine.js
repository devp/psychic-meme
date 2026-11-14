// An Engine (lib/types.js) that plays nothing: it counts seconds until the
// item's duration is up. A real one wraps an <audio> element instead.

/** @typedef {import("../lib/types.js").Engine} Engine */

/**
 * @param {{ speed?: number, interval?: number }} [options] speed: item-seconds per
 *   real second (?speed=30 in the URL makes items end while you watch);
 *   interval: milliseconds between ticks, 0 for none (tests call `advance`).
 * @returns {Engine & { advance: (seconds: number) => void }}
 */
export function createMockEngine({ speed = 1, interval = 500 } = {}) {
  let duration = 0;
  let position = 0;
  /** @type {ReturnType<typeof setInterval> | undefined} */
  let timer;
  /** @type {(position: number) => void} */
  let tick = () => {};
  /** @type {() => void} */
  let end = () => {};

  function pause() {
    clearInterval(timer);
    timer = undefined;
  }

  /** @param {number} seconds */
  function advance(seconds) {
    position = Math.min(duration, position + seconds);
    tick(position);
    if (position >= duration) {
      pause();
      end();
    }
  }

  return {
    load(item) {
      pause();
      duration = item.duration;
      position = 0;
    },
    play() {
      if (timer !== undefined || interval <= 0) return;
      timer = setInterval(() => advance((interval / 1000) * speed), interval);
    },
    pause,
    onTick(fn) {
      tick = fn;
    },
    onEnd(fn) {
      end = fn;
    },
    advance,
  };
}
