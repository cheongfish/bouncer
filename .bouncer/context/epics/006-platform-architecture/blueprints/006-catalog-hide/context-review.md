---
type: bouncer.context_review
title: 카탈로그 비공개 계획 판정
description: epic 056과 blueprint 001의 두 task가 범위·계약·검증 기준에서 일치하는지 판정한다
resource: .bouncer/context/epics/006-platform-architecture/blueprints/006-catalog-hide/context-review.md
tags:
  - bouncer
  - context_review
timestamp: '2026-08-28T11:43:50.455+09:00'
bouncer:
  id: 'CTXREVIEW-006'
  epic_id: '006'
  blueprint_id: '006'
  status: accepted
  context_review:
    findings:
      - id: CR-1
        severity: blocker
        status: resolved
      - id: CR-2
        severity: major
        status: resolved
      - id: CR-3
        severity: major
        status: resolved
      - id: CR-4
        severity: minor
        status: resolved
      - id: CR-5
        severity: minor
        status: resolved

---
# Context review

## Findings
- CR-1 (blocker, resolved): 두 task `affected_paths`를 Touch의 Rename 양쪽과 Modify 경로로 채움. 001에 `rules/governance.md`를 포함.
- CR-2 (major, resolved): 성공 조건 4를 비공개 11개 `index.md`의 `when the user asks for this skill by name` 0건으로 고정. `migrate-ids`와 `/bouncer-*` description은 제외.
- CR-3 (major, resolved): `test/skill-bouncer-surface.test.js` Touch를 비공개 11개 vs `skills/migrate-ids` 잔류로 나눔. `SUB_PATHS` 통째 이동을 거부.
- CR-4 (minor, resolved): `rules/governance.md`의 `skills/explain-diff/SKILL.md` 인용을 001 Touch·`affected_paths`에 넣음.
- CR-5 (minor, resolved): task 002가 Distill `plugin-skills` YAML `paths`에 `references/**`를 더하도록 Checklist를 고침.
