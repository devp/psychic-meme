# tinker

Game design as a Markdown outline. On each save you get feedback: what's next, readiness, teaching order, tensions between goals, and graphs.

## Getting started

1. Add the nvim plugin (lazy.nvim), e.g. in `~/.config/nvim/lua/plugins/tinker.lua`:
   ```lua
   return { dir = "~/code/misc/psychic-meme/tinker/nvim" }
   ```
2. `just new ~/games/heist` creates `~/games/heist.tinker.md` from the template.
3. Open it in nvim. Findings show up as diagnostics on open and on each save, and the echo line shows `ready n/m · next: …`.
4. `:TinkerOpen` opens the built `heist.html`. It refreshes itself while you edit.

Starting from a blank file works too; "next" tells you what to add first.

No nvim: `just watch heist.tinker.md`.

## Format

Headings are groups (acts, scenes, subsystems), at any depth. Nodes are list items that start with a kind:

```markdown
# Delve
> one-line pitch

## Goals
- goal fast: a turn takes under 30 seconds     ← list order = rank

## Core loop
- rule delve: enter the next room
  - needs: room, fatigue        ← also inferred from [[room]] anywhere in the rule
  - serves: choice  hurts: fast
  - flip a [[room]], gain 1 [[fatigue]] #core
  - ? does a cleared room stay cleared
  - rule collapse: nested rules are fine

- stub monster: 3HP, hits for 1
  - slot: {creature} that {verb}s when bloodied
- table creature: rat-king | glass hound | debt collector
- log: what got improvised in play

escalating risk --> endgame     ← your own graph; consecutive arrow lines draw as one

```tinker graph Core loop
```                             ← derived graph for a heading (or the whole doc)
```

| Syntax | Meaning |
|---|---|
| `goal` `rule` `effect` `stub` `table` | node kinds: `- kind id: text`, or `- kind: text` with no id (it can't be referenced) |
| `needs:` `serves:` `hurts:` `slot:` | fields, as child items |
| `[[id]]` | reference; inside a node it counts as `needs` |
| `1.` `2.` `3.` rules | a sequence, in document order; drawn as `==>`, and justified by their parent |
| goal check | a rule passes if it serves a goal, or if something that does needs it, contains it, or is in its sequence |
| `effect` | a dynamic (MDA's middle layer): `needs:` the rules that produce it, `serves:`/`hurts:` goals. It's a hypothesis until tagged `#seen` or referenced from a `log:` |
| goal served | every goal needs some rule or effect serving it |
| `#tag` | free tag (per-game vocabulary) |
| `? text` | open question; the first one is "next" |
| `## Attic` or `#attic` | parked: stays in the file, ignored by analysis, folded in the HTML. A core rule that needs it gets a warning |
| `a --> b --> c` | your own sketch, drawn inline |

## Files

- `outline.js`: parser and analysis (plain ESM, no deps)
- `build.js`: `.tinker.md` → `.html`, plus `file:line:sev: msg` lines on stdout
- `nvim/plugin/tinker.lua`: highlights (matchadd, layered over treesitter) and build-on-save diagnostics
- `examples/delve.tinker.md`: a toy game with deliberate problems
