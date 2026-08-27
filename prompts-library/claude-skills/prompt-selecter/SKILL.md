---
name: prompt-selecter
description: >
  Pick one or more prompt files from a library directory, concatenate them,
  and adopt the result as operating instructions for the rest of the
  session. Trigger on /prompt-selecter or "load a prompt", "start from a
  library prompt", "pick a prompt from the library".
---

# Prompt Selecter

## Input
Optional directory argument, relative to the prompts-library root
(e.g. `tech`, `coding`, `manual-prompts`). Default: the prompts-library
root itself, recursing into subdirectories.

## Process
1. Glob `*.md` under the target directory. If a directory arg was given,
   search it non-recursively; with no arg, recurse. Exclude `README.md`
   and any `SKILL.md`.
2. Show a numbered list: index, path relative to the target dir, and the
   first heading or first non-empty line of each file.
3. Ask which to load. Accept indices or names, more than one, and keep the
   order the user gives them.
4. Read each pick and concatenate in that order, with a `---` line between
   files.
5. Echo back a one-liner: how many files, rough word count, and their
   names in load order.
6. Adopt the concatenated text as the authoritative operating instructions
   for the rest of the session. A later explicit user request overrides it.

## Notes
- More than 4 picks is fine — this is a chat list, not AskUserQuestion.
- If the target directory has no matching `.md`, say so and list the
  subdirectories that do contain one.
- This does not and cannot replace the system prompt; it changes how you
  operate from here on, nothing lower-level.
