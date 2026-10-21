# ttr: task task resolution

Clear an overfull Todoist list on the subway: one card at a time, one tap per
decision, nothing sent until you say so. The point is **shrinking lists**, not
reorganizing them.

Live at `ttr.dzza.workers.dev` (deployed by `.github/workflows/deploy.yml`).

Themes: dusk, paper, **ddr** (neon cabinet: arrows, PERFECT!!/GREAT!/BOO judgements, combo count) and **subway** (signage; each verb a line bullet, Agenda rides the 7).

## Use

1. Paste a Todoist API token (Settings → Integrations → Developer). It's
   tested, then kept in this browser's localStorage.
2. Pick a target. Counts come from fetching every target; a pick within two
   minutes of that reuses the list, so it opens instantly even underground.
3. Tap a verb per card. No network until Apply. **↶ undo** walks back any
   number of decisions; **skip** moves on.
4. The summary groups the changes. Tap a row to drop it. **Apply** sends them
   in one Sync request (one per 100 commands); the result lists failures by
   task with Todoist's reason.

**start over** and **‹ targets** throw the queue away (a second tap confirms).
Killing the app does too, and changes nothing in Todoist.

| Verb | Sends |
|---|---|
| Date `+1w` … / pick… | `item_update` due date, counted from today or picked |
| Watch `+1w` … / pick… | `item_move` to Watchlist, then `item_update` due date |
| Agenda → section | `item_move` to that section, then clears the due date |
| Switch → project | `item_move` to Agenda, Watchlist or Menus (no section), then clears the due date |
| Breakdown | `item_add` per line into Inbox (description `from: <original>`), then `item_close` |
| Tomorrow | `item_update` due tomorrow |
| Unpin | `item_update` labels without `pin` |
| Done | `item_close` (recoverable, unlike delete) |
| Kill series | `item_delete`; recurring tasks only, two taps |

Recurring tasks (↻) never get a due date written, since that would overwrite
the recurrence: no Date, Tomorrow or Watch; Done reads **Done (this one)**;
Agenda and Switch move the task but keep its due date; Breakdown closes this
one and leaves the series, unless **end the series** is ticked (two taps,
then `item_delete`).

Breakdown takes one task per line, or `;` between them; never commas, which
task text is full of. One line is a reword. Undo brings the text back.

## Config

Options → Targets (JSON): targets (name, Todoist filter query, verbs), the
Date and Watch buckets (`+3d`, `+1w`, `+1mo`, `+1y`), the names of the
Agenda and Watchlist projects, Switch's projects (`switchProjects`; "Menu"
finds "Menus" and back), and the pin label. Missing keys fall back to the
defaults in `lib/triage.js`. `apiBase` is there in case browser calls ever get
blocked and need a proxy.

## Code

Built from [pizza-starter](../pizza-starter) (see `STARTER`).

- `lib/triage.js` -- verbs, decisions → Sync commands, the session queue,
  reading `sync_status`. No DOM, no network; `tests/triage.test.mjs`.
- `lib/todoist.js` -- the API v1 calls (cursor paging, form-encoded Sync).
- `remote.js` -- snapshots, the Agenda/Watchlist lookup, apply.
- `state.js` -- the only persisted things: token, config, looked-up ids, theme.
- `components/` -- setup, picker, session (card, summary, result).
- `tests/browser/app.test.mjs` -- the whole flow against a fake Todoist.
  `CHROMIUM_PATH=/path/to/chromium` to use a browser other than playwright's.

## Not yet (spec "later")

Reschedule counter, pin budget, swipe gestures, `@laura-requested` guard,
retry for failed commands.
