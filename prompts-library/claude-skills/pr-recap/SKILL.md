---
name: pr-recap
description: >
  Generate a screen-free audio-recap transcript for a set of commits or PRs,
  for listening away from the screen and driving handwritten review notes.
  Trigger when the user asks for a "recap", "audio summary", or "PR recap"
  for specific commits, SHAs, or PR numbers.
---

# PR Recap Generator

## Input
A list of commit SHAs or PR numbers/branches, provided by the user.

## Process
1. For each commit/PR, run `git show`, `git diff`, or `gh pr diff` as needed
   to get the actual change content. Do not ask the user to paste diffs.
2. For each one, produce:
   - One-sentence framing: what changed and why (intent, not mechanics).
   - What's structurally risky or non-obvious — the thing easy to miss skimming.
   - One specific thing to check on-screen before approving (a file, a
     line range, a test, a behavior).
3. Close by saying, in spoken prose (not a list), which items need
   eyes-on-screen first and which are safe to rubber-stamp.

## Output format — CRITICAL
This text will be read aloud via TTS. The user will take handwritten notes
while listening, not looking at a screen.
- Short sentences. Spoken-style transitions ("Next up...", "Second thing
  worth flagging...").
- No code blocks, no diff excerpts, no tables, no bullet-heavy variable
  lists — anything meant to be visually scanned.
- Write it as if narrating to someone who can't see the screen.

## Output location
Write the final transcript to `/tmp/transcript.txt` (plain text, no
markdown formatting characters — no `#`, `*`, backticks) unless the user
specifies another path.
