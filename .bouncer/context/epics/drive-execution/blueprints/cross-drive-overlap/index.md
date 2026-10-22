---
type: bouncer.blueprint
title: drive 간 scope 충돌 판정
description: Rejects coordinate prepare and task commits whose scope overlaps another active coordinator drive.
resource: .bouncer/context/epics/drive-execution/blueprints/cross-drive-overlap/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-10-22T14:06:14.052+09:00'
bouncer:
  id: cross-drive-overlap
  epic_id: drive-execution
  blueprint_id: cross-drive-overlap
  status: closed
  order: 59
  commit_type: feat
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  attribution: bouncer-run의 coordinate prepare·task commit 경계에 drive 간 scope 충돌 판정을 더하는 실행 단계 동작이다
  supersedes: []
---
# drive 간 scope 충돌 판정

Epic: [drive-execution](../../index.md)

## Intent
- 경로·`exclusive_resources`가 겹치지 않는 두 coordinator drive는 각자 execution worktree에서 prepare부터 커밋까지 진행하고, 겹치면 `coordinate prepare`와 task 커밋이 상대 blueprint·task·겹친 경로나 자원을 보여 주며 거절한다.
- direct-run 절차가 `drive_tasks` 정지 뒤 `advance --task`를 안내하고, 계획 작성 규칙이 생성물 원본을 고치는 task에 생성물 경로와 parity 검증을 함께 요구한다.

## Contract
- 인터페이스:
  - 새 모듈 `scripts/src/lib/cross-drive.ts`가 다른 활성 원장의 task 목록과 충돌 상세를 돌려준다.
  - `coordinate prepare`와 `bouncer commit`·commit-safety 훅에 거절 사유 `cross-drive-conflict`·`cross-drive-ledger-unreadable`이 생긴다. 거절 결과는 `conflicts` 배열(`blueprint`, `task`, `paths`, `resources`, `legacy`) 또는 읽지 못한 `ledgerFile`을 싣는다.
- 데이터·상태: 원장 스키마는 바꾸지 않는다. bootstrap이 이미 task마다 `affected_paths`·`exclusive_resources`를 쓰고 revise가 `scope.paths`를 쓴다. 충돌 판정은 읽기만 한다.
- 수용 기준:
  1. 원장이 하나뿐이면 prepare·commit 결과가 지금과 같다.
  2. 경로가 겹치지 않고 자원도 공유하지 않는 drive B는 drive A가 활성이어도 prepare·commit이 성공한다.
  3. B의 task 경로가 A의 시작된 task(`pending`이 아닌 task, integrated 포함) 최신 scope와 조상 또는 정확 일치로 겹치면 B의 prepare가 `cross-drive-conflict`로 거절되고, 상대 blueprint·task·겹친 경로가 출력된다.
  4. 경로는 달라도 같은 `exclusive_resources` id를 선언하면 같은 사유로 거절되고 겹친 자원이 출력된다.
  5. prepare 뒤 경합으로 겹친 상태가 생겨도 커밋 시 staged 경로·task 자원 비교로 같은 사유가 나온다.
  6. B가 거절된 뒤에도 A는 prepare·커밋을 계속한다. B의 원장에 남은 `pending` task는 비교 대상이 아니므로, 먼저 wave를 연 drive가 우선이다.
  7. main worktree의 `main-worktree-source-write`, `unassigned-worktree`, `stale-revision`, ledger lock 거절은 그대로다.
- 검증 명령: task마다 focused `node --test`, terminal은 `npm run ci`.
- 실패 모드·엣지 케이스:
  - detached 원장(`status: detached`)은 비활성이라 비교하지 않는다. `active`·`awaiting_confirmation`·`partial_closed`·`promotion_stopped`는 활성이다.
  - finalize로 worktree가 지워진 drive는 원장이 없어 비교하지 않는다. `integration` 원장 파일이 없는 디렉터리도 건너뛴다.
  - 읽을 수 없는 다른 원장은 fail-closed로 `cross-drive-ledger-unreadable`과 그 경로를 낸다.
  - 상대 원장의 `pending` task는 비교하지 않는다. bootstrap만 하고 prepare가 거절된 drive가 다른 drive를 막지 않게 하기 위함이다. 상대가 나중에 그 task를 열면, 그 prepare에서 이쪽의 시작된 task와 비교된다.
  - `scope.paths`도 `affected_paths`도 없는 legacy task는 모든 task와 충돌한다(`legacy: true`).
  - standalone execute(원장 없음)는 판정하지도 판정받지도 않는다.
  - 두 drive가 동시에 prepare하면 둘 다 통과할 수 있다. cross-ledger lock은 두지 않고 커밋 시 재검사로 잡는다. 이때는 두 drive가 서로를 거절하므로 "먼저 연 drive 우선"은 순차 prepare에만 성립한다. 동시 prepare 충돌은 사용자가 한쪽을 detach하거나 계획을 고쳐 푼다.

## Out of scope
- 일반 worktree의 비중첩 커밋 허용(§9-2 결정).
- cross-ledger lock, 공용 자원 예약 목록, standalone execute 판정.
- main worktree·`unassigned-worktree`·stale revision·worker 할당 경계 변경.
- 복합 gate 출력 → `gates-review` 후속 blueprint.

## One-commit justification
- 하나의 PR로 묶는 이유: 판정 모듈, prepare·commit 연결, 문서가 같은 계약을 이룬다. 회고 문서 보정 두 건은 같은 drive 경험에서 나왔고 파일이 겹치지 않아 독립 task로 함께 싣는다.
