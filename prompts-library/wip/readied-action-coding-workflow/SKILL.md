---
name: readied-action-coding-workflow
description: >
  An agent coding workflow that schedules parallel agent work around the developer's
  comprehension rate rather than agent throughput. Use when the developer asks to work
  in "readied action" mode, or asks for incremental agent-assisted coding where they
  drive one thread while unpicked work proceeds unattended in worktrees and parks until
  they come up for air. Triggers on phrases like "readied action mode", "let's work the
  readied action way", or a request to pair incrementally while parallel branches wait
  in the background. Not for one-off code generation and not for batch review of a large
  diff — this is a sustained working mode for a session, not a single request.
---

# Readied Action Coding Workflow

Named for the tabletop move: an action prepared in advance that fires on a trigger,
not on the clock. Unattended agent work is completed and held, then released only
when the developer surfaces.

## Design goal

The scarce resource being scheduled is **the developer's comprehension**, not CPU
and not agent throughput. Parallelism exists to keep that resource's *utilization*
high without raising its *rate*. Every rule below follows from that: a rule that
makes code arrive faster than it can be understood is the wrong rule.

Corollary: this system is allowed to throw away agent work. Wasted agent tokens are
cheap; a merge the developer didn't understand is expensive.

## Non-goals

- No monolithic upfront plan. Resolution is high for the immediate 2–5 tasks and
  deliberately foggy after. The agent may hold a longer arc privately, but never
  asks the developer to review or maintain one.
- Not "more code per day." The metric is *merged-and-understood* increments.
- No notifications. Nothing interrupts flow.

## Core loop

**Step 0 — Frame the task.** The developer states the immediate goal. The agent
restates it in one sentence and names what it thinks is unclear. No planning doc,
no phase breakdown.

**Step 1 — Propose a short menu.** Offer 2–3 next steps that are genuinely
independent, and for each state *why* — which files, modules, or interfaces it
touches and why they don't collide. The independence claim must be falsifiable, so
a bad decomposition is visible without reading the code.

**Step 2 — Developer picks zero or one.** Picking zero is a first-class outcome: it
means "staying on what I'm already doing." Unpicked steps become candidates for
unattended work.

**Step 3 — Pair, with the developer driving.** Incremental TDD: one test, run,
minimum code, run, one-line narration of what changed and why, next. No batch
generation. Chunk size is whatever can be verified by running it.

**Step 3b — Spin off on demand.** At any point the developer can name a subtask for
a subagent to take into a worktree. It parks when finished.

## Unattended work

Each unpicked step runs in its own worktree as self-contained TDD increments, with
two branches:

- **review-ready** — the next coherent increment, complete, held for release.
- **on-deck (speculative)** — continued work past that point while waiting.
  Expected to be rebased or discarded; that cost is priced in.

### Constraints

Unattended work arrives pre-built, so it must never require holding the whole
system in one's head to review:

- Bounded blast radius: no schema changes, no cross-cutting refactors, no
  dependency bumps, no changes to core abstractions or data models. Those are
  always developer-driven, never parallelized.
- Speculative work prefers additive, low-conflict territory — tests, adjacent
  modules, docs — and avoids files the developer is currently driving in.
- **Everything collapses back to main within a day.** A worktree that can't reduce
  to main inside a day was scoped wrong; flag it rather than let it run long.

## Queue discipline

- Completed work **parks silently**. No pings, no "ready for review" interrupts.
- The developer pulls from the queue at natural boundaries only: tests green,
  increment merged, or an actual break.
- At a pause, default to surfacing **one chain, not a broad sweep** — the single
  most relevant thread to align on, not a dashboard of everything in flight. The
  wider view is available on explicit request when unblocking many threads is the
  point of the pause.
- Nothing merges to main that hasn't been understood. Approval is the merge gate.

## Guarding against comprehension debt

Reviewed-not-built code opens a gap between mental model and real system.
Mitigations, built in rather than remembered:

- Core abstractions and data models stay hand-driven.
- Periodically — end of a chunk or a day — the developer states back what a
  subsystem now does, without looking. Failing that is a signal to go re-drive
  that area, not to have it explained again.
- A review-ready increment that can't be understood in one pass gets split or
  redone as a pairing session, not approved with a shrug.
