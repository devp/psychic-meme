# pizza-repl-fennel

A [Fennel](https://fennel-lang.org) REPL for pizza rats: in your phone browser, or installed to
the home screen, offline. Fennel's compiler runs on [Fengari](https://fengari.io) (Lua 5.3 in
JS); both, and the reference docs, are vendored.

Built on [pizza-starter](../pizza-starter) (see `STARTER`). Sibling: [pizza-repl-lil](../pizza-repl-lil).

## Try it

```
(+ 1 2)
(local x 10)              ; locals persist between entries
(* x 2)
(+ *1 1)                  ; *1 *2 *3 are recent values
(fn sq [n] (* n n))
(sq 7)
(each [_ v (ipairs [1 2 3])] (print (* v v)))
{:a 1 :b [1 2]}
,help
```

Tabs: `reference`, `tutorial`, and `lua` (the Lua primer) are Fennel's own docs; `learnx` is
[Learn X in Y minutes](https://learnxinyminutes.com/fennel/)' Fennel page. The round
button on a doc tab jumps to a section. `log` keeps sessions: rename, delete, or copy one as
commented Fennel that pastes back in and reruns.

## Layout

The language is `lang.js` + `vendor/fengari-web.js` + `vendor/fennel.lua` + `docs/`. Everything
else is the REPL shell, identical to [pizza-repl-lil](../pizza-repl-lil)'s; `diff -r` shows the
seam. See that README for the file table.

`lang.js` drives Fennel's own `fennel.repl` in a Lua coroutine: `readChunk` yields back to JS,
and each entry resumes it. So REPL semantics (locals, `*1`, `,doc`) are Fennel's, not
reimplemented, and pasting an export replays form by form.

Completions come from the same repl: `BOOT` keeps the completer `fennel.repl` hands to
`registerCompleter` (the one behind `,complete`) and `complete()` calls it directly, so nothing
is read and `*1` and line counts stay put. The shell shows them in a strip above the key row
from the second character of a symbol (tap to replace it, Tab on a keyboard), and skips the
strip for a `lang.js` with no `complete`. Options turns it off.

`just serve`, `just dev-check` (`just dev-init` once), `just warnings`. Add or remove a file:
update `ASSETS` in `sw-assets.js`.

## Known gaps

- No filesystem: no `io`, no `os.execute`; `require` can't load files. `print` goes to the log.
- An unclosed `(`, `[`, `{` or string is refused before it reaches the repl — phone Enter always
  runs, so there's no continuation prompt. Put a multi-line form on one line, or close it.
- Interpreter state lasts one page load; sessions are history, not environments.
- Error positions count lines across the whole page load, not per entry (Fennel's reader
  sees one stream).
