# forgotodo

A to-do list with Palm Pilot / Newton MessagePad manners: black title tab,
LCD-green screen, outlined push buttons, dotted rules.

Built from [`pizza-starter`](../pizza-starter): no build step, works offline,
installable, and designed for phones.

## Themes

- **palm**: grey-green LCD, faint pixel grid
- **backlight**: the same, with the backlight on
- **newton**: paper-grey, double rules, raised buttons
- **game boy**: the four-shade DMG green

## Menu

Tap the title tab: the menu bar drops down and the tab shows the time.

- **Record > Beam List** sends the list as a Markdown task list (`- [ ] task` / `- [x] task`)
  through the share sheet, or copies it. Keep it somewhere as a backup.
- **Record > Receive Beam…** takes that text back, adding its to-dos to the list.
- **Options > Preferences…** has theme, font, and about.

Font: [Departure Mono](https://departuremono.com) (OFL), vendored so it
works offline; **plain** in Options switches to the system font.

## Development

The same as pizza-starter: `just serve`, `just dev-init`, `just dev-check`,
and `just dev-rebuild` after editing any app file.
