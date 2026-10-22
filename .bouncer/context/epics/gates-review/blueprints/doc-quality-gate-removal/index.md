---
type: bouncer.blueprint
title: 문서 품질 gate 판정 삭제
description: Removes document-quality gate codes so only execution-safety checks block plan, execute, commit, and finalize.
resource: .bouncer/context/epics/gates-review/blueprints/doc-quality-gate-removal/index.md
tags:
  - bouncer
  - blueprint
  - gates
  - validate
  - context-review
  - review-format
timestamp: '2026-10-22T12:56:23.515+09:00'
bouncer:
  id: doc-quality-gate-removal
  epic_id: gates-review
  blueprint_id: doc-quality-gate-removal
  status: closed
  order: 14
  commit_type: feat
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  attribution: gate 판정의 blocking 규칙을 삭제하는 변경이라 gate·검증·리뷰 판정 domain에 귀속
  supersedes: []
---
# 문서 품질 gate 판정 삭제

Epic: [gates-review](../../index.md)

## Intent
범위·검증 증적·신선도·승인 드리프트·마감 완결성과 무관한 문서 품질 G 코드를 plan gate에서 삭제하고, G14·G21에서는 finding·round 형식 메시지만 걷어낸다.
사용자는 계획 문서 형식·context review·등록부 보정 때문에 막히지 않고, 실행 안전 판정은 기존 코드 그대로 남는다.

## Contract
- 인터페이스:
  - `bouncer validate --gate plan`은 G10·G11·G12·G18·G22·G25·G26·G27·G28·G29·G30·G31을 더 이상 내지 않는다. 번호는 G4·G9·G15처럼 결번으로 두고 재사용하지 않는다.
  - plan draft 검사(`validateBlueprint({ planDraft: true })`, `review-dispatch plan`)는 G5·G19·G20만 낸다.
  - execute G14와 finalize G21은 아래 실질 판정 메시지만 낸다. 그 밖의 `collectFindingFailures` 메시지(severity·status·note·fingerprint·category·rounds 형식 등)는 gate 결과에서 빠진다.
    - `<label> finding <id> open in accepted review`
    - `<label> accepted with open must_fix <id>`
    - fail-closed로 남기는 형식 메시지: `<label> findings must be an array`, `<label> finding <id> status invalid: <v>`, `<label> finding <id> actionability invalid`, `<label> finding <id> actionability missing`. 위 두 판정은 `status === 'open'`, `actionability === 'must_fix'` 정확 일치일 때만 나오므로, 이 값이 깨지면 열린 finding이 아무 메시지 없이 통과한다.
    - G21 자체 판정: `blueprint review missing`, `blueprint review not accepted`, `blueprint review has no rounds`, stale 판정
  - `GATE_FAILURE_HINTS`에서 G18·G22·G25–G31 행을 지운다.
- 데이터·상태: 문서·원장 형식 변경 없음. `.bouncer/epics.json`, `context-review.md`, context review state, `review record` 기록 시점 검증(`collectFindingFailures`)은 그대로다.
- 수용 기준: epic Success criteria 3–8.
- 검증 명령: commit task는 각자 focused `node --test <files>`, 종단 TASKS-004는 `npm run ci`.
- 실패 모드·엣지 케이스:
  - TODO 자리표시가 남은 brief, Touch가 정당화하지 않는 `affected_paths`, Do not touch와 겹치는 경로, accepted가 아닌 `context-review.md`, 존재하지 않는 Touch 경로, 미등록 epic도 plan gate를 통과한다. 실제 쓰기 범위는 G5·G17·commit scope가 계속 막는다.
  - `review-risk-missing` 경고는 G10 통과 분기 대신 Touch 절이 있을 때 돈다. `task-split` 경고는 그대로다.
  - findings가 배열이 아니거나 finding의 status·actionability가 enum 밖이면 G14·G21에서 계속 실패한다.
  - `blueprint review has no rounds`를 지우면 finalize stale 판정이 건너뛰므로 남긴다.
  - `review record`·`accept-risk`는 지금처럼 형식 위반 기록을 거절한다.

## Out of scope
- context review 파이프라인(`review-dispatch`·`context-review start/record`·scaffold·skill step 5) 제거. step 5는 권고 절차로 남는다.
- 등록부·`scaffold --attribution/--area`·S 코드 변경.
- 복합 gate 7개 이름과 출력 형식, drive 간 scope·`exclusive_resources` 충돌 판정(후속 blueprint).
- G24 적용 범위 변경, `gate_profile`·strict 모드 도입.
- `LEGACY_SCAFFOLD_COMMENT_BODIES` 문자열과 distill 감사 스냅샷(`test/distill-decommission-audit.test.js`).

## One-commit justification
- 한 PR이 "어떤 G 코드가 막는가"라는 하나의 계약을 바꾼다. 코드 삭제(TASKS-001·002)와 그 계약을 서술하는 문서(TASKS-003)가 함께 들어가야 플러그인 문서와 CLI 동작이 어긋나는 중간 상태가 없다.
