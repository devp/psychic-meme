# forgotodo

A to-do list with Palm Pilot / Newton MessagePad manners: black title tab,
LCD-green screen, outlined push buttons, dotted rules.

Built from [`pizza-starter`](../pizza-starter): no build step, works offline,
installable, and designed for phones.

## Themes

- **palm**: grey-green LCD, faint pixel grid
- **newton**: paper-grey, double rules, raised buttons
- **game boy**: the four-shade DMG green

Each has a dark twin. **Backlight** in Options is off (light), on (dark), or
auto (follows the system). The old `backlight` theme is palm with it on.

## Forgetting

- Priority is in the text: each trailing `!` is +1, a trailing `?` is -1
  (`foo!!` is 2, `what?` is -1; a mix like `wat?!` is 0). Most urgent first.
- Every day a to-do stays open it loses a `!`, or once it has none, ends in
  `?`. That's the end: `foo?` stays, faded, until you delete or finish it.
- Done items disappear the day after you check them.
- Catch-up happens when the app opens or comes back to the foreground, so days
  it sat unopened still count.

## Menu

Tap the title tab: the menu bar drops down and the tab shows the time.

- **Record > Beam List** sends the list as a Markdown task list (`- [ ] task` / `- [x] task`)
  through the share sheet, or copies it. Keep it somewhere as a backup.
- **Record > Receive Beam…** takes that text back, adding its to-dos to the list.
- **Organize > Sweep…** deletes the open to-dos at the lowest priority (after
  asking, and listing them).
- **Organize > Recycle…** deletes the done ones now instead of tomorrow.
- **Organize > Forget** knocks one random open to-do down a step, as a day of
  neglect would; **Remember** brings one up a step (`foo?` → `foo` → `foo!`).
  The row blinks so you can see which.
- **Options…** opens theme, backlight, font, toggles, and about.

Menu items have 10×10 pixel icons (drawn in `lib/icons.js` as ASCII bitmaps);
**Menu icons** in Options turns them off.

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
