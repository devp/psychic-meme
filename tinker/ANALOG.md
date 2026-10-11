# tinker, analog

Most of tinker's benefit with no screen: **one node per index card, one notebook for the log, short rituals in place of the build.** A whiteboard is optional, for graphs.

The idea that carries over: tinker's checks are all sorting and tracing, and you can do those with your hands. Laying out the teaching order *is* the topological sort, and a cycle is the set of cards you can't place.

## Kit

- 3×5 index cards in 4 colors, or white cards with a colored corner dot:
  - green: goal
  - white: rule
  - purple: effect
  - yellow: stub/table
- Small sticky notes for questions.
- A few binder clips (cycles, sequences) and a rubber band (end of session).
- One notebook. Grid or dot paper; bullet-journal style.
- A card box with tabbed dividers: one tab per group or act, plus **ATTIC** at the back.
- Optional: a whiteboard with magnets, d6/d20 for tables, a phone camera.

## Card anatomy

```
┌──────────────────────────────────────┐
│ R  delve                    @player  │  kind letter · id · role
│ enter the next room                  │
│  · flip a room, resolve it           │  steps
│  · gain 1 fatigue                    │
│                                      │
│ needs: room, fatigue                 │  bottom band: the analysis fields
│ + choice  + dread        − fast      │
└──────────────────────────────────────┘
   [? does a cleared room stay cleared]   ← sticky note, stuck on
```

- **Kind letter** top left: `G` `R` `E` `S` `T`. Leave the id off for an unnamed rule; then the text is its name.
- **`@role`** top right: who decides.
- **Bottom band** is reserved for `needs:`, `+goal`, `−goal`. Keeping it in one place is what makes the rituals quick to scan.
- **Goal cards** carry their rank in a circle, top right (①②③). Re-ranking means renumbering, never recopying.
- **`#void` goal:** draw a hollow circle ○ in place of the rank.
- **Effect cards** have a box: ☐ while it's a hypothesis, ☑ once you've seen it at the table.
- **Stub cards** carry the slot template (`{creature} that {verb}s when bloodied`). **Table cards** are numbered lists you can roll on.
- **Sequences:** the parent rule card goes in front, and its numbered child cards are clipped behind it in order (`turn.1`, `turn.2`).
- **Questions** go on stickies, never on the card itself. Peeling a sticky off is how you close a question, and it should feel good.

## Notebook: bullet-journal signifiers

Use the notebook only for things that happen over time: sessions, play, insights. The design itself lives on the cards. (Rapid logging and migration come from Ryder Carroll's Bullet Journal.)

| Mark | Meaning |
|---|---|
| `?` | open question (also written on a sticky) |
| `!` | insight |
| `~` | hunch: a possible effect, not yet on a card |
| `★` | seen at the table, which confirms an effect |
| `→` | moved onto a card (the line is done) |
| `×` | dropped |
| `@` | role |

Pages:
- **Index**
- **Goals**: re-copied whenever you re-rank them; the old page stays as history
- **Session log**: dated, rapid-logged
- **Readiness**: the checklist below, with a score column per session

## Rituals (in place of the build)

Each fits in a 20-minute burst. Pick one per sitting; you don't need all of them.

### Open (1 min)
Take the rubber band off. The top sticky is **next**. Read the goal cards in rank order.

### Teach-sort (5 min): teaching order and cycles
1. Shuffle the rule cards out face up.
2. Repeat: put down any card whose `needs:` are all already in the row, preferring the one that comes earliest in play.
3. If no card can be placed, the leftover cards that need each other form a **cycle**. Clip them together and put them in the row as one unit. Write `cycle: a ↔ b` in the log.
4. The row is your run sheet. Photograph it.

### Goal trace (5 min): what each rule is for
1. Put the goal cards across the top, in rank order.
2. Under each goal, stack the rule and effect cards marked `+` for it.
3. Pull in any card that a stacked card `needs`, any card clipped behind a stacked card (sequences), and any card nested under one.
4. Whatever is left on the table **doesn't trace to a goal**. Give it a goal, connect it to something that has one, or move it to the attic.
5. A goal with an empty column **has nothing serving it**, unless it's ○ void.

### Tension (3 min)
While the cards are still laid out for the goal trace: any card with both `+` and `−` goes **sideways**, spanning the two columns. Those sideways cards are your design tensions. Log each one, and say which goal wins (rank decides by default).

### Readiness (2 min)
Tick each box and write the score in the log:

- ☐ pitch written (one line, on the box lid)
- ☐ has goals
- ☐ has rules
- ☐ every name in a `needs:` exists as a card
- ☐ no clipped cycles
- ☐ every rule traces to a goal
- ☐ every goal is served (or void)
- ☐ every effect has `needs:` and a `+` or `−`
- ☐ every stub has a slot, and its tables exist
- ☐ no stickies left on active cards

### Paper playthrough (10–20 min)
1. Deal the teach-sort row.
2. Walk one turn or scene in play order, reading each card aloud: "what happens here?"
3. For a stub, roll on its tables and improvise.
4. Anything unclear becomes a new sticky on that card.
5. Anything improvised and worth keeping gets logged `!` and then moved `→` onto a card.
6. An effect you watch happen gets ☑ on its card and a `★` in the log.

### Close (1 min)
Write the **next** question on a sticky and put it on top of the stack. Rubber band. Write one log line saying where you stopped. Because of this, coming back after weeks takes 30 seconds.

## Attic

The **ATTIC** divider at the back of the box. Cards behind it are never sorted, traced, or scored. If an active card `needs` an attic card, the sort will tell you: the needed card isn't in the row. Then either bring it forward or cut the dependency.

## Migration (monthly, or whenever the box feels muddy)

The Bullet Journal move: **re-copy every active card by hand.** Anything that isn't worth re-copying goes to the attic. Rewriting is where cards get merged, renamed, and sharpened, and it's the analog version of the lint pass.

## Whiteboard (optional): graphs

- Magnet or tape the cards up, and draw the edges:
  - solid → for `needs`
  - dashed → for `+`/`−` to goals
  - thick ⇒ for sequences
- Draw a box around each group or act.
- Your own `a --> b` sketches can go right next to the cards; on a whiteboard the two kinds sit together naturally.
- **Photograph before erasing.** The photo is the "build output".

## What you lose (the other 20%)

- Re-checking on every change: the rituals are periodic, while the build runs on every save.
- "Did you mean": typos in `needs:` only turn up during the teach-sort.
- Graph layout, scoped graphs, and search.
- A shareable artifact. The photos stand in for it.

## Going back to digital

A card is one list item, so transcription is mechanical:

```markdown
- rule delve @player: enter the next room
  - flip a room, resolve it
  - gain 1 fatigue
  - needs: room, fatigue
  - serves: choice dread  hurts: fast
  - ? does a cleared room stay cleared
```

Dividers become headings. Clipped sequences become numbered lists. The attic becomes `## Attic`.
