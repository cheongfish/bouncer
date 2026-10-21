---
type: bouncer.blueprint
title: coordinator facade 축소와 coordinate 명령 분해
description: Reduce the coordinator facade to the command API, share the fenced ledger-open sequence, and split coordinate() and cmdCoordinate() into per-subcommand handlers.
resource: .bouncer/context/epics/runtime-architecture/blueprints/coordinator-command-split/index.md
tags:
  - bouncer
  - blueprint
  - coordinator
  - facade
  - ledger
  - refactor
timestamp: '2026-10-21T11:27:30.212+09:00'
bouncer:
  id: coordinator-command-split
  epic_id: runtime-architecture
  blueprint_id: coordinator-command-split
  status: closed
  order: 38
  commit_type: refactor
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  attribution: coordinator facade와 coordinate 명령 분해는 runtime-architecture의 모듈 책임 분해 범위임
  supersedes: []
---
# coordinator facade 축소와 coordinate 명령 분해

Epic: [runtime-architecture](../../index.md)

## Intent
- 문제: `coordinator` facade가 원장·lease·worker 내부 helper까지 22개를 내보내 소비자가 내부를 직접 조립하고, 946줄 `coordinate()`가 서브명령 19개를 `if (command === …)` 연쇄로 처리하며, 원장 잠금 뒤 fence 확인 순서가 일곱 곳에 반복된다.
- 완료 조건: facade는 명령 API 3개만 내보내고 helper 소비자는 정해진 모듈에서 가져오며, `coordinate()`·`cmdCoordinate()` 본체는 서브명령을 골라 handler에 위임만 하고, 거절 reason·잠금·fence·lease 계약은 그대로다.

## Contract
- 인터페이스: `scripts/lib/coordinator`는 `coordinate`·`COORDINATE_FAILURE_HINTS`·`withCoordinateFailureHints`만 내보낸다. 원장 읽기·projection(`loadLedger`, `loadLedgerBytes`, `assertLedgerFence`, `projectCheckpoint`, `assertLeaseShape`, `LEDGER_REL`)은 `coordinator-ledger`, worker·dispatch 조회 helper는 신규 `coordinator-worker`, `readyWave`·`transition`은 `execution-dag`, `registeredIntegration`·`initialWorktreeState`는 `coordinator-git`에서 가져온다. 소비자 없는 `registeredWorker`·`normalizeCommitSha` 재export는 없앤다(함수는 정의 모듈에 남는다).
- 데이터·상태: 원장 JSON, lock 파일, checkpoint 형식, CLI 인자·JSON 출력·exit code는 바뀌지 않는다.
- 수용 기준: epic 성공 기준 4(잠금 안 원장 열기·fence 확인 순서), 5(facade·`coordinate()`·`cmdCoordinate()`), 7, 8.
- 검증 명령: 각 commit task의 `bouncer.verify`와 terminal task의 `npm run ci`.
- 실패 모드·엣지 케이스:
  - 거절 reason 우선순위 `missing-ledger` → `lease-invalid` → (`validateCoordinatorLedger`) → `ledger-checkpoint-invalid`/`stale-ledger-checkpoint`/`run-detached` → 명령별 검사를 바꾸지 않는다.
  - 잠금 밖 검증·잠금 안 재확인(phase1 hash 대조) 순서를 보존한다. 검증 실행을 잠금 안으로 옮기지 않는다.
  - `critical-recovery`는 task 조회 전 검증과 lease 검사 뒤 변경이 나뉘어 있다. 두 지점의 순서를 유지한다.
  - 새 `coordinator-*` 모듈의 `reason` 리터럴은 `test/coordinator.test.js`의 reason 완전성 검사 대상에 들어가야 한다(이름이 `coordinator-`로 시작하고 `coordinator.ts`에서 require로 도달).
  - 새 모듈이 `coordinator-commands`나 `coordinator`를 다시 import하면 순환이므로 거절한다.

## Out of scope
- 서브명령 이름·플래그·출력 변경, 새 서브명령
- `coordinate-next`·`coordinate-advance`의 판단 규칙 변경
- 원장 스키마 변경
- `validate-gates`·`context-review-state` 분해 (`gate-review-split`)

## One-commit justification
- facade 경계(`TASKS-001`) 위에서 두 갈래가 진행된다. 하나는 공통 잠금 helper → handler 표 → repair 모듈(`TASKS-002`→`003`→`004`)로 `coordinator-commands`를 줄이고, 다른 하나는 CLI 조립(`TASKS-005`)을 나란히 정리한다. 모두 같은 실행 조정 경계를 줄이는 동작 보존 변경이라 terminal 검증 하나로 함께 증명한다.
