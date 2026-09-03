---
type: bouncer.context_review
title: 유지보수와 배포 표면 계획 검토
description: Records the consistency review for the maintenance and distribution blueprint.
resource: .bouncer/context/epics/061-structural-audit-remediation/blueprints/004-maintenance-distribution/context-review.md
tags:
  - bouncer
  - context_review
timestamp: '2026-09-03T16:13:46.051+09:00'
bouncer:
  id: CTXREVIEW-004
  epic_id: '061'
  blueprint_id: '004'
  status: accepted
  context_review:
    findings:
      - id: CR-1
        severity: major
        status: resolved
      - id: CR-2
        severity: major
        status: resolved
      - id: CR-3
        severity: major
        status: resolved
      - id: CR-4
        severity: major
        status: resolved
      - id: CR-5
        severity: major
        status: resolved
      - id: CR-6
        severity: major
        status: accepted
        note: '`test/skill-bouncer-init.test.js`는 task 001의 affected_paths와 Touch에 이미 포함되어 있어 범위 누락이 없음.'
---
# 유지보수와 배포 표면 계획 검토

## Findings
- id: CR-1
  severity: major
  status: resolved
  finding: Task 004의 전체 skill CLI 전환 범위에 `skills/migrate-ids/SKILL.md`가 빠져 있었다.
  resolution: `migrate-ids`를 Touch와 `affected_paths`에 추가해 테스트의 `LAUNCHER_SKILLS` 대상과 실행 범위를 일치시켰다.
- id: CR-2
  severity: major
  status: resolved
  finding: 중첩 finalize reference와 런처 계약 테스트가 `affected_paths` 및 Touch에서 빠져 있었다.
  resolution: 세 개의 중첩 finalize reference와 master/skill 런처 계약 테스트를 `affected_paths`, Touch, Checklist에 추가했다.
- id: CR-3
  severity: major
  status: resolved
  finding: commit/run skill 런처 계약 테스트가 `affected_paths` 및 Checklist에서 빠져 있었다.
  resolution: `test/skill-bouncer-commit.test.js`와 `test/skill-bouncer-run.test.js`를 `affected_paths`, Touch, Checklist에 추가했다.
- id: CR-4
  severity: major
  status: resolved
  finding: `cleanup-handoff.md`의 `worktreePathFor` 내부 API 호출을 대체할 인터페이스가 계획에 없었다.
  resolution: 새 CLI 명령을 추가하지 않고, 기존 API를 보존하면서 `bouncer-root --auto`를 일회성 모듈 경로 해석에만 사용하는 예외 계약을 Goal, Touch, Constraints, Checklist에 명시했다.
- id: CR-5
  severity: major
  status: resolved
  finding: epic의 모든 CLI 예시 런처 기준이 task 004의 `runtime-state` 모듈 경로용 일회성 `bouncer-root --auto` 예외와 충돌했다.
  resolution: epic 성공 기준에 해당 모듈 경로 해석 예외를 명시해 task 004의 인터페이스·제약과 같은 범위로 맞췄다.
- id: CR-6
  severity: major
  status: accepted
  finding: promotion ACQ 회귀 테스트 경로가 affected_paths에 없다고 보고됐다.
  resolution: `test/skill-bouncer-init.test.js`는 현재 affected_paths와 Touch에 모두 있으므로 계획 변경 없이 기존 범위를 유지한다.
