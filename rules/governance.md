# Governance

## Blueprint sizing rule

예외는 `bouncer.execution_kind: verification`인 종단 fan-in node다. 계획 시점의
문서 형태(어떤 파일을 scaffold하는지)는 `rules/planning.md`
`## Blueprint sizing rule`이 소유한다. 실패한 실행은 integrated로 전이하지 않는다.

workflow별 commit 단위, task·finalize의 staging 책임과 explain stamp는
`rules/commit-scope.md` `## Commit unit and staging`이 소유한다.

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

coordinator 실행에서 승인 `affected_paths`가 무엇으로 취급되는지는
`rules/commit-scope.md` `## Approved and ledger scope`가 소유한다.

## Coordinator mode

coordinator drive의 worktree 위상과 ledger가 담는 scope·`revision`·결정 기록의
정의, 개정이 이름 붙일 수 있는 경로 경계, staged path 감사, worktree 경계와
G17·CLI·hook의 강제 계층은 `rules/commit-scope.md`가 소유한다. 아래는 coordinator만
수행하는 mutation 절차다.

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
- **Commit ownership** — workers report; only the coordinator revises scope,
  moves the pointer, and records the judgment behind either.
- **Critical recovery budget** — delta certification may send one qualifying
  `introduced_by_revision` or `missed_critical` blocker/major finding back to a
  prepared task when the brief and diff show false-acceptance risk without
  changing task intent or introducing a product decision, dependency, or public
  interface. Record its findings and reason with `coordinate critical-recovery`
  before dispatch, then record `resolved` or `blocked` afterward. The task has
  exactly one such recovery: a remaining same finding or any new blocker/major
  is terminal `blocked`, never another dispatch.

commit gate와 CLI·hook의 상대적 강제력, ledger 없는 standalone 흐름의 범위
판정은 `rules/commit-scope.md` `## Worktree and enforcement layers`와
`## Approved and ledger scope`가 소유한다.

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
