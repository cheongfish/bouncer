---
type: bouncer.blueprint
title: drive repair 경로의 커밋 누락과 라운드 거부 수정
description: Fix multi-commit fan-in loss, round sequence vs repair-wave limit mismatch, and missing findings in review repair briefs.
resource: .bouncer/context/epics/drive-execution/blueprints/fanin-rounds-repair-brief/index.md
tags:
  - bouncer
  - blueprint
  - coordinator
  - fan-in
  - repair-wave
  - review-rounds
timestamp: '2026-10-16T10:15:00.993+09:00'
bouncer:
  id: fanin-rounds-repair-brief
  epic_id: drive-execution
  blueprint_id: fanin-rounds-repair-brief
  status: closed
  order: 56
  commit_type: fix
  scale: full
  review_scope: blueprint
  supersedes: []
---
# drive repair 경로의 커밋 누락과 라운드 거부 수정

Epic: [103](../../../drive-repair-integrity/index.md)

## Intent
rework로 worker commit이 여러 개 쌓여도 fan-in이 모두 통합하고, repair wave 상한만큼 delta 리뷰 라운드를 기록할 수 있게 함.
리뷰 원인 repair task 문서에 finding 필드를 실어 implementer가 수정 대상을 빠뜨리지 않게 함.

## Contract
- 인터페이스:
  - commit wave fan-in은 task의 통합 시작점부터 기록된 worker SHA까지의 commit 범위를 적용하고 그 task마다 통합 commit 1개를 만든다. trailer `Bouncer-Worker-Commit: <기록된 worker SHA>`는 그대로다.
  - blueprint 최종 리뷰 전용 라운드 계약이 생긴다. 허용 순서는 기존 execute 순서 세 가지(`discovery`, `discovery,delta`, `discovery,delta,critical_recovery,delta`)에 `discovery,delta,delta`를 더한 것이고 `review record`(blueprint 범위)와 G21이 이 계약을 쓴다. task별 리뷰(G14, task 범위 `review record`)는 기존 `EXECUTE_ROUND_CONTRACT`를 그대로 쓴다.
  - repair wave 상한은 `validate-sections`가 export하는 상수 `REPAIR_WAVE_LIMIT`(값 2) 하나로 모이고, blueprint 계약의 최대 delta 수가 그 상수와 같다.
  - `coordinate repair --review-finding`이 만드는 repair `tasks.md`는 finding마다 `id`·`severity`·`category`·`file`·`symbol`·`brief_clause`, 값이 있으면 `actionability`·`note`를 담고, 제목과 Goal이 리뷰 repair를 가리킨다.
- 데이터·상태: 원장 스키마, review 문서 스키마, CLI 플래그, repair wave 상한 값(2)은 바뀌지 않는다. 바뀌는 것은 통합 HEAD의 내용, 라운드 검증 허용 집합, 생성되는 repair 문서 본문이다.
- 수용 기준: epic Success criteria 1–7.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - worker commit이 1개면 지금과 같은 결과가 나온다.
  - 범위 중간 commit에서 내용 충돌이 나면 기존과 같이 `fanin-conflict`로 그 task만 revoke하고, 충돌이 아닌 실패는 `cherry-pick-failed`다.
  - light 원장 fan-in은 cherry-pick을 하지 않으므로 바뀌지 않는다.
  - blueprint 리뷰의 `discovery,delta,delta,delta`, task별 리뷰의 `discovery,delta,delta`, critical_recovery를 섞은 새 조합은 거부된다. 기존 drive 복구 순서 `discovery,delta,critical_recovery,delta`는 두 범위 모두에서 계속 통과한다.
  - root `review.md`에 없거나 읽을 수 없는 finding id는 지금처럼 repair를 막지 않고 brief에 "review.md에서 찾지 못함"으로 남는다.
  - CI 원인 repair(`--failure-command`)의 문서 본문은 바뀌지 않는다.

## Out of scope
- `bouncer commit` amend, `coordinate record`의 다중 commit 거부
- light 원장 fan-in, task별 리뷰 라운드 순서, critical_recovery 순서, context review 라운드 계약
- repair wave 상한 값 변경, `review.md` Markdown 본문 파싱

## One-commit justification
- 세 수정은 모두 102/001 drive의 repair 경로를 막은 원인이고 같은 coordinator 상태 기계의 repair·fan-in·리뷰 기록 단계에 걸친다. 한 PR로 묶어야 두 번째 repair wave가 끝까지 통과하는 흐름을 한 번에 검토할 수 있다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - fan-in 범위 적용
* [Tasks 002](tasks/002/tasks.md) - 라운드 순서와 wave 상한 정렬
* [Tasks 003](tasks/003/tasks.md) - 리뷰 repair brief에 finding 반영
* [Tasks 004](tasks/004/tasks.md) - 종단 CI 검증
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
