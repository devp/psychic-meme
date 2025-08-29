Implement a script, `git-llm-annotate`, which amends a commit with context about LLM codegen.

`git-llm-annotate [-l, --llm-name <llm-name>] [-M, --mode <mode-string>] [<commit-hash>]`

- `<commit-hash>` if not provided, defaults to HEAD
- `<llm-name>` if not provided, checks an appropriate value in git config for a default string, else defaults to "LLM"
- `<mode-string>` optional

The script them executed a `git amend` command with this argument:

1. Change the author to "{llm-name} (as {git config user.name}) <{git config user.email}>" (so that it appears in `git blame`).
2. Add a git-trailer to the end: `AI-Generated: {llm-name}`
3. If `mode-string` provided, add a git-trailer to the end: `AI-Generated-Mode: {mode-string}`
