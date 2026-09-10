# pizza-repl

A REPL for pizza rats. For trying out some languages in your phone browser/PWA, with
affordances for the phone in your pocket. Runs decker-lil today, more stuff in the future.

Open `index.html` (or the deployed URL) and start typing. It's a static site with no build step
and no server-side component -- everything, including the interpreter and the language reference
docs, is vendored locally so it keeps working after the first load, even offline (add it to your
home screen for the full effect).

**Not affiliated with Decker.** [Lil](https://beyondloom.com/decker/lil.html) and
[Decker](https://beyondloom.com/decker/) are by John Earnest. This is an unofficial browser REPL
built on his MIT-licensed interpreter — it is *not* [Lilt](https://beyondloom.com/decker/lilt.html),
his real command-line REPL, and doesn't have Lilt's filesystem or CLI bindings.

## What's here

The shell is deliberately only loosely tied to lil: the entire contract between it and the
language is one function (`window.lilRepl.evaluate(source)` → `{text, isError}`), which is what
makes "more stuff in the future" plausible without a rewrite.

- `index.html`, `style.css`, `app.js` -- the REPL shell: tabs, themes, the input/output log.
- `interpreter.js` + `vendor/lil.js` -- wraps the vendored Lil interpreter (from
  [JohnEarnest/Decker](https://github.com/JohnEarnest/Decker)) for browser use. This is the
  language-specific layer; swapping it is most of what a second language would take.
- `transcripts.js` -- autosaves REPL sessions to `localStorage`; the "log" tab lets you name,
  view, and delete them.
- `docs/`, `docs.js`, `vendor/marked.min.js` -- the Lil language reference, quick reference,
  Lilt CLI docs, and the full Decker platform reference, rendered client-side for offline
  reading.
- `manifest.webmanifest`, `sw.js`, `icons/` -- installable/offline support.

See `NOTICE.md` for third-party attributions.

## Try it

A few things to type into the repl tab to get a feel for it:

```
1+2
r:10
r*2
_+1                       # _ is always the last result
show[1,2,3]
each x in 1,2,3 print[x*x] end
on greet name do "hi " + name end
greet["world"]
```

The "lil" and "quickref" tabs have the full language reference if you get stuck on syntax;
"cli" is background on Earnest's command-line Lilt REPL, which this one borrows its shape from
(the tab carries a note that its CLI-specific features don't exist here); "decker"
is the full reference for the platform Lil scripts normally run inside of (cards, widgets,
events, and so on) -- useful context even though this REPL only evaluates bare Lil expressions,
not full decks. On any doc tab, the small round button in the bottom corner opens a
jump-to-section list -- handy since an installed home-screen app has no browser chrome, so
there's no native find-in-page.

## Known gaps

`interpreter.js` registers the same primitives as Decker's own Lilt CLI (`js/repl.js`) --
`print`, `show`, `random`, `array`, `image`, `sound`, `keystore`, `eval`, csv/xml helpers, plus
the language's built-in constants. It deliberately leaves out:

- Filesystem/OS bindings (`read`, `write`, `dir`, `shell`, `exit`, `import`, `newdeck`) -- there's
  no filesystem to talk to in a browser. Calling one of these just indexes into `nil` rather than
  erroring, matching how lil treats calls to undefined names.
- Full Decker document primitives (`go`, `transition`, `brush`, `sleep`, `play`) -- those need a
  live deck/card context this REPL doesn't have. The real Lilt CLI doesn't have them either.
- A couple of `sys`/`app` interface fields may error if they reach into decker.js-only state
  (this REPL only vendors `lil.js`, not the full Decker runtime).

None of this should surprise you if you've used Lilt before -- it's meant to behave the same way,
minus the parts that need a filesystem or a deck.

## Suggested next steps

Roughly in order of "cheapest win first":

- Syntax highlighting in the input textarea (or at least in echoed prompts) -- lil's terse
  syntax would benefit from it more than most languages.
- Tab-complete or a quick-reference popover for built-in function names while typing.
- Export a transcript (as `.txt` or `.lil`) instead of just viewing it in-app, for pasting into a
  real Decker deck.
- Keyboard niceties: up-arrow to recall previous input, a shortcut to jump to the log tab.
- Multiple concurrent "scratch" environments (right now there's one persistent `env` per page
  load -- starting a new session in the log tab doesn't currently reset bound variables, only
  the visible history).
- Surface parse errors inline in the textarea (caret position under the offending character)
  instead of only in the result line below.
- Add real app icons (PNG, not just the SVG) if this ever needs a proper iOS home-screen icon.
