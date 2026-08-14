---
distill:
  id: context-layout
  paths:
    - .bouncer/context/**
    - scripts/src/lib/layout.ts
  pulls: []
---
# context-layout

Rules routed to context-layout; routing remains disabled until the project explicitly opts in.

## Invariants

- Task layout is `tasks/<NNN>/{tasks,verification,review}.md` with ids
  `TASKS|VERIFY|REVIEW-<NNN>` and `dir` = `<bp>/tasks/<NNN>`; scaffold creates
  `tasks/001/`. Basenames, `\d{3}` dir checks, and expected ids live only in
  `scripts/src/lib/tasks-docs.ts` (`listTasksDocs`, `expectedTasksId`,
  `expectedTaskDocIds`, `NUMBERED_TASKS_RE`, `TASK_DIR_RE`,
  `TASK_UNIT_BASENAMES`) — consumers must not hardcode `tasks.md`,
  `verification.md`, `review.md`, or `tasks-\d{3}.md`. Legacy root `tasks.md` /
  `tasks-{NNN}.md` no longer resolve as task docs: `listTasksDocs` reports them
  as `legacyFiles`, validate rejects them (S15), and skills, agents, and public
  docs name them only as `bouncer migrate task-layout` input. The brief is
  `tasks/<NNN>/tasks.md`; execute evidence is the pointer task directory's
  `verification.md` / `review.md`.

- Blueprint status `imported` is exhibit-only history: after structural and
  epic-list checks, `validateBlueprint` records **S18** and returns without gate
  judgment. Do not mark imported docs `approved`. Import epic bodies carry only
  `## Intent` and `## Blueprints` — omit `## Success criteria` (context digest
  whitelist).

## Gotchas

- Layout structural codes: **S15** legacy root task files remain, **S16**
  non-`\d{3}` `tasks/` subdirectory, **S17** a unit missing one of
  tasks/verification/review, **S19** type/path mismatch, **S20** bad blueprint
  `scale`. **S14** (old/new mixing) is retired — number vacant. Non-`\d{3}`
  names like `tasks-1.md` are not task docs (ignored). Wrong `scale` spelling
  fails S20; omitting `scale` does not.

- `migrate task-layout` rewrites `resource` **and** `bouncer.id` on all three
  unit docs: an id inside a unit comes from the directory number, so a legacy
  blueprint-002 `verification.md` folded into `tasks/001/` becomes `VERIFY-001`.
  Rewriting only `tasks.md` leaves docs that the migrator's own validator
  rejects with S5.

- `normalizeContextId` strips legacy `EPIC-`/`BP-` and `KIND-BP-` prefixes for
  migrate rewrite only — S4/S5 do not call it; wrong or prefixed ids fail as
  written.

- Legacy-id SessionStart discovery must call `migrate-ids` `discoverLegacyIds`,
  not layout/`parsePathIds` (the hard cut removed the transition allowance), and
  must still warn on unmigrated consumer trees. Do not fold those warnings into
  `session-graph.js` — that hook is gated on `config.graphify.enabled` and
  swallows exceptions, so migration guidance disappears when graphs fail or are
  disabled.

- `bouncer migrate ids` apply is all-or-nothing after validate (mixed /
  collision / dirty reject). SessionStart only warns (`exit 0`) and never
  auto-applies. Cursor has no SessionStart — users get the CLI/skill only.

- An epic directory without a `.bouncer/context/index.md` row fails whole-repo
  validate with **S13**. `applyImport` registers via `ensureEpicIndexEntry` in
  the same apply; every refusal check runs before the first write so a mid-apply
  stop cannot leave that half-state.

- Switching `subagents.provider` does not backfill missing provider blocks —
  repos already past `bouncer init` must add the `antigravity` block to
  `.bouncer/config.json` by hand.

## Decisions

- Bundle-root `.bouncer/context/index.md` carries `bouncer_schema: "0.1"` beside
  `okf_version` — a Bouncer document-schema promise, not the OKF package
  version, and never repeated on epic/blueprint/task docs. `init`
  CONTEXT_INDEX and `EMPTY_CONTEXT_INDEX` seed it; existing repos add the key by
  hand. Schema constants live in `schema.ts` (`BOUNCER_SCHEMA_VERSION`,
  `SCALE_ENUM`, `DEFAULT_SCALE`, `DEFAULT_COMMIT_TYPE`).

- Canonical epic/blueprint context ids are zero-padded `\d{3}` with no `EPIC-`/
  `BP-` prefix; child docs use `TASKS-`|`VERIFY-`|`REVIEW-`|`EXPLAIN-` + `\d{3}`
  (e.g. `TASKS-001`). Scaffold/`--id` accept and emit that shape only.
  Legacy-prefixed path segments and frontmatter fail canonical/S5/S13 after the
  hard cut — consumers must `bouncer migrate ids` first.

- Legacy tree migration surface is `bouncer migrate ids` plus the `migrate-ids`
  skill (dry-run → confirm → apply). SessionStart warns through a separate hook
  that reuses that discoverer; it does not rename trees. Dogfood order is
  migrate apply first, then remove the layout/`parsePathIds`/S5 legacy
  allowance — the reverse order breaks validate on the migrating docs.

- A document-layout hard cut ships as one commit: the migration tool, the apply
  against this repo's own tree, and the validate rejection of the old layout.
  Splitting them leaves an intermediate commit where the repository fails
  validate on its own documents.

- History import path is `planImport` → `applyImport` (single commit; message is
  the `--message` argv). Git runs only through `deps.execFileSync`.

