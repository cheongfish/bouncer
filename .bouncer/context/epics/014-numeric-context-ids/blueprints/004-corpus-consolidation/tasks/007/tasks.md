---
type: bouncer.tasks
title: planning·quality governance epic을 004로 통합함
description: Moves planning and quality governance history into canonical epic 004.
resource: .bouncer/context/epics/014-numeric-context-ids/blueprints/004-corpus-consolidation/tasks/007/tasks.md
tags:
  - bouncer
  - tasks
timestamp: "2026-09-01T21:18:40.311+09:00"
bouncer:
  id: TASKS-007
  epic_id: "014"
  blueprint_id: "004"
  status: verified
  commit_intent:
    - 계획 수립 가드레일, 리뷰 루브릭, 검증 래퍼, 컨텍스트 리뷰 및 스킬 문서 품질 결함 결정이 여러 epic에 분산되어 있었음
    - 해당 history를 004 아래로 모아 planning·quality governance 역사를 단일 hierarchy로 통합하고 검색 baseline을 맞춤
  affected_paths:
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/001-spec-authoring-guardrails/distill.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/001-spec-authoring-guardrails/index.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/001-spec-authoring-guardrails/tasks/001/review.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/001-spec-authoring-guardrails/tasks/001/tasks.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/001-spec-authoring-guardrails/tasks/001/verification.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/002-init-rules-scaffold/distill.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/002-init-rules-scaffold/index.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/002-init-rules-scaffold/tasks/001/review.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/002-init-rules-scaffold/tasks/001/tasks.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/002-init-rules-scaffold/tasks/001/verification.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/003-per-task-verify-command/distill.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/003-per-task-verify-command/index.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/003-per-task-verify-command/tasks/001/review.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/003-per-task-verify-command/tasks/001/tasks.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/003-per-task-verify-command/tasks/001/verification.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/004-discovery-depth/distill.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/004-discovery-depth/index.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/004-discovery-depth/tasks/001/review.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/004-discovery-depth/tasks/001/tasks.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/004-discovery-depth/tasks/001/verification.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/005-reviewer-prompt/distill.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/005-reviewer-prompt/index.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/005-reviewer-prompt/tasks/001/review.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/005-reviewer-prompt/tasks/001/tasks.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/005-reviewer-prompt/tasks/001/verification.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/006-plan-verify-detection/explain.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/006-plan-verify-detection/index.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/006-plan-verify-detection/tasks/001/review.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/006-plan-verify-detection/tasks/001/tasks.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/006-plan-verify-detection/tasks/001/verification.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/context-review.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/explain.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/index.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/tasks/001/review.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/tasks/001/tasks.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/tasks/001/verification.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/tasks/002/review.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/tasks/002/tasks.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/tasks/002/verification.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/tasks/003/review.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/tasks/003/tasks.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/tasks/003/verification.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/tasks/004/review.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/tasks/004/tasks.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/tasks/004/verification.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/tasks/005/review.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/tasks/005/tasks.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/tasks/005/verification.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/context-review.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/explain.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/index.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/tasks/001/review.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/tasks/001/tasks.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/tasks/001/verification.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/tasks/002/review.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/tasks/002/tasks.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/tasks/002/verification.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/tasks/003/review.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/tasks/003/tasks.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/tasks/003/verification.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/tasks/004/review.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/tasks/004/tasks.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/tasks/004/verification.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/tasks/005/review.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/tasks/005/tasks.md
    - .bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/tasks/005/verification.md
    - .bouncer/context/epics/004-planning-quality-governance/index.md
    - .bouncer/context/epics/004-starter-kit-convergence/blueprints/001-spec-authoring-guardrails/distill.md
    - .bouncer/context/epics/004-starter-kit-convergence/blueprints/001-spec-authoring-guardrails/index.md
    - .bouncer/context/epics/004-starter-kit-convergence/blueprints/001-spec-authoring-guardrails/tasks/001/review.md
    - .bouncer/context/epics/004-starter-kit-convergence/blueprints/001-spec-authoring-guardrails/tasks/001/tasks.md
    - .bouncer/context/epics/004-starter-kit-convergence/blueprints/001-spec-authoring-guardrails/tasks/001/verification.md
    - .bouncer/context/epics/004-starter-kit-convergence/blueprints/002-init-rules-scaffold/distill.md
    - .bouncer/context/epics/004-starter-kit-convergence/blueprints/002-init-rules-scaffold/index.md
    - .bouncer/context/epics/004-starter-kit-convergence/blueprints/002-init-rules-scaffold/tasks/001/review.md
    - .bouncer/context/epics/004-starter-kit-convergence/blueprints/002-init-rules-scaffold/tasks/001/tasks.md
    - .bouncer/context/epics/004-starter-kit-convergence/blueprints/002-init-rules-scaffold/tasks/001/verification.md
    - .bouncer/context/epics/004-starter-kit-convergence/blueprints/003-per-task-verify-command/distill.md
    - .bouncer/context/epics/004-starter-kit-convergence/blueprints/003-per-task-verify-command/index.md
    - .bouncer/context/epics/004-starter-kit-convergence/blueprints/003-per-task-verify-command/tasks/001/review.md
    - .bouncer/context/epics/004-starter-kit-convergence/blueprints/003-per-task-verify-command/tasks/001/tasks.md
    - .bouncer/context/epics/004-starter-kit-convergence/blueprints/003-per-task-verify-command/tasks/001/verification.md
    - .bouncer/context/epics/004-starter-kit-convergence/blueprints/004-discovery-depth/distill.md
    - .bouncer/context/epics/004-starter-kit-convergence/blueprints/004-discovery-depth/index.md
    - .bouncer/context/epics/004-starter-kit-convergence/blueprints/004-discovery-depth/tasks/001/review.md
    - .bouncer/context/epics/004-starter-kit-convergence/blueprints/004-discovery-depth/tasks/001/tasks.md
    - .bouncer/context/epics/004-starter-kit-convergence/blueprints/004-discovery-depth/tasks/001/verification.md
    - .bouncer/context/epics/004-starter-kit-convergence/index.md
    - .bouncer/context/epics/005-review-depth/blueprints/001-reviewer-prompt/distill.md
    - .bouncer/context/epics/005-review-depth/blueprints/001-reviewer-prompt/index.md
    - .bouncer/context/epics/005-review-depth/blueprints/001-reviewer-prompt/tasks/001/review.md
    - .bouncer/context/epics/005-review-depth/blueprints/001-reviewer-prompt/tasks/001/tasks.md
    - .bouncer/context/epics/005-review-depth/blueprints/001-reviewer-prompt/tasks/001/verification.md
    - .bouncer/context/epics/005-review-depth/index.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/004-corpus-consolidation/tasks/007/review.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/004-corpus-consolidation/tasks/007/tasks.md
    - .bouncer/context/epics/014-numeric-context-ids/blueprints/004-corpus-consolidation/tasks/007/verification.md
    - .bouncer/context/epics/017-verify-wrapper-guidance/blueprints/001-plan-verify-detection/explain.md
    - .bouncer/context/epics/017-verify-wrapper-guidance/blueprints/001-plan-verify-detection/index.md
    - .bouncer/context/epics/017-verify-wrapper-guidance/blueprints/001-plan-verify-detection/tasks/001/review.md
    - .bouncer/context/epics/017-verify-wrapper-guidance/blueprints/001-plan-verify-detection/tasks/001/tasks.md
    - .bouncer/context/epics/017-verify-wrapper-guidance/blueprints/001-plan-verify-detection/tasks/001/verification.md
    - .bouncer/context/epics/017-verify-wrapper-guidance/index.md
    - .bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/context-review.md
    - .bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/explain.md
    - .bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/index.md
    - .bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/tasks/001/review.md
    - .bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/tasks/001/tasks.md
    - .bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/tasks/001/verification.md
    - .bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/tasks/002/review.md
    - .bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/tasks/002/tasks.md
    - .bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/tasks/002/verification.md
    - .bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/tasks/003/review.md
    - .bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/tasks/003/tasks.md
    - .bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/tasks/003/verification.md
    - .bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/tasks/004/review.md
    - .bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/tasks/004/tasks.md
    - .bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/tasks/004/verification.md
    - .bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/tasks/005/review.md
    - .bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/tasks/005/tasks.md
    - .bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/tasks/005/verification.md
    - .bouncer/context/epics/033-quality-security/index.md
    - .bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/context-review.md
    - .bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/explain.md
    - .bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/index.md
    - .bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/tasks/001/review.md
    - .bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/tasks/001/tasks.md
    - .bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/tasks/001/verification.md
    - .bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/tasks/002/review.md
    - .bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/tasks/002/tasks.md
    - .bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/tasks/002/verification.md
    - .bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/tasks/003/review.md
    - .bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/tasks/003/tasks.md
    - .bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/tasks/003/verification.md
    - .bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/tasks/004/review.md
    - .bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/tasks/004/tasks.md
    - .bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/tasks/004/verification.md
    - .bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/tasks/005/review.md
    - .bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/tasks/005/tasks.md
    - .bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/tasks/005/verification.md
    - .bouncer/context/epics/053-skill-doc-defects/index.md
    - .bouncer/context/index.md
    - docs/benchmark/context-corpus-search.md
    - test/context-corpus-search.test.js
    - test/fixtures/context-corpus-queries.json
  scope_evidence:
    producer: graphify
    generated_at: "2026-09-01T21:18:40.311+09:00"
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
        query: canonical corpus migration task 007
        result: source graph does not determine document moves
      - graph: test
        status: reused
        query: canonical corpus migration task 007
        result: test graph does not determine document moves
      - graph: context
        status: updated
        query: canonical corpus migration task 007
        result: low-confidence; user-confirmed migration map supplies scope
---
# Tasks

Blueprint: [004](../../index.md)

## Goal & intent
004,005,017,033,053의 BP를 `004-planning-quality-governance`로 통합한다.

## Interface
- 제공: planning·quality governance history가 하나의 hierarchy에 있다.
- 거부: gate 동작은 변경하지 않는다.

## Touch
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/001-spec-authoring-guardrails/distill.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/001-spec-authoring-guardrails/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/001-spec-authoring-guardrails/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/001-spec-authoring-guardrails/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/001-spec-authoring-guardrails/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/002-init-rules-scaffold/distill.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/002-init-rules-scaffold/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/002-init-rules-scaffold/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/002-init-rules-scaffold/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/002-init-rules-scaffold/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/003-per-task-verify-command/distill.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/003-per-task-verify-command/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/003-per-task-verify-command/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/003-per-task-verify-command/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/003-per-task-verify-command/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/004-discovery-depth/distill.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/004-discovery-depth/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/004-discovery-depth/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/004-discovery-depth/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/004-discovery-depth/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/005-reviewer-prompt/distill.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/005-reviewer-prompt/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/005-reviewer-prompt/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/005-reviewer-prompt/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/005-reviewer-prompt/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/006-plan-verify-detection/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/006-plan-verify-detection/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/006-plan-verify-detection/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/006-plan-verify-detection/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/006-plan-verify-detection/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/tasks/004/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/tasks/004/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/tasks/004/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/tasks/005/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/tasks/005/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/tasks/005/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/tasks/004/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/tasks/004/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/tasks/004/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/tasks/005/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/tasks/005/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/tasks/005/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-planning-quality-governance/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-starter-kit-convergence/blueprints/001-spec-authoring-guardrails/distill.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-starter-kit-convergence/blueprints/001-spec-authoring-guardrails/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-starter-kit-convergence/blueprints/001-spec-authoring-guardrails/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-starter-kit-convergence/blueprints/001-spec-authoring-guardrails/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-starter-kit-convergence/blueprints/001-spec-authoring-guardrails/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-starter-kit-convergence/blueprints/002-init-rules-scaffold/distill.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-starter-kit-convergence/blueprints/002-init-rules-scaffold/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-starter-kit-convergence/blueprints/002-init-rules-scaffold/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-starter-kit-convergence/blueprints/002-init-rules-scaffold/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-starter-kit-convergence/blueprints/002-init-rules-scaffold/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-starter-kit-convergence/blueprints/003-per-task-verify-command/distill.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-starter-kit-convergence/blueprints/003-per-task-verify-command/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-starter-kit-convergence/blueprints/003-per-task-verify-command/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-starter-kit-convergence/blueprints/003-per-task-verify-command/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-starter-kit-convergence/blueprints/003-per-task-verify-command/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-starter-kit-convergence/blueprints/004-discovery-depth/distill.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-starter-kit-convergence/blueprints/004-discovery-depth/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-starter-kit-convergence/blueprints/004-discovery-depth/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-starter-kit-convergence/blueprints/004-discovery-depth/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-starter-kit-convergence/blueprints/004-discovery-depth/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/004-starter-kit-convergence/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/005-review-depth/blueprints/001-reviewer-prompt/distill.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/005-review-depth/blueprints/001-reviewer-prompt/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/005-review-depth/blueprints/001-reviewer-prompt/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/005-review-depth/blueprints/001-reviewer-prompt/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/005-review-depth/blueprints/001-reviewer-prompt/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/005-review-depth/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/004-corpus-consolidation/tasks/007/review.md` — corpus baseline·task 번들 갱신.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/004-corpus-consolidation/tasks/007/tasks.md` — corpus baseline·task 번들 갱신.
- Modify `.bouncer/context/epics/014-numeric-context-ids/blueprints/004-corpus-consolidation/tasks/007/verification.md` — corpus baseline·task 번들 갱신.
- Modify `.bouncer/context/epics/017-verify-wrapper-guidance/blueprints/001-plan-verify-detection/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/017-verify-wrapper-guidance/blueprints/001-plan-verify-detection/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/017-verify-wrapper-guidance/blueprints/001-plan-verify-detection/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/017-verify-wrapper-guidance/blueprints/001-plan-verify-detection/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/017-verify-wrapper-guidance/blueprints/001-plan-verify-detection/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/017-verify-wrapper-guidance/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/tasks/004/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/tasks/004/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/tasks/004/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/tasks/005/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/tasks/005/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/tasks/005/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/033-quality-security/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/tasks/004/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/tasks/004/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/tasks/004/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/tasks/005/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/tasks/005/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/tasks/005/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/053-skill-doc-defects/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `docs/benchmark/context-corpus-search.md` — corpus baseline·task 번들 갱신.
- Modify `test/context-corpus-search.test.js` — corpus baseline·task 번들 갱신.
- Modify `test/fixtures/context-corpus-queries.json` — corpus baseline·task 번들 갱신.

## Do not touch
- `scripts/lib/validate.js` — gate 구현은 변경하지 않는다.

## Constraints
- bundle 이동과 resource 갱신을 함께 한다.
- corpus fixture·benchmark 문서는 이 task의 canonical epic 통합 후 baseline(hit·후보 상한)을 갱신하는 데 쓴다.

## Checklist
- [ ] inventory를 고정하고 BP를 이동·재번호화한다.
- [ ] index·링크를 갱신하고 npm test를 실행한다.
