# sexp-spike

Throwaway UI spike: a phone-first, node-aware editor for Fennel. You tap a form to focus it,
tap again to widen to the enclosing form, and use the action bar for structural edits
(wrap / splice / raise / glom / yeet). You can eval the focused subform inline and pick parts
of a result back into the editor.

v2: the editor is the file, and eval never clears it. The action row changes with the focused
node, and the nav row is ← in out → + λ. The keyboard only comes up while you type. λ inserts a
template with ▢ holes, and each ⏎ fills one and moves to the next.

It's one file, `index.html`. It borrows Fengari and Fennel from `../pizza-repl-fennel/vendor/`.
It exists to try the interaction model before deciding on a "structural" input mode for
[pizza-repl-fennel](../pizza-repl-fennel). Pick a case from the dropdown; each one lists steps
to try.
