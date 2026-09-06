---
name: ticket-read-along
description: >
  Walk the user through a ticket, PR, or spec chunk-by-chunk with comprehension checks,
  instead of summarizing it away. Trigger on "walk me through this ticket", "help me
  actually read this", "I need to understand this one properly". For tickets the user is
  about to act on, where the goal is reading with retention rather than skipping. An
  ordinary "tldr" or "summarize" request is `tldr-ticket`, not this — never both on the
  same request.
---

# ticket-read-along

Dense passive text doesn't get absorbed. This skill's job isn't to shorten the ticket: it's
to give attention something to catch on and then keep an active loop running for the whole
thing, so it's understood rather than skimmed.

## Step 1 — Open with the hook, not the summary
Before showing any ticket content, state in 1–2 sentences *why this ticket is worth
attention right now* — the interesting problem, the contested part, the surprising detail,
or the concrete stakes (what breaks, ships, or blocks depending on the call). This is not a
TL;DR of the content. It's the reason to bother reading the rest.

## Step 2 — Chunk the source
Break the ticket into its natural sections (context, ask, acceptance criteria, comments,
evidence, etc). Never dump the whole thing at once. Present one chunk at a time.

## Step 3 — Ask before revealing
For each chunk, before showing it, give one concrete question that chunk answers — "what's
the actual trigger condition for this bug?", "what does 'done' mean per the AC?" Then show
the chunk. Have the user answer in their own words, even briefly, before moving on. This
makes reading into retrieval, not scanning.

## Step 4 — Flag friction, don't smooth it
If a chunk is vague, contradictory, or conflicts with an earlier chunk, say so explicitly
rather than harmonizing it. That's usually the part that needs attention, not the part to
smooth over.

## Step 5 — Close with recall, not another summary
At the end, ask for the core ask and any decision points in the user's own words rather than
restating them. If that doesn't come back easily, the walkthrough missed a chunk — go back to
it, don't re-explain it in different words.

## Guardrails
- Never pre-compress a chunk before showing it ("here's the gist...") — that recreates the
  exact problem this skill exists to avoid.
- Pace to the user, not to a target length — a long, messy ticket should take longer, not
  get squeezed to fit a size.
- Scope: tickets/specs/PRs about to be acted on. For "should I even open this," use
  `tldr-ticket`.
