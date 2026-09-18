---
type: bouncer.epic
title: Task intent bundle 재사용
description: Reuses task intent bundles across execute roles and creates a new revision when function or Explain inputs change.
resource: .bouncer/context/epics/073-task-intent-bundle-reuse/index.md
tags:
  - bouncer
  - epic
  - intent
  - execute
  - provenance
timestamp: '2026-09-17T22:11:49.896+09:00'
bouncer:
  id: '073'
  epic_id: '073'
  status: approved
  supersedes: []
---
# Task intent bundle 재사용

## Intent

- 문제: `/bouncer-execute`의 역할별 dispatch가 같은 함수 의도를 다시 해석하거나 같은 Explain 본문을 반복 전달할 수 있다.
- 목표: 함수와 Explain이 바뀌지 않은 Task intent bundle을 재사용하고, 관련 입력이 달라진 경우에만 추적 가능한 새 revision을 만든다.

## Success criteria

1. 같은 function ref의 blob SHA와 선택된 Explain section hash가 같으면 기존 bundle ID와 revision을 반환하고 Git provenance resolver를 다시 실행하지 않는다.
2. 관련 함수 집합, 함수 blob SHA 또는 선택된 Explain section hash가 달라지면 같은 실행 Task에 대해 증가한 revision과 새 bundle ID를 반환한다.
3. bundle은 실행 Task ID와 function ref를 결정적 순서로 보존한다. 연결된 provenance entry는 stable Task ID, commit SHA, freshness와 Explain 경로를 가지며, non-historical entry만 선택 절 hash를 가진다.
4. `ambiguous`, `unresolved`, `unlinked`, `historical`, 손상되거나 사라진 cache 입력을 추측해 재사용하지 않는다.
5. debugger와 reviewer dispatch는 task brief hash, bundle ID, 역할에 필요한 절, diff 또는 실패 evidence만 받고 Explain 전체 본문을 중복 전달하지 않는다.
6. 기존 `bouncer intent --symbol`의 상태, JSON, exit code, lazy module-loading 계약과 Explain 8자리 SHA 저장 계약이 유지된다.
7. TypeScript 정본과 생성 CommonJS가 일치하고 집중 회귀 및 `npm run ci`가 통과한다.

## Out of scope

- 규모·위험 기반 reviewer dispatch 수 변경
- verification result 재사용과 coordinator checkpoint 축약
- lease, scheduler, safe fan-in과 pointer-independent 병렬 실행
- 토큰 사용량 계측과 생성 CommonJS의 Git 추적 제거
- 기존 commit·Explain SHA 형식, `bouncer intent` 공개 조회 결과와 freshness 의미 변경

## Blueprints

* [Task intent bundle 재사용 경계](blueprints/001-task-intent-bundle-reuse/index.md) - intent resolver 결과를 Git 공통 runtime bundle로 재사용하고 execute 역할별 payload를 bundle ID 중심으로 제한한다.
