---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/062-document-commit-contracts/blueprints/002-task-split-threshold/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-04T13:18:01.204+09:00'
bouncer:
  id: EXPLAIN-002
  epic_id: '062'
  blueprint_id: '002'
  status: published
  comprehension:
    - range_from: develop
      range_to: 2a46fed6aaa56a8586a7858b496506a0b955637c
      diff_sha: 9f6a341ef681e21bd46ac20b475ea9958a1e5b8ddbaa51a3797a32acece73d8b
      quiz_score: 3/3
      disposition: 경고와 실패 분리, 선택적 warnings 키, plan-only 경계를 모두 맞춤
      recorded_at: '2026-09-04T13:20:08+09:00'
  task_commits:
    - id: '001'
      sha: 2a46fed6
---
# Explain

## Background

계획 단계에서 `affected_paths`가 과도하게 넓어도, 작성자가 task를 나눌 시점을 알아차릴 신호가 없었다. 한 커밋으로 리뷰하기 어려운 넓이는 원칙으로만 적혀 있었고, plan 결과에는 수치 기반 보조가 없었다.

이번 변경은 plan gate가 경로 개수 20을 넘는 task만 구조화 `warnings`에 넣고, 게이트 성공·종료 코드·기존 JSON 소비 계약은 그대로 둔다. 대량 리네임·이관처럼 정당한 넓은 task도 차단하지 않는다.

## Intuition

과속 카메라는 있지만 경찰은 없다. 20개를 넘으면 plan 결과에 경고만 찍히고, `ok`와 종료 코드는 그대로다.

## Code

- `scripts/src/lib/validate-gates.ts` — plan task 루프에서 `affected_paths.length > 20`이면 `ctx.warnings`에 `task-split` 항목 하나. `failures`에는 넣지 않는다.
- `scripts/src/lib/validate.ts` — `warnings` 배열을 checkGate에 넘기고, 비어 있지 않을 때만 반환 객체에 `warnings` 키를 붙인다. `ok`는 `failures.length === 0`만 본다.
- `scripts/lib/validate-gates.js`, `scripts/lib/validate.js` — 위 TS의 빌드 산출물.
- `test/validate-gates.test.js`, `test/cli-validate.test.js` — 20/21 경계, 비차단, plan 외 비노출, CLI 종료 코드 0.
- `rules/governance.md` — 20개 초과 경고가 보조 신호이며 차단 규칙이 아님을 명시.

## Quiz

1. plan gate가 `affected_paths` 21개인 task를 만났을 때 기대 동작은?
   - A) `failures`에 G 코드를 넣고 `ok: false`
   - B) 선택적 `warnings`에 task-split 권고를 넣고 `ok`는 실패만 따른다
   - C) stderr에 안내 문장을 쓰고 종료 코드 1

2. `warnings`가 비어 있을 때 `validateBlueprint` 반환 형태는?
   - A) `warnings: []`를 항상 포함한다
   - B) `warnings` 키를 생략한다
   - C) `warnings: null`을 넣는다

3. 이 경고가 동작하는 gate는?
   - A) plan만
   - B) plan과 execute
   - C) 모든 gate와 gate 없는 구조 검증

## 이해 상태

- quiz_score: 3/3
- Q1 정답 B / 응답 B → 정
- Q2 정답 B / 응답 B → 정
- Q3 정답 A / 응답 A → 정
- disposition: 경고와 실패 분리, 선택적 warnings 키, plan-only 경계를 모두 맞춤
- range: develop..2a46fed6aaa56a8586a7858b496506a0b955637c
- diff_sha: 9f6a341ef681e21bd46ac20b475ea9958a1e5b8ddbaa51a3797a32acece73d8b
