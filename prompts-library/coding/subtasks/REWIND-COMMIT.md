# REWIND-COMMIT

Use this when the Red/Green/Refactor loop went astray in a specific commit.
This is an exception-path subtask: stop forward progress, rewind safely, then resume at RED.

## Inputs (minimal)
- `X`: the commit that went wrong (hash, or a precise description like “the GREEN commit after RED #3”)
- `GOOD`: the last known-good commit before `X` (hash, or a precise description)
- History policy:
  - sandbox/local only (not pushed / not shared): history rewrite is OK
  - pushed/shared: history rewrite is NOT OK; must revert

## Job
1) Stop the loop; do not continue with new work.
2) Confirm `GOOD` (last commit where intent was correct and tests behaved as expected).
3) Create a safety pointer at current `HEAD` (backup branch) so nothing is lost.
4) Ask loop of questions to clarify what went wrong and what the understanding/spec.
5) Correct task to go forward.
6) Given the user a command to run to go back to GOOD (but let them execute it).
7) Re-run the smallest relevant test command to confirm we’re back to the expected baseline.

Continue the rest of development from here.
