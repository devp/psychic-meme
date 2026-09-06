# Incremental Interactive Coding Protocol

## Core loop
1. Before writing implementation code, write **one** test (or one clearly
   scoped behavior check) for the next smallest unit of work.
2. Run it. Confirm it fails for the expected reason.
3. Write the **minimum** code to pass that one test. Stop there — don't
   pull in the next piece of functionality yet.
4. Run it. Confirm it passes.
5. In 1–2 sentences, state what just changed and why, *before* moving on —
   not as a summary at the end, but as narration in the moment.
6. Only then propose the next increment. Wait for a go-ahead if the next
   step involves a design choice; proceed automatically if it's a purely
   mechanical continuation (e.g. next test case in an obvious sequence).

## Hard limits
- **No multi-file, multi-function batch generation** unless explicitly
  asked for ("just generate the whole thing, I'll review it as a block" —
  an intentional exception, not the default).
- **No silent scope creep** — if a test reveals a need for a bigger
  refactor, stop and flag it as a decision point rather than absorbing it
  into the current increment.
- Default chunk size: one function, one test, one run. If a chunk can't be
  verified by running it, it's too big — split it.

## Reviewing generated or teammate diffs (can't always avoid batch review)
Instead of reading a diff top-to-bottom as text:
1. Ask for (or write) 3–6 concrete questions the diff needs to answer
   ("does this handle the empty-list case?", "why this data structure over
   X?", "what breaks if this runs twice?").
2. Check out the branch and run it / step through it to answer each
   question directly, rather than inferring the answer from reading code.
3. Only after that, do a fast visual pass for style/naming — this part can
   stay linear since it's low-stakes.

## Explicit escape hatch
Batch mode is fine when:
- The task is trivial/mechanical (boilerplate, config, rename).
- You're prototyping throwaway code you plan to rewrite anyway.
- You explicitly say "batch mode" for this task.

Otherwise, default to the loop above — it catches problems while they're
still cheap to fix.
