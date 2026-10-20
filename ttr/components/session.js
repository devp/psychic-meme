import { LitElement, html, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { getConfig, placesCache } from "../state.js";
import { snapshot, apply } from "../remote.js";
import { Session, decide, verbsFor, verbLabel, summarize, overdueDays, isRecurring, localDate } from "../lib/triage.js";

/** @typedef {import("../lib/triage.js").Task} Task */
/** @typedef {import("../lib/triage.js").Target} Target */
/** @typedef {import("../lib/triage.js").Verb} Verb */
/** @typedef {import("../lib/triage.js").Decision} Decision */

/** Rhythm-game judgements; only the ddr theme shows them (see theme.css). */
const JUDGE = /** @type {Record<Verb, string>} */ ({
  done: "PERFECT!!",
  kill: "MARVELOUS!!!",
  date: "GREAT!",
  watch: "GREAT!",
  agenda: "GREAT!",
  tomorrow: "GOOD",
  unpin: "GOOD",
  skip: "BOO",
});

/** Markdown links in task content show as their text. */
const plain = (/** @type {string} */ s) => s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");

/**
 * One triage run on one target: fetch, cards, summary, apply, result.
 * `start(target)` begins; it fires "exit" to go back to the picker.
 */
export class TriageSession extends LitElement {
  static properties = {
    _phase: { state: true },
    _error: { state: true },
    _tray: { state: true },
    _armed: { state: true },
    _result: { state: true },
    _judge: { state: true },
    _tick: { state: true },
  };

  createRenderRoot() {
    return this;
  }

  constructor() {
    super();
    /** @type {Target|null} */
    this.target = null;
    /** @type {Session|null} */
    this.session = null;
    /** @type {"loading"|"error"|"triage"|"applying"|"done"} */
    this._phase = "loading";
    this._error = "";
    /** Second row open under the verbs: "date" | "watch" | "agenda" | "". */
    this._tray = "";
    /** A button waiting for its confirming second tap. */
    this._armed = "";
    /** @type {Awaited<ReturnType<typeof apply>>|null} */
    this._result = null;
    /** @type {{ text: string, combo: number, n: number }|null} */
    this._judge = null;
    /** Bumped when the session mutates, since Lit can't see inside it. */
    this._tick = 0;
    /** Ignore a fetch that finished after Cancel or Start over. */
    this._run = 0;
    /** @type {AbortController|null} */
    this._abort = null;
    /** @type {ReturnType<typeof setTimeout>|undefined} */
    this._disarm = undefined;
  }

  /**
   * @param {Target} target
   * @param {{ reuse?: boolean }} [opts] reuse a fresh snapshot from the picker
   */
  async start(target, { reuse = false } = {}) {
    this.target = target;
    this.session = null;
    this._result = null;
    this._judge = null;
    this._tray = "";
    this._armed = "";
    this._error = "";
    this._phase = "loading";
    const run = ++this._run;
    this._abort?.abort();
    this._abort = new AbortController();
    try {
      const tasks = await snapshot(target, { reuse, signal: this._abort.signal });
      if (run !== this._run) return;
      this.session = new Session(target, tasks);
      this._phase = "triage";
    } catch (e) {
      if (run !== this._run) return;
      this._error = e instanceof Error ? e.message : String(e);
      this._phase = "error";
    }
  }

  /** Queued changes; what leaving would throw away. */
  get pending() {
    return this.session?.changes.length ?? 0;
  }

  exit() {
    this._run++;
    this._abort?.abort();
    this.dispatchEvent(new CustomEvent("exit"));
  }

  /**
   * Leaving with decisions queued takes a second tap. Returns true when it's
   * fine to go.
   * @param {string} which the button asking
   */
  confirmed(which) {
    if (this._phase !== "triage" || !this.session?.decisions.length || this._armed === which) {
      this._armed = "";
      return true;
    }
    this.arm(which);
    return false;
  }

  /** @param {string} which */
  arm(which) {
    this._armed = which;
    clearTimeout(this._disarm);
    this._disarm = setTimeout(() => (this._armed = ""), 4000);
  }

  startOver() {
    if (this._phase === "applying" || !this.target || !this.confirmed("restart")) return;
    this.start(this.target);
  }

  back() {
    if (this._phase === "applying" || !this.confirmed("back")) return;
    this.exit();
  }

  /**
   * @param {Verb} verb
   * @param {string} [arg]
   */
  choose(verb, arg = "") {
    const s = this.session;
    const task = s?.current;
    if (!s || !task) return;
    if ((verb === "date" || verb === "watch" || verb === "agenda") && !arg) {
      this._tray = this._tray === verb ? "" : verb;
      return;
    }
    if (verb === "kill" && this._armed !== "kill") return this.arm("kill");
    let d;
    try {
      d = decide(task, verb, arg, { today: localDate(), places: placesCache.get(), config: getConfig() });
    } catch (e) {
      this._error = e instanceof Error ? e.message : String(e);
      return;
    }
    s.push(d);
    this._error = "";
    this._tray = "";
    this._armed = "";
    this._judge = { text: JUDGE[verb], combo: combo(s.decisions), n: (this._judge?.n ?? 0) + 1 };
    this._tick++;
  }

  undo() {
    if (!this.session?.undo()) return;
    this._tray = "";
    this._armed = "";
    this._judge = null;
    this._error = "";
    this._tick++;
  }

  /** @param {Decision} d */
  drop(d) {
    this.session?.drop(d);
    this._tick++;
  }

  async applyAll() {
    const changes = this.session?.changes ?? [];
    if (!changes.length) return;
    this._phase = "applying";
    this._result = await apply(changes);
    this._phase = "done";
  }

  render() {
    const t = this.target;
    if (!t) return nothing;
    return html`
      <div class="session-bar">
        <button type="button" class="btn small" @click=${() => this.back()}>${this._armed === "back" ? `discard ${this.session?.decisions.length}?` : "‹ targets"}</button>
        <strong>${t.name}</strong>
        <button type="button" class="btn small" ?disabled=${this._phase === "applying"} @click=${() => this.startOver()}>
          ${this._armed === "restart" ? `discard ${this.session?.decisions.length} decisions?` : "start over"}
        </button>
      </div>
      ${this.body()}
    `;
  }

  body() {
    switch (this._phase) {
      case "loading":
        return html`<div class="center">
          <div class="spinner" role="status" aria-label="Loading"></div>
          <p class="dim">fetching ${this.target?.name}…</p>
          <button type="button" class="btn" @click=${() => this.exit()}>cancel</button>
        </div>`;
      case "error":
        return html`<div class="center">
          <p class="error">${this._error}</p>
          <button type="button" class="btn primary" @click=${() => this.target && this.start(this.target)}>try again</button>
          <button type="button" class="btn" @click=${() => this.exit()}>cancel</button>
        </div>`;
      case "applying":
        return html`<div class="center">
          <div class="spinner" role="status" aria-label="Applying"></div>
          <p class="dim">applying…</p>
        </div>`;
      case "done":
        return this.renderResult();
      default:
        return this.session?.current ? this.renderCard(this.session.current) : this.renderSummary();
    }
  }

  /** @param {Task} task */
  renderCard(task) {
    const s = /** @type {Session} */ (this.session);
    const config = getConfig();
    const where = placesCache.get();
    const project = where.projectNames[task.project_id] ?? "";
    const section = task.section_id ? where.sectionNames[task.section_id] ?? "" : "";
    const late = overdueDays(task, localDate());
    const desc = (task.description ?? "").split("\n").find((l) => l.trim()) ?? "";
    const verbs = verbsFor(task, s.target, config);
    return html`
      <div class="progress">
        <button type="button" class="btn" ?disabled=${!s.index} @click=${() => this.undo()} aria-label="Undo">↶ undo</button>
        <span class="count">${s.index + 1} / ${s.tasks.length}</span>
        <button type="button" class="btn" @click=${() => this.choose("skip")}>skip ›</button>
      </div>
      ${this.renderJudge()}
      <article class="card" aria-live="polite">
        <div class="where dim">${project}${section ? html` / ${section}` : nothing}</div>
        <h2 class="content">${plain(task.content)}</h2>
        <div class="meta">
          ${late ? html`<span class="badge late">overdue ${late}d</span>` : nothing}
          ${task.due ? html`<span class="badge">${task.due.string || task.due.date}</span>` : nothing}
          ${isRecurring(task) ? html`<span class="badge recur" title="recurring">↻</span>` : nothing}
          ${(task.labels ?? []).map((l) => html`<span class="badge label">@${l}</span>`)}
        </div>
        ${desc ? html`<p class="desc dim">${plain(desc)}</p>` : nothing}
      </article>
      ${this._error ? html`<p class="error">${this._error}</p>` : nothing}
      <div class="controls">
        ${this.renderTray(task)}
        <div class="verbs" data-n=${verbs.length}>
          ${verbs.map(
            (v) => html`<button type="button" class="verb" data-verb=${v} aria-pressed=${this._tray === v}
              @click=${() => this.choose(v)}>${v === "kill" && this._armed === "kill" ? "tap again: kill series" : verbLabel(v, task)}</button>`
          )}
        </div>
      </div>
    `;
  }

  /** @param {Task} task */
  renderTray(task) {
    const config = getConfig();
    const v = /** @type {Verb} */ (this._tray);
    if (!v) return nothing;
    /** @type {{ arg: string, label: string }[]} */
    let opts;
    if (v === "agenda") {
      opts = placesCache.get().agendaSections.map((s) => ({ arg: s.id, label: s.name }));
      if (!opts.length) return html`<p class="tray error">no sections in a "${config.agendaProject}" project (yet?)</p>`;
    } else {
      if (v === "watch" && !placesCache.get().watchProjectId) return html`<p class="tray error">no "${config.watchProject}" project found</p>`;
      opts = (v === "watch" ? config.watchBuckets : config.dateBuckets).map((b) => ({ arg: b, label: b }));
    }
    return html`<div class="tray" data-verb=${v} role="group" aria-label=${verbLabel(v, task)}>
      ${opts.map((o) => html`<button type="button" class="verb small" data-verb=${v} @click=${() => this.choose(v, o.arg)}>${o.label}</button>`)}
    </div>`;
  }

  renderJudge() {
    const j = this._judge;
    return repeat(j ? [j] : [], (j) => j.n, (j) => html`<div class="judge" aria-hidden="true">
      <span class="judge-word">${j.text}</span>${j.combo > 1 ? html`<span class="judge-combo">${j.combo} combo</span>` : nothing}
    </div>`);
  }

  renderSummary() {
    const s = /** @type {Session} */ (this.session);
    const groups = summarize(s.decisions);
    const n = s.changes.length;
    return html`
      <div class="progress">
        <button type="button" class="btn" ?disabled=${!s.index} @click=${() => this.undo()}>↶ undo</button>
        <span class="count">${s.tasks.length} / ${s.tasks.length}</span>
        <span></span>
      </div>
      <div class="summary">
        ${s.tasks.length ? nothing : html`<p class="center dim">Nothing in ${s.target.name}. 🎉</p>`}
        ${groups.map(
          (g) => html`<section>
            <h3>${g.label} (${g.decisions.length})</h3>
            <ul>
              ${g.decisions.map(
                (d) => html`<li><button type="button" class="drop" @click=${() => this.drop(d)} aria-label=${`drop: ${d.task.content}`}>
                  <span>${plain(d.task.content)}</span><span class="x" aria-hidden="true">✕</span>
                </button></li>`
              )}
            </ul>
          </section>`
        )}
        ${s.tasks.length && !n ? html`<p class="dim">No changes queued.</p>` : nothing}
      </div>
      <div class="controls">
        ${n
          ? html`<button type="button" class="verb apply" @click=${() => this.applyAll()}>Apply ${n} change${n === 1 ? "" : "s"}</button>`
          : html`<button type="button" class="verb" @click=${() => this.exit()}>done</button>`}
      </div>
    `;
  }

  renderResult() {
    const r = /** @type {NonNullable<typeof this._result>} */ (this._result);
    return html`
      <div class="summary">
        <p class="applied">✓ ${r.applied.length} applied</p>
        ${r.failed.length
          ? html`<section>
              <h3 class="error">${r.failed.length} failed</h3>
              <ul>
                ${r.failed.map((f) => html`<li class="failed"><strong>${plain(f.decision.task.content)}</strong> <span class="dim">${f.decision.label}: ${f.reason}</span></li>`)}
              </ul>
            </section>`
          : nothing}
      </div>
      <div class="controls">
        <div class="verbs" data-n="2">
          <button type="button" class="verb" @click=${() => this.target && this.start(this.target)}>again</button>
          <button type="button" class="verb" @click=${() => this.exit()}>targets</button>
        </div>
      </div>
    `;
  }
}

/**
 * Decisions in a row that weren't skips, counting back from the latest.
 * @param {Decision[]} ds
 */
function combo(ds) {
  let n = 0;
  for (let i = ds.length - 1; i >= 0 && ds[i].verb !== "skip"; i--) n++;
  return n;
}
