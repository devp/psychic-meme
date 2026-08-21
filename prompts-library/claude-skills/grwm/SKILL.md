---
name: grwm
description: >
  Morning briefing. Pulls work journal + task list + calendar, surfaces one best-impact
  AM move plus today's focuses. Use when user runs /grwm or asks "what should I work on
  this morning" / "help me plan today". Inputs are all optional — Todoist/Google Calendar
  MCP if connected, pasted journal/agenda text otherwise, or just ask the user directly.
---

# grwm

Morning planning pass: journal + tasks + calendar in, one AM-impact pick + short focus
list for today out.

## Inputs — gather what's available, don't block on missing ones

- **Work journal** — most recent entries, pasted markdown/text (or a file path if given).
  Carries yesterday's loose threads, open questions, half-finished thoughts.
- **Task list** — Todoist MCP (`mcp__claude_ai_Todoist__get-overview` or
  `find-tasks-by-date` for today/overdue) if connected. Else ask user to paste it.
- **Calendar** — Google Calendar MCP (`list_events` for today) if connected. Else ask, or
  skip if user says no meetings.

Don't demand all three. If only the journal is pasted, work from that and ask 1-2 quick
questions to fill gaps (what's due today, any meetings).

## Procedure

1. Pull whatever inputs are available (parallel MCP calls where possible).
2. Cross-reference: overdue/due-today tasks, calendar gaps, journal threads still open.
3. Pick **one AM-impact move** — high-leverage, fits before meetings eat the day.
   Priority order: overdue > blocking someone else > journal thread already in motion >
   new task.
4. List **2-4 focuses for today** — not a full task dump, just what's realistic given the
   calendar load.
5. Flag anything time-boxed (meeting prep, EOD deadline) that needs a slot.
6. Check for a LOOP — a pattern visible across journal entries / task history, not a
   single day's snapshot. Only surface if genuinely visible; skip silently otherwise.

## LOOP detection

State plainly if seen — "X has been [state] since [date]" or "Y has not been completed."
No advice attached.

Patterns to watch for:
- big rock left undecided across multiple entries
- P0/overdue label persisting without movement
- Monday check-in or Friday self-check-in left incomplete (flag on that day of week)
- EOD reflection skipped
- side work (tooling, env setup, optimization) consuming time repeatedly instead of the
  stated priority
- a design decision revisited after it was already treated as settled

## Output

AM pick first, then focus list, then deadline flags, then LOOP (if any). No recap of
inputs, no "here's what I found" preamble.

## Guardrails

- Read-only against Todoist/Calendar — never create, update, or complete tasks/events
  unless explicitly asked.
- Don't invent tasks or events not present in the actual inputs.
