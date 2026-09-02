---
type: bouncer.tasks
title: platform architecture epic을 006으로 통합함
description: Moves platform architecture history into canonical epic 006.
resource: .bouncer/context/epics/014-numeric-context-ids/blueprints/004-corpus-consolidation/tasks/008/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-09-01T21:18:40.347+09:00'
bouncer:
  id: TASKS-008
  epic_id: '014'
  blueprint_id: '004'
  status: verified
  commit_intent:
    - 006, 029, 035, 045, 056의 platform architecture 결정이 여러 epic에 분산되어 있었음
    - 해당 history를 006-scripts-typescript 아래로 모아 플랫폼 아키텍처 역사를 단일 hierarchy로 통합하고 검색 baseline을 맞춤
  affected_paths:
    - .bouncer/context/epics/006-scripts-typescript/blueprints/001-tsc-cjs-migrate/distill.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/001-tsc-cjs-migrate/index.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/001-tsc-cjs-migrate/tasks/001/review.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/001-tsc-cjs-migrate/tasks/001/tasks.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/001-tsc-cjs-migrate/tasks/001/verification.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/002-skill-structure/explain.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/002-skill-structure/index.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/002-skill-structure/tasks/001/review.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/002-skill-structure/tasks/001/tasks.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/002-skill-structure/tasks/001/verification.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/002-skill-structure/tasks/002/review.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/002-skill-structure/tasks/002/tasks.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/002-skill-structure/tasks/002/verification.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/002-skill-structure/tasks/003/review.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/002-skill-structure/tasks/003/tasks.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/002-skill-structure/tasks/003/verification.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/002-skill-structure/tasks/004/review.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/002-skill-structure/tasks/004/tasks.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/002-skill-structure/tasks/004/verification.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/003-core-module-split/context-review.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/003-core-module-split/explain.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/003-core-module-split/index.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/003-core-module-split/tasks/001/review.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/003-core-module-split/tasks/001/tasks.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/003-core-module-split/tasks/001/verification.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/003-core-module-split/tasks/002/review.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/003-core-module-split/tasks/002/tasks.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/003-core-module-split/tasks/002/verification.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/003-core-module-split/tasks/003/review.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/003-core-module-split/tasks/003/tasks.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/003-core-module-split/tasks/003/verification.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/003-core-module-split/tasks/004/review.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/003-core-module-split/tasks/004/tasks.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/003-core-module-split/tasks/004/verification.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/004-skill-body-shape/context-review.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/004-skill-body-shape/explain.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/004-skill-body-shape/index.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/004-skill-body-shape/tasks/001/review.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/004-skill-body-shape/tasks/001/tasks.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/004-skill-body-shape/tasks/001/verification.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/004-skill-body-shape/tasks/002/review.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/004-skill-body-shape/tasks/002/tasks.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/004-skill-body-shape/tasks/002/verification.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/004-skill-body-shape/tasks/003/review.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/004-skill-body-shape/tasks/003/tasks.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/004-skill-body-shape/tasks/003/verification.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/005-implementation-doc-comments/context-review.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/005-implementation-doc-comments/explain.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/005-implementation-doc-comments/index.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/005-implementation-doc-comments/tasks/001/review.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/005-implementation-doc-comments/tasks/001/tasks.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/005-implementation-doc-comments/tasks/001/verification.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/006-catalog-hide/context-review.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/006-catalog-hide/explain.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/006-catalog-hide/index.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/006-catalog-hide/tasks/001/review.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/006-catalog-hide/tasks/001/tasks.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/006-catalog-hide/tasks/001/verification.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/006-catalog-hide/tasks/002/review.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/006-catalog-hide/tasks/002/tasks.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/006-catalog-hide/tasks/002/verification.md
    - .bouncer/context/epics/006-scripts-typescript/index.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/001-tsc-cjs-migrate/distill.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/001-tsc-cjs-migrate/index.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/001-tsc-cjs-migrate/tasks/001/review.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/001-tsc-cjs-migrate/tasks/001/tasks.md
    - .bouncer/context/epics/006-scripts-typescript/blueprints/001-tsc-cjs-migrate/tasks/001/verification.md
    - .bouncer/context/epics/006-scripts-typescript/index.md
    - .bouncer/context/epics/029-release-one-zero/blueprints/001-skill-structure/explain.md
    - .bouncer/context/epics/029-release-one-zero/blueprints/001-skill-structure/index.md
    - .bouncer/context/epics/029-release-one-zero/blueprints/001-skill-structure/tasks/001/review.md
    - .bouncer/context/epics/029-release-one-zero/blueprints/001-skill-structure/tasks/001/tasks.md
    - .bouncer/context/epics/029-release-one-zero/blueprints/001-skill-structure/tasks/001/verification.md
    - .bouncer/context/epics/029-release-one-zero/blueprints/001-skill-structure/tasks/002/review.md
    - .bouncer/context/epics/029-release-one-zero/blueprints/001-skill-structure/tasks/002/tasks.md
    - .bouncer/context/epics/029-release-one-zero/blueprints/001-skill-structure/tasks/002/verification.md
    - .bouncer/context/epics/029-release-one-zero/blueprints/001-skill-structure/tasks/003/review.md
    - .bouncer/context/epics/029-release-one-zero/blueprints/001-skill-structure/tasks/003/tasks.md
    - .bouncer/context/epics/029-release-one-zero/blueprints/001-skill-structure/tasks/003/verification.md
    - .bouncer/context/epics/029-release-one-zero/blueprints/001-skill-structure/tasks/004/review.md
    - .bouncer/context/epics/029-release-one-zero/blueprints/001-skill-structure/tasks/004/tasks.md
    - .bouncer/context/epics/029-release-one-zero/blueprints/001-skill-structure/tasks/004/verification.md
    - .bouncer/context/epics/029-release-one-zero/index.md
    - .bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split/context-review.md
    - .bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split/explain.md
    - .bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split/index.md
    - .bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split/tasks/001/review.md
    - .bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split/tasks/001/tasks.md
    - .bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split/tasks/001/verification.md
    - .bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split/tasks/002/review.md
    - .bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split/tasks/002/tasks.md
    - .bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split/tasks/002/verification.md
    - .bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split/tasks/003/review.md
    - .bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split/tasks/003/tasks.md
    - .bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split/tasks/003/verification.md
    - .bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split/tasks/004/review.md
    - .bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split/tasks/004/tasks.md
    - .bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split/tasks/004/verification.md
    - .bouncer/context/epics/035-scripts-refactor/index.md
    - .bouncer/context/epics/045-skill-shape/blueprints/001-skill-body-shape/context-review.md
    - .bouncer/context/epics/045-skill-shape/blueprints/001-skill-body-shape/explain.md
    - .bouncer/context/epics/045-skill-shape/blueprints/001-skill-body-shape/index.md
    - .bouncer/context/epics/045-skill-shape/blueprints/001-skill-body-shape/tasks/001/review.md
    - .bouncer/context/epics/045-skill-shape/blueprints/001-skill-body-shape/tasks/001/tasks.md
    - .bouncer/context/epics/045-skill-shape/blueprints/001-skill-body-shape/tasks/001/verification.md
    - .bouncer/context/epics/045-skill-shape/blueprints/001-skill-body-shape/tasks/002/review.md
    - .bouncer/context/epics/045-skill-shape/blueprints/001-skill-body-shape/tasks/002/tasks.md
    - .bouncer/context/epics/045-skill-shape/blueprints/001-skill-body-shape/tasks/002/verification.md
    - .bouncer/context/epics/045-skill-shape/blueprints/001-skill-body-shape/tasks/003/review.md
    - .bouncer/context/epics/045-skill-shape/blueprints/001-skill-body-shape/tasks/003/tasks.md
    - .bouncer/context/epics/045-skill-shape/blueprints/001-skill-body-shape/tasks/003/verification.md
    - .bouncer/context/epics/045-skill-shape/blueprints/002-implementation-doc-comments/context-review.md
    - .bouncer/context/epics/045-skill-shape/blueprints/002-implementation-doc-comments/explain.md
    - .bouncer/context/epics/045-skill-shape/blueprints/002-implementation-doc-comments/index.md
    - .bouncer/context/epics/045-skill-shape/blueprints/002-implementation-doc-comments/tasks/001/review.md
    - .bouncer/context/epics/045-skill-shape/blueprints/002-implementation-doc-comments/tasks/001/tasks.md
    - .bouncer/context/epics/045-skill-shape/blueprints/002-implementation-doc-comments/tasks/001/verification.md
    - .bouncer/context/epics/045-skill-shape/index.md
    - .bouncer/context/epics/056-unpublished-helper-skills/blueprints/001-catalog-hide/context-review.md
    - .bouncer/context/epics/056-unpublished-helper-skills/blueprints/001-catalog-hide/explain.md
    - .bouncer/context/epics/056-unpublished-helper-skills/blueprints/001-catalog-hide/index.md
    - .bouncer/context/epics/056-unpublished-helper-skills/blueprints/001-catalog-hide/tasks/001/review.md
    - .bouncer/context/epics/056-unpublished-helper-skills/blueprints/001-catalog-hide/tasks/001/tasks.md
    - .bouncer/context/epics/056-unpublished-helper-skills/blueprints/001-catalog-hide/tasks/001/verification.md
    - .bouncer/context/epics/056-unpublished-helper-skills/blueprints/001-catalog-hide/tasks/002/review.md
    - .bouncer/context/epics/056-unpublished-helper-skills/blueprints/001-catalog-hide/tasks/002/tasks.md
    - .bouncer/context/epics/056-unpublished-helper-skills/blueprints/001-catalog-hide/tasks/002/verification.md
    - .bouncer/context/epics/056-unpublished-helper-skills/index.md
    - .bouncer/context/index.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-09-01T21:18:40.347+09:00'
    suggested_paths: []
    quality:
      status: low-confidence
      confidence: low
      reasons:
        - context graph query produced no safe file ranking for corpus migration
        - migration scope is confirmed from the explicit canonical mapping
    candidates:
      implementation: []
      test: []
      context: []
    basis:
      - graph: source
        status: reused
        query: canonical corpus migration task 008
        result: source graph does not determine document moves
      - graph: test
        status: reused
        query: canonical corpus migration task 008
        result: test graph does not determine document moves
      - graph: context
        status: updated
        query: canonical corpus migration task 008
        result: low-confidence; user-confirmed migration map supplies scope
---
# Tasks

Blueprint: [004](../../index.md)

## Goal & intent
006,029,035,045,056의 BP를 `006-scripts-typescript`로 통합한다.

## Interface
- 제공: platform architecture history가 하나의 hierarchy에 있다.
- 거부: scripts 구현은 변경하지 않는다.

## Touch
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/001-tsc-cjs-migrate/distill.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/001-tsc-cjs-migrate/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/001-tsc-cjs-migrate/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/001-tsc-cjs-migrate/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/001-tsc-cjs-migrate/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/002-skill-structure/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/002-skill-structure/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/002-skill-structure/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/002-skill-structure/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/002-skill-structure/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/002-skill-structure/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/002-skill-structure/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/002-skill-structure/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/002-skill-structure/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/002-skill-structure/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/002-skill-structure/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/002-skill-structure/tasks/004/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/002-skill-structure/tasks/004/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/002-skill-structure/tasks/004/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/003-core-module-split/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/003-core-module-split/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/003-core-module-split/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/003-core-module-split/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/003-core-module-split/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/003-core-module-split/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/003-core-module-split/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/003-core-module-split/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/003-core-module-split/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/003-core-module-split/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/003-core-module-split/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/003-core-module-split/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/003-core-module-split/tasks/004/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/003-core-module-split/tasks/004/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/003-core-module-split/tasks/004/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/004-skill-body-shape/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/004-skill-body-shape/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/004-skill-body-shape/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/004-skill-body-shape/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/004-skill-body-shape/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/004-skill-body-shape/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/004-skill-body-shape/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/004-skill-body-shape/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/004-skill-body-shape/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/004-skill-body-shape/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/004-skill-body-shape/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/004-skill-body-shape/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/005-implementation-doc-comments/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/005-implementation-doc-comments/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/005-implementation-doc-comments/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/005-implementation-doc-comments/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/005-implementation-doc-comments/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/005-implementation-doc-comments/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/006-catalog-hide/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/006-catalog-hide/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/006-catalog-hide/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/006-catalog-hide/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/006-catalog-hide/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/006-catalog-hide/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/006-catalog-hide/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/006-catalog-hide/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/006-catalog-hide/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/001-tsc-cjs-migrate/distill.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/001-tsc-cjs-migrate/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/001-tsc-cjs-migrate/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/001-tsc-cjs-migrate/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/blueprints/001-tsc-cjs-migrate/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/029-release-one-zero/blueprints/001-skill-structure/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/029-release-one-zero/blueprints/001-skill-structure/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/029-release-one-zero/blueprints/001-skill-structure/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/029-release-one-zero/blueprints/001-skill-structure/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/029-release-one-zero/blueprints/001-skill-structure/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/029-release-one-zero/blueprints/001-skill-structure/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/029-release-one-zero/blueprints/001-skill-structure/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/029-release-one-zero/blueprints/001-skill-structure/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/029-release-one-zero/blueprints/001-skill-structure/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/029-release-one-zero/blueprints/001-skill-structure/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/029-release-one-zero/blueprints/001-skill-structure/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/029-release-one-zero/blueprints/001-skill-structure/tasks/004/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/029-release-one-zero/blueprints/001-skill-structure/tasks/004/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/029-release-one-zero/blueprints/001-skill-structure/tasks/004/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/029-release-one-zero/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split/tasks/004/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split/tasks/004/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split/tasks/004/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/035-scripts-refactor/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/045-skill-shape/blueprints/001-skill-body-shape/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/045-skill-shape/blueprints/001-skill-body-shape/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/045-skill-shape/blueprints/001-skill-body-shape/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/045-skill-shape/blueprints/001-skill-body-shape/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/045-skill-shape/blueprints/001-skill-body-shape/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/045-skill-shape/blueprints/001-skill-body-shape/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/045-skill-shape/blueprints/001-skill-body-shape/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/045-skill-shape/blueprints/001-skill-body-shape/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/045-skill-shape/blueprints/001-skill-body-shape/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/045-skill-shape/blueprints/001-skill-body-shape/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/045-skill-shape/blueprints/001-skill-body-shape/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/045-skill-shape/blueprints/001-skill-body-shape/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/045-skill-shape/blueprints/002-implementation-doc-comments/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/045-skill-shape/blueprints/002-implementation-doc-comments/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/045-skill-shape/blueprints/002-implementation-doc-comments/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/045-skill-shape/blueprints/002-implementation-doc-comments/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/045-skill-shape/blueprints/002-implementation-doc-comments/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/045-skill-shape/blueprints/002-implementation-doc-comments/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/045-skill-shape/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/056-unpublished-helper-skills/blueprints/001-catalog-hide/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/056-unpublished-helper-skills/blueprints/001-catalog-hide/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/056-unpublished-helper-skills/blueprints/001-catalog-hide/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/056-unpublished-helper-skills/blueprints/001-catalog-hide/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/056-unpublished-helper-skills/blueprints/001-catalog-hide/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/056-unpublished-helper-skills/blueprints/001-catalog-hide/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/056-unpublished-helper-skills/blueprints/001-catalog-hide/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/056-unpublished-helper-skills/blueprints/001-catalog-hide/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/056-unpublished-helper-skills/blueprints/001-catalog-hide/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/056-unpublished-helper-skills/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.

## Do not touch
- `scripts/src/` — platform code는 변경하지 않는다.

## Constraints
- bundle 이동과 resource 갱신을 함께 한다.

## Checklist
- [ ] inventory를 고정하고 BP를 이동·재번호화한다.
- [ ] index·링크를 갱신하고 npm test를 실행한다.
