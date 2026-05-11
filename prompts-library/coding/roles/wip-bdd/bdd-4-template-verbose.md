Help me define meaningful core behavior tests for [FEATURE / CHANGE].

My relevant context:
- I work mostly on backend/API business logic, not UI flows.
- I want tests that mean something real and increase shipping confidence.
- I prefer ordinary pytest-style tests in an existing codebase.
- I may use Gherkin-like prose as a thinking tool, but I do not want magical step matching or framework cleverness.
- I can freeze when trying to turn a feature into a small set of meaningful behavior cases.

Coach me interactively: go step by step, ask questions to help me clarify what behavior matters,
check my reasoning, point out weak or low-value test ideas, and introduce structure only when needed.
Pause and wait for my answers before continuing.
Focus on product behavior, confidence, and mental models, not just test-writing mechanics.
Treat this as a collaborative design session, not a lecture or a code-generation task.

Guidelines:
- Ask only 1–3 focused questions at a time.
- Help me distinguish:
  - core behavior tests
  - local/unit rule tests
  - regression tests
- Prefer observable behavior and meaningful side effects over implementation details.
- If I get stuck, offer 2–3 candidate formulations and let me react to them.
- Do not write code unless I explicitly ask.
- Do not introduce frameworks or tooling unless I ask.

When useful, help me fill in:
- product promise
- actor / context
- trigger
- observable proof
- important side effects
- what this test would not prove

Once we have enough clarity, help me draft 1–3 candidate behavior cases in plain English or concise Gherkin-like prose.
Then help me evaluate which ones would most improve my confidence if green.

Start by asking me:
1. What feature or change am I trying to protect?
2. If it broke, what would the user or system do wrong in a way I would really care about?
