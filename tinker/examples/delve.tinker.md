# Delve

> push-your-luck delve; every room costs you, the exit is always one more room away

## Goals

- goal fast: a turn takes under 30 seconds
- goal choice: every turn has a real tradeoff
- goal dread: the table should feel the walls closing in

escalating risk --> endgame
fatigue --> forced rest --> the deck advances --> escalating risk

## Effects

- effect pressure: the deck advancing makes every rest feel expensive
  - needs: rest, room
  - serves: dread  hurts: fast
- effect hoarding: players sit near 4 fatigue to squeeze one more room #hunch
  - needs: fatigue, delve
  - serves: choice

## Core loop

- rule turn: one player at a time
  - serves: fast
  1. rule: choose to [[delve]] or [[rest]]
  2. rule: pass the lantern left
- rule delve: enter the next room
  - needs: room, fatigue
  - serves: choice dread
  - flip a [[room]], resolve it
  - gain 1 [[fatigue]] #core
  - ? does a cleared room stay cleared
- rule rest: recover, but the dungeon moves
  - needs: fatigue
  - serve: choice
  - hurts: fast
  - lose 2 [[fatigue]], the deck advances 1 #core

## The dungeon

### Fatigue

- rule fatigue: a counter; at 5 you [[collapse]]
  - serves: dread
  - rule collapse: what 5 fatigue does
    - you must [[rest]] or drop your loot

```tinker graph Fatigue
```

### Rooms

- rule room: draw from the room deck
  - serves: dread
  - reveal; if it shows a [[monster]], fight it
- stub monster: 3HP, hits for 1
  - slot: {creature} that {verb}s when bloodied
- table creature: rat-king | glass hound | debt collector
- table verb
  - splits
  - screams
  - bargains

## Endgame

- ? how does the game end for everyone
- log: improvised "debt collector bargains": took your loot instead of HP; keep it
- log: someone rested at 2 fatigue just to dodge a room; [[pressure]] is real

```tinker graph
```

## Attic

- rule torches: light as a second resource?
  - ? does this fight fatigue for the same job
- table omens: a crow | cold draft | the lantern gutters
