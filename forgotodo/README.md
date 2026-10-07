# forgotodo

A to-do list with Palm Pilot / Newton MessagePad manners: black title tab,
LCD-green screen, outlined push buttons, dotted rules.

Built from [`pizza-starter`](../pizza-starter): no build step, works offline,
installable, and designed for phones.

## Themes

- **palm**: grey-green LCD, faint pixel grid
- **newton**: paper-grey, double rules, raised buttons
- **game boy**: the four-shade DMG green
- **papyrus**: a parchment scroll in Papyrus (the font wins over Font; macOS/iOS only, `fantasy` elsewhere)

Each has a dark twin. **Backlight** in Options is off (light), on (dark), or
auto (follows the system). The old `backlight` theme is palm with it on.

## Forgetting

- Priority is in the text: each trailing `!` is +1, a trailing `?` is -1
  (`foo!!` is 2, `what?` is -1; a mix like `wat?!` is 0). Most urgent first.
- Every day a to-do stays open it drops a tier:
  `foo!!` → `foo!` → `foo` → `foo?` (faded) → `foo??` (forgotten).
- **Forgotten** is the bottom. It's hidden from the list but still counted
  ("2 of 9 done · 3 forgotten") until you sweep it or it's remembered. Type
  `??` on the end of a new to-do to file it straight there.
- Done items disappear the day after you check them.
- Catch-up happens when the app opens or comes back to the foreground, so days
  it sat unopened still count.
- Beam carries the suffixes, so forgotten to-dos survive a backup too.

## Desktop

Tap the title tab: a desktop of pixel icons covers the list, and the tab
shows the time. Tap an icon to run it; tap bare desktop (or press Escape, or
the tab again) to close it. Icons are grouped like Palm launcher categories.

- **Record > Beam List** sends the list as a Markdown task list (`- [ ] task` / `- [x] task`)
  through the share sheet, or copies it. Keep it somewhere as a backup.
- **Record > Receive Beam…** takes that text back, adding its to-dos to the list.
- **Record > Edit** arms edit mode: the next to-do you tap becomes a text field
  (Enter saves; Escape, tapping away, or tapping the tab cancels). An edit
  resets that to-do's daily decay, and editing its `!`/`?` sets its priority.
- **Organize > Sweep…** shows the forgotten to-dos and offers to delete them.
- **Organize > Recycle…** deletes the done ones now instead of tomorrow.
- **Organize > Forget** forgets one random to-do from the lowest tier still
  showing. It puffs away and you're not told which.
- **Organize > Remember** brings one random forgotten to-do back, at neutral.
- **Organize > Shake Up** rolls for every open to-do, forgotten ones too: 30%
  up a tier, 30% down, 40% stays. Movers blink; a note sums it up.
- **Organize > Fast Forward…** runs a day's rollover now ("tomorrow's list,
  today"), after saying what it'll do. It's an extra day: the real one still
  comes tonight.
- **System > Options…** opens theme, backlight, font, toggles, and about.

The icons are 10×10 bitmaps, drawn in `lib/icons.js` as ASCII art and shown
at 4×. **Desktop icons** in Options turns them off for a plain list by name.

**Shrink to fit** in Options: big type for three to-dos or fewer, a little
smaller with each one after, then as small as it takes (down to 10px) for the
whole list to fit without scrolling.

Fonts, vendored so they work offline:
- **pixel**: [Departure Mono](https://departuremono.com) (OFL)
- **casual**: [Comic Neue](https://comicneue.com) (OFL), Comic Sans redrawn
  to be legible (and a nod to the Newton's Casual face)
- **plain**: the system font

## Development

The same as pizza-starter: `just serve`, `just dev-init`, `just dev-check`,
`just warnings`. Adding, renaming or deleting an app file (fonts included)
means updating `ASSETS` in `sw.js`; `just warnings` flags any mismatch.
