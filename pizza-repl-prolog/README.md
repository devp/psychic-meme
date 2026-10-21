# pizza-repl-prolog

A Prolog REPL for pizza rats: in your phone browser, or installed to the home screen, offline.
Runs [Tau Prolog](http://tau-prolog.org), vendored.

Built on [pizza-starter](../pizza-starter) (see `STARTER`). Siblings: [pizza-repl-lil](../pizza-repl-lil),
[pizza-repl-fennel](../pizza-repl-fennel).

## Try it

```
parent(tom, bob). parent(bob, ann). parent(bob, pat).
anc(X, Y) :- parent(X, Y).
anc(X, Y) :- parent(X, Z), anc(Z, Y).
?- anc(tom, Who).
?- between(1, 100, X).
;
?- listing.
```

An entry is read like a Prolog file: clauses join the program, `?-` runs a query, `;` asks it
for more. Docs (one tab; tap it again to switch): `guide` (this REPL's conventions), `learn`
(Learn X in Y minutes' Prolog page, itself a program you can paste in), and `builtins` (every
predicate it starts with). `log` keeps sessions: rename, delete, or copy one as a Prolog file that pastes back in and reruns.

## Layout

The language is `lang.js` + `vendor/tau-prolog.js` + `docs/`. Everything else is the REPL
shell from [pizza-repl](../pizza-repl) (see `STARTER-LAST-UPDATED`), whose README has the
`lang.js` contract and the file table.

`lang.js` splits each entry into clauses with Tau's own tokenizer. Runs of program clauses are
consulted per paragraph, so re-entering a predicate replaces it and an export (entries
separated by blank lines) replays entry for entry. Queries don't use Tau's `answer()`, which
calls back via `setTimeout`: `nextAnswer()` runs Tau's search loop synchronously, so the shell's
`evaluate()` stays sync.

`vendor/tau-prolog.js` is Tau's `core lists format charsio random statistics` modules,
unmodified and concatenated, from GitHub master at 5bd606a2: 0.3.4 on npm predates a DCG
translation fix. `docs/builtins.md` is generated: `node scripts/builtins-doc.mjs`.

`just serve`, `just dev-check` (`just dev-init` once), `just warnings`. Add or remove a file:
update `ASSETS` in `sw-assets.js`.

## Known gaps

- Up to 10 answers and a million inferences per entry; `;` continues either.
- No keyboard input (`read/1` sees `end_of_file`), no files, no libraries beyond the preloaded.
- Built-in and library predicates can't be redefined (a guard in `lang.js`; Tau would allow it).
- Defining `term_expansion/2` or `goal_expansion/2` is refused: once either exists, Tau consults
  and queries through `setTimeout`. (`assertz` of one isn't caught.)
- `:- initialization(G).` isn't a directive here: it runs as a goal, and errors.
- Interpreter state lasts one page load; sessions are history, not programs.
