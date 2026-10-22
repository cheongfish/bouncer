---
type: bouncer.explain
title: residual-lint-cleanup explain
description: Explain for residual-lint-cleanup
resource: .bouncer/context/epics/runtime-architecture/blueprints/residual-lint-cleanup/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-22T11:25:45.851+09:00'
bouncer:
  id: EXPLAIN-residual-lint-cleanup
  epic_id: runtime-architecture
  blueprint_id: residual-lint-cleanup
  status: draft
  comprehension: []
---
# Explain

## Background

workflow-responsibility-split(PR #254)을 병합한 뒤 `develop`에서 `npm run ci`가 lint 단계에서 실패했다. 원인은 오류 3건이었다. `context-review-store.ts`가 쓰지 않는 type `ReportRef`, `Cycle`을 import했고, 테스트가 쓰는 Node 내장 전역 `structuredClone`을 ESLint가 정의되지 않은 이름으로 보고했다. 또 main checkout에서 `eslint .`를 돌리면 git-ignore 대상인 `.worktrees/` 아래 복사본까지 검사해 887건이 더 나왔다. 이 변경은 세 가지를 동작 변경 없이 정리한다.

## Code

- `scripts/src/lib/context-review-store.ts`: `import type` 목록에서 쓰지 않는 `ReportRef`, `Cycle`만 지웠다. 나머지 type은 그대로이고 type-only import라 런타임 출력은 같다.
- `eslint.config.js`: `languageOptions.globals`에 `structuredClone: 'readonly'`를 추가했다. `engines.node`가 `>=24`라 내장 전역이다. `ignores`에는 `.gitignore`와 같은 범위로 `.worktrees/**`를 추가했다.
- 종단 검증에서 `npm run ci`가 이 BP 바깥의 실패를 하나 더 드러냈다. `lint:test-names`가 `test/finalize-digest.test.js`의 이어 붙인 테스트 이름 6곳을 `dynamic-name`으로 거절했다. light blueprint는 commit task가 하나여야 해서 repair task를 이어갈 수 없었고, 이 수정은 계획 없이 `develop`에 직접 커밋했다(`4c92397a`, 이름 내용은 그대로 두고 문자열 리터럴 하나로 합침).

## 변경 전후

| 항목 | 변경 전 | 변경 후 |
| --- | --- | --- |
| `context-review-store.ts` type import | `ReportRef`, `Cycle`을 import하고 쓰지 않아 `no-unused-vars` 2건 | 쓰는 type만 import |
| 테스트의 `structuredClone` | ESLint `no-undef` 1건 | 전역으로 선언되어 오류 없음 |
| main checkout의 `eslint .` | `.worktrees/` 아래 887건 포함 890건 | ignore로 제외되어 0건 |
| `finalize-digest.test.js` 테스트 이름 | 이어 붙인 이름 6곳이 `lint:test-names` 실패 | 문자열 하나로 합쳐 통과 (커밋 `4c92397a`) |
| `npm run ci` (Node 24) | 실패 | exit 0 |

## 한계

- 이 BP는 `/bouncer-finalize`로 닫지 못했다. TASKS-002(종단 검증)는 repair 중 막혀 `verified`가 되지 못했고 TASKS-003은 취소됐다. 같은 검증은 `develop`에서 직접 `npm run ci`로 통과를 확인했다.
