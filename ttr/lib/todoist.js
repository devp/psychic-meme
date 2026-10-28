// Todoist unified API v1 (https://developer.todoist.com/api/v1/), straight
// from the browser. REST v2 is deprecated; don't paste v2 examples in here.
//
// List endpoints page with a cursor: { results, next_cursor }. Sync takes
// form-encoded `commands` (JSON) and answers with sync_status keyed by uuid.

export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {number} status 0 for network failures
   */
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/**
 * @param {string} base e.g. https://api.todoist.com/api/v1
 * @param {string} token
 * @param {typeof fetch} [fetchFn]
 */
export function todoist(base, token, fetchFn = (...a) => fetch(...a)) {
  /**
   * @param {string} path
   * @param {RequestInit} [init]
   */
  async function call(path, init = {}) {
    let res;
    try {
      res = await fetchFn(base.replace(/\/$/, "") + path, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, ...init.headers },
      });
    } catch (e) {
      // fetch only throws when there's no response at all: offline, or a
      // CORS refusal, which the browser won't tell us apart.
      throw new ApiError(navigator.onLine === false ? "offline" : "couldn't reach Todoist (offline, or blocked)", 0);
    }
    if (res.status === 401 || res.status === 403) throw new ApiError("Todoist rejected the token", res.status);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ApiError(`Todoist said ${res.status}${text ? ": " + text.slice(0, 200) : ""}`, res.status);
    }
    return res.json();
  }

  /**
   * Every page of a list endpoint.
   * @param {string} path
   * @param {Record<string, string>} [params]
   * @param {AbortSignal} [signal]
   * @returns {Promise<any[]>}
   */
  async function all(path, params = {}, signal) {
    /** @type {any[]} */
    const out = [];
    /** @type {string|null} */
    let cursor = null;
    do {
      const q = new URLSearchParams({ ...params, limit: "200", ...(cursor ? { cursor } : {}) });
      const page = await call(`${path}?${q}`, { signal });
      out.push(...(page.results ?? []));
      cursor = page.next_cursor ?? null;
    } while (cursor);
    return out;
  }

  return {
    /**
     * @param {string} query
     * @param {AbortSignal} [signal]
     * @returns {Promise<import("./triage.js").Task[]>}
     */
    filter: (query, signal) => all("/tasks/filter", { query }, signal),
    /** @param {AbortSignal} [signal] */
    projects: (signal) => all("/projects", {}, signal),
    /** @param {AbortSignal} [signal] */
    sections: (signal) => all("/sections", {}, signal),
    /** One cheap call, for the setup screen. */
    check: () => call("/projects?limit=1"),
    /**
     * @param {import("./triage.js").Command[]} commands at most 100
     * @returns {Promise<{ sync_status?: Record<string, any> }>}
     */
    sync: (commands) =>
      call("/sync", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ commands: JSON.stringify(commands) }),
      }),
  };
}

/**
 * Agenda's sections, Watchlist's and Inbox's ids, and Switch's projects, by name.
 * @param {{ id: string, name: string, inbox_project?: boolean }[]} projects
 * @param {{ id: string, name: string, project_id: string, section_order?: number }[]} sections
 * @param {import("./triage.js").Config} config
 * @returns {import("./triage.js").Places & { projectNames: Record<string, string>, sectionNames: Record<string, string> }}
 */
export function places(projects, sections, config) {
  const byName = (/** @type {string} */ n) => projects.find((p) => p.name.toLowerCase() === n.toLowerCase())?.id ?? null;
  const agendaId = byName(config.agendaProject);
  // "Menu" finds "Menus" and the other way round.
  const loosely = (/** @type {string} */ n) => byName(n) ?? byName(n.endsWith("s") ? n.slice(0, -1) : n + "s");
  return {
    watchProjectId: byName(config.watchProject),
    inboxProjectId: projects.find((p) => p.inbox_project)?.id ?? byName("Inbox"),
    switchProjects: (config.switchProjects ?? []).flatMap((n) => {
      const id = loosely(n);
      return id ? [{ id, name: projects.find((p) => p.id === id)?.name ?? n }] : [];
    }),
    agendaSections: sections
      .filter((s) => s.project_id === agendaId)
      .sort((a, b) => (a.section_order ?? 0) - (b.section_order ?? 0))
      .map((s) => ({ id: s.id, name: s.name })),
    projectNames: Object.fromEntries(projects.map((p) => [p.id, p.name])),
    sectionNames: Object.fromEntries(sections.map((s) => [s.id, s.name])),
  };
}
