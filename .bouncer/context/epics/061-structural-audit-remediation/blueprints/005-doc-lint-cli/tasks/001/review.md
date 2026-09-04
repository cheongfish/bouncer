---
type: bouncer.review
title: 001 문서 구조 검사 CLI 리뷰
description: Review for 001
resource: .bouncer/context/epics/061-structural-audit-remediation/blueprints/005-doc-lint-cli/tasks/001/review.md
tags:
  - bouncer
  - review
timestamp: '2026-09-04T09:08:37.412+09:00'
bouncer:
  id: REVIEW-001
  epic_id: '061'
  blueprint_id: '005'
  status: accepted
  review:
    required: true
    findings:
      - id: F1
        severity: major
        status: accepted
        note: epic index.md는 plan seed 재고이며 makeAllowed가 블루프린트와 함께 허용한다. Touch Extra가 아니라 첫 태스크 커밋 범위의 계획 문서다.
      - id: F2
        severity: minor
        status: resolved
        note: ''
      - id: F3
        severity: nit
        status: resolved
        note: ''
      - id: F4
        severity: nit
        status: accepted
        note: package.json과 lint → lint:docs 정규식이 순서를 이미 고정한다. indexOf 접두 매칭은 현 계약에서 거짓 통과를 만들지 않는다.
---
# Review

## Findings
<!-- finding: id, severity, status. accepted이면 note 필수.
     severity: blocker | major | minor | nit
     status: resolved | accepted -->
- F1 (major, accepted): epic index.md가 Touch 밖이라는 지적 — plan seed 재고이며 makeAllowed 허용. 이 태스크 커밋에 포함한다.
- F2 (minor, resolved): `runCli`의 도달 불가능한 `targets.length === 0` 분기 제거 예정/완료.
- F3 (nit, resolved): `contractForFile` 주석을 `contractForKind`에 맞게 수정 예정/완료.
- F4 (nit, accepted): `ci.indexOf('npm run lint')` 접두 매칭 — 별도 regex가 after-lint를 이미 강제.
