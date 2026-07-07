# SPIKE.md

*Open this whenever a task is vague, unfamiliar, or "should be quick."*
*You don't estimate the unknown — you timebox reducing it, then report.*
*Ending with a sharper question is a win, not a failure.*

---

## 0 · Set the alarm first

Before anything else: **set a phone alarm for the end of this block.**
Not a soft intention. The actual alarm.

- Timebox: **____ hrs**
- Alarm set for: **____**
- When it rings, STOP and report — even if incomplete.

The stop is the whole mechanism. Exploration silently expands until the
runway is gone. The alarm is the hard edge that turns a slow, foggy start
into a bounded, reportable phase.

---

## 1 · Intake — where's the risk?

Scan for the three things that reliably blow up my estimates.
Flag each present one **now**, out loud, before committing to anything.

- [ ] **Cross-team / cross-tech seams.** Does this touch a system, service,
      or team I don't own? (auth, another swimlane's surface, a legacy
      PHP/Laravel/WP corner, someone else's API, another team's approval.)
      Every seam is an unknown that isn't mine to resolve alone.

- [ ] **Leadership / stakeholder visibility.** Is anyone senior watching?
      High visibility = frequent red lines = the target moves after I start.
      Name who can move it.

- [ ] **UX not settled.** Is the design final, or a prompt/sketch that could
      mutate? Unsettled UX is unbounded product scope.

**If any box is checked, I do NOT give a date yet. I give a spike.**

---

## 2 · The spike

- **Done means:** ______
  *(write it even if wrong — a wrong draft surfaces scope disagreement on
  day one instead of day five)*

- **Load-bearing unknowns** (the 2–3 answers that swing the estimate — not
  everything I don't know):
  1. ______
  2. ______
  3. ______

- **Timebox:** ___ hrs (alarm set — see §0)

---

## 3 · Checkpoint — pick exactly one verdict

When the alarm rings, report one of these. All three are legitimate output.

- **Scoped** — I understand it. Real estimate: ______

- **Bounded-but-bigger** — I understand it; it's larger than assumed.
  New shape + estimate: ______

- **Still foggy, here's why** — I hit a *specific* wall: ______.
  I need one more timebox aimed only at that.
  This is NOT "I need more time" (vague, reads slow). It's "I need 2 hrs to
  answer whether X, because the whole estimate forks on it." Finding the
  real risk early is the job, not a failure of it.

---

## Scripts

### When I can't commit a date — and someone pushes "why not a week?"

> "I can't give you a real date yet without guessing, and a guess helps
> neither of us. There are [N] unknowns that will swing this a lot —
> [name them]. Give me [X hrs / until EOD] to spike them and I'll come back
> with a real number and the shape of the work. If it turns out to be a
> week, great. If it's more, you'll know now instead of at the deadline."

Hold the line. "I don't know yet," said calmly and with a plan to know, is
more senior than a confident number I'll miss.

### When the budget is fixed (2 days / 1 week) — walk backward.

Don't promise the whole feature into a fixed box. Invert it:

> "For a [2-day / 1-week] budget, here's what I can reliably land:
> [core slice]. Here's what's out of scope at that budget: [rest]. If we
> need the rest too, that's a different timeline — but I can commit to
> [core slice] by [date]."

Name the reliable slice and the cut explicitly, up front.
Shipped-and-modest beats late-and-complete whenever the point is the date.

---

## Watch-out: vibes over KPIs

Some orgs state KPIs but *decide* on vibes — especially with non-technical
stakeholders. When that's the weather, "it moves the metric" won't always
save me, and "it felt slow" can outweigh what shipped. I can't fix that from
my seat. What I can do: (a) get scope and done-definition agreed **in
writing** early, and (b) read persistent unfairness as fit information, not
just personal failure. Both can be true at once — the process can be unfair
*and* the spike habit still worth building.

---

*Though I am often in a hurry, I am never in haste.*
*Defend outcomes, not the calendar. Set the alarm.*
