---
distill:
  id: core
  always: true
  paths:
    - "**"
  pulls: []
---
# core

Rules routed to core; routing remains disabled until the project explicitly opts in.

## Invariants

- Canonical Bouncer docs live only under `.bouncer/context/` — never a root
  `context/` tree.

- Unknown CLI usage goes to **stderr** so stdout stays pipe-clean.

- Commit unit is one task document; the blueprint remains the review / PR unit.

- Blueprint-root `context-review.md` is kind `bouncer.context_review` (id
  `CTXREVIEW-<bp>`), a BP-unit document like `explain.md`, not a task-unit file.
  Findings vocabulary matches `review.md` (`id` / `severity` / `status`;
  `accepted` requires a non-empty `note`).

- The active-pointer surface is `bouncer current` (read / `--set` / `--clear`);
  workflow skills must not call `scripts/lib/current` via `node -e`. The file is
  `<git-common-dir>/bouncer/current` — never `.bouncer/current`. Its JSON is
  `{ blueprint, task?, base }` where `task` is a repo-relative task-doc path
  string (absent or non-string → unspecified); the CLI presents `task` as
  `{ path, id }` or `null` and the file never stores that id object.
  `/bouncer-execute`'s brief is `current.task.path` when set.

## Gotchas

- `affected_paths` as a wide directory (e.g. `scripts`) overlaps Do not touch
  file paths under it and fails G12 — prefer per-file paths.

## Decisions

- Workflow order is init → plan → execute → commit → finalize.
  `/bouncer-run` is an **alternate path** for the execute→commit span only — it
  repeats those skills until open tasks are gone and never enters finalize; the
  canonical five-step order stays the source of truth. The run session is an
  orchestrator: implementation, review, and debugging go to named agents through
  execute, and the loop routes from those three reports only. Four things stay in
  the loop's own hands because they cannot be delegated — `bouncer` CLI calls,
  document status and `## Findings` writes, gate judgment, and ACQ (the gate runs
  `config.verify` itself and `commit-safety` inspects the command's actual cwd).
  `/bouncer-commit` commits one task only — no `explain-diff` / quiz — and
  same-blueprint next-task handoff is confirm-then
  `bouncer current --set … --task <NNN>` there. `/bouncer-finalize` promotes
  Distill, then authors explain + quiz (`explain-diff`) for pointer-`base`..HEAD
  as **one** blueprint comprehension entry, then G16 / remainder commit. G16
  blocks while any task is not `verified` or the blueprint entry / hash is
  missing; next-blueprint advance is confirm-then `--set` only — never
  automatic. One execute worktree is reused for every task on a blueprint.

- Project Distill SSOT is `${PROJECT_ROOT}/.bouncer/Distill.md`, where
  `PROJECT_ROOT` is the consuming repo's main worktree from
  `bouncer project-root` (`runtimePaths().projectRoot`). Plugin root and
  execute worktree cwd are not Distill path bases — do not fall back to
  `${BOUNCER_ROOT}/.bouncer/Distill.md`. Distill is agent runtime under
  `.bouncer/`, outside `context/`, ungated OKF-shaped meta with no registered
  `bouncer.*` kind. Master rules name the resolve + read obligation only.
  Write Distill in English; epic/blueprint/tasks/explain stay Korean for humans.
  `bouncer init` soft-seeds a missing Distill on an already-ready bootstrap and
  never overwrites curated content. Promotion requires `makeAllowed` to
  whitelist that path, or finalize aborts as out-of-scope. Workflow skills bind
  `PROJECT_ROOT` via the CLI; `discovery` / `spec-authoring` take a
  caller-provided absolute Distill path only (no `BOUNCER_ROOT` resolve).

- Plan inventory for wording cutovers: search first, then Touch, then Goal. Goal
  does not outrank Touch. The same closed set is the commit unit
  (`affected_paths`); widening after execute is a plan gap, not an implementer
  miss.

- Minimality discipline lives only in the `minimality` skill. The ladder is
  seven rungs: YAGNI, reuse, native platform, standard library, installed
  dependency, shortest surface, then new code — native platform and stdlib are
  separate rungs. `bouncer.scale: light` applies rungs 1–4 with a one-line
  rationale; absence/`full` is all seven. `scripts/` does not read this mapping
  and there is no new config key. The Ponytail `plugin_advisors` /
  `bouncer advise` path is removed; do not reintroduce it as a parallel mode
  switcher.

