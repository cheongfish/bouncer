---
distill:
  id: context-layout
  paths:
    - .bouncer/context/**
    - scripts/src/lib/layout.ts
  pulls: []
---
# context-layout

## Invariants

- Task layout is `tasks/<NNN>/{tasks,verification,review}.md` with ids `TASKS|VERIFY|REVIEW-<NNN>` and `dir` = `<bp>/tasks/<NNN>`; scaffold creates `tasks/001/`. Basenames, `\d{3}` checks, and expected ids live only in `scripts/src/lib/tasks-docs.ts` (`listTasksDocs`, `expectedTasksId`, `expectedTaskDocIds`, `NUMBERED_TASKS_RE`, `TASK_DIR_RE`, `TASK_UNIT_BASENAMES`) - do not hardcode those or `tasks-\d{3}.md`. Legacy root `tasks.md` / `tasks-{NNN}.md` no longer resolve: `listTasksDocs` reports `legacyFiles`, validate rejects (S15), docs name them only as `bouncer migrate task-layout` input. Brief = `tasks/<NNN>/tasks.md`; evidence = pointer task dir `verification.md` / `review.md`.
- Blueprint status `imported` is exhibit-only: after structural and epic-list checks, `validateBlueprint` records **S18** and returns without gate judgment. Do not mark imported docs `approved`. Import epic bodies carry only `## Intent` and `## Blueprints` - omit `## Success criteria`.

## Gotchas

- Layout codes: **S15** legacy root task files, **S16** non-`\d{3}` `tasks/` subdir, **S17** unit missing tasks/verification/review, **S19** type/path mismatch, **S20** bad blueprint `scale`. **S14** retired (vacant). Non-`\d{3}` names like `tasks-1.md` are not task docs. Wrong `scale` spelling fails S20; omitting `scale` does not.
- `migrate task-layout` rewrites `resource` **and** `bouncer.id` on all three unit docs - id comes from the directory number (legacy blueprint-002 `verification.md` folded into `tasks/001/` becomes `VERIFY-001`). Rewriting only `tasks.md` leaves docs the migrator rejects with S5.
- Epic dir without `.bouncer/context/index.md` row fails whole-repo validate (**S13**). `applyImport` registers via `ensureEpicIndexEntry` in the same apply; every refusal runs before first write.
- Switching `subagents.provider` does not backfill missing provider blocks - repos past `bouncer init` add `antigravity` to `.bouncer/config.json` by hand.

## Decisions

- Bundle-root `.bouncer/context/index.md` carries `bouncer_schema: "0.1"` beside `okf_version` - Bouncer document-schema promise, not OKF package version, never repeated on epic/blueprint/task docs. `init` CONTEXT_INDEX / `EMPTY_CONTEXT_INDEX` seed it; existing repos add by hand. Constants in `schema.ts` (`BOUNCER_SCHEMA_VERSION`, `SCALE_ENUM`, `DEFAULT_SCALE`, `DEFAULT_COMMIT_TYPE`).
- Canonical epic/blueprint ids are zero-padded `\d{3}` with no `EPIC-`/`BP-` prefix; child docs use `TASKS-`|`VERIFY-`|`REVIEW-`|`EXPLAIN-` + `\d{3}`. Scaffold/`--id` emit that shape only. Legacy-prefixed paths/frontmatter fail canonical/S5/S13 — no automatic id-migration CLI remains.
- Document-layout hard cut ships as one commit: migration tool, apply against this repo, and validate rejection of the old layout. Splitting leaves a commit that fails validate on its own documents.
- History import is `planImport` -> `applyImport` (single commit; message = `--message` argv). Git only through `deps.execFileSync`.
- Dirty-worktree refusal for `migrate task-layout` and history import is owned by `runtime-state.isWorktreeDirty` (shared helper; not a migrate-ids leftover).
