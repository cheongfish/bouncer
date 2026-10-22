---
type: bouncer.blueprint
title: plan 리뷰 4관점 병렬과 light 검증 가능성 리뷰
description: Split plan context review of review_contract brief blueprints into four parallel perspectives and give light blueprints a verifiability review
resource: .bouncer/context/epics/plan-workflow/blueprints/plan-review-perspectives/index.md
tags:
  - bouncer
  - blueprint
  - context-review
  - review-dispatch
  - light-plan
  - review-contract
timestamp: '2026-10-22T23:06:21.769+09:00'
bouncer:
  id: plan-review-perspectives
  epic_id: plan-workflow
  blueprint_id: plan-review-perspectives
  status: closed
  order: 33
  commit_type: feat
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  attribution: plan 단계 context review의 관점 구성과 light 리뷰를 바꾸는 계획 단계 동작 변경이라 plan-workflow에 귀속
  supersedes: []
---
# plan 리뷰 4관점 병렬과 light 검증 가능성 리뷰

Epic: [plan-workflow](../../index.md)

## Intent
새 리뷰 계약 표식이 붙은 blueprint의 plan 리뷰를 겹치지 않는 4관점 병렬 호출로 나누고, light blueprint도 검증 가능성 관점 리뷰를 받게 한다.
표식이 없는 blueprint와 이미 저장된 리뷰 기록은 지금 동작을 그대로 유지한다.

## Background
session-handoff-note drive의 최종 리뷰 finding 중 타입 3중 정의·guard 복제·테스트 누락은 계획 단계에서 정할 수 있던 항목이었고, 정규식으로 느슨해진 테스트 단언은 브리프에 이미 정밀도가 적혀 있었다.
지금 plan 리뷰는 full이면 `combined` 한 명이 두 rubric을 함께 보고(`review-dispatch.ts` `classifyPlanReview`), light는 `strategy: skip`이라 리뷰가 전혀 없다.
`gates-review` `final-review-brief-compliance`가 run 최종 리뷰를 브리프 이행 판정으로 좁히므로, 설계 결함은 plan 리뷰가 먼저 잡아야 한다.
과거 `clustered` 다중 호출은 비용 대비 효과가 낮아 제거됐다. 이번 변경은 표식 blueprint에 한해 그 결정을 되돌리며(사용자 확인), 비용 비교는 병합 뒤 drive에서 따로 보고한다.

## Contract
- 인터페이스:
  - 전제: `final-review-brief-compliance`(B)가 먼저 병합된다. B는 `schema.ts` `reviewContractOf`, full scaffold의 `review_contract: brief`, 구조 검사 S38(값 검사와 light 동시 사용 거절)을 도입한다. 이 blueprint는 B 병합 뒤 실행한다.
  - light 표식(사용자 결정 2026-10-22): 새 light scaffold도 `review_contract: brief`를 쓰고, S38에서 light 동시 사용 거절을 뺀다. 값 검사(`brief`가 아니면 S38)는 그대로다.
  - 해석기 분리(사용자 결정 2026-10-22, light run은 현행 유지): `reviewContractOf`는 `scale: light`면 `'legacy'`를 돌려 run 쪽 소비자(최종 리뷰 관점·record·repair·G21)가 표식 light를 지금 light처럼 다룬다. plan 리뷰는 새 해석기 `planReviewContractOf`(light를 접지 않음, 잘못된 값은 `null`)를 쓴다.
  - `review-dispatch plan --blueprint <dir>`: 표식 full이면 `strategy: 'perspectives'`, `perspectives: ['consistency','scope_minimality','verifiability','risk_security']`. 표식 light면 `strategy: 'perspectives'`, `perspectives: ['verifiability']`이고 full과 같은 `snapshot_version`·parts·`follow_up` 필드를 싣는다. 표식이 없으면 full `single`/`['combined']`, light `skip` 그대로다.
  - plan 관점 enum(`CONTEXT_REVIEW_PERSPECTIVE`)에 `consistency`·`scope_minimality`·`verifiability`·`risk_security`를 더한다. `combined`·`local`·`global`과 legacy 네 이름은 그대로 읽는다.
  - `context-review start|record|restart|route --dispatch`: `perspectives` payload와 표식 light blueprint를 받는다. `close`는 dispatch 없이 그 cycle을 닫는다. `perspectives` cycle의 discovery round 관점은 dispatch `perspectives`와 같은 집합이어야 하고, delta round 관점은 full이면 `combined`, light면 `verifiability` 하나여야 한다.
  - `scaffold blueprint --scale light`: 표식이 붙는 새 light blueprint에 `context-review.md`를 만든다.
  - `plan approve`: 표식 light blueprint도 `context-review.md` `status: accepted`를 요구한다.
- 데이터·상태:
  - round 순서는 지금처럼 `discovery` 또는 `discovery,delta`다. 4관점 discovery는 round 1 하나에 관점 4개로 기록한다.
  - 같은 fingerprint finding은 관점을 넘어 하나로 병합하고 `category`에 관점 이름을 남긴다(현행 규칙).
  - 수정은 문서별 1회, delta는 1회, restart는 cycle당 1회다(현행 `RESTART_LIMIT`).
  - `review_contract`를 plan snapshot 구조(`normalizeStructure`)에 넣을지는 `final-review-brief-compliance` 소관이다.
- 수용 기준: epic Success criteria 3–6.
- 검증 명령: `npm run ci` (terminal TASKS-003).
- 실패 모드·엣지 케이스:
  - B가 병합되지 않으면 `reviewContractOf`·S38이 없어 이 blueprint의 Touch가 성립하지 않는다. `/bouncer-run`은 B 병합을 확인한 뒤 시작한다.
  - 표식 값이 `brief`가 아니면 light에서도 S38로 거절하고, plan dispatch는 `planReviewContractOf`가 `null`이면 `review-contract-invalid`로 거절한다.
  - 표식 light의 run 최종 리뷰는 `reviewContractOf`가 `'legacy'`를 돌려 B의 새 라운드 규칙을 받지 않는다.
  - 표식이 없는 blueprint에 `strategy: perspectives` payload를 주거나, 표식 blueprint에 `single`/`clustered` payload를 주면 `start`·`record`가 target-invalid로 거절한다. 표식 blueprint를 `combined` 한 명으로 리뷰하고 닫는 길은 없다.
  - `single`·`clustered` cycle에 새 관점 이름 round를 기록하면 `record`가 거절한다.
  - `perspectives` cycle에서 discovery 관점이 하나라도 빠지거나 더해지면, 또는 delta 관점이 지정값이 아니면 `record`가 거절한다.
  - 저장된 latest payload가 `perspectives`일 때 `--previous`로 넘기면 받는다. 지금은 `previous strategy must be single or clustered`로 거절된다.
  - 수정이 `affected_paths`·`depends_on`·`scale` 같은 구조를 바꾸면 delta가 아니라 restart다(현행). light↔full 전환도 restart다.
  - 한 관점이라도 `blocked`인 finding을 내면 승인으로 가지 않는다(현행 규칙을 문서에 유지).
  - 표식 light의 `context-review.md`는 light 100줄 예산에 들어가지 않는다.

## Out of scope
- `review_contract`가 없는 blueprint의 plan 리뷰 동작 변경
- full 표식 도입과 run 최종 리뷰 규칙 → `gates-review` `final-review-brief-compliance`
- 표식 light의 run 최종 리뷰를 새 계약으로 바꾸는 것(light run은 현행 유지)
- direct 실행 handoff 문장 → `drive-execution` `direct-run-final-repair`
- reviewer 모델 설정(`subagents`)
- 개편 전후 토큰 비교 측정 — 병합 뒤 drive에서 `metrics summary`로 보고한다

## One-commit justification
- 코드(TASKS-001)와 문서(TASKS-002)는 같은 관점 이름·전략 계약을 공유한다. 코드만 병합하면 skill·rubric이 `single`만 안내해 controller가 4관점을 호출하지 않고, 문서만 병합하면 CLI가 `perspectives`를 거절한다. 그래서 한 blueprint 안에서 두 commit task로 나누고 terminal 검증 하나로 묶는다.
