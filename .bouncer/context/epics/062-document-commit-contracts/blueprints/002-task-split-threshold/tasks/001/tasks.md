---
type: bouncer.tasks
title: task 분해 임계치 경고 추가
description: Adds a non-blocking warning for plan tasks with more than twenty affected paths.
resource: .bouncer/context/epics/062-document-commit-contracts/blueprints/002-task-split-threshold/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
  - plan_validation
  - task_sizing
timestamp: '2026-09-04T12:47:18.891+09:00'
bouncer:
  id: TASKS-001
  epic_id: '062'
  blueprint_id: '002'
  status: verified
  commit_intent:
    - 넓은 task가 분해 검토 대상임을 plan 결과에서 알림
    - 기존 게이트 실패와 CLI 성공 계약을 유지함
  verify: npm test
  affected_paths:
    - scripts/src/lib/validate-gates.ts
    - scripts/src/lib/validate.ts
    - scripts/lib/validate-gates.js
    - scripts/lib/validate.js
    - test/validate-gates.test.js
    - test/cli-validate.test.js
    - rules/governance.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-09-04T12:54:43+09:00'
    suggested_paths: []
    basis:
      - graph: source
        status: reused
        query: plan task affected paths warning validation
        result: graph was fresh; suggestion returned low-confidence with no retained candidates
      - graph: test
        status: reused
        query: plan task affected paths warning validation
        result: graph was fresh; suggestion returned low-confidence with no retained candidates
      - graph: context
        status: updated
        query: plan task affected paths warning validation
        result: graph was rebuilt; suggestion returned low-confidence with no retained candidates
    quality:
      status: low-confidence
      confidence: low
      reasons:
        - 'source omissions: skipped unknown relation: rationale_for'
        - 'context seeds: 4 labels, 10 paths'
        - 'relation filter: calls, imports, imports_from (depth ≤ 2); contains ownership only'
        - 'result explosion: 66 candidates (≥ 50)'
    candidates:
      implementation: []
      test: []
      context: []
---
# Tasks

Blueprint: [002](../../index.md)

## Goal & intent

plan gate가 task의 `affected_paths` 개수를 관찰해 20개 초과만 비차단 경고로 반환한다.
경고는 task 분해 판단을 돕되 게이트 실패, 종료 코드, 기존 JSON 소비 계약을 바꾸지 않는다.

## Interface

- 제공: `validateBlueprint({ gate: 'plan' })` 결과에 선택적 `warnings: FailureEntry[]`를 제공한다. 각 항목은 20개를 초과한 task의 경로와 개수를 식별하고, 한 커밋으로 리뷰할 수 없으면 task를 분리하라고 권고하며, `ok: true`인 결과에도 존재할 수 있다.
- 거부: 20개 이하를 경고하지 않고, 경고를 `failures`에 넣거나 새 G/S 코드·stderr 문장으로 바꾸지 않는다. plan 외 gate와 gate 없는 검증에는 경고를 만들지 않는다.

## Touch

- Modify `scripts/src/lib/validate-gates.ts` — plan task별 경고 판정과 실패 배열과 분리된 경고 수집 계약을 추가한다.
- Modify `scripts/src/lib/validate.ts` — `validateBlueprint()`의 선택적 `warnings` 결과를 보존하고 `ok` 판정이 실패만 따르도록 연결한다.
- Modify `scripts/lib/validate-gates.js` — TypeScript 원본의 컴파일 산출물을 갱신한다.
- Modify `scripts/lib/validate.js` — TypeScript 원본의 컴파일 산출물을 갱신한다.
- Modify `test/validate-gates.test.js` — 20개/21개 경계, 경고의 비차단성, plan 외 gate 비노출을 검증한다.
- Modify `test/cli-validate.test.js` — CLI stdout JSON의 선택적 `warnings` 직렬화와 경고만 있을 때 종료 코드 `0`을 검증한다.
- Modify `rules/governance.md` — 한-커밋 리뷰 원칙을 보조하는 20개 초과 경고의 의미와 비차단성을 설명한다.

## Do not touch

- `scripts/src/lib/validate-structural.ts` — 구조 경고 체계는 plan task 분해 신호와 독립적으로 유지한다.
- `scripts/src/lib/cli-doc-commands.ts` — CLI는 반환 객체를 그대로 JSON 직렬화하므로 별도 출력 분기를 추가하지 않는다.

## Constraints

- 임계값은 `affected_paths.length > 20`으로 고정한다. 경고는 task별로 한 항목만 만들고, 한-커밋 검토가 어렵다면 task 분리를 권고하되 경고만으로 `ok` 또는 프로세스 종료 코드를 바꾸지 않는다.
- 기존 소비자가 `warnings` 부재를 허용하므로 필드는 선택적으로 추가하며, stdout JSON 밖에 안내 문장을 쓰지 않는다.
- 새 의존성·설정 키·추상화는 추가하지 않는다.

## Checklist

- [ ] `test/validate-gates.test.js`에 20개 이하·21개 이상 task를 넣고, 현재 결과에 `warnings`가 없거나 경고가 없어야 한다는 기대를 먼저 추가해 실패를 확인한다.
- [ ] 같은 테스트에 21개 task의 경고 항목 하나와 한-커밋 검토 불가 시 task 분리 권고 문구, `failures` 비오염, `ok: true` 보존 및 plan 외 gate 비노출 기대를 추가해 실패를 확인한다.
- [ ] `test/cli-validate.test.js`에 21개 plan task fixture를 추가하고 stdout JSON의 `warnings`와 종료 코드 `0` 기대를 먼저 추가해 실패를 확인한다.
- [ ] `validate-gates.ts`와 `validate.ts`에 경고 수집·반환을 구현하고 `scripts/lib/*.js`를 빌드 산출물과 맞춘다.
- [ ] `rules/governance.md`에 경고가 한-커밋 검토가 어려운 task의 분리를 권고하는 보조 신호이며 차단 규칙이 아니라는 계약을 추가한다.
- [ ] `npm test`로 gate·CLI 회귀와 컴파일 산출물 일치를 확인한다.
