---
type: bouncer.blueprint
title: light 계획 계약 경량화
description: light 전용 scaffold와 plan gate로 승인 범위와 실행 증적을 보존하며 계획 고정비를 줄인다
resource: .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/002-light-plan-contract/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-21T20:32:39.595+09:00'
bouncer:
  id: '002'
  epic_id: '043'
  blueprint_id: '002'
  status: closed
  commit_type: feat
  scale: full
---
# 002 light 계획 계약 경량화

Epic: [043](../../index.md)

## Intent
- 문제: `scale: light`는 epic·agent·quiz 왕복만 줄이고 full과 같은 scaffold와 G10·G18을 요구해 실제 계획 문서가 340줄이다.
- 완료 조건: 명시적 light scaffold가 축약 문서 세트를 만들고 light plan gate가 그 계약을 판정하며, full 경로는 기존 문서와 게이트를 그대로 유지한다.

## Contract
- 인터페이스: `bouncer scaffold blueprint --scale light`는 `scale: light` blueprint와 축약 task bundle을 만들고 `context-review.md`를 만들지 않는다. light plan gate는 G18을 면제하고 G10에서 `Goal & intent`, `Touch`, `Checklist`만 요구한다. G4·G5·G11·G12는 full과 같다. `--scale` 생략 또는 `full`은 현행 다섯 문서와 G10·G18 계약을 유지한다.
- 데이터·상태: `bouncer.scale` 열거값과 `bouncer_schema`는 바뀌지 않는다. light도 tasks·verification·review를 유지하고 execute 이후 G6~G8·G13·G14·G16·G17을 그대로 통과한다.
- 수용 기준: Epic 성공 조건 4~7이 참이고, 고정 timestamp의 새 light blueprint plan 단계 파일 총 줄 수 합계가 100 이하임을 테스트가 단언한다.
- 검증 명령: 구현 task는 `npm run ci`; 후속 측정은 BP001과 같은 네 명령·네 프롬프트·블라인드 심사를 사용한다.
- 실패 모드·엣지 케이스: 알 수 없는 `--scale`은 파일 생성 전에 거부한다. 기존 `scale: light` 문서에 context-review가 있어도 읽기·실행을 막지 않는다. light 작업이 커지면 새 plan에서 `scale: full`로 되돌리고 누락 문서를 scaffold한 뒤 full gate를 따른다. full에 context-review가 없거나 Interface·Do not touch가 비면 기존 G18·G10이 계속 실패한다.

## Out of scope
- `affected_paths`, verify 원장, review, commit/finalize 게이트 완화.
- `quick` 등 새 모드와 경량 자동 판정.
- BP001의 scaffold 힌트·측정기 수정 재작업.

## Delivery order
1. Task 001은 CLI·scaffold·plan gate·workflow 문서·계약 테스트를 한 호환성 파기 계약으로 전환한다.
2. Task 002는 같은 네 사례를 다시 측정해 100줄 상한과 비용·품질 조건을 판정한다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - light scaffold와 plan gate 계약
* [Tasks 002](tasks/002/tasks.md) - light 계약 적용 후 3회차 측정
* [Verification 001](tasks/001/verification.md) - light 계약 검증 증적
* [Verification 002](tasks/002/verification.md) - 3회차 측정 증적
* [Review 001](tasks/001/review.md) - light 계약 리뷰
* [Review 002](tasks/002/review.md) - 3회차 측정 리뷰
* [Context review](context-review.md) - 계획 문서 정합성 판정
