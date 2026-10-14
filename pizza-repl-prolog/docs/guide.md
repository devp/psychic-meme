# Prolog in this REPL

A Prolog program is facts and rules. You don't run it; you ask it things, and
it searches for every way to make your question true.

## Program text and queries

An entry is read like a Prolog file. Clauses join the program:

```
parent(tom, bob). parent(bob, ann). parent(bob, pat).
anc(X, Y) :- parent(X, Y).
anc(X, Y) :- parent(X, Z), anc(Z, Y).
```

Each run reports what it defined, e.g. `anc/2: 2 clauses`.

A line starting with `?-` is a query:

```
?- anc(tom, Who).
```

The final `.` is optional: Enter ends the entry, and so does a blank line.
`?-` and `;` are on the ⋯ key.

## Answers, and asking for more

Prolog prints each way it found to make the query true, one per line:

```
Who = bob ;
Who = ann ;
Who = pat ;
false.
```

`;` after an answer means "there may be more". `false.` means the search ran
out. An answer ending in `.` was the last one. `true.` is a yes with nothing to
bind; `false.` alone is a no.

You get up to 10 answers per entry. If there may be more, the last line is
`(; for more)`: enter `;` on its own to continue the same search.

## Redefining a predicate

Entering clauses for a predicate replaces its earlier clauses, so you can fix a
rule by entering it again. To build one up across entries, put all its clauses
in one entry (one line is fine: `p(1). p(2). p(3).`), or declare it dynamic and
add to it with `assertz`:

```
:- dynamic counter/1.
?- assertz(counter(0)).
```

Built-in and library predicates can't be redefined. That error usually means a
query is missing its `?-`: `X = 1.` on its own would be a clause defining `=`.

## Directives

`:- dynamic foo/1.`, `:- op(700, xfx, ===>).`, and the like are directives: they
take effect as the clause is read. Any other `:- Goal.` runs as a query.

## Output

`write/1`, `writeln/1`, `print/1`, `nl/0` and `format/2` print above the answers:

```
?- member(X, [a, b]), format("got ~w~n", [X]).
```

There's no keyboard input: `read/1` sees `end_of_file`.

## When a query runs away

Each entry gets a million inferences (about half a second). A query that's still
searching after that stops with a note; enter `;` to give it another million.

```
loop :- loop.
?- loop.
```

## Libraries

Preloaded: `lists` (`append/3`, `member/2`, `length/2`, `nth0/3`, `msort/2`,
`sum_list/2`, `maplist/2..8`, `foldl/4..8`, ...), `format`, `charsio`, `random`,
`statistics` (`time/1`), plus `writeln/1`, `print/1`, `plus/3` and `memberchk/2`.
The builtins tab lists everything.

`?- listing.` shows your program; `?- listing(anc/2).` shows one predicate.

## Strings

`"abc"` is a list of characters, `[a,b,c]`. For an atom, use single quotes:
`'Hello world'`.

## This Prolog

The engine is [Tau Prolog](http://tau-prolog.org), mostly ISO. Coming from
SWI-Prolog: no string type, no `format(atom(A), ...)`, no `>>` lambdas, no
tabling or `clpfd`, and no libraries beyond the preloaded ones.

## Exports

The log tab's 📋 copies a session as a Prolog file: your entries, with the
answers they gave as `%` comments. Paste it back as one entry to rerun it.
