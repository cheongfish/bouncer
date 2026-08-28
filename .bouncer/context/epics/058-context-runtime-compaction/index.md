---
type: bouncer.epic
title: 런타임 지시문 압축
description: 마스터 규칙과 Project Distill의 주입량을 줄이면서 안전 계약과 선택 라우팅을 보존한다
resource: .bouncer/context/epics/058-context-runtime-compaction/index.md
tags:
  - bouncer
  - epic
  - distill
  - context
timestamp: '2026-08-28T13:44:23.858+09:00'
bouncer:
  id: '058'
  epic_id: '058'
  status: approved
  supersedes: []
---
# 058 런타임 지시문 압축

## Intent
- 문제: 모든 Bouncer 세션이 읽는 `CLAUDE.md`와 Project Distill 7개 샤드가 중복 절차, 종료된 회차 기록, 넓은 경로 패턴을 함께 품어 현재 Distill 전량만 47,964바이트다.
- 목표: 게이트·신뢰 경계·fail-open 계약을 유지하면서 마스터 규칙과 경로별 Distill 주입량을 측정 가능한 기준까지 줄인다.

## Success criteria
1. `CLAUDE.md`의 바이트 수가 변경 전 8,765바이트보다 30% 이상 줄고, `test/master-rules.test.js`가 요구하는 워크플로 순서·Distill 소비·신뢰 경계 계약은 모두 통과한다.
2. `bouncer distill --all`이 보고하는 샤드 본문 합계가 변경 전 47,964바이트보다 35% 이상 줄며 `core`는 4KB 이하, 모든 비항상 샤드는 각각 6KB 이하이다.
3. 벤치마크 경로와 일반 플러그인 경로가 서로 다른 비항상 샤드를 선택하고, 미분류 경로는 기존 fail-open 계약에 따라 전량을 선택한다.
4. 저장소 `distill.max_bytes`가 6KB 기준을 사용하고 구조 검사에 S26 경고가 없다.
5. 모든 task에서 `npm run ci`와 해당 Bouncer 게이트가 통과한다.

## Out of scope
- 설치 캐시와 과거 `.bouncer/context/**` 문서를 수정하지 않는다.
- Distill CLI의 라우팅 알고리즘, 자동 절삭·자동 요약, 워크플로 스킬과 named agent의 절차를 바꾸지 않는다.
- 규칙을 삭제했다는 이유만으로 제품 동작이나 게이트 판정을 바꾸지 않는다.

## Blueprints
<!-- OKF §6 인덱스 형식. 새 blueprint를 만드는 기준은 하나 — 한 커밋으로
     리뷰 가능한 단위인가. 더 크면 blueprint를 쪼갠다. 하위 태스크 계층은
     만들지 않는다 (rules/governance.md).
     한 줄 목적에는 무엇이 바뀌는지(what)와 어디를 건드리는지(where)를
     함께 적는다. 기존 라인은 소급 수정하지 않는다. -->
* [001 마스터 규칙·Distill 압축](blueprints/001-master-distill-compaction/index.md) - `CLAUDE.md`와 Distill 본문을 압축하고 플러그인·벤치마크 라우팅을 분리한다
