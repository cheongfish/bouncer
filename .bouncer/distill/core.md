---
distill:
  id: core
  always: true
  paths:
    - "**"
  pulls: []
---
# core

Project-wide rules that apply to every path.

## Invariants

- Canonical Bouncer docs live only under `.bouncer/context/` — never a root `context/` tree.
- Project Distill uses a versioned index plus registered shards. Routing is opt-in via `distill.routing_enabled`; invalid structure, uncertain path metadata, missing matches, and broken `pulls` fail open to the full shard set. Enable routing only after structural validation and the full-render bullet audit pass.
- Unknown CLI usage, Distill route diagnostics, and byte-size observations go to **stderr** so stdout stays pipe-clean. `distill.max_bytes` is warning-only: route output is never truncated or dropped for size.
- Commit unit is one task document; the blueprint remains the review / PR unit.
- Blueprint-root `context-review.md` is kind `bouncer.context_review` (id `CTXREVIEW-<bp>`), a BP-unit document like `explain.md`, not a task-unit file. Findings vocabulary matches `review.md` (`id` / `severity` / `status`; `accepted` requires a non-empty `note`).
- Active pointer surface is `bouncer current` (read / `--set` / `--clear`); skills must not call `scripts/lib/current` via `node -e`. File is `<git-common-dir>/bouncer/current` — never `.bouncer/current`. JSON is `{ blueprint, task?, base }` where `task` is a repo-relative path string (absent or non-string → unspecified); CLI presents `task` as `{ path, id }` or `null` and never stores that id object. `/bouncer-execute`'s brief is `current.task.path` when set.

## Gotchas

- `affected_paths` as a wide directory (e.g. `scripts`) overlaps Do not touch paths under it and fails G12 — prefer per-file paths.
- Name/content scans via `git ls-files` see tracked files only, so a new file is invisible while untracked. An execute gate can record `verify` green and the same command fail after commit tracks the file. Add the allowlist entry in the same commit that creates the file.

## Decisions

- This repository enables `distill.routing_enabled` only after the full seven-shard render preserves every original bullet; route selection keeps `always` shards and transitive `pulls`, with full-render fallback on uncertainty.
- Workflow order is init → plan → execute → commit → finalize. `/bouncer-run` covers execute→commit only (never finalize). `/bouncer-commit` commits one task — no `explain-diff` / quiz; next-task handoff is confirm-then `bouncer current --set … --task <NNN>`. `/bouncer-finalize` promotes Distill, then authors explain + quiz as **one** blueprint comprehension entry for pointer-`base`..HEAD, then G16 / remainder commit. G16 blocks while any task is not `verified` or the entry / hash is missing; next-blueprint advance is confirm-then `--set` only. One execute worktree is reused for every task on a blueprint.
- Project Distill SSOT is `${PROJECT_ROOT}/.bouncer/Distill.md` (`PROJECT_ROOT` = `bouncer project-root` / `runtimePaths().projectRoot`). Plugin root and execute worktree cwd are not Distill bases. Distill is English agent runtime under `.bouncer/`, outside `context/`, ungated OKF-shaped meta with no registered `bouncer.*` kind. `bouncer init` soft-seeds a missing Distill and never overwrites curated content. Promotion requires `makeAllowed` to whitelist the path. After `affected_paths` confirm, re-ground with one `bouncer distill --for <path-1> --for <path-2> ... --repo "${PROJECT_ROOT}"` call.
- Plan inventory for wording cutovers: search first, then Touch, then Goal. Goal does not outrank Touch. The same closed set is the commit unit (`affected_paths`); widening after execute is a plan gap.
- Minimality lives only in the `minimality` skill (seven rungs: YAGNI, reuse, native platform, stdlib, installed dep, shortest surface, then new code). `bouncer.scale: light` applies rungs 1–4 with a one-line rationale; absence/`full` is all seven. `scripts/` does not read this mapping. The Ponytail `plugin_advisors` / `bouncer advise` path is removed.
