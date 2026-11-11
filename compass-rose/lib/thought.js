// The thought-record model: entries, connections, and what the compass needle
// should point at. Pure functions over plain data -- no DOM, no storage -- so
// the rules are testable on their own (tests/thought.test.mjs).
//
// Vocabulary (see README):
//   Entry       one line of text, with a category and a timestamp
//   Connection  {from, to}: "from led to to". Optional; many entries have none.
//   Corner      thought, feeling, behavior -- the triangle
//   Resolution  an entry too; a record is resolved while its latest entry is one

/** @typedef {"situation"|"thought"|"feeling"|"behavior"|"intervention"|"resolution"} Category */
/** @typedef {"less"|"same"|"more"} Feel */

/**
 * @typedef {Object} Entry
 * @property {string} id
 * @property {Category} category
 * @property {string} text
 * @property {number} ts epoch ms
 * @property {Feel} [feel] only on a resolution
 */

/** @typedef {{ from: string, to: string }} Connection */

/**
 * The shape the views and exports work on. In storage it's a StoredRecord
 * (lib/store.js): `items` holds the entries, `name` the title.
 * @typedef {Object} ThoughtRecord
 * @property {string} id
 * @property {string} name
 * @property {number} createdAt
 * @property {Entry[]} entries
 * @property {Connection[]} connections
 * @property {number} [hintDismissedAt]
 */

/** @type {Category[]} */
export const CATEGORIES = ["situation", "thought", "feeling", "behavior", "intervention", "resolution"];

/** @type {Category[]} The triangle, in needle order. */
export const CORNERS = ["thought", "feeling", "behavior"];

/** @param {string} c @returns {c is Category} */
export function isCategory(c) {
  return /** @type {string[]} */ (CATEGORIES).includes(c);
}

/**
 * A StoredRecord, as read from the store, in the shape this module expects.
 * Tolerates old or partial data: unknown categories are dropped.
 * @param {import("./store.js").StoredRecord} stored
 * @returns {ThoughtRecord}
 */
export function fromStored(stored) {
  const s = /** @type {any} */ (stored);
  return {
    id: s.id,
    name: s.name ?? "",
    createdAt: s.createdAt ?? 0,
    entries: (s.items ?? []).filter((/** @type {any} */ e) => isCategory(e.category)),
    connections: Array.isArray(s.connections) ? s.connections : [],
    hintDismissedAt: s.hintDismissedAt,
  };
}

/** @param {Entry[]} entries @returns {Entry[]} oldest first; a copy */
export function chronological(entries) {
  return entries.slice().sort((a, b) => a.ts - b.ts);
}

/**
 * "src led to something new." The connection runs src -> new.
 * @param {string} srcId
 * @param {string} newId
 * @returns {Connection}
 */
export function causes(srcId, newId) {
  return { from: srcId, to: newId };
}

/**
 * "Something new led to src." The connection runs new -> src.
 * @param {string} srcId
 * @param {string} newId
 * @returns {Connection}
 */
export function causedBy(srcId, newId) {
  return { from: newId, to: srcId };
}

/**
 * Add a connection, unless it's a self-link, a duplicate, or names a missing entry.
 * @param {ThoughtRecord} rec
 * @param {Connection} c
 * @returns {Connection[]} the record's new connection list
 */
export function connect(rec, c) {
  const ids = new Set(rec.entries.map((e) => e.id));
  if (c.from === c.to || !ids.has(c.from) || !ids.has(c.to)) return rec.connections;
  if (rec.connections.some((x) => x.from === c.from && x.to === c.to)) return rec.connections;
  return [...rec.connections, { from: c.from, to: c.to }];
}

/**
 * @param {ThoughtRecord} rec
 * @param {Connection} c
 * @returns {Connection[]}
 */
export function disconnect(rec, c) {
  return rec.connections.filter((x) => !(x.from === c.from && x.to === c.to));
}

/**
 * Connections that survive deleting an entry.
 * @param {ThoughtRecord} rec
 * @param {string} entryId
 * @returns {Connection[]}
 */
export function connectionsWithout(rec, entryId) {
  return rec.connections.filter((c) => c.from !== entryId && c.to !== entryId);
}

/** @param {ThoughtRecord} rec */
export function isResolved(rec) {
  const all = chronological(rec.entries);
  return all.length > 0 && all[all.length - 1].category === "resolution";
}

/** @param {ThoughtRecord} rec @returns {Entry|undefined} */
export function lastIntervention(rec) {
  return chronological(rec.entries)
    .filter((e) => e.category === "intervention")
    .pop();
}

/**
 * The current informal round: everything after the latest intervention.
 * Interventions mark the rounds -- map, test, map again.
 * @param {ThoughtRecord} rec
 * @returns {Entry[]} oldest first
 */
export function sinceLastIntervention(rec) {
  // By position, not ts: two entries can share a millisecond.
  const all = chronological(rec.entries);
  const last = all.map((e) => e.category).lastIndexOf("intervention");
  return all.slice(last + 1);
}

/**
 * Has the map gone around the loop? True if some connection leads into a
 * corner category that is already upstream of it -- behavior linked back to an
 * earlier thought, or a new thought added as caused by a behavior that a
 * thought caused.
 * @param {Entry[]} entries
 * @param {Connection[]} connections
 */
export function hasLoop(entries, connections) {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const conns = connections.filter((c) => byId.has(c.from) && byId.has(c.to));
  /** @type {Map<string, string[]>} id -> ids that led to it */
  const parents = new Map();
  for (const c of conns) parents.set(c.to, [...(parents.get(c.to) ?? []), c.from]);

  for (const c of conns) {
    const target = byId.get(c.to);
    if (!target || !CORNERS.includes(target.category)) continue;
    // Walk upstream from c.from (inclusive). `seen` keeps cycles finite.
    const seen = new Set();
    const stack = [c.from];
    while (stack.length) {
      const id = /** @type {string} */ (stack.pop());
      if (seen.has(id)) continue;
      seen.add(id);
      if (id === c.to || byId.get(id)?.category === target.category) return true;
      stack.push(...(parents.get(id) ?? []));
    }
  }
  return false;
}

/**
 * Where the compass needle points.
 * - "intervention" (the center): the current round has looped and nothing has
 *   been tested since, unless the hint was dismissed after the loop formed.
 * - a corner: the first one not visited this round.
 * - null: nothing to suggest; the needle rests.
 * @param {ThoughtRecord} rec
 * @returns {{ target: Category|null, hint: boolean }}
 */
export function needle(rec) {
  const round = sinceLastIntervention(rec);
  const ids = new Set(round.map((e) => e.id));
  const roundConns = rec.connections.filter((c) => ids.has(c.from) && ids.has(c.to));
  if (hasLoop(round, roundConns)) {
    const latest = round.length ? round[round.length - 1].ts : 0;
    const dismissed = (rec.hintDismissedAt ?? 0) >= latest;
    return { target: "intervention", hint: !dismissed };
  }
  const seen = new Set(round.map((e) => e.category));
  return { target: CORNERS.find((c) => !seen.has(c)) ?? null, hint: false };
}

/**
 * A short title: the record's name, else its first situation, else its first entry.
 * @param {ThoughtRecord} rec
 */
export function titleOf(rec) {
  if (rec.name) return rec.name;
  const all = chronological(rec.entries);
  return (all.find((e) => e.category === "situation") ?? all[0])?.text ?? "Untitled";
}
