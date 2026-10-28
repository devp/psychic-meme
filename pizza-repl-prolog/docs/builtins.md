# Builtins

Every predicate this REPL starts with, by where it comes from. Names only: for
what one does, the ISO standard and SWI-Prolog's manual mostly agree with Tau.

## system

Built into the engine.

`->/2`, `;/2`, `!/0`, `@</2`, `@=</2`, `@>/2`, `@>=/2`, `*->/2`, `\+/1`, `\=/2`, `\==/2`, `</2`, `=:=/2`, `=../2`, `=/2`, `=\=/2`, `=</2`, `==/2`, `>/2`, `>=/2`, `abolish/1`, `acyclic_term/1`, `arg/3`, `asserta/1`, `assertz/1`, `at_end_of_stream/0`, `at_end_of_stream/1`, `atom_chars/2`, `atom_codes/2`, `atom_concat/3`, `atom_length/2`, `atom/1`, `atomic_concat/3`, `atomic_list_concat/2`, `atomic_list_concat/3`, `atomic/1`, `bagof/3`, `between/3`, `call_cleanup/2`, `call/1`, `call/2`, `call/3`, `call/4`, `call/5`, `call/6`, `call/7`, `call/8`, `callable/1`, `catch/3`, `char_code/2`, `clause/2`, `close/1`, `close/2`, `compare/3`, `compound/1`, `consult/1`, `copy_term/2`, `current_input/1`, `current_module/1`, `current_op/3`, `current_output/1`, `current_predicate/1`, `current_prolog_flag/2`, `downcase_atom/2`, `fail/0`, `false/0`, `findall/3`, `findall/4`, `float/1`, `flush_output/0`, `flush_output/1`, `forall/2`, `functor/3`, `get_attr/3`, `get_byte/1`, `get_byte/2`, `get_char/1`, `get_char/2`, `get_code/1`, `get_code/2`, `get_time/1`, `goal_expansion/2`, `ground/1`, `halt/0`, `halt/1`, `integer/1`, `is_list/1`, `is/2`, `keygroup/2`, `keysort/2`, `license/0`, `listing/0`, `listing/1`, `nl/0`, `nl/1`, `nonvar/1`, `number_chars/2`, `number_codes/2`, `number/1`, `numbervars/3`, `once/1`, `op/3`, `open/3`, `open/4`, `peek_byte/1`, `peek_byte/2`, `peek_char/1`, `peek_char/2`, `peek_code/1`, `peek_code/2`, `phrase/2`, `phrase/3`, `predicate_property/2`, `put_attr/3`, `put_byte/1`, `put_byte/2`, `put_char/1`, `put_char/2`, `put_code/1`, `put_code/2`, `read_term/2`, `read_term/3`, `read/1`, `read/2`, `repeat/0`, `retract/1`, `retractall/1`, `set_input/1`, `set_output/1`, `set_prolog_flag/2`, `set_stream_position/2`, `setof/3`, `setup_call_cleanup/3`, `sort/2`, `stream_position_data/3`, `stream_property/2`, `sub_atom/5`, `subsumes_term/2`, `succ/2`, `term_variables/2`, `term_variables/3`, `throw/1`, `time_month/2`, `time_property/2`, `time_year/2`, `true/0`, `unify_with_occurs_check/2`, `upcase_atom/2`, `var/1`, `version/0`, `write_canonical/1`, `write_canonical/2`, `write_term/2`, `write_term/3`, `write/1`, `write/2`, `writeq/1`, `writeq/2`

## lists

library(lists), preloaded.

`append/2`, `append/3`, `drop/3`, `exclude/3`, `foldl/4`, `foldl/5`, `foldl/6`, `foldl/7`, `foldl/8`, `foldr/4`, `foldr/5`, `foldr/6`, `foldr/7`, `foldr/8`, `include/3`, `last/2`, `length/2`, `list_to_set/2`, `maplist/2`, `maplist/3`, `maplist/4`, `maplist/5`, `maplist/6`, `maplist/7`, `maplist/8`, `max_list/2`, `member/2`, `min_list/2`, `msort/2`, `nth0/3`, `nth0/4`, `nth1/3`, `nth1/4`, `permutation/2`, `prefix/2`, `prod_list/2`, `replicate/3`, `reverse/2`, `select/3`, `sum_list/2`, `take/3`

## format

library(format), preloaded.

`format_/4`, `format/2`, `format/3`

## charsio

library(charsio), preloaded.

`write_term_to_chars/3`

## random

library(random), preloaded.

`get_seed/1`, `maybe/0`, `maybe/1`, `random_between/3`, `random_member/2`, `random_permutation/2`, `random/1`, `random/3`, `set_seed/1`

## statistics

library(statistics), preloaded.

`statistics/0`, `statistics/2`, `time/1`

## compat

SWI-Prolog staples Tau lacks, defined in lang.js.

`memberchk/2`, `plus/3`, `print/1`, `writeln/1`
