---
type: bouncer.epic
title: 규모·위험 기반 리뷰 디스패치
description: Selects plan and execute review perspectives from deterministic size and risk signals while preserving review convergence contracts.
resource: .bouncer/context/epics/075-adaptive-review-dispatch/index.md
tags:
  - bouncer
  - epic
  - review
  - dispatch
  - risk
timestamp: '2026-09-21T10:38:33.284+09:00'
bouncer:
  id: '075'
  epic_id: '075'
  status: approved
  supersedes: []
---
# 규모·위험 기반 리뷰 디스패치

## Intent
- 문제: Plan과 Execute controller가 변경 규모와 무관하게 고정된 수의 reviewer를 호출하고, 보안 민감 변경의 추가 관점 여부도 자연어로 다시 판단한다.
- 목표: CLI가 문서·diff의 구조화된 신호로 리뷰 전략을 계산하고, controller는 작은 변경을 한 reviewer에게 맡기며 큰 Plan과 보안 민감 변경에만 fan-out을 사용한다.

## Success criteria
1. 리뷰 dispatch 분류기는 Plan의 `scale`·task 수·Interface·Touch 중첩과 Execute diff의 파일·변경 줄 수·승인된 위험 flag만 입력으로 사용하며 같은 입력에 같은 JSON을 반환한다.
2. `scale: light` Plan은 기존처럼 context review를 생략하고, 작은 full Plan은 문서·scope·성공 조건을 한 reviewer가 판단한다.
3. 큰 full Plan은 Interface·Touch 중첩 cluster마다 local reviewer를 호출한 뒤 한 global reviewer가 전체 DAG와 공유 경로를 판단한다.
4. 작은 Execute diff는 `spec_scope`, `correctness_tests`, `minimality_maintainability`를 한 reviewer가 함께 판단한다.
5. 공개 interface·인증·권한·credential 위험 flag가 하나라도 있으면 Execute 규모와 무관하게 `security` reviewer가 추가된다.
6. named agent, generic fallback, inline 실행이 같은 dispatch 결과와 frozen target을 사용한다.
7. frozen target, finding fingerprint, 단일 fix batch, delta certification, critical recovery 한도와 기존 review status 계약이 유지된다.

## Out of scope
- verification evidence 재사용과 coordinator checkpoint compaction
- reviewer finding 통계, reviewer 투표, 토큰 계측과 모델 선택 설정
- `scale: light`의 context-review 생략 계약과 사용자 선언 기반 scale 결정
- finding schema, review status, delta·critical recovery 순서 재설계
- 자연어 diff 내용을 검색해 위험을 추측하는 휴리스틱

## Blueprints
* [001 규모·위험 기반 리뷰 디스패치](blueprints/001-adaptive-review-dispatch/index.md) - CLI 분류기와 Plan·Execute reviewer 계약을 연결해 리뷰 fan-out을 규모와 위험에 맞춘다.
