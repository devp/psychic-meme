# lilt-repl

A browser-based, offline-friendly REPL for [Lil](https://beyondloom.com/decker/lil.html),
the scripting language behind [Decker](https://beyondloom.com/decker/). Built as a mobile-first
alternative to the [Lilt](https://beyondloom.com/decker/lilt.html) command-line REPL, optimized
for a phone in portrait mode.

Open `index.html` (or the deployed URL) and start typing lil expressions. It's a static site with
no build step and no server-side component -- everything, including the interpreter and the
language reference docs, is vendored locally so it keeps working after the first load, even
offline (add it to your home screen for the full effect).

## What's here

- `index.html`, `style.css`, `app.js` -- the REPL shell: tabs, themes, the input/output log.
- `interpreter.js` + `vendor/lil.js` -- wraps the vendored Lil interpreter (from
  [JohnEarnest/Decker](https://github.com/JohnEarnest/Decker)) for browser use.
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
"cli" is background on the original command-line Lilt REPL this one is modeled after; "decker"
is the full reference for the platform Lil scripts normally run inside of (cards, widgets,
events, and so on) -- useful context even though this REPL only evaluates bare Lil expressions,
not full decks.

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
