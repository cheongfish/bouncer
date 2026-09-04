---
type: bouncer.tasks
title: task 커밋 임시 문서 제외
description: Separates scope authorization from task-commit staging and preserves transient cleanup.
resource: .bouncer/context/epics/062-document-commit-contracts/blueprints/005-explain-task-context/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
  - commit_scope
  - lifecycle
timestamp: '2026-09-04T13:25:50.750+09:00'
bouncer:
  id: TASKS-002
  epic_id: '062'
  blueprint_id: '005'
  status: verified
  verify: npm test
  affected_paths:
    - scripts/src/lib/commit.ts
    - scripts/lib/commit.js
    - scripts/src/lib/scope.ts
    - scripts/lib/scope.js
    - scripts/src/lib/finalize.ts
    - scripts/lib/finalize.js
    - scripts/src/lib/commit-guard.ts
    - scripts/lib/commit-guard.js
    - CLAUDE.md
    - references/verification/index.md
    - rules/governance.md
    - rules/okf.md
    - skills/bouncer-commit/SKILL.md
    - skills/bouncer-run/SKILL.md
    - skills/bouncer-finalize/SKILL.md
    - test/commit-task.test.js
    - test/commit-guard.test.js
    - test/cli-commit.test.js
    - test/finalize.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-09-04T13:33:00.000+09:00'
    suggested_paths: []
    basis:
      - graph: source
        status: reused
        query: document commit lifecycle task context staging message
        result: source graph fresh; ranking produced 621 candidates
      - graph: test
        status: reused
        query: document commit lifecycle task context staging message
        result: test graph fresh; ranking produced 621 candidates
      - graph: context
        status: updated
        query: document commit lifecycle task context staging message
        result: context graph rebuilt; ranking produced 621 candidates
    quality:
      status: low-confidence
      confidence: low
      reasons:
        - source omissions
        - context seed volume
        - relation filter
        - result explosion
    candidates:
      implementation: []
      test: []
      context: []
  commit_intent:
    - task 산출물 커밋에서 임시 실행 증거를 분리함
    - finalize가 증거 수명주기를 안전하게 끝내게 함
  commit_sha: 54f23d06
---
# task 커밋 임시 문서 제외

Blueprint: [005](../../index.md)

## Goal & intent
task 커밋은 작업 산출물만 스테이징하고 task bundle·context 문서·Distill은 남긴다. finalize는 추적 여부에 따라 임시 문서를 삭제하되, `commit_sha`와 explain의 task 링크를 유지한다.

## Interface
- 제공: 범위 허용과 스테이징 후보 필터를 분리한 task 커밋 정책을 제공한다.
- 거부: 허용된 임시 문서 때문에 `out-of-scope`를 내거나, 없는 미추적 파일을 스테이징하지 않는다.

## Touch
- Modify `scripts/src/lib/commit.ts` — scope 검사 뒤 임시 문서를 task 스테이징에서 제외한다.
- Modify `scripts/lib/commit.js` — 컴파일 산출물을 맞춘다.
- Modify `scripts/src/lib/scope.ts` — task-commit 전용 스테이징 판정을 제공한다.
- Modify `scripts/lib/scope.js` — 컴파일 산출물을 맞춘다.
- Modify `scripts/src/lib/finalize.ts` — 추적·미추적 임시 문서를 다르게 삭제하고 복구 스냅샷을 유지한다.
- Modify `scripts/lib/finalize.js` — 컴파일 산출물을 맞춘다.
- Modify `scripts/src/lib/commit-guard.ts` — 실제 스테이징 경로만 G17에 전달한다.
- Modify `scripts/lib/commit-guard.js` — 컴파일 산출물을 맞춘다.
- Modify `CLAUDE.md` — task 산출물 커밋과 임시 증거의 권위를 명시한다.
- Modify `references/verification/index.md` — 증거 기록과 finalize 삭제 경계를 설명한다.
- Modify `rules/governance.md` — task bundle의 임시 수명주기를 명시한다.
- Modify `rules/okf.md` — 종료 뒤 남는 explain과 task commit 링크 경계를 명시한다.
- Modify `skills/bouncer-commit/SKILL.md` — `commit_sha`가 finalize까지 working tree에 남음을 설명한다.
- Modify `skills/bouncer-run/SKILL.md` — 다음 task 커밋의 스테이징 경계를 설명한다.
- Modify `skills/bouncer-finalize/SKILL.md` — 의도된 임시 문서 삭제를 설명한다.
- Modify `test/commit-task.test.js` — 임시 문서 미스테이징과 산출물 커밋을 단언한다.
- Modify `test/commit-guard.test.js` — 실제 스테이징 경로의 G17 판정을 단언한다.
- Modify `test/cli-commit.test.js` — 미추적 task bundle에서도 `commit_sha` 보존과 소스 변경 정리를 단언한다.
- Modify `test/finalize.test.js` — 추적·미추적 cleanup과 복구를 단언한다.

## Do not touch
- `references/explain-diff/index.md` — explain 본문 형식은 task 001 계약을 유지한다.

## Constraints
- `makeAllowed`의 범위 권한을 완화하지 않는다. 새 의존성 없이 기존 scope·commit helper로 구현한다.

## Checklist
- [ ] 임시 문서가 있어도 task 산출물만 스테이징되는 실패 사례를 먼저 테스트한다.
- [ ] scope 허용과 task 스테이징 필터를 분리하고 `commit_sha` 기록을 유지한다.
- [ ] 미추적 task bundle이 porcelain에서 상위 경로로 축약돼도 `commit_sha` 보존을 검증한다.
- [ ] 추적·미추적 cleanup과 실패 복구를 구현하고 수명주기 문서를 갱신한다.
- [ ] `npm test`를 실행한다.
