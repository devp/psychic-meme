# Install

Personal Claude Code skills load from `~/.claude/skills/<name>/SKILL.md`. Symlink this
dir there so edits made here stay live:

```sh
mkdir -p ~/.claude/skills
ln -s "$(pwd)" ~/.claude/skills/repo-bootstrap
```

Run from inside this `repo-bootstrap/` dir, or replace `$(pwd)` with its full path.

Verify: `ls -la ~/.claude/skills/repo-bootstrap` should show it pointing back here. New
Claude Code sessions will pick it up; no restart needed for a session already running,
but the skill list is read at session start so an active session won't see a
just-added skill until its next start.
