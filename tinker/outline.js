// Parse a game outline (markdown) and derive graph, teach order, tensions, readiness.
// Plain ESM, no deps: runs in node and the browser.
//
// Headings are groups (any depth). Nodes are list items starting with a kind:
//   - rule delve: text
//     - needs: a, b          fields are reserved keys, as child items
//     - serves: x  hurts: y
//     - prose step, [[ref]] counts as needs, #tag
//     - ? open question
//     - rule sub: nested node; parent recorded
// Fenced blocks are skipped; ```tinker graph [scope]``` is recorded for the renderer.

export const KINDS = ["goal", "rule", "effect", "stub", "table"];
export const KEYS = ["needs", "serves", "hurts", "slot"];
const LIST_KEYS = ["needs", "serves", "hurts"];
// "rule id: text", "rule id", or anonymous "rule: text"; "#tags" and "@roles" may follow the id
const KIND_RE = new RegExp(`^(${KINDS.join("|")})(?:\\s+([\\w-]+))?((?:\\s+[#@][\\w-]+)*)\\s*(?::\\s*(.*))?$`);
// "## Attic", "## Ideas #attic", or "#attic" on a node parks it: kept in the file, ignored by analysis.
export const ATTIC_HEAD = /^attic\b|(^|\s)#attic\b/i;
const ATTIC_TAG = /(^|\s)#attic\b/;
const BULLET_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

export function parse(src) {
  const doc = { pitch: "", title: "", nodes: [], logs: [], questions: [], fences: [], loose: [], lints: [], arrows: [], parked: new Set() };
  const groups = [];
  let items = []; // open list items: { indent, node }
  let fence = null;

  const path = () => groups.filter(Boolean);
  const atticGroup = () => groups.some((g) => g && ATTIC_HEAD.test(g));
  const owner = () => {
    for (let k = items.length - 1; k >= 0; k--) if (items[k].node) return { node: items[k].node, depth: items.length - 1 - k };
    return { node: null, depth: 0 };
  };

  src.split("\n").forEach((raw, i) => {
    const at = i + 1;
    const fm = raw.match(/^\s*(```+|~~~+)\s*(.*)$/);
    if (fence) {
      if (fm && fm[1].startsWith(fence.mark) && !fm[2].trim()) { fence.end = at; fence = null; }
      return;
    }
    if (fm) {
      fence = { mark: fm[1], info: fm[2].trim(), line: at, end: null, group: path() };
      doc.fences.push(fence);
      return;
    }
    if (!raw.trim() || /^\s*<!--.*-->\s*$/.test(raw)) return;

    let m;
    if ((m = raw.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/))) {
      const lvl = m[1].length;
      groups.length = lvl;
      groups[lvl - 1] = m[2];
      if (lvl === 1 && !doc.title) doc.title = m[2];
      items = [];
      return;
    }
    if ((m = raw.match(/^>\s?(.*)$/)) && !doc.pitch && !doc.nodes.length) { doc.pitch = m[1].trim(); return; }

    const li = raw.match(BULLET_RE);
    const body = li ? li[3] : raw.trim();
    if (/\s-->\s/.test(body))
      doc.arrows.push({ chain: body.split(/\s-->\s/).map((x) => x.trim().replace(/^\[\[([\w-]+)\]\]$/, "$1")), line: at, indent: li ? li[1].length + 2 : 0, group: path() });
    if (!li) {
      const t = raw.trim();
      const { node } = /^\s/.test(raw) ? owner() : { node: null };
      if (atticGroup() || node?.attic) doc.parked.add(at);
      if (t.startsWith("? ")) doc.questions.push({ text: t.slice(2), line: at, node: node?.id ?? null, group: path() });
      else if (node) scan(node, t, at);
      else scanLoose(doc, t, at);
      return;
    }

    const indent = li[1].replace(/\t/g, "    ").length;
    const text = li[3].trim();
    while (items.length && items[items.length - 1].indent >= indent) items.pop();
    const { node: parent, depth } = owner();
    if (atticGroup() || parent?.attic || ATTIC_TAG.test(text)) doc.parked.add(at);

    if ((m = text.match(KIND_RE))) {
      const n = {
        kind: m[1], id: m[2] ?? `@${at}`, anon: !m[2], text: m[4] ?? "", line: at, group: path(), parent: parent?.id ?? null,
        needs: [], serves: [], hurts: [], refs: [], goalRefs: [], tags: [], who: [], steps: [], fields: {}, items: [],
      };
      // numbered siblings form a sequence, in document order
      if (/\d/.test(li[2])) n.seq = `${parent?.id ?? path().join("/")}|${indent}`;
      n.attic = doc.parked.has(at);
      n.label = n.anon ? shorten(n.text) || `${n.kind}@${at}` : n.id;
      if (n.kind === "table" && n.text.includes("|")) n.items = n.text.split("|").map((x) => x.trim()).filter(Boolean);
      else scan(n, n.text, at);
      scan(n, m[3], at);
      doc.nodes.push(n);
      items.push({ indent, node: n });
      return;
    }
    items.push({ indent, node: null });

    const firstWord = text.match(/^(\w+)(?:\s+[\w-]+)?\s*:/)?.[1];
    if (KINDS.includes(text.match(/^(\w+)\s/)?.[1]))
      doc.lints.push({ line: at, msg: `not a node: an id is one word; write "${text.split(" ")[0]}: text" for an unnamed one` });
    else if (firstWord && !KINDS.includes(firstWord)) {
      const near = closest(firstWord, KINDS, 1);
      if (near) doc.lints.push({ line: at, msg: `"${firstWord}" isn't a kind; did you mean "${near}"?` });
    }

    if ((m = text.match(/^log:\s*(.*)$/))) {
      doc.logs.push({ text: m[1], line: at, refs: [...m[1].matchAll(/\[\[([\w-]+)\]\]/g)].map(([, id]) => id) });
      return;
    }
    if ((m = text.match(/^\?\s*(.*)$/))) { doc.questions.push({ text: m[1], line: at, node: parent?.id ?? null, group: path() }); return; }
    if (!parent) { scanLoose(doc, text, at); return; }
    if (parent.kind === "table" && depth === 0) { parent.items.push(text); return; }

    const key = text.match(/^(\w+):/)?.[1];
    if (key && KEYS.includes(key)) {
      // "serves: fast  hurts: choice": several fields per line
      for (const [, k, v] of text.matchAll(/(\w+):\s*((?:(?!\s\w+:).)*)/g)) {
        if (!KEYS.includes(k)) {
          doc.lints.push({ line: at, msg: `unknown field "${k}:"${hint(k, KEYS)}` });
          continue;
        }
        const vals = v.split(/[,\s]+/).map((x) => x.replace(/^\[\[|\]\]$/g, "")).filter(Boolean);
        if (k === "needs") vals.forEach((id) => parent.refs.push({ id, line: at }));
        else if (k === "slot") parent.fields.slot = { text: v.trim(), line: at };
        else vals.forEach((id) => parent.goalRefs.push({ id, line: at, kind: k }));
      }
      return;
    }
    if (key) {
      const near = closest(key, KEYS, 2);
      if (near) doc.lints.push({ line: at, msg: `"${key}:" reads as prose; did you mean "${near}:"?` });
    }
    parent.steps.push({ text, depth, line: at });
    scan(parent, text, at);
  });

  const seqs = new Map();
  for (const n of doc.nodes) if (n.seq) seqs.set(n.seq, [...(seqs.get(n.seq) || []), n]);
  for (const list of seqs.values()) list.forEach((n, k) => { n.prev = list[k - 1]?.id ?? null; n.next = list[k + 1]?.id ?? null; });

  for (const n of doc.nodes) {
    n.needs = [...new Set(n.refs.map((r) => r.id))];
    for (const k of ["serves", "hurts"]) n[k] = [...new Set(n.goalRefs.filter((r) => r.kind === k).map((r) => r.id))];
    n.tags = [...new Set(n.tags)];
    // roles: own, else inherited from the enclosing node (parents come first in doc order)
    n.who = [...new Set(n.who)];
    if (!n.who.length && n.parent) n.who = doc.nodes.find((p) => p.id === n.parent)?.who ?? [];
  }
  return doc;
}

function shorten(s) {
  const t = s.replace(/\[\[([\w-]+)\]\]/g, "$1").trim();
  return t.length > 40 ? t.slice(0, 39) + "…" : t;
}

function scan(node, s, line) {
  for (const [, id] of s.matchAll(/\[\[([\w-]+)\]\]/g)) node.refs.push({ id, line });
  for (const [, t] of s.matchAll(/(?:^|\s)#([\w-]+)/g)) node.tags.push(t);
  for (const [, w] of s.matchAll(/(?:^|\s)@([\w-]+)/g)) node.who.push(w);
}

function scanLoose(doc, s, line) {
  for (const [, id] of s.matchAll(/\[\[([\w-]+)\]\]/g)) doc.loose.push({ id, line });
}

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

function closest(word, candidates, max) {
  let best = null, bestD = max + 1;
  for (const c of candidates) {
    const dist = c.startsWith(word) || word.startsWith(c) ? 1 : lev(word, c);
    if (dist < bestD && c !== word) { best = c; bestD = dist; }
  }
  return bestD <= max ? best : null;
}

const hint = (w, cands) => {
  const c = closest(w, cands, 2);
  return c ? `; did you mean "${c}"?` : "";
};

// SCCs (Tarjan), then Kahn over the condensation, ties broken by document order.
function teachOrder(rules, edges) {
  const pos = new Map(rules.map((r, i) => [r.id, i]));
  let idx = 0;
  const index = new Map(), low = new Map(), on = new Set(), stack = [], comps = [];
  const visit = (v) => {
    index.set(v, idx); low.set(v, idx); idx++;
    stack.push(v); on.add(v);
    for (const w of edges.get(v)) {
      if (!index.has(w)) { visit(w); low.set(v, Math.min(low.get(v), low.get(w))); }
      else if (on.has(w)) low.set(v, Math.min(low.get(v), index.get(w)));
    }
    if (low.get(v) === index.get(v)) {
      const c = [];
      let w;
      do { w = stack.pop(); on.delete(w); c.push(w); } while (w !== v);
      comps.push(c.sort((a, b) => pos.get(a) - pos.get(b)));
    }
  };
  for (const r of rules) if (!index.has(r.id)) visit(r.id);

  const compOf = new Map();
  comps.forEach((c, i) => c.forEach((id) => compOf.set(id, i)));
  const indeg = comps.map(() => 0), out = comps.map(() => new Set());
  for (const [v, ws] of edges)
    for (const w of ws) {
      const a = compOf.get(w), b = compOf.get(v); // w must be taught before v
      if (a !== b && !out[a].has(b)) { out[a].add(b); indeg[b]++; }
    }
  const ready = comps.map((_, i) => i).filter((i) => !indeg[i]);
  const order = [];
  while (ready.length) {
    ready.sort((a, b) => pos.get(comps[a][0]) - pos.get(comps[b][0]));
    const c = ready.shift();
    order.push(c);
    for (const b of out[c]) if (!--indeg[b]) ready.push(b);
  }
  return order.map((c) => ({ ids: comps[c], cycle: comps[c].length > 1 || edges.get(comps[c][0]).includes(comps[c][0]) }));
}

// Consecutive arrow lines form one sketch.
export function sketches(doc) {
  const out = [];
  for (const a of doc.arrows) {
    const last = out[out.length - 1];
    if (last && last.end === a.line - 1) { last.arrows.push(a); last.end = a.line; }
    else out.push({ arrows: [a], end: a.line, indent: a.indent });
  }
  return out;
}

export function sketchMermaid(sketch, doc) {
  const known = new Set(doc.nodes.map((n) => n.id));
  const ids = new Map();
  const ref = (label) => {
    if (!ids.has(label)) ids.set(label, `s${ids.size}`);
    const id = ids.get(label);
    return known.has(label) ? `${id}["${label}"]:::node` : `${id}["${label.replace(/"/g, "'")}"]`;
  };
  const lines = ["flowchart LR"];
  for (const a of sketch.arrows) lines.push("  " + a.chain.map(ref).join(" --> "));
  lines.push("  classDef node fill:#e8eef8,stroke:#4a6a9a");
  return lines.join("\n");
}

export function analyze(full) {
  const live = (x) => !full.parked.has(x.line);
  const doc = {
    ...full,
    nodes: full.nodes.filter((n) => !n.attic),
    questions: full.questions.filter(live),
    loose: full.loose.filter(live),
    lints: full.lints.filter(live),
  };
  const attic = full.nodes.filter((n) => n.attic);
  const byId = new Map();
  const warnings = [...doc.lints];
  for (const n of doc.nodes) {
    if (byId.has(n.id) && !n.anon) warnings.push({ line: n.line, msg: `duplicate id "${n.id}" (first at line ${byId.get(n.id).line})` });
    else byId.set(n.id, n);
  }
  const ids = doc.nodes.filter((n) => !n.anon).map((n) => n.id);
  const label = (id) => byId.get(id)?.label ?? id;
  const rules = doc.nodes.filter((n) => n.kind === "rule" && byId.get(n.id) === n);
  const effects = doc.nodes.filter((n) => n.kind === "effect" && byId.get(n.id) === n);
  // an effect is a hypothesis until tagged #seen or referenced from a log: line
  const logged = new Set(doc.logs.filter(live).flatMap((l) => l.refs));
  for (const e of effects) e.seen = e.tags.includes("seen") || logged.has(e.id);
  const goals = doc.nodes.filter((n) => n.kind === "goal" && byId.get(n.id) === n);
  const goalIds = goals.map((g) => g.id);
  const stubs = doc.nodes.filter((n) => n.kind === "stub");
  const tables = new Set(doc.nodes.filter((n) => n.kind === "table").map((n) => n.id));

  const missing = [];
  for (const r of [...doc.nodes.flatMap((n) => n.refs.map((x) => ({ ...x, from: n.id }))), ...doc.loose])
    if (!byId.has(r.id)) missing.push(r);
  const parkedIds = new Set(attic.map((n) => n.id));
  for (const r of missing)
    warnings.push({ line: r.line, msg: parkedIds.has(r.id) ? `[[${r.id}]] is in the attic` : `unknown [[${r.id}]]${hint(r.id, ids)}` });
  for (const n of doc.nodes)
    for (const g of n.goalRefs)
      if (byId.get(g.id)?.kind !== "goal") {
        missing.push(g);
        warnings.push({ line: g.line, msg: `${g.kind} "${g.id}" isn't a goal${hint(g.id, goalIds)}` });
      }

  const edges = new Map(rules.map((r) => [r.id, r.needs.filter((d) => byId.get(d)?.kind === "rule")]));
  const teach = teachOrder(rules, edges);
  const cycles = teach.filter((t) => t.cycle).map((t) => t.ids);
  for (const c of cycles) warnings.push({ line: byId.get(c[0]).line, msg: `cycle: ${c.map(label).join(" ↔ ")} can only be taught together` });

  // A rule traces to a goal if it serves one, or something that does needs it,
  // contains it, or shares a sequence with it.
  const traced = new Set([...rules, ...effects].filter((r) => r.serves.length).map((r) => r.id));
  for (let grew = true; grew; ) {
    grew = false;
    for (const r of rules) {
      if (traced.has(r.id)) continue;
      if ([...rules, ...effects].some((q) => traced.has(q.id) && (q.needs.includes(r.id) || q.id === r.parent || (r.seq && q.seq === r.seq)))) {
        traced.add(r.id);
        grew = true;
      }
    }
  }
  const goalless = rules.filter((r) => !traced.has(r.id));
  for (const r of goalless) warnings.push({ line: r.line, msg: `rule "${r.label}" doesn't trace to a goal: no serves:, and nothing that has one needs, contains, or sequences it` });
  const slotless = stubs.filter((s) => !s.fields.slot);
  for (const s of slotless) warnings.push({ line: s.line, msg: `stub "${s.label}" has no slot: to improvise from` });
  const slotRefs = stubs.flatMap((s) =>
    s.fields.slot ? [...s.fields.slot.text.matchAll(/\{([\w-]+)\}/g)].map(([, t]) => ({ stub: s.id, table: t, line: s.fields.slot.line })) : [],
  );
  const badSlots = slotRefs.filter((r) => !tables.has(r.table));
  for (const r of badSlots) warnings.push({ line: r.line, msg: `no table "${r.table}"${hint(r.table, [...tables])}` });

  for (const e of effects) {
    if (!e.needs.length) warnings.push({ line: e.line, msg: `effect "${e.label}" has no needs: (which rules produce it?)` });
    if (!e.serves.length && !e.hurts.length) warnings.push({ line: e.line, msg: `effect "${e.label}" doesn't serve or hurt a goal` });
  }
  const served = new Set([...rules, ...effects].flatMap((n) => n.serves));
  // #void: a goal the rules circle but deliberately don't serve (Baker's fruitful void)
  const unserved = goals.filter((g) => !served.has(g.id) && !g.tags.includes("void"));
  for (const g of unserved) warnings.push({ line: g.line, msg: `goal "${g.label}" has nothing serving it` });

  const authority = new Map();
  for (const r of rules) for (const w of r.who.length ? r.who : [""]) authority.set(w, [...(authority.get(w) || []), r]);

  const tension = [...rules, ...effects].filter((r) => r.serves.length && r.hurts.length).map((r) => ({ rule: r.label, serves: r.serves, hurts: r.hurts }));

  const checks = [
    { label: "has a pitch", ok: !!doc.pitch },
    { label: "has goals", ok: goals.length > 0 },
    { label: "has rules", ok: rules.length > 0 },
    { label: "references resolve", ok: !missing.length },
    { label: "no rule cycles", ok: !cycles.length },
    { label: "every rule traces to a goal", ok: !goalless.length },
    { label: "every goal is served", ok: !unserved.length },
    { label: "effects are grounded", ok: effects.every((e) => e.needs.length && (e.serves.length || e.hurts.length)) },
    { label: "stubs have slots", ok: !slotless.length && !badSlots.length },
    { label: "no open questions", ok: !doc.questions.length },
  ];

  warnings.sort((a, b) => a.line - b.line);
  const next =
    (!doc.pitch && { line: 1, text: "Write a one-line pitch as a > quote under the title." }) ||
    (!goals.length && { line: 1, text: "Add a goal: what should this feel like at the table? (- goal id: text)" }) ||
    (!rules.length && { line: 1, text: "Add a rule: what does a player do on their turn? (- rule id: text)" }) ||
    (doc.questions[0] && { line: doc.questions[0].line, text: `? ${doc.questions[0].text}` }) ||
    (warnings[0] && { line: warnings[0].line, text: warnings[0].msg }) ||
    { line: null, text: "Ready. Try a paper playthrough." };

  return { authority, goals, rules, effects, teach, cycles, tension, missing, checks, warnings, next, attic, questions: doc.questions };
}

const mid = (id) => "n_" + id.replace(/\W/g, "_");

// scope: substring of a heading; includes nodes under it plus their direct neighbors.
export function mermaid(full, scope = "") {
  const doc = { ...full, nodes: full.nodes.filter((n) => !n.attic) };
  const s = scope.trim().toLowerCase();
  const inScope = (n) => !s || n.group.some((g) => g.toLowerCase().includes(s));
  const core = new Set(doc.nodes.filter(inScope).map((n) => n.id));
  const shown = new Set(core);
  const edges = [];
  for (const n of doc.nodes) {
    const add = (from, to, kind) => {
      if (!core.has(from) && !core.has(to)) return;
      if (!doc.nodes.some((x) => x.id === from) || !doc.nodes.some((x) => x.id === to)) return;
      shown.add(from); shown.add(to);
      edges.push(kind === "needs" ? `  ${mid(from)} --> ${mid(to)}`
        : kind === "then" ? `  ${mid(from)} ==> ${mid(to)}`
        : kind === "serves" ? `  ${mid(from)} -. serves .-> ${mid(to)}`
        : `  ${mid(from)} -. hurts .-x ${mid(to)}`);
    };
    for (const d of n.needs) add(d, n.id, "needs");
    if (n.next) add(n.id, n.next, "then");
    for (const g of n.serves) add(n.id, g, "serves");
    for (const g of n.hurts) add(n.id, g, "hurts");
  }

  const lines = ["flowchart BT"];
  const shape = { goal: ["([", "])"], rule: ["[", "]"], effect: ["{{", "}}"], stub: ["[/", "/]"], table: ["[(", ")]"] };
  const nodeLine = (n, pad) => `${pad}${mid(n.id)}${shape[n.kind][0]}"${(n.label + (n.who.length && !n.anon ? " @" + n.who.join(" @") : "")).replace(/"/g, "'")}"${shape[n.kind][1]}:::${core.has(n.id) ? n.kind : "ext"}`;
  // nest by heading path, below the title level
  const tree = { kids: new Map(), nodes: [] };
  for (const n of doc.nodes.filter((n) => shown.has(n.id))) {
    let t = tree;
    for (const g of n.group.slice(1)) {
      if (!t.kids.has(g)) t.kids.set(g, { kids: new Map(), nodes: [] });
      t = t.kids.get(g);
    }
    t.nodes.push(n);
  }
  let gi = 0;
  const emit = (t, pad) => {
    for (const n of t.nodes) lines.push(nodeLine(n, pad));
    for (const [label, k] of t.kids) {
      lines.push(`${pad}subgraph g${gi++}["${label.replace(/"/g, "'")}"]`);
      emit(k, pad + "  ");
      lines.push(`${pad}end`);
    }
  };
  emit(tree, "  ");
  lines.push(...new Set(edges));
  lines.push("  classDef goal fill:#e8f0e0,stroke:#5a7a3a");
  lines.push("  classDef rule fill:#fff,stroke:#555");
  lines.push("  classDef effect fill:#f3e8f6,stroke:#7a4a8a");
  lines.push("  classDef stub fill:#f4ecd8,stroke:#9a7a3a");
  lines.push("  classDef table fill:#eee,stroke:#888");
  lines.push("  classDef ext fill:#fff,stroke:#bbb,color:#999,stroke-dasharray:3 3");
  return lines.join("\n");
}
