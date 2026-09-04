---
distill:
  id: core
  always: true
  pulls: []
---
# core

Project-wide rules that apply to every path.

## Invariants

- File is `<git-common-dir>/bouncer/current` — never `.bouncer/current`. JSON is `{ blueprint, task?, base }` where `task` is a repo-relative path string; CLI presents `task` as `{ path, id }` or `null`. `/bouncer-execute`'s brief is `current.task.path` when set.

## Gotchas

- `affected_paths` as a wide directory (e.g. `scripts`) overlaps Do not touch paths under it and fails G12 — prefer per-file paths.
- Name/content scans via `git ls-files` see tracked files only. Add the allowlist entry in the same commit that creates the file.

## Decisions

- Distill SSOT is `${PROJECT_ROOT}/.bouncer/Distill.md` (`PROJECT_ROOT` = `bouncer project-root`). After `affected_paths` confirm, re-ground with one `bouncer distill --for <path-1> --for <path-2> ... --repo "${PROJECT_ROOT}"` call.
- Next-task handoff is confirm-then `bouncer current --set … --task <NNN>`. G16 blocks while any task is not `verified` or the entry / hash is missing; next-blueprint advance is confirm-then `--set` only. One execute worktree is reused for every task on a blueprint.
- `scripts/` does not read the `bouncer.scale` Intensity mapping.
