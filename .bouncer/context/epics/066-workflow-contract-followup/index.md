---
type: bouncer.epic
title: 워크플로 계약 후속 정비
description: Coordinates implementer role synchronization, workflow skill measurements, and Graphify context ranking evaluation.
resource: .bouncer/context/epics/066-workflow-contract-followup/index.md
tags:
  - bouncer
  - epic
  - workflow
  - dispatch
  - graphify
  - measurement
timestamp: '2026-09-06T13:46:05.125+09:00'
bouncer:
  id: '066'
  epic_id: '066'
  status: approved
  supersedes: []
---
# 워크플로 계약 후속 정비

## Intent
- 문제: 구현 에이전트 역할 사본, 진입 workflow 문서, Graphify context 기여도의 현재 상태를 같은 근거로 판정할 후속 작업이 필요하다.
- 목표: 역할 사본 정합성을 회귀 테스트로 고정하고, 측정으로 입증된 workflow 중복만 줄이며, context ranking의 효용과 위험을 고정 corpus 결과로 기록한다.

## Success criteria
1. checked-in implementer TOML이 Markdown 변환 결과와 byte-for-byte로 일치한다.
2. generated marker와 exact match를 모두 만족한 새 named dispatch만 compact payload를 사용한다.
3. 여섯 workflow skill을 동일 기준으로 측정하고, 정비한 항목마다 제거한 중복과 보존한 ACQ·gate·scope 불변조건을 테스트로 증명한다.
4. 정비 근거가 없는 workflow skill은 수정하지 않고 측정값과 무변경 이유를 기록한다.
5. Graphify 평가는 source·test 기준선과 context 보강 결과를 분리해 추가 발견 경로, top-k recall, 오추천, self-hit을 기록한다.
6. context ranking의 유지 또는 후속 변경 검토 권고가 고정 corpus 측정값에서 도출된다.
7. task 3개의 focused test와 저장소 전체 `npm run ci`가 통과한다.

## Out of scope
- 이미 구현된 공통 출력, session 한정 출력 모드, commit gate 단일 실행, pre-draft context 질의 계약의 재구현
- reviewer를 포함한 다른 generated agent TOML의 동기화
- Graphify 점수·confidence·ranking 계약 또는 workflow 실행 순서 변경
- 제거된 범용 benchmark skill 복원과 새 측정 도구·dependency 추가
- 측정 근거가 없는 줄 수 축약과 기완료 blueprint 문서의 소급 수정

## Blueprints
* [워크플로 계약 후속 검증](blueprints/001-contract-maintenance-evaluation/index.md) - generated 역할 사본, 여섯 workflow skill, Graphify 평가 문서를 독립 task 3개로 검증하고 정비한다.
