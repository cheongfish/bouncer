---
type: bouncer.review
title: 001 review
description: Review for 001
resource: .bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/review.md
tags:
  - bouncer
  - review
timestamp: '2026-08-07T09:59:09.568+09:00'
bouncer:
  id: REVIEW-001
  epic_id: '020'
  blueprint_id: '001'
  status: accepted
  review:
    required: true
    findings:
      - id: F1
        severity: major
        status: resolved
        summary: scaffoldTask가 TASK_UNIT_BASENAMES import 후에도 body('tasks.md') 등 리터럴을 재사용함
      - id: F2
        severity: nit
        status: accepted
        note: expectedTaskDocIds의 typeof 분기는 동일 padStart라 동작 차이 없음. 후속 정리 가능.
        summary: expectedTaskDocIds number/string 분기가 동일 표현식
---
# Review

## Findings

- **F1** `major` → `resolved` — Constraints는 unit basename 문자열이
  `tasks-docs.ts`에만 있어야 하는데, `scaffoldTask`가 경로에는
  `TASK_UNIT_BASENAMES`를 쓰면서 `body('tasks.md')` 등으로 리터럴을
  다시 넣음. `body(tasksBase)` / `body(verifyBase)` / `body(reviewBase)`로
  교체함. (`scripts/src/lib/scaffold.ts`)

- **F2** `nit` → `accepted` — `expectedTaskDocIds`의 `typeof number` 분기가
  양쪽 모두 `String(number).padStart(3, '0')`라 동작 차이가 없음. 동작
  계약과 무관해 이번 커밋에서는 두지 않음.

재리뷰 결과 추가 발견 없음.
