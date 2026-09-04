---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/063-maintenance/blueprints/001-graphify-query-guidance/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-04T22:13:14.152+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '063'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: develop
      range_to: 971a061cadfb10685ee5383f540fa86658f1d32c
      diff_sha: abdfdfe73f79ef7648e645aa53f864fb7643188280d147eed24b9fd8f635a952
      quiz_score: 1/1
      disposition: light quiz passed; entry-symbol seed example understood
      recorded_at: '2026-09-04T22:17:17+09:00'
  task_commits:
    - id: '001'
      sha: 971a061c
---
# Explain

## Background
Plan 단계에서 `graph-suggest`에 `scripts/bouncer` 같은 허브 시드와 `document`·`task`·`evidence`류 일반어를 넣으면 후보가 수십~백 개로 불어나고, Graphify는 50개 이상이면 `low-confidence`와 빈 `suggested_paths`만 돌려준다. 이 블루프린트는 러너·계획 참조에 검색 공간 축소 4대 원칙을 적고, 허브 시드 배제와 진입 심볼 예시를 테스트로 고정한다.

## Intuition
넓은 입구로 그래프를 두드리지 말고, 실제 변경의 문손잡이 한두 개만 잡는다.

## Code
- `references/graphify-runner/index.md` — step 3에 축소 4대 원칙과 진입 심볼 예시(`scripts/src/lib/graph-search.ts`, `graphSuggest`)를 둔다.
- `skills/bouncer-plan/references/graphify-suggestions.md` — plan 시점 `--query`/`--seed`에도 같은 원칙을 반복한다.
- `test/skill-graphify-runner.test.js` — 허브 시드·구 일반어 쿼리 금지, 실제 진입 경로/심볼, 원칙 키워드를 단언한다.

## Quiz
1. `graph-suggest` 예시에서 허용되는 시드 조합은?
   - A) `--seed "scripts/bouncer"` 와 `--seed "finalize"`
   - B) `--seed "scripts/src/lib/graph-search.ts"` 와 `--seed "graphSuggest"`
   - C) `--seed "lib/graph-suggest"` 와 `--seed "writeScopeEvidence"`

## 이해 상태
- Q1 정답: B · 응답: B · 맞음
- quiz_score: 1/1
- disposition: light quiz passed; entry-symbol seed example understood
- range: develop..971a061cadfb10685ee5383f540fa86658f1d32c
- diff_sha: abdfdfe73f79ef7648e645aa53f864fb7643188280d147eed24b9fd8f635a952

## Tasks

### Task 001

#### Goal & intent

Graphify 러너 지침과 계획 제안 참조에 검색 공간 축소 4대 원칙을 반영하고 단위 테스트로 검증한다.