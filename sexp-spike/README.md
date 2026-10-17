# sexp-spike

Throwaway UI spike: a phone-first, node-aware editor for Fennel. You tap a form to focus it,
tap again to widen to the enclosing form, and use the action bar for structural edits
(wrap / splice / raise / slurp / barf). You can eval the focused subform inline and pick parts
of a result back into the editor.

It's one file, `index.html`. It borrows Fengari and Fennel from `../pizza-repl-fennel/vendor/`.
It exists to try the interaction model before deciding on a "structural" input mode for
[pizza-repl-fennel](../pizza-repl-fennel). Pick a case from the dropdown; each one lists steps
to try.
