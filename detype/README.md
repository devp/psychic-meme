# detype

A freewriting page in the morning-pages style. You type a line, press Enter,
and it drifts up and fades away. The screen isn't for rereading, editing, or
thinking. It's for getting words out.

Built from [`pizza-starter`](../pizza-starter): no build step, works offline,
installable, and designed for phones.

## How it works

- **write**: one line at a time. Backspace works on the line you're typing.
  Once you press Enter the line is saved and gone. The last three lines stay
  on screen as fading ghosts and are never shown again after a reload.
  Pressing Enter on an empty line does nothing.
- **pages**: one page per day (days roll over at local midnight), newest
  first. Each page is the day's lines as a single block of text. You can
  search across all pages (for that to-do list you know you wrote down
  somewhere), download a day as a `.txt`, download everything as one `.txt`,
  or delete a day.
- **options** (∆): the dusk and linen themes, serif/sans/mono fonts, and an
  optional daily goal counted in words, characters, or lines. The goal is
  shown as a hairline at the bottom that fills up and then stays full. No
  numbers, no streaks.

## Where your words live

Only in this browser's localStorage. Nothing is sent anywhere. That means:

- Clearing site data deletes your pages. Use **download all** now and then if
  you want a copy.
- localStorage is capped at roughly 5MB per site, which is about two years of
  daily 750-word pages. If a save ever fails, a notice appears under the line
  you're typing.
- On phones, downloads go to Downloads (Android) or open a preview you can
  save to Files (iOS). From an installed iOS home-screen app this can be
  clunkier than in Safari.

## Files

- `app.js`: wiring for writing, the goal, downloads, and the shell
- `state.js`: persisted settings and the `pages` store (one record per day)
- `lib/pages.js`: pure helpers (day key, text block, counts, export)
- `components/ghost-lines.js`: the fading lines
- `components/pages-list.js`: the pages view
- everything else is pizza-starter as-is, except `lib/store.js`, which now
  reports when a write didn't reach storage (`isSaved()`)

## Development

The same as pizza-starter: `just serve`, `just dev-init`, `just dev-check`,
and `just dev-rebuild` after editing any app file.
