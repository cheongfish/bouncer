---
type: bouncer.epic
title: Bouncer 비용 대비 품질 개선
description: 측정 가능한 비용 절감과 경량 계획 계약으로 Bouncer의 품질 이득을 유지한다
resource: .bouncer/context/epics/043-bouncer-cost-improvement/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-21T20:32:39.359+09:00'
bouncer:
  id: '043'
  epic_id: '043'
  status: approved
---
# 043 Bouncer 비용 대비 품질 개선

## Intent
- 문제: Bouncer를 적용하면 test quality는 좋아지지만 토큰 2.19배, 툴 호출 3.98배, 시간 3.32배가 들고 작은 작업도 313~365줄의 계획 문서를 만든다.
- 목표: 스키마 발견 왕복과 `scale: light`의 고정비를 줄여 시간 배수를 2.5배 이하로 낮추면서 test quality 증가분 3.00과 on arm 실격 0건을 유지한다.

## Success criteria
1. `c7df084` 기준 on arm 4런과 scaffold 개선 후 on arm 4런이 같은 네 프롬프트·검증 명령·블라인드 심사 규약으로 기록된다.
2. scaffold 개선 후 4런에서 G18 및 S9/G4 스키마 발견 실패가 각각 0건이다.
3. 2회차에서 시간 배수가 2.5배 이하이고 test quality 증가분 3.00, on arm 실격 0건을 유지한다.
4. `scale: light` blueprint의 plan 단계 문서 총합이 100줄 이하이며 full scaffold와 full plan gate 계약은 바뀌지 않는다.
5. light에서도 `affected_paths`, verify 실행 증적, review, commit scope, finalize 이해도 판정이 유지된다.
6. light 계약 적용 후 같은 네 태스크로 3회차를 실행하고 조건 3을 다시 판정한다.
7. 각 구현 task의 `npm run ci`가 통과한다.

## Out of scope
- 벤치마크 프롬프트·`done_when`·루브릭·네 검증 명령을 바꾸지 않는다.
- G13 원장과 `git commit -a` 가드의 구현을 다시 설계하지 않는다.
- `config.json` 스키마, Graphify 알고리즘, Distill 라우팅을 변경하지 않는다.
- npm 패키지·외부 측정 서비스·새 런타임 의존성을 추가하지 않는다.

## Blueprints
* [001 측정 기반 비용 절감](blueprints/001-measured-cost-reduction/index.md) - 변경 전 기준선을 고정하고 scaffold 힌트·측정 도구·공유 상태 문서를 고친 뒤 2회차를 기록한다
* [002 light 계획 계약](blueprints/002-light-plan-contract/index.md) - light 전용 scaffold와 plan gate 계약으로 계획 문서를 100줄 이하로 줄이고 3회차를 기록한다
* [004 정적 baseline과 측정 계약](blueprints/004-baseline-measurement/index.md) - 회귀 시나리오와 정적 지표 수집 계약을 고정한다
* [005 named agent 정본화](blueprints/005-agent-rubric-ssot/index.md) - 네 역할의 상세 rubric을 named agent 정본으로 통합한다
* [006 조건부 절차 reference 분리](blueprints/006-conditional-reference-split/index.md) - 진입 스킬의 조건부 절차를 reference로 분리한다
* [007 반복 규칙 공통화](blueprints/007-shared-rule-blocks/index.md) - 반복 규칙의 정본을 rules로 통합한다
* [008 description 축약과 예산 고정](blueprints/008-description-budget-lock/index.md) - 스킬 description 비용과 정본 개수를 고정한다
* [009 실행 baseline](blueprints/009-execution-baseline/index.md) - 실행 지표의 변경 전 기준선을 기록한다
