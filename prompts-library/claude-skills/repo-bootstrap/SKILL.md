---
name: repo-bootstrap
description: Bootstrap a repo's local dev environment from scratch by actually running commands and verifying each step live, then write the results into a personal recipe store (init/up/down/status + NOTES.md) so the next setup is one command. Use when spinning up a repo you haven't set up before, or re-verifying a recipe that might be stale. Invoke from inside the target repo's own checkout (cwd = that repo).
---

# repo-bootstrap

Get one repo running locally, verify it for real, document what actually worked. Do not
trust old notes as fact — treat them as hints to investigate, nothing more.

## Where things live

- **Recipe root**: wherever you keep per-repo setup recipes, e.g. `~/code/repo-recipes/`
  or a `repo-recipes/` folder inside a dotfiles repo. If you don't have one yet, pick a
  location and create it on first use. If it has a `README.md`, read that first — it's
  the contract this skill follows for that root.
- **Target repo**: the directory you were invoked from (`cwd`). Determine its name from
  `git rev-parse --show-toplevel` (basename).
- The recipe dir for this run is `<recipe-root>/<repo-name>/`. If it doesn't exist yet,
  create it with `init`/`up`/`down`/`status` stubs + `NOTES.md`, matching the shape of an
  existing recipe in that root if one exists (copy its structure), otherwise use a
  minimal default:
  - `init` — one-time setup (install deps, create `.env`, pull images, etc.)
  - `up` — start whatever needs starting. For a long-running service, this is the
    server/containers. For a CLI or library with nothing to run persistently, this step
    may be a no-op — say so in `NOTES.md` rather than forcing one.
  - `down` — stop/tear down (also a no-op if `up` was)
  - `status` — however you'd confirm "this works": health check for a service, test
    suite for a library, a sample invocation for a CLI. Not every repo has all three.
  - `NOTES.md` — running log of what was tried, what worked, what didn't, and why

## Interpreter/toolchain conventions

If you have a standing convention for a language (e.g. "always use `uv` to pin Python,
never brew/system python", "always use the repo's `.nvmrc` via `nvm`"), apply it here too
— but don't invent one. If the recipe root's `README.md` documents a convention, follow
it. If it doesn't and none is obvious, ask rather than assume.

## Procedure

1. **Read the target repo's own setup docs first** — README, CONTRIBUTING, Makefile,
   `docker-compose.yml`, `pyproject.toml`/`package.json` scripts. This is the primary
   source of truth, not anything in the recipe root.
2. **Check the recipe dir for prior art** — existing `init`/`up`/`down`/`status`,
   docker-compose overrides, and `NOTES.md`'s historical-hints section. Prior art may be
   stale, generic boilerplate, or simply wrong — verify before reusing.
3. **Attempt each step for real.** Run it, read the actual output/error, fix forward. Do
   not write a step down as working until you watched it work.
4. **Log as you go, not just at the end.** Every workaround goes into `NOTES.md`
   immediately, with the *why* (what failed, what you tried, what fixed it) — not just the
   final command.
5. **Promote to `init`/`up`/`down`/`status` only once verified.** Ideally verify from a
   clean state (fresh clone or `down` then `up`) before calling a step canonical.

## Guardrails — stay in scope

- **Touch only:** the target repo's untracked/gitignored local state (`.env`, venv, docker
  volumes, local DB) and the recipe dir under the recipe root.
- **Never edit the target repo's own tracked/committed files.** Folding a verified recipe
  back into that repo's actual README/Dockerfile/CI is a deliberate, separate, manual step
  the human does later — explicitly out of scope here. If you're tempted to "fix their
  README while you're in there," don't — flag it in `NOTES.md` instead.
- **Never touch global machine config** (shell rc files, dotfiles-managed files, global
  package installs) without stopping and asking the human first.
- **One scenario only.** If the repo has multiple ways to run (docker vs bare-metal,
  multiple sandbox modes), document the one you got working and note the others exist in
  `NOTES.md` — don't try to build every scenario in one pass.

## Definition of done — both required, don't skip either

1. **Human-confirmed access.** Ask the human to verify it themselves, in whatever form
   fits this repo: hit an endpoint, load it in a browser, run the CLI against sample
   input, import the library in a scratch script. Do not infer "it's working" from your
   own `curl`/log output — ask.
2. **Verification step runs.** Actually execute whatever this repo uses to prove
   correctness — test suite, lint+typecheck, a smoke script — via `status` or a
   documented step, and report the real result (pass, or a named known-failure). If the
   repo genuinely has no such step, say so explicitly in `NOTES.md` instead of skipping
   silently.

Only after both are confirmed, mark the checklist in `NOTES.md` done and summarize what
changed in `init`/`up`/`down`/`status`.
