# pizza-repl-lil

A [Lil](https://beyondloom.com/decker/lil.html) REPL for pizza rats: in your phone browser, or
installed to the home screen, offline. Interpreter and reference docs are vendored; nothing
talks to a server after the first load.

**Not affiliated with Decker.** Lil and [Decker](https://beyondloom.com/decker/) are by John
Earnest. This is an unofficial browser REPL on his MIT-licensed interpreter — not
[Lilt](https://beyondloom.com/decker/lilt.html), and without Lilt's filesystem or CLI bindings.

Built on [pizza-starter](../pizza-starter) (see `STARTER`). Sibling: [pizza-repl-fennel](../pizza-repl-fennel).

## Try it

```
1+2
r:10
r*2
_+1                       # _ is always the last result
show[1,2,3]
each x in 1,2,3 print[x*x] end
on greet name do "hi ", name end
greet["world"]
```

Tabs: `lil` and `quickref` are the language reference; `cli` is Earnest's Lilt docs (background
only); `decker` is the platform Lil normally runs inside. The round button on a doc tab jumps to
a section — an installed app has no find-in-page. `log` keeps sessions: rename, delete, or copy
one as commented lil that pastes back in and reruns.

## Layout

The language is `lang.js` + `vendor/lil.js` + `docs/`. Everything else is the REPL shell, the
same in every `pizza-repl-<lang>`; `diff -r` against a sibling shows exactly the seam.

| File | What |
|---|---|
| `lang.js` | evaluate, comment prefix, unterminated-input scan, `_` export caveat, doc preprocessing |
| `app.js` | wiring: REPL, sessions, docs, settings, offline |
| `lib/export.js` | a session as replay-safe commented source |
| `components/doc-view.js` | vendored markdown, rendered on first open, with a heading index |
| `components/session-list.js` | the log tab's list |
| `components/append-log.js`, `tabs.js`, `lib/` | from the starter |

`just serve`, `just dev-check` (`just dev-init` once), `just warnings`. Add or remove a file:
update `ASSETS` in `sw.js`.

## Known gaps

`lang.js` registers the same primitives as Decker's Lilt CLI — `print`, `show`, `random`,
`array`, `image`, `sound`, `keystore`, `eval`, csv/xml helpers, and the built-in constants. Left
out:

- Filesystem/OS bindings (`read`, `write`, `dir`, `shell`, `exit`, `import`, `newdeck`): calling
  one indexes into `nil` rather than erroring, as lil does for any undefined name.
- Deck primitives (`go`, `transition`, `brush`, `sleep`, `play`): they need a live deck. Lilt
  doesn't have them either.
- Some `sys`/`app` fields may error where they reach into decker.js-only state.

Interpreter state (variables, `_`) lasts one page load; sessions are history, not environments.
