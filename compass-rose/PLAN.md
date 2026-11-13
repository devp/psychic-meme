# compass-rose: what's next? (hypotheses, not decisions)

Dev, after a few days of use: building connected chains feels fussy. The connections don't *show* anything that helps me understand or evolve. And the theme hides, especially with the keyboard open, which is most of the time.

Below are hypotheses about why, each with candidate fixes and a cheap way to check it. They're grouped by the three complaints and ranked within each group. A suggested order is at the end.

---

## A. Chains are fussy to build

**A1. The default is "unconnected", but my default is "and then...".**
Today, typing line after line in the composer makes loose entries. To chain, I have to tap an entry and then "What does it cause?" before typing. Most of the time I'm narrating a sequence, so the app's default runs opposite to mine.
- *Fix: chain by default.* Each new entry links from the last one, or from the selected one. The composer shows the link as a chip above the input: `from: kept refreshing email ↗`. Tap the chip to unlink this one entry, or to pick another source. "Several at once, not connected" becomes an explicit choice: a "separately" toggle, or a long-press on Add.
- *Check:* count, in my real records, how many entries I later wished were linked.

**A2. Direction is a decision I'm asked to make before I know it.**
"What does it cause?" versus "What causes it?" asks me to know the direction first. I often notice the feeling first and the thought after, and I only know the order once both are written.
- *Fix: link first, direction later.* A connection starts as plain "related". The arrow can be flipped with one tap on the route chip, or left undirected; exports print undirected links as `---`.
- *Fix: offer the causal question after the fact.* Once two corners exist, a small prompt asks, e.g. "Did *tight chest* come before or after *I'll mess this up*?" (two buttons, dismissable).

**A3. Linking to an existing entry means hunting through a strip of clipped text.**
- *Fix: tap-tap linking.* A "link" action puts the timeline in pick mode: tap entry A, tap entry B, and you're done. Exit with ✕. This reuses the selection UI that's already there.
- *Fix: drag a route.* Drag from an entry's ink dot onto another entry. It looks good but is fiddly one-handed; try tap-tap first.

**A4. The category auto-advance guesses wrong, and correcting it is an extra tap.**
After a thought, it suggests feeling, but I may have a second thought.
- *Fix: suggest without selecting.* Keep the last category selected, and show the suggested next corner as a soft halo. Or flip it: pick the category *after* typing, by swiping the input toward a corner.
- *Fix: a tag word.* Typing `f:`, `t:` or `b:` at the start of a line sets the category, like gemdrafter's keyboard shortcuts. This is a power-user path.

**A5. One entry is often two things.** "Kept refreshing email because I felt dread" is a behavior and a feeling at once.
- *Fix: split.* A "split" action on an entry turns it into two entries, linked, each with a category to pick.

---

## B. The connections don't show me anything

**B1. The structure exists in the data, but the screen only shows text chips.**
"← from X" chips are a list, not a picture, so the shape of my thinking never appears.
- *Fix: route lines in the timeline gutter* (git-graph style). Draw the actual connections as curved ink lines in the left margin between connected rows. Loop-backs arc further out and in a different ink. This is the cheapest true visual and stays in the view I already use.
- *Fix: a Map view* (the layered-SVG plan from the Mermaid question). A separate Timeline / Map toggle, with the loop drawn as a visible circle.

**B2. The compass is decoration. It doesn't reflect *this* record.**
The rose looks the same whether I've written 2 entries or 20.
- *Fix: the compass is the mini-map.* Plot each entry as a small mark in its corner's sector: thoughts near the top, and so on. Draw connections as ink routes across the rose. A loop becomes a visible circuit around the pin, and an intervention plants a mark in the center with routes leaving it. The needle keeps its job. This makes the theme *be* the visualization instead of framing it.
- *Nice to have, as a thematic option: a floating needle.* Tilt the phone and the needle sways a few degrees (about ±5°) around wherever it's pointing, with a spring and settle, like a compass card floating in its bowl. Implementation:
  - Use `deviceorientation`, heavily smoothed. It needs no permission on Android Chrome; iOS needs one tap to allow it.
  - It's its own Options toggle ("floating needle"), and only runs when Motion is on and the Record tab is visible.
  - About 40 lines, no dependencies, and the sensor data never leaves the device.
  - *Battery:* small but not zero. The tilt sensor reports up to ~60 times a second, and each reading redraws one SVG transform. Keep it cheap:
    - stop listening when the page is hidden or the compass is off-screen;
    - stop redrawing once the needle has settled and the phone is still.
  - *Check:* after a week, Android's per-app battery usage for the installed app should be negligible.
  - *Risk:* a jittery needle reads as anxious. If heavy smoothing doesn't make it calm, drop it.
- *Fix: rounds as rings.* Each intervention adds a faint ring outward, like tree rings or a sounding chart, so "map → test → map again" shows as the record growing outward.

**B3. Evolving is invisible: the new thought doesn't sit beside the old one.**
The payoff of CBT is "old thought → test → new thought", but in the timeline these entries are far apart.
- *Fix: a "then / now" pair.* When an intervention leads to a thought (or behavior) of the same corner as one it was about, show the two side by side as a pair card: the old one crossed lightly in ink, the new one beside it. Gentle, with no score.
- *Fix: a "routes taken" summary* at the bottom of a resolved record. Just the interventions and what each led to, as a short legend on the map. This is also what you'd want to show a therapist.

**B4. Patterns across records are invisible.** The same thought recurs across situations.
- *Fix (later):* when a new entry closely matches an earlier one, a quiet "you've charted this before" link to that record. It would use local text matching only, never a score or a streak. This needs care: it could feel like surveillance. Check the feeling before building.

---

## C. The theme hides, especially with the keyboard up

**C1. With the keyboard open, chrome eats the screen and the map scrolls away.**
On a phone, the keyboard takes about half the height. Then the header and tabs (~100px) and the composer (~170px) leave a sliver, and the compass is off-screen.
- *Fix: writing mode, ported from gemdrafter* (`gemdrafter/app.js` ~421-460). While the keyboard is up, fold the header and tabs away. It's already proven in this repo, and the starter README lists it as a TODO to port.
- *Fix: shrink the composer while typing.* Collapse the category chip row into a single compact control (see C2).

**C2. The composer is where I live, and it's the least themed part.**
- *Fix: a compass picker in the composer.* Replace the row of six chips with a small rose (about 56px) beside the input. Tap a point to pick the category, and the needle shows the suggestion. This is one-handed, takes less width, and keeps the compass on screen whenever the keyboard is.
- *Fix: an ink line into the input.* With chain-by-default (A1), draw a short ink route from the last entry down into the input field, so I can see what I'm writing *from*.

**C3. Nothing themed happens at the moment of writing.**
The unfurl plays on panel changes, not when I add an entry.
- *Fix: ink settling.* A new entry's text appears darker and "wet", then settles to the normal ink colour over about 1s. Gated on motion, like the unfurl.
- *Fix: a mini compass in the header* that turns when the needle changes, so the theme answers my writing while I type.

---

## Which to try first

Suggested order: biggest friction for least work first, each one small enough to judge in a week of real use.

1. **A1 chain-by-default + the "from" chip**, with **A3 tap-tap linking**. This fixes building, and is mostly in `record-view.js`.
2. **C1 writing mode** (port from gemdrafter) and **C2 the compass picker in the composer**. These fix "the theme hides" exactly when it matters.
3. **B2 the compass as a live mini-map.** This is the theme doing the explaining. Draw from the same layout code as the Map view, or start simpler with sectors and straight routes.
4. **B1 gutter route lines**, then the **Map view**, if B2 isn't enough.
5. **B3 then/now pairs**, once chains are easy enough that there's something to pair.

## How to tell what's working

- Keep a one-line note in a record whenever something feels fussy: "wanted to link X to Y", "lost the compass". A week of these settles the order better than this list does.
- For each change, look at whether records come out *more connected* without taking longer to write. Look, don't count: no in-app metrics.
- Keep the guardrails: gentle copy, no scores, everything on device, and every prompt can be dismissed.
