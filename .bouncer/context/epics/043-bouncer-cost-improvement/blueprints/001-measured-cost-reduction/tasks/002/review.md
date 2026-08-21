---
type: bouncer.review
title: scaffold 스키마 힌트 리뷰
description: 주석만 바뀌고 검증 스키마와 기본값이 유지됐는지 판정한다
resource: .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/001-measured-cost-reduction/tasks/002/review.md
tags:
  - bouncer
  - review
timestamp: '2026-08-21T20:32:39.457+09:00'
bouncer:
  id: REVIEW-002
  epic_id: '043'
  blueprint_id: '001'
  status: accepted
  review:
    required: true
    findings:
      - id: F1
        severity: minor
        status: resolved
      - id: F2
        severity: nit
        status: accepted
        note: >-
          review/context-review의 id·status includes는 프론트매터만으로도 참이다.
          severity 열거와 note 단언이 힌트를 고정함.
---
# Review

## Findings

- F1 (minor, resolved): `basis: []` 직전 YAML 주석(`# - graph: source | context`)을 테스트가 단언한다.
- F2 (nit, accepted): review/context-review의 `id`/`status` includes는 프론트매터만으로도 통과한다. severity 열거와 `note`가 힌트를 고정함.
