---
type: bouncer.review
title: 컨텍스트 우선 추천 엔진과 CLI 리뷰
description: graph-suggest 점수·신뢰도·저신뢰 판정과 CLI 계약을 판정한다
resource: .bouncer/context/epics/060-graphify-search-quality/blueprints/001-context-first-ranking/tasks/002/review.md
tags:
  - bouncer
  - review
timestamp: '2026-08-31T12:04:03.083+09:00'
bouncer:
  id: REVIEW-002
  epic_id: '060'
  blueprint_id: '001'
  status: accepted
  review:
    required: true
    findings:
      - id: F1
        severity: major
        status: resolved
      - id: F2
        severity: major
        status: resolved
      - id: F3
        severity: minor
        status: accepted
        note: 제외 경로는 후보에서 제거하며 reasons에 drop을 남기는 동작이 Interface의 −5 취지와 맞음
      - id: F4
        severity: minor
        status: resolved
      - id: F5
        severity: minor
        status: resolved
      - id: F6
        severity: nit
        status: accepted
        note: hasSpecificPrimary 중복 분기는 동작에 영향 없음
      - id: F7
        severity: nit
        status: accepted
        note: help short usage는 Checklist 문자열을 따르며 --repo는 파서에서 지원됨
---
# Review

## Findings
- F1 (major, resolved): contains-only (−3) 미적용 — ownership/relation 플래그와 테스트로 수정
- F2 (major, resolved): test-only 상위 low-confidence 도달 불가 — 게이트·픽스처로 수정
- F3 (minor, accepted): excludedPath −5는 drop + reasons로 처리
- F4 (minor, resolved): all-low 테스트가 generic-only에 걸리던 픽스처 수정
- F5 (minor, resolved): context path seed를 exact/segment/suffix로 제한
- F6 (nit, accepted): hasSpecificPrimary 중복 분기
- F7 (nit, accepted): help에 `--repo` 생략 — Checklist usage 우선
