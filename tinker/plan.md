# tinker: game-design outline tool

A plain-text outline per game. A build step derives the rule graph, teaching order, tensions, and readiness. Deterministic; no LLM.

## Why
- Designs die from: competing goals, rules that can't be explained in order, the content wall (writing everything before playing), and lost momentum after effort.
- Few playtests this era, so the tool has to supply the "it works" signal.
- Short bursts, many projects, ideas captured on mobile, so resuming has to be instant.

## Decisions
- Substrate: indented outline. Formality ladder per line: prose → tags (folksonomy) → leaf s-exprs (later; Fennel/Lil).
- Editor: neovim first. Build-on-save diagnostics plus matchadd highlights; the browser is only a viewer. The parser is plain ESM so a browser editor can reuse it later.
- One folder per game; tag vocabulary is per game.
- Fiction lives only in stubs and tables that hang off rules.
- Outputs: an outline you can run a game from, an outline that expands into prose, and a shareable view.

## Format (v0)
- Markdown, `*.tinker.md`; it reads fine in any Markdown viewer.
- Headings are groups, at any depth. Nodes are list items: `- rule id: text`. Nested nodes record a parent.
- Fields are child items: `needs:`, `serves:`, `hurts:`, `slot:`. `[[ref]]` inside a node counts as `needs`.
- `effect` is a dynamic (MDA): it `needs:` rules and serves/hurts goals, and it's a hypothesis until `#seen` or logged.
- `## Attic` / `#attic` parks material: it stays in the file and the analysis ignores it.
- `? q` is an open question. `log:` is an improvised result. `#tag` is a free tag.
- `a --> b` is a sketch written by hand, drawn inline; it doesn't feed the analysis.
- `` ```tinker graph [heading] `` is a derived graph, scoped to a heading.
- Full reference: README.md.

## Derived views
- Rule graph (Mermaid). Cycles are flagged.
- Teaching order: a topological sort; each cycle is taught as one unit and labeled.
- Tension map: goal × rule (+/−). A rule that serves one goal and hurts another is called out.
- Readiness n/m: refs resolve, no cycles, each rule serves a goal, stubs have slots, slot tables exist, no open `?`.
- Next: the first missing basic (pitch/goal/rule), else the first open question, else the first warning.
- Lint: near-miss kinds and keys, and unknown refs, with "did you mean".

## Next
- Paper playthrough: step through the teaching order and prompt "what happens?"; unresolved answers become `?` and improvised ones become `log`.
- Variants: fork files and diff their tension maps.
- Leaf expressions (level 3).
- Mobile capture (pizza-starter PWA).
