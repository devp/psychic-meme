// What's on, and the few things you can do about it. No DOM.
//
// It knows two seams and nothing behind them: a service to ask "what's next in
// this collection?", and an engine that makes time pass for an item.

/** @typedef {import("./types.js").Collection} Collection */
/** @typedef {import("./types.js").Item} Item */
/** @typedef {import("./types.js").Engine} Engine */
/** @typedef {import("./types.js").Service} Service */

/**
 * @typedef {Object} PlayerState
 * @property {Collection | null} collection
 * @property {Item | null} item null while the first one loads
 * @property {boolean} playing
 * @property {number} position seconds into the item
 * @property {"up" | "down" | null} vote on the current item
 */

/**
 * @param {{ service: Pick<Service, "nextItem" | "vote">, engine: Engine }} deps
 */
export function createPlayer({ service, engine }) {
  /** @type {PlayerState} */
  let state = { collection: null, item: null, playing: false, position: 0, vote: null };
  /** @type {Set<(s: PlayerState) => void>} */
  const subs = new Set();
  // Bumped on every change of item, so a slow answer for the last one is dropped.
  let turn = 0;

  /** @param {Partial<PlayerState>} patch */
  function set(patch) {
    state = { ...state, ...patch };
    subs.forEach((fn) => fn(state));
  }

  async function advance() {
    const collection = state.collection;
    if (!collection) return;
    const mine = ++turn;
    engine.pause();
    set({ item: null, position: 0, vote: null });
    const item = await service.nextItem(collection.id);
    if (mine !== turn) return;
    engine.load(item);
    if (state.playing) engine.play();
    set({ item });
  }

  engine.onTick((position) => set({ position }));
  engine.onEnd(() => void advance());

  return {
    /** @returns {PlayerState} */
    get state() {
      return state;
    },

    /**
     * Start a collection. Asking for the one that's already on just resumes it.
     * @param {Collection} collection
     */
    async play(collection) {
      if (state.collection?.id === collection.id) {
        if (!state.playing) this.toggle();
        return;
      }
      set({ collection, playing: true });
      await advance();
    },

    toggle() {
      if (!state.collection) return;
      const playing = !state.playing;
      if (state.item) playing ? engine.play() : engine.pause();
      set({ playing });
    },

    skip() {
      return advance();
    },

    /**
     * Voting again the same way takes it back. A thumbs-down also skips.
     * @param {"up" | "down"} vote
     */
    async vote(vote) {
      const { collection, item } = state;
      if (!collection || !item) return;
      if (state.vote === vote) return set({ vote: null });
      set({ vote });
      void service.vote(collection.id, item.id, vote);
      if (vote === "down") await advance();
    },

    /**
     * @param {(s: PlayerState) => void} fn called immediately, then on every change
     * @returns {() => void} unsubscribe
     */
    subscribe(fn) {
      subs.add(fn);
      fn(state);
      return () => subs.delete(fn);
    },
  };
}
