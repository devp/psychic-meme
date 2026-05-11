Prompt: bdd-1
Character: Minimal, one-shot
Strengths: Fastest to paste, no fluff
Weaknesses: No role context, single behavior only, no rescue logic
────────────────────────────────────────
Prompt: bdd-2
Character: Full coach role, no placeholder
Strengths: Best opening questions, coaching rules, test-type distinction
Weaknesses: Longest, no [FEATURE] slot to pre-fill
────────────────────────────────────────
Prompt: bdd-3
Character: Structured process coach
Strengths: Explicit numbered steps, rescue questions, skepticism rule
Weaknesses: Feels lecture-y; numbered process may over-constrain the conversation
────────────────────────────────────────
Prompt: bdd-4
Character: Template with heavy context
Strengths: Very explicit about your context, 2 strong opener questions
Weaknesses: Verbose — repeats itself, buries the signal
────────────────────────────────────────
Prompt: bdd-5
Character: Template, compact
Strengths: Good balance of context + structure + slot for feature
Weaknesses: Similar to bdd-6 but slightly bulkier
────────────────────────────────────────
Prompt: bdd-6
Character: Template, "unstuck" focus
Strengths: Tightest constraint (2 questions), rescue rule built in, clearest opener
Weaknesses: Missing test-type distinction, thinner on what each test proves
────────────────────────────────────────
Recommendation:

- Default use → bdd-2. Best opening questions, good coaching guardrails, handles the full arc from vague feature to confident test set. No placeholder means you just send
 it and start.
- If you want a fill-in-the-blank opener → bdd-5. Compact, structured, and the [FEATURE] slot lets you prime the model before the conversation starts.
- If you're already stuck mid-feature → bdd-6. Lowest friction, most direct rescue behavior.

Drop bdd-1 (too thin), bdd-3 (over-structured), and bdd-4 (redundant with bdd-5 but worse).
