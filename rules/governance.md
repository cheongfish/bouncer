# Governance

## Blueprint sizing rule

예외는 `bouncer.execution_kind: verification`인 종단 fan-in node다. 계획 시점의
문서 형태(어떤 파일을 scaffold하는지)는 `rules/planning.md`
`## Blueprint sizing rule`이 소유한다. 실패한 실행은 integrated로 전이하지 않는다.

workflow별 commit 단위, task·finalize의 staging 책임과 explain stamp는
`rules/commit-scope.md` `## Commit unit and staging`이 소유한다.

## Lightweight cycle

Light 선언·문서 집합·G10/G18·공유 maintenance 에픽 할당은 `rules/planning.md`
`## Lightweight cycle`이 소유한다. light 실행·dispatch 규범은
`skills/bouncer-execute/references/agent-dispatch.md`, quiz 크기는
`references/explain-diff/index.md`, canonical context는
`skills/bouncer-finalize/references/explain-quiz.md`가 소유한다. 아래는 scale
read-site 구현 설명이다.

`scripts/` reads `scale` in four places: `scaffoldBlueprint` picks the document
set, `scaffoldTask` inherits the blueprint's declared scale for a later task,
the plan gate picks the G10 / G18 contract, and structural validation (S20)
checks the value against the enum. Every one of them reads the declared
`bouncer.scale` value and nothing else; none infers size.

## Task DAG and approved scope

Plan-time DAG fields, ready waves, the plan-gate cycle check, and the approved baseline are owned by
`rules/planning.md` `## Task DAG and approved scope`.

coordinator 실행에서 승인 `affected_paths`가 무엇으로 취급되는지는
`rules/commit-scope.md` `## Approved and ledger scope`가 소유한다.

## Coordinator mode

coordinator drive의 worktree 위상과 ledger가 담는 scope·`revision`·결정 기록의
정의, 개정이 이름 붙일 수 있는 경로 경계, staged path 감사, worktree 경계와
G17·CLI·hook의 강제 계층은 `rules/commit-scope.md`가 소유한다.
coordinator 전용 authority, revision judgment, critical recovery, repair와
partial-close 절차는 `agents/bouncer-coordinator.md`가 소유한다. 아래는
lock과 atomic write 구현 설명이다.

- **Ledger lock and revision model** — read-modify-write is serialized so
  concurrent workers cannot mint one revision twice or drop a log entry. A
  writer that cannot take the ledger lock in time is refused outright, and a
  writer re-checks ownership twice — once before writing the task document and
  once before writing the ledger — backing off without writing at whichever
  check finds the lock lost. A writer that loses the lock between those two
  checks writes the task document but not the ledger: the second check refuses
  it, so the document is left carrying a `scope_revision` the ledger never
  recorded. That state needs no hand repair — `nextRevision` is a function of
  the ledger revision alone and a revision does not pre-check the document's
  `scope_revision`, so the next scope revision writes both sides to one number
  and reconciles them — but nothing heals on its own either: until that revision
  is issued, a task document whose `scope_revision` disagrees with the ledger is
  stale, and commit safety keeps refusing the commit rather than guessing which
  side is current; so does a ledger it cannot read, and a pointer task the
  ledger does not carry.
- **Repair write unit** — the task document and ledger revision are one write
  unit.
