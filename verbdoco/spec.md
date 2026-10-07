# verbdoco spec

A self-modifying HTML file whose content is its state. It opens from `file://` and syncs to my own server.

## Decisions

- **The server is the source of truth.** The file is a bootstrap plus a cached snapshot, so a stale copy loads its old snapshot and then fetches the latest.
- **The file embeds `{serverUrl, docId, etag, snapshot}`.**
- **Local save is an export, not the main path.** That avoids `doc (3).html` sprawl and the browser-specific file-handle work.
- **Sync is per-doc GET/PUT with `ETag` + `If-Match`.** A mismatch returns `412`, giving last-writer-wins with conflict detection, which is enough for one user.
- **Auth is a bearer token in `Authorization`, with no cookies.** That keeps `Access-Control-Allow-Origin: *` legal, since `*` is only forbidden for credentialed requests.
- **Each doc gets random read and write tokens,** never a reused password. A read token alone gives a shareable read-only copy.

## Server CORS

| Header | Value |
|---|---|
| `Access-Control-Allow-Origin` | `*` |
| `Access-Control-Allow-Methods` | `GET, PUT, OPTIONS` |
| `Access-Control-Allow-Headers` | `Authorization, If-Match, If-None-Match, Content-Type` |
| `Access-Control-Expose-Headers` | `ETag` (without it, the page can't read the ETag) |

- The `Authorization` header forces a preflight, so the server must answer `OPTIONS`.
- Requests arrive with `Origin: null` and no `Referer`.

## Browser constraints (`file://`)

- **Detecting `file://`:** `location.protocol === 'file:'`, or `location.origin === 'null'` (the string). `isSecureContext` is `true` here too, so it can't tell file from https.
- **The page can't write its own file.**
  - File System Access API (Chromium only): the user picks the file once; the handle can be kept in IndexedDB; Chrome re-prompts for permission each session.
  - Fallback: download a new copy.
- **Chrome gives every `file://` page one shared `localStorage`,** so any local HTML file can read a token stored there. Firefox isolates more.
- **Live updates:**
  - `EventSource` can't set headers, so the token would go in the query string.
  - A WebSocket has no CORS and can send the token as its first message.
  - Polling with `If-None-Match` → `304` is the simplest option.
- **Server content goes in via `textContent` or a sanitizer,** never raw `innerHTML`: a compromised server would otherwise run script in the page.

## Open questions

- Where does the write token live: embedded in the file (the file becomes the capability), in `sessionStorage`, or re-prompted each session?
- How should offline edits to a stale copy resolve: show the conflict and let me pick, or keep both versions?
- Should the server be plain GET/PUT, or a minimal remoteStorage subset shared with pizza-starter sync?
- Push channel: polling, SSE, or WebSocket?

## Prior art

- **TiddlyWiki:** a single-file wiki with savers for download, browser extensions, and WebDAV `PUT`.
- **Feather Wiki:** a small single-file version of the same idea.
- **remoteStorage:** the same design (CORS everywhere, bearer tokens, ETag/If-Match, per-path documents).
