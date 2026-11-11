# compass-rose

A thought record shaped like a compass, following the CBT "cognitive triangle": situation, thoughts, feelings, behavior. Log what you notice one line at a time, connect what led to what, and turn loops into something to test. Offline PWA; everything stays in this browser's localStorage.

Not a medical device. No clinical advice, no scores or streaks. A therapist's own worksheet comes first.

## Words

| Term | Meaning |
|---|---|
| **Record** | One in-the-moment situation. Revisiting later means a new record ("Reviewing my crashing on Tuesday"). |
| **Entry** | One line of text, with a category and a time. Shown and exported in time order. |
| **Category** | `situation`, `thought`, `feeling`, `behavior`, `intervention`, `resolution`. The **corners** are thought, feeling and behavior. |
| **Connection** | Optional "this led to that" (`{from, to}`). Plenty of entries have none. |
| **Intervention** | Something you try: checking the evidence, an alternative thought, doing something different. The compass's center pin. |
| **Resolve / Reopen** | Resolving adds a `resolution` entry (optional note, optional less/same/more). Anything added afterwards reopens the record. Repeatable. |
| **Toolkit** | Your own list of interventions, tagged by corner, offered when you intervene. Starts with five neutral starters you can delete. |
| **Needle / hint** | Looks only at entries since the last intervention. It points at a corner you haven't touched yet; or, once the map has looped back with nothing tested, at the center, with a dismissable "Mapped it. What's one thing you could test?" |

## Look and feel

- Three lights to read the map by: **Daylight**, **Candlelight** (default on a dark device) and **Moonlight**, with Match device as the default. Options also has the font (Lora serif by default, vendored in `fonts/`; or sans or mono) and Motion.
- **Motion**: panels, new entries and dialogs unroll like a scroll; the needle swings slowly; candlelight flickers, barely. Motion follows the device's reduced-motion setting unless Options says Unfurl or Still. Everything that moves is gated on `:root[data-moving]` in `app.css`.

## Using it

- Tap a corner of the compass (or the situation mark) and type a line.
- Tap an entry: **What does it cause?**, **What causes it?**, **Intervene**, **Delete**. Cause/caused-by can add a new entry or link to an existing one. After adding, the composer keeps asking what it led to; ✕ stops that.
- Exports are clipboard copies, per record (Record tab) or for all records (Records tab): a chronological timeline, and Markdown with a Mermaid graph plus an outline (loops print as `(back to) ...`).

## Code

- `lib/thought.js`: the model as pure functions (connections, loops, needle).
- `lib/export.js`: both exports.
- `components/`: `compass-rose` (inline SVG), `record-view`, `record-list`, `toolkit-list`.
- Storage is the starter's `recordStore`, with a small `patch()` added for the `connections` field beside the entries.

Built from [pizza-starter](../pizza-starter); see `STARTER`. `just serve`, `just dev-check`, `just warnings`.
