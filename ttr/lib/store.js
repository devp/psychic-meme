// localStorage-backed state with subscribers.
//
// The subscriber list is the whole point. Without it you end up hand-calling a
// re-render at every mutation site and silently showing stale data the day you
// forget one. (The project this starter was extracted from had five such call
// sites for a single list.) Components subscribe; nobody remembers anything.
//
// Framework-agnostic: no DOM, no custom elements, no Lit.

/** @returns {string} */
function uid() {
  return "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * @param {string} key
 * @param {string|null} fallback
 * @returns {string|null}
 */
function readRaw(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : raw;
  } catch {
    // private mode, blocked site data, quota weirdness -- never fatal
    return fallback;
  }
}

/**
 * @param {string} key
 * @param {string} value
 */
function writeRaw(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* best effort */
  }
}

/**
 * A single persisted scalar -- theme, font, active tab. Anything where the
 * value *is* the state.
 *
 * @param {string} key
 * @param {string} initial
 */
export function persistedValue(key, initial) {
  let value = readRaw(key, initial) ?? initial;
  /** @type {Set<(v: string) => void>} */
  const subs = new Set();

  return {
    /** @returns {string} */
    get() {
      return value;
    },
    /** @param {string} next */
    set(next) {
      if (next === value) return;
      value = next;
      writeRaw(key, next);
      subs.forEach((fn) => fn(value));
    },
    /**
     * @param {(v: string) => void} fn called immediately with the current
     *   value, then on every change.
     * @returns {() => void} unsubscribe
     */
    subscribe(fn) {
      subs.add(fn);
      fn(value);
      return () => subs.delete(fn);
    },
  };
}

/**
 * An item carries an id we assign; everything else is caller-shaped.
 * @typedef {{ id: string } & Record<string, any>} Item
 */

/**
 * Named StoredRecord, not Record -- `Record` is a built-in TypeScript utility
 * type, and shadowing it breaks every `Record<string, any>` in the file.
 * @typedef {Object} StoredRecord
 * @property {string} id
 * @property {string} name
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {Item[]} items
 */

/**
 * A list of named things you come back to -- sessions, documents, lists --
 * each holding items, with one marked active.
 *
 * Held in memory and written through on change, rather than re-parsing the
 * whole blob on every read the way a naive version does.
 *
 * Reads return copies. That costs an allocation, which at these sizes is
 * nothing, and buys two things: you cannot accidentally mutate stored state
 * without subscribers hearing about it, and a re-read is never `===` the value
 * you already had -- which is exactly what a reactive property needs in order
 * to notice that something changed.
 *
 * @param {string} key localStorage key prefix
 */
export function recordStore(key) {
  const RECORDS_KEY = key + ":records";
  const ACTIVE_KEY = key + ":activeId";

  /** @type {StoredRecord[]} */
  let records = [];
  try {
    const parsed = JSON.parse(readRaw(RECORDS_KEY, "[]") ?? "[]");
    if (Array.isArray(parsed)) records = parsed;
  } catch {
    records = [];
  }

  let activeId = readRaw(ACTIVE_KEY, null);

  /** @type {Set<() => void>} */
  const subs = new Set();

  function flush() {
    writeRaw(RECORDS_KEY, JSON.stringify(records));
    if (activeId !== null) writeRaw(ACTIVE_KEY, activeId);
    subs.forEach((fn) => fn());
  }

  /**
   * @param {string} id
   * @returns {StoredRecord|undefined}
   */
  function find(id) {
    return records.find((r) => r.id === id);
  }

  /**
   * Detach a record from internal state before handing it out.
   * @param {StoredRecord} r
   * @returns {StoredRecord}
   */
  function detach(r) {
    return { ...r, items: r.items.map((i) => ({ ...i })) };
  }

  const api = {
    /** @returns {StoredRecord[]} newest first; copies */
    getAll() {
      return records
        .slice()
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map(detach);
    },

    /**
     * @param {string} id
     * @returns {StoredRecord|null}
     */
    get(id) {
      const rec = find(id);
      return rec ? detach(rec) : null;
    },

    /** @returns {string|null} */
    getActiveId() {
      return activeId;
    },

    /**
     * @param {string} [name]
     * @returns {StoredRecord}
     */
    create(name = "") {
      const rec = {
        id: uid(),
        name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        items: [],
      };
      records.push(rec);
      activeId = rec.id;
      flush();
      return detach(rec);
    },

    /**
     * The active record, creating one if there isn't a valid one.
     * @returns {StoredRecord}
     */
    ensureActive() {
      const rec = activeId ? find(activeId) : undefined;
      return rec ? detach(rec) : api.create("");
    },

    /** @param {string} id */
    setActive(id) {
      if (!find(id) || id === activeId) return;
      activeId = id;
      flush();
    },

    /**
     * @param {string} id
     * @param {string} name
     */
    rename(id, name) {
      const rec = find(id);
      if (!rec) return;
      rec.name = name;
      rec.updatedAt = Date.now();
      flush();
    },

    /** @param {string} id */
    remove(id) {
      records = records.filter((r) => r.id !== id);
      if (activeId === id) {
        activeId = null;
        try {
          localStorage.removeItem(ACTIVE_KEY);
        } catch {
          /* best effort */
        }
      }
      flush();
    },

    /**
     * @param {string} id
     * @param {Object} item an id is assigned for you
     * @returns {Item|null}
     */
    append(id, item) {
      const rec = find(id);
      if (!rec) return null;
      const stored = { ...item, id: uid() };
      rec.items.push(stored);
      rec.updatedAt = Date.now();
      flush();
      return { ...stored };
    },

    /**
     * @param {string} id
     * @param {string} itemId
     * @param {Object} patch merged into the item
     */
    updateItem(id, itemId, patch) {
      const rec = find(id);
      if (!rec) return;
      const item = rec.items.find((i) => i.id === itemId);
      if (!item) return;
      Object.assign(item, patch, { id: itemId });
      rec.updatedAt = Date.now();
      flush();
    },

    /**
     * @param {string} id
     * @param {string} itemId
     */
    removeItem(id, itemId) {
      const rec = find(id);
      if (!rec) return;
      rec.items = rec.items.filter((i) => i.id !== itemId);
      rec.updatedAt = Date.now();
      flush();
    },

    /** @param {string} id */
    clearItems(id) {
      const rec = find(id);
      if (!rec) return;
      rec.items = [];
      rec.updatedAt = Date.now();
      flush();
    },

    /**
     * @param {() => void} fn called on every change (not immediately)
     * @returns {() => void} unsubscribe
     */
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };

  return api;
}
