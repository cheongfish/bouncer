---
type: bouncer.review
title: 000 리뷰 원장 예제
description: Complete blueprint-root review ledger with rounds
resource: .bouncer/context/epics/000-example-contract/blueprints/000-example-unit/review.md
tags:
  - bouncer
  - review
timestamp: '2026-08-12T12:00:00.000+09:00'
bouncer:
  id: REVIEW-000
  epic_id: '000'
  blueprint_id: '000'
  status: accepted
  review:
    required: true
    findings:
      - id: F1
        severity: major
        status: resolved
        note: Interface 거부 목록에 없는 입력을 throw로 바꿨음
        category: correctness
        brief_clause: tasks/001 Interface
        file: scripts/lib/example.js
        symbol: runExample
        fingerprint: 'correctness:tasks/001 interface:scripts/lib/example.js#runExample'
        actionability: must_fix
        origin: discovery
        first_seen_round: 1
        last_seen_round: 2
      - id: F2
        severity: nit
        status: accepted
        note: >-
          주석 순서만 다른 헬퍼는 계약 구멍이 아니므로 수용한다.
          후속 정리는 현재 task와 독립이다.
        category: maintainability
        brief_clause: tasks/001 Constraints
        file: scripts/lib/example.js
        symbol: formatNote
        fingerprint: 'maintainability:tasks/001 constraints:scripts/lib/example.js#formatNote'
        actionability: advisory
        origin: discovery
        first_seen_round: 1
        last_seen_round: 1
    rounds:
      - round: 1
        mode: discovery
        target:
          base: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
          head: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
        perspectives:
          - name: combined
            target_head: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
        task_brief_hashes:
          TASKS-001: 'cccccccccccccccccccccccccccccccccccccccc'
        intent_bundles:
          TASKS-001:
            id: example-bundle-000
            revision: 1
        previous_finding_ids: []
        new: 2
        resolved: 0
        regressed: 0
      - round: 2
        mode: delta
        target:
          base: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
          head: 'dddddddddddddddddddddddddddddddddddddddd'
        perspectives:
          - name: combined
            target_head: 'dddddddddddddddddddddddddddddddddddddddd'
        task_brief_hashes:
          TASKS-001: 'cccccccccccccccccccccccccccccccccccccccc'
        intent_bundles:
          TASKS-001:
            id: example-bundle-000
            revision: 1
        previous_finding_ids:
          - F1
          - F2
        new: 0
        resolved: 1
        regressed: 0
---
# Review

## Findings

### F1 — Interface 거부 입력을 throw하지 않음 (major → resolved)
- 요약: 거절 목록의 입력이 fallback으로 떨어졌다.
- 처분: resolved — throw로 바꿨음.

### F2 — 주석 순서만 다른 헬퍼 (nit → accepted)
- 요약: 동작은 같고 주석 순서만 다르다.
- 처분: accepted — 위 frontmatter note 참고.
