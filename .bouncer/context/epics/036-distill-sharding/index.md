---
type: bouncer.epic
title: Distill 경로 샤딩
description: 경로 라우팅 기반 Project Distill 샤딩
resource: .bouncer/context/epics/036-distill-sharding/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-14T12:56:28.138+09:00'
bouncer:
  id: '036'
  epic_id: '036'
  status: approved
---
# 036 distill-sharding

## Intent
- 문제: Project Distill 전문을 매 plan·execute·run 세션이 읽어, 규칙이 늘수록 반복 컨텍스트 비용과 관련 규칙의 신호 손실이 커진다.
- 목표: Distill을 경로 글롭과 정적 의존을 가진 샤드로 보존하고, 안전한 조건에서만 affected paths로 선택 로드한다.

## Success criteria
1. 유효한 샤드 인덱스가 없는 저장소에서 `bouncer distill`과 워크플로 소비는 기존 단일 `Distill.md` 전문을 그대로 사용한다.
2. 샤드 모드 라우팅은 항상 샤드, 경로 교집합, `pulls` 전이 폐쇄를 포함하고, 매칭 실패·불확실성에서는 전량 로드한다.
3. `routing_enabled: true` 전환은 고아·누락·순환·라우팅 구멍 구조 경고가 없을 때만 허용된다.
4. context graph digest·freshness와 finalize 스코프는 인덱스에 등재된 샤드를 Project Distill 정본으로 처리한다.
5. plan/discovery는 전량을, execute/run은 확정된 `affected_paths`로 관련 샤드를 소비하며 finalize는 전량 검색 후 승격 대상을 라우팅한다.
6. 현행 Distill 불릿을 사람이 분류해 샤드로 옮긴 뒤에도 `routing_enabled`는 기본값 `false`로 유지된다.
7. 이 저장소에서 선택 라우팅을 활성화하고 파일·디렉터리·복수 경로·fail-open 결과를 검증한다.

## Out of scope
- 기존 Distill 불릿의 자동 분류·자동 삭제와 소비 저장소의 암묵적 샤드 전환.
- 샤드별 엄격한 바이트 상한·예산 강제, 히스토리 explain 백필, 중복 불릿의 validator 오류화.

## Blueprints
<!-- OKF §6 인덱스 형식. 새 blueprint를 만드는 기준은 하나 — 한 커밋으로
     리뷰 가능한 단위인가. 더 크면 blueprint를 쪼갠다. 하위 태스크 계층은
     만들지 않는다 (rules/governance.md).
     한 줄 목적에는 무엇이 바뀌는지(what)와 어디를 건드리는지(where)를
     함께 적는다. 기존 라인은 소급 수정하지 않는다. -->
* [001 path-routed-distill](blueprints/001-path-routed-distill/index.md) - Distill 라우터·CLI·검증·워크플로와 정본 샤드를 7개 태스크 커밋으로 연결한다
