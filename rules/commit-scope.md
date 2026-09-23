# Commit scope

실행 경로(execute · commit · finalize)가 commit 단위와 변경 범위를 판단할 때
직접 읽는 공유 계약이다. run과 coordinator는 `rules/governance.md`의 pointer
문장을 따라 같은 정본에 도달한다. **승인 scope**는 plan 시점에 task 문서에서 확정한
`affected_paths`이고, **ledger scope**는 coordinator가 현재 `revision`에 기록한
source path 집합이다. scope 개정 명령과 lock 절차, 실패 뒤의 repair 예산과 중지
판정은 `rules/governance.md` `## Coordinator mode`가 소유하며 이 문서는 복제하지
않는다.

## Commit unit and staging

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
