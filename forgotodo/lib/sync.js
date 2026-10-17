// Sync: one list, a few devices, a button. See TODO.sync.md for the rules.
//
// The remote's ETag is the version. Each list keeps `base`, the version it
// last synced, and `dirty`, set when you change something. Sync compares the
// two against the remote's current version and pushes, pulls or asks.
// Transport is lib/remotestorage.js; this file only decides.

/** Where the active list lives in remoteStorage. */
export const PATH = "forgotodo/list.json";

/**
 * @typedef {{ base: string|null, dirty: boolean }} SyncState
 * @typedef {"in-sync" | "pull" | "push" | "ask"} Decision
 */

/**
 * The button table. A list that's never synced counts as dirty, so it's
 * never silently replaced; nothing on the remote means push.
 * @param {SyncState} state
 * @param {string|null} remote the remote's ETag, null if there's no document
 * @returns {Decision}
 */
export function decide({ base, dirty }, remote) {
  if (remote === null) return "push";
  const changed = dirty || base === null;
  const moved = remote !== base;
  if (!moved) return changed ? "push" : "in-sync";
  return changed ? "ask" : "pull";
}

/**
 * Every list's SyncState, kept in one persisted JSON value, keyed by list id.
 * @param {{ get(): string, set(v: string): void }} value
 */
export function syncLedger(value) {
  /** @returns {Record<string, SyncState>} */
  const all = () => {
    try {
      return JSON.parse(value.get() || "{}");
    } catch {
      return {};
    }
  };
  /** @param {string} id @param {SyncState} s */
  const put = (id, s) => value.set(JSON.stringify({ ...all(), [id]: s }));

  return {
    /** @param {string} id @returns {SyncState} */
    get: (id) => all()[id] ?? { base: null, dirty: false },
    /** @param {string} id */
    markDirty(id) {
      const s = all()[id] ?? { base: null, dirty: false };
      if (!s.dirty) put(id, { ...s, dirty: true });
    },
    /** @param {string} id @param {string} etag */
    synced: (id, etag) => put(id, { base: etag, dirty: false }),
    /** Forget every list's sync state, as if none had ever synced. */
    clear: () => value.set(""),
  };
}

/**
 * @typedef {"this" | "other" | "neither"} Choice
 * @typedef {"in-sync" | "pulled" | "pushed" | "kept" | "raced" | "skipped"} Outcome
 *   kept: you chose Neither. raced: another device pushed between our read and
 *   write. skipped: quiet, and it wasn't a pull.
 */

/**
 * One press of Sync, or with `quiet`, the check on open: pull only, never ask.
 * Throws a RemoteStorageError when offline or the server says no.
 * @param {Object} opts
 * @param {ReturnType<typeof import("./remotestorage.js").remoteStorage>} opts.client
 * @param {ReturnType<typeof syncLedger>} opts.ledger
 * @param {string} opts.id the list's id
 * @param {() => unknown} opts.read the list, as it should travel
 * @param {(doc: any) => void} opts.write replace the list with a pulled one
 * @param {() => Promise<Choice>} opts.choose both sides changed: which to keep
 * @param {boolean} [opts.quiet]
 * @returns {Promise<Outcome>}
 */
export async function syncList({ client, ledger, id, read, write, choose, quiet = false }) {
  const remote = await client.get(PATH);
  const decision = decide(ledger.get(id), remote?.etag ?? null);
  if (quiet && decision !== "pull") return "skipped";
  if (decision === "in-sync") return "in-sync";
  const choice = decision === "ask" ? await choose() : decision === "pull" ? "other" : "this";
  if (choice === "neither") return "kept";
  if (choice === "other" && remote) {
    const doc = JSON.parse(remote.body);
    if (!doc || !Array.isArray(doc.items)) throw new Error("The synced list isn't one this app can read.");
    write(doc);
    ledger.synced(id, remote.etag);
    return "pulled";
  }
  // Conditional on the version just read: base, unless you chose This device.
  const put = await client.put(PATH, JSON.stringify(read()), { ifMatch: remote?.etag ?? null });
  if (!put) return "raced";
  ledger.synced(id, put.etag);
  return "pushed";
}
