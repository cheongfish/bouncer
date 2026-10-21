---
type: bouncer.blueprint
title: gate 판정과 컨텍스트 리뷰 상태 모듈 분해
description: Split runCheckGate into per-gate modules and context-review-state into a storage layer and cycle transitions, then record the series measurement.
resource: .bouncer/context/epics/runtime-architecture/blueprints/gate-review-split/index.md
tags:
  - bouncer
  - blueprint
  - gates
  - context-review
  - refactor
  - measurement
timestamp: '2026-10-21T11:27:30.388+09:00'
bouncer:
  id: gate-review-split
  epic_id: runtime-architecture
  blueprint_id: gate-review-split
  status: closed
  order: 39
  commit_type: refactor
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  attribution: 게이트·컨텍스트 리뷰 상태 모듈 분해는 runtime-architecture의 모듈 책임 분해 범위임
  supersedes: []
---
# gate 판정과 컨텍스트 리뷰 상태 모듈 분해

Epic: [runtime-architecture](../../index.md)

## Intent
- 문제: `runCheckGate()` 416줄이 partial-close·plan·execute·finalize·commit gate를 한 함수에서 판정하고 `validate-gates.ts`가 1,961줄이며, `context-review-state.ts` 1,713줄은 경로·쓰기 안전 저장 계층과 cycle 전이가 섞여 전이 함수가 `state.json` 위치를 직접 안다.
- 완료 조건: `runCheckGate()`는 gate 단계를 골라 단계 모듈에 위임만 하고, 컨텍스트 리뷰 전이는 저장 계층 함수로만 디스크를 읽고 쓰며, 이 시리즈의 전후 실측이 `check-report`를 통과하는 inventory로 남는다.

## Contract
- 인터페이스: `validate-gates`의 export(`checkGate`, `checkPartialCloseEvidence`, `checkPlanDraft`, `SECURITY_PATH_TOKENS`)와 `context-review-state`의 export(`startCycle`, `recordReport`, `closeCycle`, `restartCycle`, `routeFollowUp`, `readStoredLatest`, `readLegacyEvidence`, `writeAtomic`, `writeImmutable`)는 이름·시그니처가 그대로다. 새 모듈은 내부 경계다.
- 데이터·상태: G 코드·메시지·순서, 컨텍스트 리뷰 디스크 형식(`state.json`, dispatch·report 파일, `context-review.md` 투영), 거절 reason은 바뀌지 않는다.
- 수용 기준: epic 성공 기준 5, 6, 7, 8.
- 검증 명령: 각 commit task의 `bouncer.verify`와 terminal task의 `npm run ci`.
- 실패 모드·엣지 케이스:
  - 같은 gate 안에서 여러 G 코드가 나는 경우의 순서를 보존한다(`failures.map(code)` 순서 단언).
  - execute와 commit이 함께 쓰는 `checkG13`·`checkG24`는 한 곳에만 둔다.
  - 새 gate 모듈이 `validate`·`validate-gates`·`finalize`를 import하면 순환이므로 거절한다(`plan-snapshot.ts:22-23` 주석의 금지 목록 포함).
  - 저장 계층의 symlink·저장소 밖 경로 거절과 `wx` 원자 쓰기 실패 시 임시 파일 정리를 보존한다.
  - 측정 도구 실패는 값으로 대체하지 않는다.

## Out of scope
- G 코드 추가·폐기, 판정 규칙 변경
- 컨텍스트 리뷰 상태 형식 변경과 재시작 한도 변경
- coordinator 계열 변경 (`coordinator-command-split`)
- `scripts/measure-source-boundaries.js` 수정

## One-commit justification
- 두 분해 task는 같은 원칙(진입 함수는 고르기만, 세부는 책임 모듈)을 gate와 리뷰 상태에 적용하고, 마지막 측정 task가 세 blueprint의 결과를 한 번에 기록한다. terminal 검증 하나로 함께 증명한다.
