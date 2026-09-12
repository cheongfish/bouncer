---
type: bouncer.epic
title: task 브리프 구체성 강화
description: Makes task briefs executable without extra design judgment by linking current behavior, target behavior, code symbols, and verification.
resource: .bouncer/context/epics/070-task-brief-specificity/index.md
tags:
  - bouncer
  - epic
  - task-brief
  - plan-gate
  - spec-authoring
  - readiness
timestamp: '2026-09-12T20:40:51.403+09:00'
bouncer:
  id: '070'
  epic_id: '070'
  status: approved
  supersedes: []
---
# 070 task-brief-specificity

## Intent
- 문제: plan gate는 task 브리프의 절 존재와 경로 정합성만 판정하므로 현재 동작, 목표 동작, 변경 심볼, 검증 연결이 빠진 task도 승인되고 구현자가 설계 판단을 떠안는다.
- 목표: task 브리프 하나로 문제 조건, 관찰할 목표 동작, 조사·변경할 심볼, 허용·거부 입력, 보존 동작, 완료 검증을 찾게 하고, 조사 handoff·readiness 판정·리뷰 추적성을 blueprint 단위로 이어서 강화한다.

## Success criteria
1. full `tasks.md` 템플릿이 `## Current behavior`·`## Target behavior` 절과 `경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거` 열의 Touch 표를 제공하고, `parseTasksSections`가 두 절을 `currentBehavior`·`targetBehavior` 키로 따로 파싱한다는 `test/scaffold.test.js`와 `test/validate-gates.test.js`가 통과한다.
2. 두 새 절 중 하나에 TODO 자리표시(`TODO_RE`)가 남은 task를 plan gate G10이 거부하고, 두 절이 없는 기존 full task·light task·목록형 Touch는 이전과 같은 G10·G11·G12 판정을 받는다는 `test/validate-gates.test.js`가 통과한다.
3. `references/spec-authoring/index.md`의 tasks 항목이 Current behavior의 재현 조건 규칙, Target behavior의 성공·실패·보존 구분, Touch 표 열과 `신규 추출 지점` 규칙, 판정 불가 표현 금지 예시, 미확정 결정 처리, 동작 변화 없는 task의 판정 근거, full 전환 네 조건을 싣고, 구현자 Authority와 execute dispatch payload가 두 절을 포함한다는 `test/skill-spec-authoring.test.js`, `test/agents.test.js`, `test/skill-bouncer-execute.test.js`가 통과한다.
4. plan의 코드 조사 handoff가 코드 변경 경로마다 관련 심볼 또는 신규 추출 지점, 선택 근거, 조사 시점 commit을 반환하고 spec author가 이를 Touch 표에 옮긴다.
5. plan 승인 전 판정(plan gate 또는 context review)이 다음 세 조건을 각각 실패 코드나 finding으로 보고한다는 fixture 테스트가 통과한다: (a) Checklist에 대응하는 테스트·검증 항목이 없는 Target behavior 항목, (b) 심볼 칸과 신규 추출 지점이 모두 빈 코드 경로 Touch 행, (c) Interface에 없는 공개 계약을 Checklist가 요구하는 task.
6. execute reviewer 입력에 Target behavior와 Touch 표가 포함되고, review finding의 `brief_clause`가 task 절 이름을, evidence가 diff 위치를 가리킨다.
7. 각 blueprint를 마감할 때 `npm run ci`가 통과한다.

## Out of scope
- 강화 전후 scope revision·구현 재시도·reviewer finding 수 계측. benchmark 후속 작업으로 이연한다.
- 069 Out of scope 결정 1(Plan 작성 역할 계층 분리)의 agent 구성.
- light task 템플릿과 100줄 예산 변경.
- 기존 task 브리프를 새 절로 소급 작성하는 migration.
- explain `## Tasks`에 새 절을 복사하는 finalize 변경.
- review finding fingerprint 정규형 변경. 069/002가 정한 계약을 그대로 쓴다.

## Blueprints
* [001 task 브리프 본문 계약 강화](blueprints/001-task-brief-contract/index.md) - full task 템플릿에 현재·목표 동작 절과 심볼 단위 Touch 표를 두고 작성 지침·구현자 전달에 반영 — `scripts/src/lib/templates.ts`, `validate-sections.ts`, `validate-gates.ts`, `references/spec-authoring/`, `agents/bouncer-implementer.md`

후속 blueprint는 아직 작성하지 않았다. 002 모듈·심볼 조사 handoff(성공 조건 4), 003 semantic readiness 판정(5), 004 task review 추적성(6) 순서로 이 epic에 추가한다. 004는 069/002의 finding 필드를 재사용하도록 범위를 다시 정한다.
