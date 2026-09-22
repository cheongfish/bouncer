# Governance

## Blueprint sizing rule

예외는 `bouncer.execution_kind: verification`인 종단 fan-in node다. 계획 시점의
문서 형태(어떤 파일을 scaffold하는지)는 `rules/planning.md`
`## Blueprint sizing rule`이 소유한다. 실패한 실행은 integrated로 전이하지 않는다.

`/bouncer-commit` closes one task (scope check → `bouncer commit`).
`/bouncer-run` repeats that commit unit; verification node에서는 commit 대신
integration checkout의 verification runner만 실행한다.
`/bouncer-execute` does not commit. `/bouncer-finalize` closes the blueprint
(explain + quiz, remainder commit, draft PR, worktree cleanup) after every task
is committed.

Task commits authorize the complete existing candidate set through the shared
scope helper, then stage task outputs only. Task bundles and context documents
remain for finalize; finalize stages tracked transient deletions and removes
untracked documents without adding paths that no longer exist. The
task's `commit_sha` stays in its working-tree document until finalize copies it
to `explain.md` as `{ task, sha, intent_anchor }`: `task` is
`EPIC-<ddd>/BP-<ddd>/TASK-<ddd>`, `intent_anchor` is `task-<ddd>`, and both
`commit_sha` and `sha` stay lowercase 8-char hex. Finalize does not rewrite
existing explain rows in bulk; only the document it writes at close switches to
the new shape. Readers keep accepting legacy `{ id, sha }`.

## Lightweight cycle

Light 선언·문서 집합·G10/G18·공유 maintenance 에픽 할당은 `rules/planning.md`
`## Lightweight cycle`이 소유한다. 아래는 실행 경로만 남긴다.

4. **Agent round-trips** — when `bouncer.scale` is `light`, run the implementer
   **inline** (same session) instead of named-agent dispatch. Keep the host
   `named agents are unavailable` fallback wording as a separate sentence —
   do not replace it with the light branch. Reviewer and `bouncer-debugger`
   stay named. During a `/bouncer-run` drive the loop keeps named dispatch for
   implement too even on `light`: the loop is an orchestrator that reads
   subagent reports, so it must not become the implementer. See
   `/bouncer-execute`.
5. **Quiz size** — `explain-diff` asks **one question** when `scale: light`
   (still within the usual 1–10 range rules otherwise). See
   `references/explain-diff/index.md`.

What stays the same:

- Canonical context remains the only repository-knowledge source at finalize.

`scripts/` reads `scale` in four places: `scaffoldBlueprint` picks the document
set, `scaffoldTask` inherits the blueprint's declared scale for a later task,
the plan gate picks the G10 / G18 contract, and structural validation (S20)
checks the value against the enum. Every one of them reads the declared
`bouncer.scale` value and nothing else; none infers size.

Limit of implement inline: the writing session still authored the change a
named reviewer will score against **its own diff** (self-review pressure on
the writer, not a same-session review verdict). Returning to `full` and
restoring the missing plan documents is owned by `rules/planning.md`
`## Lightweight cycle`.

## Task DAG and approved scope

Plan-time DAG fields, ready waves, the plan-gate cycle check, and the approved baseline are owned by
`rules/planning.md` `## Task DAG and approved scope`.

Under coordinator-owned execution the approved `affected_paths` is an initial
estimate the coordinator may revise — see **Coordinator mode** below.

## Coordinator mode

A drive delegated to `bouncer-coordinator` runs from an integration worktree
with one assigned worktree per open task. In that mode `affected_paths` is the
**initial expected scope** recorded at approval, and the coordinator ledger
(`.bouncer/runtime/coordinator.json` inside the integration worktree) carries
the current task scope, its `revision`, and an append-only decision log.

- **Dynamic plan** — a scope revision moves the task document and the ledger to
  one shared `revision` and is refused without a reason. Each revision appends a
  decision naming the task, the reason, and the previous and next paths, and the
  read-modify-write is serialized so concurrent workers cannot mint one revision
  twice or drop a log entry. A writer that cannot take the ledger lock in time is
  refused outright, and a writer re-checks ownership twice — once before
  writing the task document and once before writing the ledger — backing off
  without writing at whichever check finds the lock lost. A writer that loses
  the lock between those two checks writes the task document but not the
  ledger: the second check refuses it, so the document is left carrying a
  `scope_revision` the ledger never recorded. That state needs no hand repair —
  `nextRevision` is a function of the ledger revision alone and a revision does
  not pre-check the document's `scope_revision`, so the next scope revision
  writes both sides to one number and reconciles them — but nothing heals on its
  own either: until that revision is issued, a task document whose
  `scope_revision` disagrees with the ledger is stale, and commit safety keeps
  refusing the commit rather than guessing which side is current; so does a
  ledger it cannot read, and a pointer task the ledger does not carry.
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
- **Commit ownership** — a task commit is still one task bundle, and it belongs
  to the worktree the coordinator assigned; the main checkout stays read-only
  provenance for the whole drive. Workers report; only the coordinator revises
  scope, moves the pointer, and records the judgment behind either.
- **Critical recovery budget** — delta certification may send one qualifying
  `introduced_by_revision` or `missed_critical` blocker/major finding back to a
  prepared task when the brief and diff show false-acceptance risk without
  changing task intent or introducing a product decision, dependency, or public
  interface. Record its findings and reason with `coordinate critical-recovery`
  before dispatch, then record `resolved` or `blocked` afterward. The task has
  exactly one such recovery: a remaining same finding or any new blocker/major
  is terminal `blocked`, never another dispatch.

The commit gate is the weaker of the three layers. **G17** judges staged paths
against the task document alone and reads no ledger, so it accepts a stale
revision, a main-worktree commit, and an unassigned worktree that `bouncer
commit` and the `commit-safety` hook both refuse. The CLI and the hook are the
enforcement points; treat a passing commit gate as a document-level check, not
as coordinator authorization.

Without a coordinator ledger nothing above applies: plan and commit gates treat
the approved `affected_paths` as the change boundary exactly as before.

Terminal CI failure may add at most two dynamic repair tasks. Each append-only
decision records the failed command and summary, previous/next DAG,
previous/next source scope, and Blueprint necessity; the repair depends on the
then-integrated leaves and the terminal verification node moves its dependency
to that repair. The task document and ledger revision are one write unit.

After a second repair still fails, automatic execution stops. The integration
root keeps an untracked `NEXT_PLAN.md`, the last command and remaining paths,
the ledger, and all worktrees. Only explicit user confirmation may set the
Blueprint and ledger to `partial_closed`; that terminal status is unresolved
handoff, never ordinary `closed`, and none of those preserved artifacts may be
copied to main, committed, pushed, or included in a PR.
