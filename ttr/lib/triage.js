// The triage itself, with no DOM and no network: which verbs a task gets,
// what Sync commands a decision becomes, the session queue, and reading the
// Sync response back. Everything here is testable in node.

/**
 * A task as GET /tasks/filter returns it (only the fields used here).
 * @typedef {Object} Task
 * @property {string} id
 * @property {string} content
 * @property {string} [description]
 * @property {string} project_id
 * @property {string|null} [section_id]
 * @property {string|null} [parent_id]
 * @property {string[]} [labels]
 * @property {{ date: string, string?: string, is_recurring?: boolean } | null} [due]
 */

/**
 * @typedef {Object} Target
 * @property {string} name
 * @property {string} query Todoist filter query
 * @property {Verb[]} verbs Skip and Undo are always there
 */

/**
 * @typedef {Object} Config
 * @property {Target[]} targets
 * @property {string[]} dateBuckets e.g. "+1w"; see addBucket
 * @property {string[]} watchBuckets
 * @property {string} agendaProject project name; its sections are the Agenda buttons
 * @property {string} watchProject project name
 * @property {string} pinLabel label name, no @
 * @property {string} apiBase a proxy goes here if CORS ever blocks the real one
 */

/** @typedef {"date"|"watch"|"agenda"|"tomorrow"|"unpin"|"done"|"kill"|"skip"} Verb */

/** @typedef {{ type: string, uuid: string, args: Record<string, any> }} Command */

/**
 * One tap on one card. Skips are decisions too, with no commands, so Undo
 * walks back through them and the card index is just the queue length.
 * @typedef {Object} Decision
 * @property {Task} task
 * @property {Verb} verb
 * @property {string} label what the summary groups by, e.g. "Date +1w"
 * @property {Command[]} commands
 */

/** @type {Config} */
export const DEFAULT_CONFIG = {
  targets: [
    { name: "Today", query: "today | overdue", verbs: ["date", "agenda", "tomorrow", "done"] },
    { name: "Pins", query: "@pin", verbs: ["unpin", "date", "agenda", "done"] },
    { name: "Inbox", query: "#Inbox & no date", verbs: ["watch", "agenda", "tomorrow", "done"] },
  ],
  dateBuckets: ["+1w", "+2w", "+1mo", "+3mo"],
  watchBuckets: ["+1w", "+2w", "+1mo", "+3mo"],
  agendaProject: "Agenda",
  watchProject: "Watchlist",
  pinLabel: "pin",
  apiBase: "https://api.todoist.com/api/v1",
};

/**
 * Stored config over the defaults, so a hand-edited config can leave keys out.
 * @param {Partial<Config>|null|undefined} stored
 * @returns {Config}
 */
export function withDefaults(stored) {
  const c = { ...DEFAULT_CONFIG, ...(stored && typeof stored === "object" ? stored : {}) };
  if (!Array.isArray(c.targets)) c.targets = DEFAULT_CONFIG.targets;
  return c;
}

// ---- dates ----------------------------------------------------------------
// Plain "YYYY-MM-DD" strings in the phone's own day, which is the day Dev means.

/** @param {Date} [d] */
export function localDate(d = new Date()) {
  const p = (/** @type {number} */ n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** @param {string} ymd */
function toUtc(ymd) {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/**
 * "+3d", "+1w", "+1mo", "+1y" from a day. Months clamp: Jan 31 +1mo is Feb 28.
 * @param {string} today YYYY-MM-DD
 * @param {string} bucket
 * @returns {string} YYYY-MM-DD
 */
export function addBucket(today, bucket) {
  const m = /^\+(\d+)(d|w|mo|y)$/.exec(bucket);
  if (!m) throw new Error(`bad bucket "${bucket}"; use e.g. +3d, +1w, +1mo, +1y`);
  const n = Number(m[1]);
  const [y, mo, d] = today.split("-").map(Number);
  if (m[2] === "d" || m[2] === "w") {
    return new Date(toUtc(today) + n * (m[2] === "w" ? 7 : 1) * 86400_000).toISOString().slice(0, 10);
  }
  const months = m[2] === "y" ? n * 12 : n;
  const first = new Date(Date.UTC(y, mo - 1 + months, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, last));
  return first.toISOString().slice(0, 10);
}

/**
 * Days overdue; 0 if due today, later, or undated.
 * @param {Task} task
 * @param {string} today
 */
export function overdueDays(task, today) {
  if (!task.due?.date) return 0;
  return Math.max(0, Math.round((toUtc(today) - toUtc(task.due.date)) / 86400_000));
}

/** @param {Task} task */
export function isRecurring(task) {
  return Boolean(task.due?.is_recurring);
}

/**
 * API order, but overdue first (oldest first among those). Stable.
 * @param {Task[]} tasks
 * @param {string} today
 */
export function sortTasks(tasks, today) {
  return tasks
    .map((t, i) => ({ t, i, late: overdueDays(t, today) }))
    .sort((a, b) => (b.late > 0 ? 1 : 0) - (a.late > 0 ? 1 : 0) || (a.late > 0 ? b.late - a.late : 0) || a.i - b.i)
    .map((x) => x.t);
}

// ---- verbs ----------------------------------------------------------------

/**
 * The big buttons for this card, in the target's order.
 *
 * Recurring tasks: setting a due date overwrites the recurrence, so Date,
 * Tomorrow and Watch go, and Kill series (the only delete) comes in.
 * @param {Task} task
 * @param {Target} target
 * @param {Config} config
 * @returns {Verb[]}
 */
export function verbsFor(task, target, config) {
  /** @type {Verb[]} */
  let verbs = target.verbs.filter((v) => v !== "skip" && v !== "kill");
  if (!(task.labels ?? []).includes(config.pinLabel)) verbs = verbs.filter((v) => v !== "unpin");
  if (isRecurring(task)) verbs = [...verbs.filter((v) => v !== "date" && v !== "tomorrow" && v !== "watch"), "kill"];
  return verbs;
}

/**
 * @param {Verb} verb
 * @param {Task} task
 */
export function verbLabel(verb, task) {
  if (verb === "done" && isRecurring(task)) return "Done (this one)";
  return { date: "Date", watch: "Watch", agenda: "Agenda", tomorrow: "Tomorrow", unpin: "Unpin", done: "Done", kill: "Kill series", skip: "Skip" }[verb];
}

/**
 * What the Agenda and Watch verbs need from the account, looked up by name.
 * @typedef {Object} Places
 * @property {string|null} watchProjectId
 * @property {{ id: string, name: string }[]} agendaSections
 */

/**
 * Turn a tap into a decision with its Sync commands. Commands get their UUIDs
 * now, so a later retry could resend them idempotently.
 *
 * @param {Task} task
 * @param {Verb} verb
 * @param {string} arg bucket for date/watch, section id for agenda, else ""
 * @param {{ today: string, places: Places, config: Config, uuid?: () => string }} ctx
 * @returns {Decision}
 */
export function decide(task, verb, arg, { today, places, config, uuid = () => crypto.randomUUID() }) {
  const id = task.id;
  /** @type {(type: string, args: Record<string, any>) => Command} */
  const cmd = (type, args) => ({ type, uuid: uuid(), args: { id, ...args } });
  const tomorrow = () => addBucket(today, "+1d");
  switch (verb) {
    case "date":
      return { task, verb, label: `Date ${arg}`, commands: [cmd("item_update", { due: { date: addBucket(today, arg) } })] };
    case "tomorrow":
      return { task, verb, label: "Tomorrow", commands: [cmd("item_update", { due: { date: tomorrow() } })] };
    case "watch":
      if (!places.watchProjectId) throw new Error(`no "${config.watchProject}" project`);
      return {
        task,
        verb,
        label: `Watch ${arg}`,
        commands: [
          cmd("item_move", { project_id: places.watchProjectId }),
          cmd("item_update", { due: { date: addBucket(today, arg) } }),
        ],
      };
    case "agenda": {
      const section = places.agendaSections.find((s) => s.id === arg);
      if (!section) throw new Error(`no section ${arg} in "${config.agendaProject}"`);
      const commands = [cmd("item_move", { section_id: section.id })];
      // Clearing the due date would end a recurring task's series too.
      if (task.due && !isRecurring(task)) commands.push(cmd("item_update", { due: null }));
      return { task, verb, label: `Agenda → ${section.name}`, commands };
    }
    case "unpin":
      return {
        task,
        verb,
        label: "Unpin",
        commands: [cmd("item_update", { labels: (task.labels ?? []).filter((l) => l !== config.pinLabel) })],
      };
    case "done":
      return { task, verb, label: isRecurring(task) ? "Done (this one)" : "Done", commands: [cmd("item_close", {})] };
    case "kill":
      return { task, verb, label: "Kill series", commands: [cmd("item_delete", {})] };
    case "skip":
      return { task, verb, label: "Skip", commands: [] };
  }
}

// ---- the session ----------------------------------------------------------

/**
 * A snapshot and the decisions on it. In memory only: losing it loses
 * nothing in Todoist, because nothing is written until apply.
 */
export class Session {
  /**
   * @param {Target} target
   * @param {Task[]} tasks already sorted
   */
  constructor(target, tasks) {
    this.target = target;
    this.tasks = tasks;
    /** @type {Decision[]} one per card so far, in order */
    this.decisions = [];
  }

  /** Index of the card showing; tasks.length means the summary. */
  get index() {
    return this.decisions.length;
  }

  /** @returns {Task|null} null once every card has a decision */
  get current() {
    return this.tasks[this.index] ?? null;
  }

  /** @param {Decision} d */
  push(d) {
    if (this.current) this.decisions.push(d);
  }

  /** @returns {Decision|undefined} */
  undo() {
    return this.decisions.pop();
  }

  /**
   * Drop one change from the summary. It becomes a skip, so the card count
   * and Undo still line up.
   * @param {Decision} d
   */
  drop(d) {
    const i = this.decisions.indexOf(d);
    if (i >= 0) this.decisions[i] = { task: d.task, verb: "skip", label: "Skip", commands: [] };
  }

  /** Decisions that change something. */
  get changes() {
    return this.decisions.filter((d) => d.commands.length);
  }
}

/**
 * Changes grouped by label, in first-seen order: "Done (6)", "Date +1w (4)".
 * @param {Decision[]} decisions
 * @returns {{ label: string, decisions: Decision[] }[]}
 */
export function summarize(decisions) {
  /** @type {Map<string, Decision[]>} */
  const groups = new Map();
  for (const d of decisions) {
    if (!d.commands.length) continue;
    groups.set(d.label, [...(groups.get(d.label) ?? []), d]);
  }
  return [...groups].map(([label, ds]) => ({ label, decisions: ds }));
}

/**
 * Batches of at most `max` commands, never splitting a decision's commands.
 * @param {Decision[]} decisions
 * @param {number} [max] Sync's limit per request
 * @returns {Decision[][]}
 */
export function batches(decisions, max = 100) {
  /** @type {Decision[][]} */
  const out = [];
  let size = 0;
  for (const d of decisions) {
    if (!d.commands.length) continue;
    if (!out.length || size + d.commands.length > max) {
      out.push([]);
      size = 0;
    }
    out[out.length - 1].push(d);
    size += d.commands.length;
  }
  return out;
}

/**
 * Read sync_status back onto decisions. A decision applied only if all its
 * commands came back "ok".
 * @param {Decision[]} decisions
 * @param {Record<string, any>} status uuid -> "ok" | { error, error_code, ... }
 * @returns {{ applied: Decision[], failed: { decision: Decision, reason: string }[] }}
 */
export function readStatus(decisions, status) {
  /** @type {Decision[]} */
  const applied = [];
  /** @type {{ decision: Decision, reason: string }[]} */
  const failed = [];
  for (const d of decisions) {
    const bad = d.commands.find((c) => status[c.uuid] !== "ok");
    if (!bad) applied.push(d);
    else {
      const s = status[bad.uuid];
      failed.push({ decision: d, reason: s && typeof s === "object" ? String(s.error ?? JSON.stringify(s)) : "no response for this change" });
    }
  }
  return { applied, failed };
}
