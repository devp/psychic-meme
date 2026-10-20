// The network side, in one place: snapshots, the places lookup, apply.
// Nothing else in the app talks to Todoist.

import { token, getConfig, placesCache } from "./state.js";
import { todoist, places } from "./lib/todoist.js";
import { sortTasks, localDate, batches, readStatus } from "./lib/triage.js";

/** @typedef {import("./lib/triage.js").Task} Task */
/** @typedef {import("./lib/triage.js").Target} Target */
/** @typedef {import("./lib/triage.js").Decision} Decision */

const api = () => todoist(getConfig().apiBase, token.get());

/** Test the token: resolves, or rejects with an ApiError saying why. */
export const checkToken = () => api().check();

// The target picker fetches every target to count it. A pick within FRESH of
// that reuses the list, so picking in a tunnel right after a station is instant.
const FRESH = 2 * 60_000;
/** @type {Map<string, { at: number, tasks: Task[] }>} keyed by query */
const snapshots = new Map();

/** @type {Promise<void>|null} */
let placesInFlight = null;
let placesAt = 0;

/** Look up Agenda/Watchlist and project names, at most once per FRESH. */
export function refreshPlaces() {
  if (Date.now() - placesAt < FRESH) return Promise.resolve();
  placesInFlight ??= (async () => {
    try {
      const a = api();
      const [projects, sections] = await Promise.all([a.projects(), a.sections()]);
      placesCache.set(places(projects, sections, getConfig()));
      placesAt = Date.now();
    } finally {
      placesInFlight = null;
    }
  })();
  return placesInFlight;
}

/**
 * The target's tasks, overdue first.
 * @param {Target} target
 * @param {{ reuse?: boolean, signal?: AbortSignal }} [opts] reuse: take a snapshot younger than FRESH
 * @returns {Promise<Task[]>}
 */
export async function snapshot(target, { reuse = false, signal } = {}) {
  const hit = snapshots.get(target.query);
  if (reuse && hit && Date.now() - hit.at < FRESH) return hit.tasks;
  // Places failing is fine: the cached lookup from last time still works.
  const [tasks] = await Promise.all([api().filter(target.query, signal), refreshPlaces().catch(() => {})]);
  const sorted = sortTasks(tasks, localDate());
  snapshots.set(target.query, { at: Date.now(), tasks: sorted });
  return sorted;
}

/** @param {Target} target @returns {number|null} the last known count */
export function knownCount(target) {
  return snapshots.get(target.query)?.tasks.length ?? null;
}

/**
 * Send every change: one Sync request per 100 commands, in queue order.
 * @param {Decision[]} decisions
 * @returns {Promise<{ applied: Decision[], failed: { decision: Decision, reason: string }[] }>}
 */
export async function apply(decisions) {
  const a = api();
  /** @type {Awaited<ReturnType<typeof apply>>} */
  const out = { applied: [], failed: [] };
  for (const batch of batches(decisions)) {
    try {
      const res = await a.sync(batch.flatMap((d) => d.commands));
      const r = readStatus(batch, res.sync_status ?? {});
      out.applied.push(...r.applied);
      out.failed.push(...r.failed);
    } catch (e) {
      out.failed.push(...batch.map((decision) => ({ decision, reason: e instanceof Error ? e.message : String(e) })));
    }
  }
  // Every snapshot is stale now.
  snapshots.clear();
  return out;
}
