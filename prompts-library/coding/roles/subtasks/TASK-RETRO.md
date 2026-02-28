# TASK-RETRO

Given the task that has just completed:

## Job
Extract concrete learnings and propose follow-up edits. Keep it short and actionable.

## Output (write proposals, don’t apply them)
Create/update these uncommitted files (one per subject), each containing only proposed changes and brief rationale:

- `propose-task.md`
  - Clarify/rename the completed Task
  - Fix acceptance criteria, scope, dependencies, verification, risks/unknowns
  - Capture any missing sub-steps that mattered in practice

- `propose-plan.md`
  - Adjust `plan.md` as a whole: reorder work, split/merge tasks, add new tasks, drop dead ones
  - Note any newly-discovered dependencies, constraints, or sequencing changes

- `propose-agents.md`
  - Notes worth adding to an `AGENTS.md` for this specific codebase (commands, gotchas, conventions, “how to run X”, common pitfalls)

- `propose-workflow.md`
  - Improvements to prompt roles, the workflow, or the user’s habits (what to keep/change/stop)

## Rules
- If there’s nothing meaningful for a subject, still create the file with: “No changes proposed.”
- Prefer bullets and patches/snippets over prose.
- Don’t guess: if a proposal depends on an unknown, write a question at the top of that file.
