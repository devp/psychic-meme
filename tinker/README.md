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
- ! playtest with 3 before adding more         ← flag: an issue or your next task
- ?! grid: hex or square                       ← blocker; id optional

## Givens
- given no-dice: perfect information, no chance  ← unranked; refer back to these
  - resolves: grid

## Core loop
- rule delve: enter the next room
  - needs: room, fatigue        ← also inferred from [[room]] anywhere in the rule
  - serves: choice  hurts: fast no-dice
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
| `goal` `given` `rule` `effect` `stub` `table` | node kinds: `- kind id: text`, or `- kind: text` with no id (it can't be referenced) |
| `needs:` `serves:` `hurts:` `slot:` | fields, as child items |
| `[[id]]` | reference; inside a node it counts as `needs` |
| `1.` `2.` `3.` rules | a sequence, in document order; drawn as `==>`, and justified by their parent |
| goal check | a rule passes if it serves a goal, or if something that does needs it, contains it, or is in its sequence |
| `effect` | a dynamic (MDA's middle layer): `needs:` the rules that produce it, `serves:`/`hurts:` goals. It's a hypothesis until tagged `#seen` or referenced from a `log:` |
| goal served | every goal needs some rule or effect serving it |
| `given` | a commitment you hold yourself to: a decision, constraint, or antigoal. Unranked, and it needs nothing serving it. Goals say what the game reaches for; givens say what you've settled |
| `serves:`/`hurts:` a given | `serves:` draws a dotted "shaped by" line (it doesn't count as tracing to a goal). `hurts:` is a violation: a warning, not a tension. Phrase an antigoal so breaking it is what hurts it (`given no-sim`) |
| `resolves:` | on a given: the id of a `?!` it closes. The blocker stays in the file as history |
| `#tag` | free tag (per-game vocabulary) |
| `@role` | who decides (`@gm`, `@player`, `@dice`, `@left`…), on the node line or in steps. Nested rules inherit it. Shown as a "who decides" table |
| `#void` on a goal | deliberately unserved (Baker's fruitful void): no warning |
| `? text` | open question |
| `?! id: text` | blocking question: it stops forward progress until a given `resolves:` it. Id optional (needed to resolve it) |
| `! text` | flag: an issue or next task you've marked for yourself |
| next | first `!`, else first open `?!`, else a missing basic, else first `?`, else first warning |
| `## Attic` or `#attic` | parked: stays in the file, ignored by analysis, folded in the HTML. A core rule that needs it gets a warning |
| `a --> b --> c` | your own sketch, drawn inline |

## Files

- `outline.js`: parser and analysis (plain ESM, no deps)
- `build.js`: `.tinker.md` → `.html`, plus `file:line:sev: msg` lines on stdout
- `nvim/plugin/tinker.lua`: highlights (matchadd, layered over treesitter) and build-on-save diagnostics
- `examples/delve.tinker.md`: a toy game with deliberate problems
- `ANALOG.md`: the same method with index cards, a notebook, and a whiteboard

## Lineage

Practices and prior work this draws on, credited generously. "Direct" means an idea taken on purpose. "Aligned" means the tool ended up close to an existing practice, whether or not it was copied. "Not used (yet)" is a candidate for later.

### Direct

- **MDA** (Robin Hunicke, Marc LeBlanc, Robert Zubek, 2004): mechanics → dynamics → aesthetics. `rule` → `effect` → `goal` is that chain, with goals widened to cover constraints (like "fast") as well as feel.
- **Second-order design** (Katie Salen & Eric Zimmerman, *Rules of Play*, 2003): the designer shapes rules, and the experience emerges from play, out of the designer's direct reach. That's why the tool has a separate `effect` layer and keeps it a hypothesis. *Meaningful play* (choices whose outcomes are discernible, and integrated into the larger game) is a goal worth writing down.
- **Design pillars / experience goals** (common studio practice): a short, ranked list of what the game must deliver. Ranking is what settles a conflict between two goals.
- **The rulebook as a design test**: if you can't teach it in order, it has a structural problem. The teaching order and cycle detection put that on rails.
- **Learn-to-play vs. rules reference** (the split many modern board games use): the run sheet is the learn-to-play order, and the document itself is the reference.
- **Board-game teaching practice** (e.g. Rodney Smith's *Watch It Played*): goal first, then the turn, then the exceptions. That's goals ranked first and sequences taught in play order.
- **Improvised content tables**: the random tables of early D&D and the OSR, and solo-RPG oracles (Tana Pigeon's *Mythic GM Emulator*, Shawn Tomkin's *Ironsworn*). `stub` + `slot:` + `table` lets you improvise at the table instead of writing everything up front.
- **"Play to find out"** (*Apocalypse World*, D. Vincent Baker & Meguey Baker): don't prewrite what play can generate. That's why fiction only shows up where a procedure needs it.
- **The Lumpley Principle** (D. Vincent Baker): system is the means by which the group agrees on what happens in the fiction. It's why the tool treats "rules" broadly (procedures, sequences, prompts), and why fiction has to serve procedure.
- **Actual play** (the Forge's Actual Play forum): you judge a design by reports of what happened at the table. `log:` is a small AP report, and it's what turns an effect from hypothesis to `#seen`.
- **Tools for thought** (Andy Matuschak & Michael Nielsen, 2019): a medium that changes what you can think, not just a place to store notes.
- **Lenses** (Jesse Schell, *The Art of Game Design*): design progresses by asking pointed questions. `? question` lines, and "next", are lenses aimed at your own design.
- **Formal elements** (Tracy Fullerton, *Game Design Workshop*): objectives, procedures, rules, resources, conflict, outcome. These are close to goal / sequence / rule / stub.
- **Mermaid** and **Marp**: plain text that renders as diagrams and slides. This is the "markdown, plus a little" bet.

### Aligned

- **Procedural rhetoric** (Ian Bogost, *Persuasive Games*, 2007; *Unit Operations*): a system makes its argument through how it operates. A web of rule → effect → goal is a diagram of what the game argues, whatever the text says.
- **Ludic century / systems literacy** (Eric Zimmerman, *Manifesto for a Ludic Century*, 2013): designing a game as a way to understand, and critique, systems.
- **Critical play** (Mary Flanagan, *Critical Play*, 2009): games built to question the systems they model.
- **Ritual phrases as procedure** (PH Lee, *Polaris*): play advanced by fixed key phrases ("But only if…", "And furthermore…"), so conversation itself becomes the rule. That's the strongest case for rules being procedures over talk, not just over components.
- **PH Lee**'s *Bliss Stage* and *Polaris*: seats with defined roles and authority, and mechanics that carry theme. Effects that serve a goal *as argument*, not just as feel.
- **QFD "house of quality"** (Yoji Akao): a matrix relating requirements to design features, with +/− relationships and a roof that shows conflicts. The goal × rule tension grid is a small version of it.
- **Design structure matrix** (Donald Steward): dependency graphs, plus finding cycles that have to be resolved together. That's the `needs:` graph and its strongly connected components.
- **Skill atoms and loops** (Daniel Cook, *The Chemistry of Game Design*): a game as nested loops of action → feedback. Numbered sequences inside rules are loops written as outlines.
- **Game structures** (Justin Alexander, *The Alexandrian*): explicit procedures (hexcrawls, dungeon turns) as the backbone of play. Rules as procedures, sequences as structure.
- **Fruitful void** (D. Vincent Baker): the thing a game's rules circle but never address directly. `#void` on a goal marks it as deliberate, as opposed to a gap.
- **Clouds and boxes** (D. Vincent Baker, lumpley.com): fiction (clouds) and mechanics (boxes), joined by arrows. The `-->` sketches are the same move.
- **Bullet Journal** (Ryder Carroll): rapid logging, signifiers, and migration. ANALOG.md borrows all three.
- **Index-card design** (paper prototyping, card sorting, and the screenwriter's corkboard): one idea per card, meaning carried by where it sits.
- **Parking lot** (meeting and agile practice): a visible place for things that matter but aren't on the agenda yet. That's the attic.
- **Hypothesis-driven design / build-measure-learn** (Eric Ries): an effect is a claim, and a play log confirms it.
- **Outliners and linked notes** (Dave Winer's outliners, Workflowy, Logseq, Obsidian, Niklas Luhmann's Zettelkasten): nesting as structure, `[[links]]` and `#tags` as a loose folksonomy.
- **Literate programming** (Donald Knuth): one document that's both readable prose and machine-checked structure.
- **Ink** (inkle): narrative scripting that stays readable as text.

### Not used (yet)

- **GNS / the Big Model / Creative Agenda** (Ron Edwards and the Forge): Step On Up, Story Now, Right to Dream. A lens on what goals are *for*, and on incoherence when a design's ranked goals serve competing agendas.
- **Kickers, Bangs, Flags** (Ron Edwards, *Sorcerer*): situation as content. Kickers are written by players; bangs are dilemmas the GM throws. Candidates for stub types.
- **IIEE** (intent, initiation, execution, effect; Forge vocabulary): a checklist for resolution rules.
- **The Czege Principle** (Paul Czege): if one person authors both the adversity and its resolution, there's little to play for. A check, once rules say who decides.
- **Lumpley–Care Principle** (D. Vincent Baker, extended by Emily Care Boss): authority and credibility in play, meaning who gets to say what. `@role` is a first step; a Czege check would be next.
- **Emily Care Boss**'s Romance trilogy (*Breaking the Ice*, *Shooting the Moon*, *Under My Skin*): small, procedure-dense designs. Good test cases for the format.
- **Agenda, principles, moves** (*Apocalypse World*): the structure for a GM procedure. Goals are close to agenda; rules are close to moves; principles have no slot yet.
- **"Say yes or roll the dice"** (D. Vincent Baker, *Dogs in the Vineyard*): a meta-rule about when the system engages. An example of a rule *about* rules.
- **Ludii / ludemes** (Cameron Browne et al.): board games fully formalized. It sits at the far end of the formality ladder; leaf expressions would be a small step toward it.
- **Machinations** (Joris Dormans): resource-flow diagrams you can simulate. A likely model for a board-game-economy view.
- **Inform 7** (Graham Nelson): rules written in English that still execute. The other way to bridge prose and code.
- **Tree Notation / Scroll** (Breck Yunits): indentation as syntax. The same bet as the outline, without Markdown.
- **Patterns in Game Design** (Staffan Björk & Jussi Holopainen, 2005), after **A Pattern Language** (Christopher Alexander): a named catalog of recurring dynamics. Could seed a vocabulary of effects.
