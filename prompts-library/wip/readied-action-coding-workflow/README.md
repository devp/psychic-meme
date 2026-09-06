# Readied Action Coding Workflow — trial notes

Try this on a personal project before using it on real work. The workflow will
*feel* good early if it matches how your attention works, which is exactly why
feel is a bad measure of whether it's producing better code. Measure instead.

## The bet being tested

That paying a steady, moderate overhead (menu decisions, small increments,
parked branches) buys retained understanding and eliminates big review walls —
and that retained understanding is what actually drives your defect rate.

If understanding *isn't* the constraint — if skimming generated diffs would
have been fine — then the overhead bought nothing, and either hand-writing or
plain batch review wins on both speed and defects.

## Two numbers worth actually tracking

1. **Time-to-merge per increment**, against your normal pace. Overhead here is
   many small costs rather than one big one; many small costs are easy to
   under-notice and can total more than the review wall they replaced.
2. **Where main-reaching defects come from** — branches you drove vs. branches
   you approved. If approved-branch defects dominate, the comprehension bet is
   not paying off, and the fix is *fewer parallel branches*, not better review.

## Failure modes to watch for

**Defects**
- *Approval is a weaker guarantee than authorship.* Hand-written code fails at
  things you knew you skipped; approved code fails at things you didn't know
  were there.
- *Integration bugs at the seams.* Each branch individually correct and
  reviewed, the bug living in the interaction — nobody built the seam. The
  independence-claim rule only catches collisions the agent can predict.
- *Agent-written tests test what the agent suspected.* Narrower than tests you'd
  have written, which encode your own hunches about what's fragile.

**Time**
- *Menu overhead compounds.* Evaluating independence claims is cheap once and
  expensive fifty times a day.
- *Rebase churn* if the collapse-to-main-within-a-day discipline slips even a
  little.
- *The queue becomes a second inbox.* Parked work still occupies background
  attention. "There's stuff waiting" is an open loop even with notifications
  off, and open loops are costly.

## Behavioral checks

- Does **"pick zero"** actually get used, or does the menu create pressure to
  always take something? (If it's never used, the menu is driving you rather
  than serving you.)
- Does **one-chain-at-a-pause** hold, or is there constant pull toward the broad
  sweep?
- What fraction of speculative on-deck work is usable vs. discarded? High
  discard is fine and expected; near-total discard means the menu step is
  proposing badly.
- A week later, can you explain everything that landed in main? Anything you
  can't is comprehension debt that the guardrails failed to catch.

## Kill criteria

Worth abandoning or heavily simplifying if, after a fair trial:
- Approved-branch defects clearly exceed driven-branch defects, or
- Time-to-merge is meaningfully worse with no defect improvement, or
- The parked queue is generating more background load than the review walls it
  replaced.
