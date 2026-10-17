# Sync (desktop ↔ mobile)

Single user, a few devices. Manual: a sync button. No CRDT, no ids, no clocks.

## Decisions

- **One button: Record > Sync.** It pushes or pulls the active list, or asks you which to keep.
- **The app also checks when it opens or comes to the foreground.** It pulls silently only when this device has no unsynced changes. Otherwise it leaves the list alone until you press Sync.
- **Changes are detected with versions, not timestamps.** The remote's ETag is the version. Each device stores `base`, the version it last synced, plus a `dirty` flag.
- **`dirty` means you changed something.** Adding, checking, editing, deleting and the Organize actions set it. Daily decay and catch-up don't, because they're computed from `seenDay` and any device gets the same result.
- **The payload is the whole record as JSON.** `seenDay`/`doneDay` have to travel. Markdown Send stays the human backup.
- **Only the active list syncs.** Theme, mode, font, icons and fit stay per-device.
- **Writes are conditional.** A push sends If-Match: `base`, so a push can't silently overwrite another device's push.
- **Transport: the remoteStorage protocol.**

## The button

| This device dirty? | Remote moved past `base`? | Sync does |
|---|---|---|
| no | no | "Already in sync." |
| no | yes | pull (also happens on open) |
| yes | no | push |
| yes | yes | ask: **This device** / **Other device** / **Neither** |

- This device: push with If-Match on the remote's current version.
- Other device: pull. This device's changes are lost.
- Neither: does nothing. The list stays dirty, and the next Sync asks again.
- Offline or an error: say so. No retries or queue.
- Nothing on the remote yet: push. A list that's never synced counts as dirty, so its first Sync against an existing remote asks.

## Tasks

- [x] `dirty` + `base` persisted per list, outside the record; cleared on pull/push.
- [x] Set `dirty` at user-action call sites (`components/checklist.js`, the Organize commands in `app.js`), not in `forget()`.
- [x] Sync client: GET with ETag, PUT with If-Match.
- [x] Sync icon and the three-way alert (`alert-dialog` gets a third button).
- [x] Check on open/visibility; pull only when clean.

## Open questions

- **remoteStorage provider:** just 5apps.com/storage, but leave some of the structure in place that we can later have multiple possible providers (think SSO picker)
  - Done as `PROVIDERS` in `lib/remotestorage.js`: a bare name gets the first provider's domain; the connect dialog takes its placeholder and signup link from it. A picker would list `PROVIDERS`. Any full `user@host` address already works.
- **Second-device onboarding:** q: can this be resolved when connecting to remoteStorage?
  - Mostly yes. Connecting is the onboarding: same address, sign in, and the first Sync on a device that's never synced asks This device / Other device (never-synced counts as dirty), so the new device can't clobber the list, and Other device brings it over.
  - Still open: on iOS the sign-in redirect leaves an installed app for Safari, and iOS keeps the two storages apart, so the token may land in Safari's copy. Untested; may need a paste-the-token fallback.
  - Still open: no Disconnect. Switching accounts means Erase. A 401/403 drops the token and the next Sync reconnects.
- **Feature budget:** if we max our menu as a 4x4 grid, there is one more slot under Record, we sould be fine.
  - Used it: Record is Send, Receive, Sync, Edit.

## structure notes

- we don't want the complexity to baloon for this -- ideally sync, and remoteStorage integration, and the specific mechanics, can all be consolidated or isolated and modularized, to keep overall complexity low.
- we are also looking to make it easy to adapt remoteStorage for other apps as well
