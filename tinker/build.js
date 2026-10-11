#!/usr/bin/env node
// Usage: node build.js game.tinker.md [--live]   → writes game.html beside it.
// stdout: "file:line:warn|info: msg" per finding (quickfix / nvim diagnostics).
// stderr: one summary line. --live adds a 2s meta refresh to the page.
import { readFileSync, writeFileSync } from "node:fs";
import { parse, analyze, mermaid, sketches, sketchMermaid, KINDS, KEYS, ATTIC_HEAD } from "./outline.js";

const args = process.argv.slice(2);
const live = args.includes("--live");
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("usage: node build.js <game.tinker.md> [--live]");
  process.exit(2);
}

const src = readFileSync(file, "utf8");
const doc = parse(src);
const a = analyze(doc);
const out = file.replace(/(\.tinker)?\.md$/, "") + ".html";
writeFileSync(out, render(doc, a));

for (const w of a.warnings) console.log(`${file}:${w.line}:warn: ${w.msg}`);
for (const q of a.questions) console.log(`${file}:${q.line}:info: ? ${q.text}`);
const passed = a.checks.filter((c) => c.ok).length;
console.error(`tinker: ready ${passed}/${a.checks.length} · next: ${a.next.text}`);

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

function inline(s) {
  return esc(s)
    .replace(/\[\[([\w-]+)\]\]/g, '<a href="#$1">$1</a>')
    .replace(/(^|\s)#([\w-]+)/g, '$1<span class="tag">#$2</span>');
}

// Markdown source for the document view: decorate nodes/fields/refs, expand graph fences.
function decorate(src, doc) {
  const known = new Set(doc.nodes.map((n) => n.id));
  const lines = src.split("\n");
  const graphFences = new Map(doc.fences.filter((f) => /^tinker\s+graph\b/.test(f.info)).map((f) => [f.line, f]));
  const otherFence = new Set(doc.fences.filter((f) => !graphFences.has(f.line)).flatMap((f) => range(f.line, f.end ?? lines.length)));
  const after = new Map(sketches(doc).map((s) => [s.end, s]));
  const kindRe = new RegExp(`^(\\s*(?:[-*+]|\\d+[.)])\\s+)(${KINDS.join("|")})\\s+([\\w-]+)(?=(?:\\s+#[\\w-]+)*\\s*(?::|$))`);
  const anonRe = new RegExp(`^(\\s*(?:[-*+]|\\d+[.)])\\s+)(${KINDS.join("|")}):`);
  const keyRe = new RegExp(`^(\\s*(?:[-*+]|\\d+[.)])\\s+)(${[...KEYS, "log"].join("|")}):`);
  const res = [];
  let atticLevel = 0; // open <details> for an attic heading
  for (let i = 0; i < lines.length; i++) {
    const at = i + 1;
    const h = otherFence.has(at) ? null : lines[i].match(/^(#{1,6})\s+(.*?)\s*$/);
    if (h && atticLevel && h[1].length <= atticLevel) { res.push("", "</details>", ""); atticLevel = 0; }
    if (h && !atticLevel && ATTIC_HEAD.test(h[2])) {
      atticLevel = h[1].length;
      res.push(`<details class="attic"><summary>${esc(h[2])} (parked)</summary>`, "");
      continue;
    }
    const f = graphFences.get(at);
    if (f) {
      const scope = f.info.replace(/^tinker\s+graph\s*/, "");
      res.push("```mermaid", mermaid(doc, scope), "```");
      i = (f.end ?? lines.length) - 1;
      continue;
    }
    if (otherFence.has(at)) { res.push(lines[i]); continue; }
    res.push(lines[i]
      .replace(kindRe, '$1<span class="kind k-$2" id="$3">$2 $3</span>')
      .replace(anonRe, '$1<span class="kind k-$2">$2</span>:')
      .replace(keyRe, '$1<span class="field">$2:</span>')
      .replace(/^(\s*(?:[-*+]|\d+[.)])\s+)\?\s(.*)$/, '$1<span class="q">? $2</span>')
      .replace(/\[\[([\w-]+)\]\]/g, (_, id) => (known.has(id) ? `[${id}](#${id})` : `<span class="bad">${id}</span>`))
      .replace(/(^|\s)#([\w-]+)/g, '$1<span class="tag">#$2</span>'));
    const sk = after.get(at);
    if (sk) {
      const pad = " ".repeat(sk.indent);
      res.push("", ...["```mermaid", ...sketchMermaid(sk, doc).split("\n"), "```"].map((l) => pad + l), "");
    }
  }
  if (atticLevel) res.push("", "</details>");
  return res.join("\n");
}

function range(a, b) {
  return Array.from({ length: b - a + 1 }, (_, k) => a + k);
}

function render(doc, a) {
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  const passed = a.checks.filter((c) => c.ok).length;
  const qsFor = (id) => doc.questions.filter((q) => q.node === id);

  const steps = (list) => {
    // steps carry depth relative to their node; rebuild nesting
    let html = "", d = -1;
    for (const s of list) {
      while (d < s.depth) { html += "<ul>"; d++; }
      while (d > s.depth) { html += "</ul>"; d--; }
      html += `<li>${inline(s.text)}</li>`;
    }
    while (d-- >= 0) html += "</ul>";
    return html;
  };

  const ruleBlock = (id) => {
    const r = byId.get(id);
    const meta = [
      r.group.length > 1 && `<span class="grp">${esc(r.group.slice(1).join(" › "))}</span>`,
      r.needs.length && `needs ${r.needs.map((d) => `<a href="#${d}">${d}</a>`).join(", ")}`,
      r.next && `then ${esc(byId.get(r.next).label)}`,
      r.serves.length && `<span class="plus">+${r.serves.join(" +")}</span>`,
      r.hurts.length && `<span class="minus">−${r.hurts.join(" −")}</span>`,
    ].filter(Boolean).join(" · ");
    const head = r.anon ? `<b>${inline(r.text) || r.label}</b>` : `<b>${id}</b>${r.text ? ` — ${inline(r.text)}` : ""}`;
    return `<li>${head}
      ${meta ? `<div class="meta">${meta}</div>` : ""}
      ${steps(r.steps)}
      ${qsFor(id).map((q) => `<div class="q">? ${inline(q.text)}</div>`).join("")}</li>`;
  };

  const teach = a.teach
    .map((t) => (t.cycle
      ? `<li class="cycle"><div class="warn">cycle: teach together (${t.ids.map((i) => byId.get(i).label).join(" ↔ ")})</div><ol>${t.ids.map(ruleBlock).join("")}</ol></li>`
      : ruleBlock(t.ids[0])))
    .join("");

  const grid = a.goals.length && (a.rules.length || a.effects.length) ? `
    <div class="scroll"><table class="grid"><tr><th></th>${a.goals.map((g, i) => `<th title="${esc(g.text)}">${i + 1}. ${esc(g.label)}</th>`).join("")}</tr>
    ${[...a.effects, ...a.rules].map((r) => `<tr><th>${r.kind === "effect" ? "<i>" + esc(r.label) + "</i>" : esc(r.label)}</th>${a.goals.map((g) =>
      `<td>${r.serves.includes(g.id) ? '<span class="plus">+</span>' : ""}${r.hurts.includes(g.id) ? '<span class="minus">−</span>' : ""}</td>`).join("")}</tr>`).join("")}
    </table></div>` : "";

  const docJson = JSON.stringify(decorate(src, doc)).replace(/</g, "\\u003c");

  return `<!doctype html><meta charset="utf-8">${live ? '<meta http-equiv="refresh" content="2">' : ""}
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(doc.title || file)}</title>
<style>
  body{font:15px/1.45 system-ui,sans-serif;margin:0;color:#222;background:#fdfcf8}
  .wrap{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:2rem;padding:1rem 1.2rem;max-width:90rem;margin:0 auto}
  @media (max-width:900px){.wrap{grid-template-columns:1fr}}
  h1{font-size:1.3rem;margin:.2rem 0} h2.sec{font-size:.85rem;margin:1.4rem 0 .4rem;text-transform:uppercase;letter-spacing:.06em;color:#777}
  .next{background:#fff6d6;border:1px solid #e0c870;padding:.6rem .8rem;border-radius:6px}
  .meta,.grp{color:#777;font-size:.88em} .q{color:#a05a00} .warn{color:#b03030}
  .plus{color:#2a7a2a} .minus{color:#b03030} .tag{color:#5a5aa0;font-size:.9em} .bad{color:#b03030;text-decoration:wavy underline}
  .kind{font-weight:600} .k-rule{color:#2a4a8a} .k-goal{color:#3a6a2a} .k-stub,.k-table{color:#8a6a2a} .k-effect{color:#7a4a8a} .field{color:#777}
  .cycle{border-left:3px solid #b03030;padding-left:.6rem;list-style:none}
  .checks{padding:0} .checks li{list-style:none} .scroll{overflow-x:auto}
  .grid{border-collapse:collapse} .grid td,.grid th{border:1px solid #ddd;padding:.2rem .5rem;text-align:center} .grid th:first-child{text-align:left}
  #doc pre:not(.mermaid){background:#f3f1ea;padding:.5rem;overflow-x:auto} .mermaid{background:none;overflow-x:auto}
  .attic{opacity:.7;border-left:3px solid #ccc;padding-left:.6rem} .attic summary{cursor:pointer;color:#777}
  a{color:inherit}
</style>
<div class="wrap">
<section>
  <h1>${esc(doc.title || file)}</h1>
  ${doc.pitch ? `<div class="meta">${inline(doc.pitch)}</div>` : ""}
  <p class="next"><b>Next${a.next.line ? ` (line ${a.next.line})` : ""}:</b> ${inline(a.next.text)} · ready <b>${passed}/${a.checks.length}</b></p>
  <ul class="checks">${a.checks.map((c) => `<li>${c.ok ? "✓" : "✗"} ${c.label}</li>`).join("")}</ul>
  ${a.warnings.length ? `<h2 class="sec">Warnings</h2><ul>${a.warnings.map((w) => `<li class="warn">L${w.line}: ${esc(w.msg)}</li>`).join("")}</ul>` : ""}
  ${a.questions.length ? `<h2 class="sec">Open questions</h2><ul>${a.questions.map((q) => `<li class="q">L${q.line}${q.node ? ` (${q.node})` : ""}: ${inline(q.text)}</li>`).join("")}</ul>` : ""}
  ${a.effects.length ? `<h2 class="sec">Effects</h2><ul>${a.effects.map((e) => `<li><b>${esc(e.label)}</b>${e.anon ? "" : ` — ${inline(e.text)}`}
    <span class="meta">${e.seen ? "seen" : "hypothesis"}</span>
    <div class="meta">${[
      e.needs.length && `from ${e.needs.map((d) => `<a href="#${d}">${d}</a>`).join(", ")}`,
      e.serves.length && `<span class="plus">+${e.serves.join(" +")}</span>`,
      e.hurts.length && `<span class="minus">−${e.hurts.join(" −")}</span>`,
    ].filter(Boolean).join(" · ")}</div></li>`).join("")}</ul>` : ""}
  <h2 class="sec">Goals, ranked</h2>
  <ol>${a.goals.map((g) => `<li><b>${esc(g.label)}</b>${g.anon ? "" : `: ${inline(g.text)}`}</li>`).join("")}</ol>
  ${a.tension.length ? `<div class="warn">tensions: ${a.tension.map((t) => `${t.rule} (+${t.serves.join(",")} −${t.hurts.join(",")})`).join("; ")}</div>` : ""}
  ${grid}
  ${a.attic.length ? `<h2 class="sec">Attic</h2><p class="meta">${a.attic.map((n) => `${n.kind} ${esc(n.label)}`).join(" · ")}</p>` : ""}
  <h2 class="sec">Run sheet (teach order)</h2>
  <ol>${teach}</ol>
  ${doc.logs.length ? `<h2 class="sec">Play log</h2><ul>${doc.logs.map((l) => `<li>${inline(l.text)}</li>`).join("")}</ul>` : ""}
  ${doc.fences.some((f) => /^tinker\s+graph\s*$/.test(f.info)) ? "" : `<h2 class="sec">Graph</h2>
  <pre class="mermaid">${esc(mermaid(doc))}</pre>`}
</section>
<section id="doc"></section>
</div>
<script src="https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js"></script>
<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs";
  const el = document.getElementById("doc");
  el.innerHTML = marked.parse(${docJson});
  for (const c of el.querySelectorAll("code.language-mermaid")) {
    const pre = document.createElement("pre");
    pre.className = "mermaid";
    pre.textContent = c.textContent;
    c.parentElement.replaceWith(pre);
  }
  mermaid.initialize({ startOnLoad: true, theme: "neutral" });
  await mermaid.run();
</script>
`;
}
