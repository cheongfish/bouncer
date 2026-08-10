---
title: Project Distill
description: Current project invariants, gotchas, and decisions
resource: .bouncer/Distill.md
tags:
  - bouncer
  - distill
timestamp: '2026-08-07T11:14:36+09:00'
---
# Distill

Project-wide cautions for plan/execute. BP `explain.md` is a cycle candidate;
`/bouncer-finalize` promotes durable items here (add / replace / drop).
Decisions are **current** only — replace the sentence when it changes; do not
append a change log.

## Invariants

- Canonical Bouncer docs live only under `.bouncer/context/` — never a root
  `context/` tree. Project Distill is agent runtime at `.bouncer/Distill.md`,
  not under `context/`.
- Plugin consumers stay Node-only: commit `scripts/lib` CJS emit and regenerate
  via `pretest` / `npm run build`; do not require TS runtimes at consume time.
- `tsc` does not rewrite `require('../vendor/…')` — keep `outDir`/`rootDir` so
  emit lands in `scripts/lib` and relative vendor paths stay valid.
- Commit-message subject/body come from document fields (`title`,
  `commit_type`, `commit_intent`), not free-form finalize prose; keep
  Epic/Blueprint/Distill ids and file paths out of those fields.
- Unknown CLI usage goes to **stderr** so stdout stays pipe-clean.
- Optional `tasks.bouncer.verify` is a single executable argv string only
  (no shell chaining, redirection, or `cd` prefix) so the evidence command
  is reproducible from the repository root.
- Task document basenames, `\d{3}` dir checks, and expected ids live only in
  `scripts/src/lib/tasks-docs.ts` (`listTasksDocs`, `expectedTasksId`,
  `expectedTaskDocIds`, `NUMBERED_TASKS_RE`, `TASK_DIR_RE`,
  `TASK_UNIT_BASENAMES`). Consumers must not hardcode `tasks.md`,
  `verification.md`, `review.md`, or `tasks-\d{3}.md`. New layout entry:
  `tasks/<NNN>/{tasks,verification,review}.md` with ids
  `TASKS|VERIFY|REVIEW-<NNN>` and `dir` = `<bp>/tasks/<NNN>`. That is the only
  layout: legacy root `tasks.md` / `tasks-{NNN}.md` no longer resolve as task
  docs — `listTasksDocs` reports them as `legacyFiles` and validate rejects
  them (S15). Scaffold creates `tasks/001/`.
- Commit unit is one task document; the blueprint remains the review / PR
  unit.
- The supported surface for the active blueprint pointer is `bouncer current`
  (read / `--set` / `--clear`). Workflow skills must not call
  `scripts/lib/current` via `node -e`.
- The pointer file lives under the Git common directory as `bouncer/current`
  — never document it as `.bouncer/current`.
- `tasks.bouncer.graph.basis` is a non-empty legacy string **or** a non-empty
  array of entries (`graph` `source`|`context`, `status` in
  `updated`|`reused`|`fail-skip`|`skip-disabled`|`missing`, non-empty
  `query`/`result`). S9 and G4 must call the same `isValidGraphBasis` helper.
- Execute G6–G8 / G13 / G14 and finalize commit-bullet titles judge only the
  pointer’s task unit (`loadBlueprintDocs` → `docs.taskUnits`,
  `resolveTaskUnit` via 019 `entriesForVerify`). Do not fall back to a sibling
  unit’s `tasks.md` / `verification.md` / `review.md`.
- Workflow skills, agents, and public docs must name the same task bundle:
  `tasks/<NNN>/tasks.md` for the brief and the pointer task directory's
  `verification.md` / `review.md` for execute evidence. Legacy root paths are
  described only as `bouncer migrate task-layout` input, never as a live layout.
- `runVerification` / `recordVerificationResult` write the target unit’s
  `verification.md` only (`verificationRel`). Missing file →
  `VERIFY_DOCUMENT_MISSING` and no create.
- `closed` is the blueprint lifecycle terminal status: `finalize --yes` stamps
  the blueprint `index.md` and stages that path, `scaffold task` refuses a
  `closed` blueprint, and `listReadyBlueprints` excludes it. Work on a finished
  blueprint goes to a new blueprint, not a new task on the old one.

## Gotchas

- Plain CJS without `import`/`export` needs `moduleDetection: force` or files
  collide as scripts across the program.
- `affected_paths` as a wide directory (e.g. `scripts`) overlaps Do not touch
  file paths under it and fails G12 — prefer per-file paths.
- Skill YAML `description` plain `##` is truncated as a comment — quote or avoid.
- Name-policy / allowlist scanners that only listed `scripts/lib/*.js` break when
  `scripts/src/**/*.ts` is tracked — update allowlists with the source tree.
- `git worktree add` checks out every tracked file at its HEAD blob — the
  destination is never empty, so "the file is already there" does not mean
  someone else wrote it; compare against the HEAD blob (`git cat-file --filters
  HEAD:<path>`, which respects autocrlf) before calling it a conflict.
- Finalize empty-epic cleanup `rmdir`s only when the removed worktree path is
  nested (grandparent basename is `.worktrees`). After a flat
  `.worktrees/<bp-id>` reuse, never `rmdir` the `.worktrees` root.
- `git checkout -- <path>` restores from the index, so it silently leaves a
  staged change in place; name HEAD (`git checkout HEAD -- <path>`) to reset the
  index and working tree together.
- `git diff --name-only HEAD` reports staged changes and deletions too — feeding
  its output straight into a file read throws on any deleted path.
- Reviewer rubric, `reviewer-prompt.md`, named agent docs under `agents/`, and
  execute dispatch are one commit unit — change them together.
- Do not redeclare an `agents` path in plugin manifests. Claude rejects the
  plugin when a convention path is listed again; Cursor auto-discovers
  `agents/` when unset.
- Promoting into `.bouncer/Distill.md` requires `makeAllowed` to whitelist
  that path; otherwise finalize aborts as out-of-scope.
- Do not assume `.bouncer/templates/` exists — scaffold/PR bodies come from
  built-in `scripts/lib/templates.js` unless a project override is intentionally
  present.
- `BOUNCER_HOME` is not a host/provider signal — it is a manual plugin-root
  override usable on any host. Cursor users must set
  `subagents.provider: "cursor"` explicitly.
- `verification.md` is rewritten by `recordVerificationResult` — never put
  author declarations there; declare an optional verify command on
  `tasks.md` as `bouncer.verify`.
- A present-but-invalid `bouncer.verify` must not fall through to
  `config.verify` — that would hide a plan-time `S12` miss.
- Layout structural codes: **S15** legacy root task files remain,
  **S16** non-`\d{3}` `tasks/` subdirectory, **S17** a unit missing one of
  tasks/verification/review. **S14** (old/new mixing) is retired — number
  vacant. Non-`\d{3}` names like `tasks-1.md` are not task docs (ignored).
- `migrate task-layout` rewrites `resource` **and** `bouncer.id` on all three
  unit docs: an id inside a unit comes from the directory number, so a legacy
  blueprint-002 `verification.md` folded into `tasks/001/` becomes
  `VERIFY-001`. Rewriting only `tasks.md` leaves docs that the migrator's own
  validator rejects with S5.
- The commit-safety hook runs the **installed plugin cache** code against the
  shell cwd at PreToolUse time. A task that changes the document layout inside
  this repo therefore hits a released resolver that cannot read the new layout,
  `affected_paths` resolves to `[]`, and every commit in the execute worktree is
  blocked as out-of-scope. Verify scope with the worktree's own
  `readAffectedPaths` before working around it.
- Active pointer JSON is `{ blueprint, task?, base }`. `task` is a repo-relative
  task-doc path string (or absent/non-string → unspecified). CLI `bouncer current`
  presents `task` as `{ path, id }` (or `null`); the pointer file never stores the
  id object. `/bouncer-execute` brief is `current.task.path` when set.
- When the pointer has a `task` path and that file exists: `readVerifyCommand` and
  `readAffectedPaths` use that document only. When `task` is unspecified or the
  file is gone: earliest `bouncer.verify` declaration and union of
  `affected_paths`.
- `scripts/src/lib/templates.ts` blueprint Documents link `tasks/001/…`; keep
  `templates.ts` (and any assertion like `test/init.test.js`) in Touch when
  changing scaffold task layout names.
- `/bouncer-plan` Author verify detection: compose / `Makefile` / `Taskfile`
  are file-existence only; `package.json` counts only when a `scripts` key
  is present (key presence, not script bodies). Do not treat any root
  `package.json` as a hit.
- Empty `diff_sha` (or empty `disposition`) on `explain.md` is G15 **record
  missing**, not hash mismatch — scaffold defaults must not collapse into the
  wrong failure branch.
- `finalize` nests the whole `nextBlueprint` return under `next`, so the
  candidate is `next.next` and overlap is `next.next.sharedPaths` — a flat
  `next.sharedPaths` read skips the handoff warning.
- Skills and docs that say the pointer path is `.bouncer/current` are wrong;
  the shared file is `<git-common-dir>/bouncer/current`.
- When `config.source_dirs` is `scripts` / `hooks` / `test`, Graphify source
  queries do not return `skills/` paths — manually add skill directories to
  `suggested_paths` for blueprints that touch skills.
- Changing `docs/ARCHITECTURE.md` §4 generic-skills table also requires
  updating `test/public-name-regression.test.js` `APPROVED_GENERIC_SKILLS`
  (and listing that test in `affected_paths`); otherwise execute cannot put a
  new skill in the table.
- discovery pre-read (`.bouncer/context/epics/` indexes, `.bouncer/Distill.md`)
  is required for framing, but missing files are not a hard stop — record
  Overlap as `"none"` and continue.
- 「Behavior-changing diff without adding/updating tests」 is a Code quality
  review candidate (`minor` / `major`); docs-only and configuration-only diffs
  are exempt. Keep the rubric in sync across `skills/review`,
  `reviewer-prompt.md`, and `agents/bouncer-reviewer.md`.
- `graphSyncWarnings` missing copy: use “none of … exist” only for
  `skip-no-dirs` / empty `dirs`; scopes already in `failed` must not get a
  missing line (failed covers them).
- newestMtimeUnder skips directories named graphify-out, node_modules, .git, .worktrees and does not descend directory symlinks.
- Skill contracts that lock “do not promote/copy `## 이해 상태`” must assert
  positive exclusion phrases (`승격하지 않` / `옮기지 않` / …), not
  `doesNotMatch(/이해 상태/)` — the prohibition text itself would break an
  absence assert.
- `normalizeContextId` strips legacy `EPIC-`/`BP-` and `KIND-BP-` prefixes
  for migrate rewrite only — S4/S5 do not call it; wrong or prefixed ids fail
  as written.
- Legacy-id SessionStart discovery must call `migrate-ids` `discoverLegacyIds`,
  not layout/`parsePathIds` (hard cut removed transition allowance). The hook
  must still warn on unmigrated consumer trees.
- Do not fold legacy-id warnings into `session-graph.js` — that hook is gated
  on `config.graphify.enabled` and swallows exceptions, so migration guidance
  disappears when graphs fail or are disabled.
- `migrate-ids` is a specialized skill (like `graphify-runner`), not an
  `APPROVED_GENERIC_SKILLS` entry — ship under `skills/migrate-ids/` without
  updating the §4 generic table unless the plan expands that allowlist.
- `bouncer migrate ids` apply is all-or-nothing after validate (mixed /
  collision / dirty reject). SessionStart only warns (`exit 0`) and never
  auto-applies. Cursor has no SessionStart — users get the CLI/skill only.
- `explain-diff` quiz count is agent judgment in **1–10** (minimum 1) from
  `base..HEAD` scale — state a one-line rationale; no mechanical table. Each
  item has three options; vary the correct-answer slot without RNG. Present
  and collect all answers in one batch (no per-question ACQ).
- Put correct answers / responses / right-wrong only under `## 이해 상태`,
  never into `## Quiz`. Unanswered items drop from the `N/M` denominator. On
  skip, do not set `quiz_score` to `0/0` — record the reason in `disposition`.
- Scaffold defaults `graph.basis` to `[]`; an empty array fails G4 until
  graphify-runner records per-graph entries. Never omit an entry when a query
  cannot run — leave the mapped `status` (graph absence remains a state).
- `scaffoldTask`'s closed-blueprint guard must fire before the `tasks/<NNN>`
  existence check and any `writeRel`, or a partial unit survives and the next
  scaffold fails with `already exists`. A missing or unparsable blueprint
  `index.md` must fall through unjudged — a corrupt index cannot block
  scaffolding.
- finalize decides the `closed` lock **after** the out-of-scope check, and a
  re-run on an already-closed blueprint returns `closed: null` (idempotent).
  `validate` G2 branches its message by blueprint status so `closed` reads as
  already finalized, not as unapproved `draft`.
- Execute G14 review findings entries need `id`, `severity`, and `status`
  (`resolved` | `accepted`) — `disposition` is not the field name — plus a
  non-empty `note` on every `accepted` finding.
- `plugin_advisors` / `bouncer advise` / `scripts/lib/advisor` are gone from
  defaults and the CLI. Leftover `plugin_advisors` in a consumer `config.json`
  is ignored (no warn, no migrate). Do not re-seed that key in `init` or
  examples. After deleting `advisor`, `cmdCurrent --set` still needs a local
  swallow-`{}` `readConfig` in `cli.ts` — `subagents` has a twin but does not
  export it.

## Decisions

- Project Distill SSOT is `.bouncer/Distill.md` (agent runtime under `.bouncer/`,
  not under `context/`). Master rules only name the path and the read
  obligation. Write Distill in English; epic/blueprint/tasks/explain stay
  Korean for humans.
- Human-facing bodies under `.bouncer/context/epics/**` and BP `explain.md` are
  Korean (ids/paths/code fences excepted). Apply `stop-slop` there (advisory).
- G15 (`commit` gate) checks the pointer task's comprehension entry and
  matching `diff_sha` for that entry's `range_from..HEAD` (excluding
  `.bouncer/context/`). G16 (`finalize` gate) requires every task `verified`,
  explain `published` with written sections, and one comprehension entry per
  task number. Global Distill is skill promotion + `makeAllowed`, not a body-
  quality gate. G9 is retired (number vacant).
- Distill promotion and draft PR body both source from BP `explain.md`
  (`## Background` / `## Intuition` / `## Code`); `## 이해 상태` / Quiz /
  comprehension stay out of Distill and PR. Bouncer PR meta uses
  `- Explain: <explain path>` (not a Distill path). Shortest surface is skill
  prose + template strings — no `finalize.ts` PR builder.
- Project Distill is ungated OKF-shaped meta (no registered `bouncer.*` kind).
- `bouncer init` soft-seeds missing Distill on an already-ready bootstrap and
  never overwrites curated content.
- Mechanical TS migration may keep `strict: false` until a later tightening BP.
- Plan artifacts reach the execute worktree through `bouncer seed-worktree`,
  run in the base checkout right after `git worktree add`; the moved set is the
  plan context documents only, and the base is returned to HEAD.
- Execute worktree paths come from `runtime-state.worktreePathFor({ repoRoot,
  blueprint })`: `<repo>/.worktrees/<epic-id>/<bp-id>` (ids from `parsePathIds`
  on the blueprint dir). If the nested path is missing and a flat
  `<repo>/.worktrees/<bp-id>` already exists as a directory, reuse that flat
  path — do not rename or migrate. `ensureWorktreeRoot` is removed; skills must
  not assemble the path themselves. The `.worktrees` root is still under the
  main worktree from `git-common-dir`, not under the host XDG state home.
- Review Findings come from named agent `bouncer-reviewer` (or generic /
  inline fallback when named agents are unavailable); only the controller
  sets `review → accepted`. `bouncer-implementer` and `bouncer-debugger`
  must not commit or flip document status. Task commits belong to
  `/bouncer-commit` (`bouncer commit`); `/bouncer-execute` does not commit.
  `/bouncer-finalize` may commit Distill remainder only. `bouncer-debugger`
  is read-only: root-cause report only; the implementer or controller
  applies the fix.
- Named-agent dispatch is four steps: `resolveSubagentModel` → named call →
  slug reject retries with `inherit` (and notify the user) → named-agent
  unsupported falls back to generic/inline. Keep the fallback wording or G8
  blocks on hosts without `agents/` (Codex). The same four steps apply to
  `bouncer-implementer`, `bouncer-reviewer`, and `bouncer-debugger`.
- On `/bouncer-execute` verify failure, dispatch `bouncer-debugger` (brief:
  `skills/debugging` — Root cause → Pattern → Hypothesis → Implementation;
  no fix proposals before root-cause). Redispatch the same failing verify at
  most 3 times, then escalate to architecture / `/bouncer-plan`.
- `reviewer-prompt.md` is a per-run call brief slot; persona, guards, and
  Findings output contract live in `agents/bouncer-reviewer.md`. Debugger
  persona / Hard guards / Output contract live in `agents/bouncer-debugger.md`.
- Named-agent model overrides live in `.bouncer/config.json` `subagents` as
  per-provider blocks (model ID namespaces differ by host).
  `resolveSubagentModel` never throws — miss / `'inherit'` / non-string →
  `{ model: null }` (parent-session inherit). `subagents` is project config,
  not OKF/document frontmatter — do not register it in `schema.ts`. Default
  provider blocks seed `bouncer-debugger: inherit` alongside reviewer and
  implementer.
- Codex is out of named-agent routing: the plugin cannot deploy `agents/`, so
  review, execute implementer, and debugger always take the generic/inline
  fallback there.
- Verify command resolution: if the pointer names a task doc, read that doc’s
  `bouncer.verify` only; otherwise walk `listTasksDocs` in number order and take
  the first declaration, then fall back to `config.verify`. Format rules live
  only in `isValidVerifyCommand`, which plan `S12` and runtime
  `VERIFY_COMMAND_INVALID` both reuse.
- Workflow order is init → plan → execute → commit → finalize.
  `/bouncer-commit` records one explain comprehension entry (append-only
  array) and commits one task; same-blueprint next-task handoff is
  confirm-then `bouncer current --set … --task <NNN>` there. `/bouncer-finalize`
  G16 blocks while any task is not `verified` or lacks a comprehension
  entry; next-blueprint advance is confirm-then `--set` only — never
  automatic. One execute worktree is reused for every task on a blueprint.
- `/bouncer-plan` Author asks before writing `tasks.bouncer.verify` when root
  build/container signals exist; never write from detection alone and never
  edit `config.verify` there. Container-up + test must be one project script
  (single argv); wrapper pattern (worktree compose project name, docker-absent
  skip→0) lives in `docs/configuration.md`.
- Pointer absence is a state, not an error: bare `bouncer current` always
  exits `0`, and attaches `ready` only when the pointer is null.
- `listReadyBlueprints` includes only blueprint `approved` with at least one
  task document `ready` / `in_progress` (`verified` is excluded); broken docs
  are skipped per entry.
- `bouncer current --set` writes the pointer only after the plan gate passes;
  failures ship `validateBlueprint` results untouched and leave the pointer
  alone.
- Plan G3–G5·G10–G12 still apply to **every** task document (not narrowed by
  the pointer). G3 accepts `ready` | `in_progress` | `verified` so a finished
  sibling does not block next-task `--set`; `draft` still fails G3.
- When `docs.taskUnits` is present, skip structural checks on root
  `verification` / `review` only if that `rel` was already seen on a unit leaf
  — orphan root leftovers must still be S-checked.
- The next blueprint after finalize is a computation (`listReadyBlueprints` +
  epic `## Blueprints` order), not stored state; advancing the pointer is
  confirm-then-`bouncer current --set` only — never automatic and never a new
  CLI.
- discovery Confirmation hands off six named outputs: `Goal`, `Scope`,
  `Non-goals`, `Success criteria`, `Edge cases & failure modes`, `Overlap`.
  `/bouncer-plan` step 1 cites those names and maps Edge cases → blueprint
  Contract 「실패 모드·엣지 케이스」, Overlap → epic Out of scope or reuse of
  an existing blueprint.
- Epic `## Blueprints` one-line purpose must show what changes and where it
  touches so the next discovery can judge stream overlap from the list alone.
- Graph absence is a state, not an error: `syncSessionGraphs.missing` stays
  empty on `NO_GRAPH_WORK` paths and never flips `ok` to false; consumers
  signal via fields / stderr, not exit codes.
- init default source_dirs is the fixed candidate list filtered to existing directories (order preserved); empty yields [] with sourceDirsUnresolved; existing config.json is never overwritten.
- Canonical epic/blueprint context ids are zero-padded `\d{3}` with no
  `EPIC-`/`BP-` prefix; child docs use `TASKS-`|`VERIFY-`|`REVIEW-`|`EXPLAIN-`
  + `\d{3}` (e.g. `TASKS-001`). Scaffold/`--id` accept and emit that shape
  only. Legacy-prefixed path segments and frontmatter fail canonical/S5/S13
  after the hard cut — consumers must `bouncer migrate ids` first.
- Legacy tree migration surface is `bouncer migrate ids` plus the
  `migrate-ids` skill (dry-run → confirm → apply). SessionStart warns through
  a separate hook that reuses that discoverer; it does not rename trees.
  Dogfood order is migrate apply first, then remove layout/`parsePathIds`/S5
  legacy allowance — reverse order breaks validate on the migrating docs.
- Execute worktree directory and branch names are not renamed by migrate even
  when they still contain legacy `BP-` tokens; leave them through finalize.
- Adaptive quiz rules live in `skills/explain-diff` prose plus
  `test/skill-explain-diff.test.js` contract asserts — no quiz engine or CLI.
- `/bouncer-finalize` step 4 keeps a single Draft PR ACQ. After accept, show
  the rendered title/body then push + `gh pr create --draft` with no second
  body-confirm. If push or `gh` fails, keep the local commit and report the
  reason — do not re-ask the PR ACQ.
- A document-layout hard cut ships as one commit: the migration tool, the
  apply against this repo's own tree, and the validate rejection of the old
  layout. Splitting them leaves an intermediate commit where the repository
  fails validate on its own documents.
- Closed-blueprint rejection lives in `scaffoldTask` as a throw; `cli.ts` gets
  no new branch because its existing catch already renders
  `scaffold: <message>` + exit 2. The message names the closure and points at
  opening a new blueprint.
- Minimality discipline lives only in the `minimality` skill. The Ponytail
  `plugin_advisors` / `bouncer advise` path is removed; do not reintroduce it
  as a parallel mode switcher.
