# Commit scope

실행 경로(run · finalize)가 commit 단위와 변경 범위를 판단할 때
직접 읽는 공유 계약이다. run과 coordinator는 `${BOUNCER_ROOT}/agents/bouncer-coordinator.md`의 pointer
문장을 따라 같은 정본에 도달한다. **승인 scope**는 plan 시점에 task 문서에서 확정한
`affected_paths`이고, **ledger scope**는 coordinator가 현재 `revision`에 기록한
source path 집합이다. scope 개정 명령과 lock 절차, 실패 뒤의 repair 예산과 중지
판정은 `${BOUNCER_ROOT}/agents/bouncer-coordinator.md`가 소유하며 이 문서는 복제하지
않는다.

## Commit unit and staging

`/bouncer-run` closes each task internally (scope check → `bouncer commit`); verification node에서는 commit 대신
integration checkout의 verification runner만 실행한다.
An implementation worker does not commit. `/bouncer-finalize` closes the blueprint
(explain + quiz, remainder commit, draft PR, worktree cleanup) after every task
is committed.

Task commits authorize the complete existing candidate set through the shared
scope helper, then stage task outputs only. Task bundles and context documents
remain for finalize; finalize stages tracked transient deletions and removes
untracked documents without adding paths that no longer exist. The
task's `commit_sha` stays in its working-tree document until finalize copies it
to `explain.md` as `{ task, sha, intent_anchor }`: `task` is
`<epic-slug>/<bp-slug>/<ddd>`, `intent_anchor` is `task-<ddd>`, and both
`commit_sha` and `sha` stay lowercase 8-char hex. Finalize does not rewrite
existing explain rows in bulk; only the document it writes at close switches to
the new shape. Readers keep accepting legacy `{ id, sha }` rows and the old
`EPIC-<ddd>/BP-<ddd>/TASK-<ddd>` trailer and task form, which they map through
the registry's `legacy_id` and `blueprint_aliases`. When the legacy epic's `moved_to` lists the blueprint, they resolve to the domain epic location instead.

## Approved and ledger scope

Under coordinator-owned execution the approved `affected_paths` is an initial
estimate the coordinator may revise. A drive delegated to `bouncer-coordinator`
runs from an integration worktree with one assigned worktree per open task. In
that mode `affected_paths` is the **initial expected scope** recorded at
approval, and the coordinator ledger
(`.bouncer/runtime/coordinator.json` inside the integration worktree) carries
the current task scope, its `revision`, and an append-only decision log.

- **What a revision may name** — repository source paths only. Absolute paths,
  paths escaping the repository, whole-tree spellings, `.git/`, and the
  `.bouncer/` governance tree are refused. Inside that boundary there is no
  ceiling: a newly discovered source path is accepted on the coordinator's word,
  and the append-only decision log — not a path limit — is what makes the
  widening reviewable. Judge revisions at review time accordingly.
- **Scope audit** — commit safety judges the actual staged paths against the
  ledger's current scope instead of the approval snapshot, and refuses a commit
  made in the main worktree, outside the task's assigned worktree, on a stale
  revision, or with the ledger missing. A completed commit records the paths it
  actually carried back into the ledger beside the initial estimate.

### Three layers of path policy

The same staged path is judged by three layers, and which one blocks depends on
the ledger mode:

1. **Expected scope** — the ledger scope (coordinator drive) or the approved
   `affected_paths` (anywhere else). A path inside it is always allowed.
2. **Recorded deviation** — a path outside the expected scope that no Do not
   touch line covers. In a **full** ledger drive it is allowed and recorded: the
   commit result carries `unexpected_paths`, and `coordinate report --outcome
   accepted` stores each such path with the worker's reason (see below). A
   generated pair or a pinned test that the task had to edit no longer needs a
   scope revision first.
3. **Do not touch line** — the only blocking line for a path outside the
   expected scope in a full drive: `scope-do-not-touch-violation` when the path
   overlaps a line, `scope-do-not-touch-unreadable` when the line cannot be
   read. Overlap is the shared `pathsOverlap` rule: the same path or a segment
   ancestor, so the slash-less token `agents` covers every path under the
   `agents` directory but not the sibling `agents-extra` directory.

A **light** ledger and a commit with no coordinator ledger (standalone) keep the
old rule: any path outside the expected scope is `out-of-scope`. The order in
the full drive is verification node, worktree/revision boundary, Do not touch
(read failure included), recorded deviation, then the cross-drive check; the
cross-drive comparison uses every allowed path (in scope plus recorded).

- **Where the line is read** — only from the task document in the
  **integration checkout**, never from the worker's copy: a worker that deletes
  the line in its own copy changes nothing. A missing document, broken
  frontmatter, or read error means the line is unknown, and an unknown line is
  never treated as empty (fail closed). The line is read only when a path
  outside the expected scope exists, so an in-scope commit does not depend on it.
  A dynamic repair task's own document carries only the `.git/` and `.bouncer/`
  lines, so for it the set is the union of the lines of every ledger task, the
  same set the final-review repair check uses. Otherwise the plan's lines would
  not apply to a repair that touches another task's territory.
- **Releasing a line** — `coordinate revise --release-do-not-touch` edits the
  task document in the working directory it runs from. Run it from the
  integration checkout after the user approves, so the canonical copy changes.
  Run from another checkout, the canonical copy stays and the block stays.
- **Deviation reasons** — the worker lists each deviating path under
  `## Unexpected paths` in its report as ``- `path` — reason`` (reason
  1 to 200 characters). `coordinate report --outcome accepted` takes the
  candidates from `git diff --name-only --no-renames <base_head>..HEAD` in the
  worker (a rename counts both paths), drops runtime artifacts, and refuses with
  `unexpected-path-reason-missing` when a deviating path has no usable reason. It
  also re-checks the Do not touch line (a commit that bypassed the hook), so a
  hit is `scope-do-not-touch-violation`. It also records `overlaps`: the ids of
  other tasks of the same drive, not yet `integrated`, whose scope overlaps a
  deviating path.
- **Final-review repair** — a `--new-path` of the one brief-contract repair is
  accepted unless it overlaps the union of the Do not touch lines of every
  ledger task (`final-review-repair-do-not-touch`; an unreadable task document is
  `scope-do-not-touch-unreadable`). An accepted repair records the paths as
  `unexpected_paths`.

### Parallel conflicts: detection and recovery

A deviating path can collide with a task running in parallel. The conflict is
caught at three moments:

1. **At commit** — the cross-drive check refuses a path or exclusive resource that
   another drive's started task holds (`cross-drive-conflict`).
2. **At report** — `overlaps` records a same-drive overlap with an unintegrated
   task. The coordinator reads it before accepting the next step.
3. **At fan-in** — a cherry-pick conflict revokes only that task
   (`fanin-conflict`).

Recovery never rewrites history: commits that are already integrated stay. A
conflicting task is revoked, its worktree is salvaged, and it is dispatched again
from the new integration HEAD, which raises its lease generation.

Without a coordinator ledger nothing above applies: plan and commit gates treat
the approved `affected_paths` as the change boundary exactly as before.

## Worktree and enforcement layers

Every task command runs with its assigned worktree as the actual `cwd`. A task
commit is still one task bundle, and it belongs to the worktree the coordinator
assigned; the main checkout stays read-only provenance for the whole drive.

The commit gate is the weaker of the three layers. **G17** judges staged paths
against the task document alone and reads no ledger, so it accepts a stale
revision, a main-worktree commit, and an unassigned worktree that `bouncer
commit` and the `commit-safety` hook both refuse. The CLI and the hook are the
enforcement points; treat a passing commit gate as a document-level check, not
as coordinator authorization.
