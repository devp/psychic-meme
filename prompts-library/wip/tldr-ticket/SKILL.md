---
name: tldr-ticket
description: >
  Compress a long Linear ticket, GitHub PR description, or review comment to a one-sentence
  TL;DR plus a few "watch for" bullets, added only when something crucial would otherwise be
  lost. Trigger when the user asks to "tldr", "compress", "boil down", or "summarize" a
  ticket/issue/PR, including when they paste a link or a wall of ticket text and ask what it
  says or whether anything in it matters. Trigger without the word "tldr" too — "what's the
  actual ask here" or "what does this one actually say" pointed at a ticket counts. Works on
  requests, reports, and decision records alike. Compresses source text written by someone else,
  not Claude's own replies (that's the `caveman` skill) — and not for a ticket the user is
  about to act on, where `ticket-read-along` applies instead.
---

# tldr-ticket

A ticket carries load-bearing detail and context in the same undifferentiated block. The job
isn't "make it shorter" — it's to separate the one load-bearing thing from everything else,
and say only that.

On-demand only. Never run it automatically on every ticket/PR you happen to see.

## The rule, in one line

Say the load-bearing essence in one sentence. Add a bullet only for something that one-liner
would otherwise hide or misrepresent. Zero bullets is the common, correct outcome.

## How to compress

1. **Find the load-bearing essence.** Not the context nor history nor justification.
   Read what shape the source is, and write that:
   - **request** → the ask
   - **report / finding** → what's true, and what it changes
   - **decision record** → what was decided, and what's now foreclosed

   One sentence, under ~20 words where possible. Test it: the sentence has to stay correct if
   nobody does anything. If it only reads as an instruction, the source was a request —
   otherwise you invented one, which is rule 5.

2. **Decide if a bullet is earned.** Only when leaving it out would make the one-liner
   misleading or drop something the reader needs — a hard constraint, an acceptance criterion,
   a contradiction between sections, an edge case, or an open decision.
   If the one-liner already covers it, no bullet. Cap at 3; use fewer when fewer suffice.

3. **When genuinely unsure whether something is crucial, keep it as a bullet.** One extra line
   costs far less than acting on a summary that dropped a constraint.

4. **Prefer a pointer over a restatement.** If a bullet is flagging "there's important detail
   here, go read it," name where to look (a section, an AC number, a specific line) instead of
   compressing the detail into the bullet. The source gets read for it either way. Compare:
   - Weaker: "The query joins on order_id and customer_id, missing rows where the child record
     is null, which affects 29 of 44 rows..."
   - Better: "see the Evidence section for the exact query/table names"

5. **Never invent or infer.** If the source doesn't say it, it doesn't go in the summary — not
   even as a guess phrased confidently.

6. **Same rules regardless of platform.** Linear ticket description, GitHub PR description, and
   GitHub review comment all get identical treatment. No per-platform process. (Step 1's
   request/report/decision split is about the shape of what's written, not where it lives.)

## Output format

Exactly this shape (omit the "Watch for" line entirely when there are no bullets — never write
"Watch for: none"):

```
**TL;DR:** <one sentence>
**Watch for:**
- <bullet>
- <bullet>
```

Close with a link back to the original, framed as a first pass rather than a substitute for
reading the source. Match the framing to the shape — "worth reading the full ticket before
acting: <link>" for a request, "worth reading in full: <link>" for a report or decision
record.

## Worked examples

**Short ticket → one-liner only.** Nothing rises to "crucial and otherwise hidden," so zero
bullets.

> **TL;DR:** Build admin read/write endpoints for account detail and per-account overrides,
> unblocking TICKET-102.
>
> First pass — worth reading the full ticket before acting: [TICKET-XXX]

**Medium ticket → one-liner plus a real open decision.** The one-liner alone would hide that the
outcome branches on a fact nobody's confirmed, so it gets a bullet — both branches, because
either one changes what gets built.

> **TL;DR:** Decide whether anyone edits the `*_override` fields today — if so, the new service
> needs a write endpoint before the old one goes read-only at cutover.
> **Watch for:**
> - If yes: build write endpoint before cutover, feeds TICKET-207
> - If no: field stays permanently read-only
>
> First pass — worth reading the full ticket before acting: [TICKET-XXX]

**Report-shaped ticket → what's true, not what to do.** A postmortem asks for nothing. The
one-liner states the finding and its consequence; forcing it into an imperative would invent an
ask the source never made.

> **TL;DR:** Last week's sync outage was a silently-expired credential, not the retry logic —
> retries were a symptom, and the same credential expires again in 90 days.
> **Watch for:**
> - Rotation isn't automated yet; see "Follow-ups" for who owns it
>
> First pass — worth reading in full: [TICKET-XXX]

**Long, 648-word ticket → one-liner plus pointer-style bullets.** The specifics (which 29 keys,
which query) aren't worth restating — verifying the claim means reading that section anyway.

> **TL;DR:** Decide and implement a consistent foreign-key indexing convention — 29 of 44 foreign
> keys currently lack indexes, risking full scans on parent deletes.
> **Watch for:**
> - See the evidence section for exactly which 29 keys and the query used to find them —
>   needed before making the call
> - Not urgent — tables are small today, but the decision affects a later milestone's scope
>
> First pass — worth reading the full ticket before acting: [TICKET-XXX]
