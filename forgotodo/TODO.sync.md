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

## Tasks

- [ ] `dirty` + `base` persisted per list, outside the record; cleared on pull/push.
- [ ] Set `dirty` at user-action call sites (`components/checklist.js`, the Organize commands in `app.js`), not in `forget()`.
- [ ] Sync client: GET with ETag, PUT with If-Match.
- [ ] Sync icon and the three-way alert (`alert-dialog` gets a third button).
- [ ] Check on open/visibility; pull only when clean.

## Open questions

- **remoteStorage provider:** who still runs public hosting? If no one does, self-host, which means running a server.
- **Second-device onboarding:** a QR code with the secret in the URL fragment, a paste button, or a password manager. On iOS, a home-screen PWA's storage is separate from Safari's, so pairing has to happen in the installed app.
- **Feature budget:** Sync is one more icon unless something goes.

## Future

- **Merge**, as a fourth answer to the conflict: match items by text with the `!`/`?`/`>` suffix stripped. For matches, the lower tier wins, because forgetting wins. Everything else is a union.
