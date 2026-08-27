---
type: bouncer.tasks
title: 지시문 비용 최종 회차 기록
description: baseline과 같은 일곱 시나리오의 최종 산출물을 전사하고 품질 비회귀를 벤치마크 이력과 테스트에 고정한다
resource: .bouncer/context/epics/054-skill-context-optimization/blueprints/005-description-budget-lock/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-27T15:18:31.189+09:00'
bouncer:
  id: TASKS-003
  epic_id: '054'
  blueprint_id: '005'
  status: ready
  verify: npm run ci
  commit_intent:
    - 정적 예산 절감만으로는 실제 실행 비용과 plan·verify·review 품질이 유지됐는지 판정할 수 없었음
    - baseline과 같은 시나리오·열로 최종 수치를 남겨 지시문 최적화의 비용과 품질을 함께 비교하려 함
  affected_paths:
    - docs/benchmark/history.md
    - test/benchmark-context-cost.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-27T15:23:59+09:00'
    suggested_paths:
      - test
      - .bouncer/context/epics/027-history-import
      - .bouncer/context/epics/027-history-import/blueprints/001-history-import-cli/tasks/002
      - .bouncer/context/epics/027-history-import/blueprints/001-history-import-cli/tasks/003
    # 유효 엔트리 필드: graph, status, query, result — 예시는 주석이라 파싱되지 않는다
    # - graph: source | context
    #   status: updated | reused | fail-skip | skip-disabled | missing
    #   query: <graphify 조회>
    #   result: <한 줄 요약>
    basis:
      - graph: source
        status: reused
        query: instruction cost final benchmark history scenario quality regression
        result: '54 nodes; top files: test/benchmark-context-cost.test.js, test/finalize.test.js, test/import-history.test.js'
      - graph: context
        status: updated
        query: instruction cost final benchmark history scenario quality regression
        result: '11 nodes; hits were unrelated epic 027 history-import context documents'
---
# Tasks

Blueprint: [005](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | context
     status: updated | reused | fail-skip | skip-disabled | missing
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
blueprint 006의 baseline과 같은 일곱 시나리오를 실행한 최종 산출물이 `docs/benchmark/history.md`의 `## 지시문 비용 회차` 표에 baseline 바로 다음 행들로 남는다. gate 통과율은 baseline 이상이고 review finding 수와 scope 위반 수는 baseline 이하이며, 산출물이 하나라도 없거나 품질이 나빠지면 기록을 추정하지 않고 작업을 중단한다.

## Interface
- 제공:
  - `docs/benchmark/history.md`의 기존 `## 지시문 비용 회차` 절에 baseline과 같은 열·시나리오 순서의 최종 7행을 추가한다. 각 행은 측정일과 산출물 경로를 가진다.
  - `test/benchmark-context-cost.test.js`가 history 절의 baseline·최종 두 세트, 일곱 scenario id, 동일 열, 품질 비회귀 비교를 단정한다.
- 거부:
  - blueprint 006이 closed가 아니거나 baseline 7행·최종 7개 산출물이 모두 없으면 파일을 수정하지 않는다.
  - 측정하지 않은 `usage` 값을 0으로 채우거나, 1~3회차·DeepSWE 수치를 대리값으로 쓰지 않는다.
  - 품질 세 값 중 하나라도 나빠지면 행을 성공 회차처럼 기록하지 않고 `/bouncer-plan`으로 돌려보낸다.

## Touch
- Modify `docs/benchmark/history.md` — 지시문 비용 절의 baseline 다음에 같은 일곱 시나리오의 최종 회차 수치와 출처를 기록한다.
- Modify `test/benchmark-context-cost.test.js` — history의 두 회차 완결성, 열 일치, 품질 비회귀를 구조적으로 단정한다.

## Do not touch
- `docs/benchmark/context-cost.md` — 측정 계약과 baseline은 blueprint 001·006의 산출물이다.
- `.benchmarks` — 읽기 전용 입력이며 git에 기록하거나 수정하지 않는다.
- `skills/agentic-code-benchmark` — 수집기·루브릭·점수 계산은 epic Out of scope다.

## Constraints
- `docs/benchmark/context-cost.md`의 일곱 scenario id, 기록 값, 공통 통제, plan 단계 snapshot 절차를 그대로 쓴다.
- `docs/benchmark/history.md`에서는 `## 지시문 비용 회차` 절만 수정하고 1–3회차·DeepSWE 절은 유지한다.
- `tokens_in`, `tokens_out`, `wall_s`, `tool_calls` 미측정 값은 빈칸으로 남긴다.
- gate 통과율은 높을수록, review finding 수와 scope 위반 수는 낮을수록 좋다는 방향으로 baseline과 scenario별 비교한다.
- 테스트는 표 구조와 기록된 숫자를 읽어 비교하며 특정 측정값을 코드에 한 벌 더 복사하지 않는다.

## Checklist
- [ ] blueprint 006 `bouncer.status`가 `closed`이고 history의 baseline이 `s1-light-cycle`부터 `s7-run-multitask`까지 7행인지 확인한다. 아니면 파일을 수정하지 않고 중단한다.
- [ ] 같은 일곱 scenario의 최종 `.metrics.json`, verification, review, commit-scope 산출물 경로를 열거한다. 하나라도 없으면 0이나 추정값으로 대신하지 않고 중단한다.
- [ ] `test/benchmark-context-cost.test.js`에 history의 baseline·최종 7행과 열 일치, 품질 세 값의 방향 비교를 먼저 추가한다.
- [ ] `node --test test/benchmark-context-cost.test.js`가 최종 행 부재로 실패하는지 확인한다.
- [ ] 산출물에서 `usage.tokens_in`, `usage.tokens_out`, `usage.wall_s`, `usage.tool_calls`, gate 통과율, review finding 수, scope 위반 수를 scenario별로 전사한다. 미측정 usage 값은 빈칸으로 둔다.
- [ ] 품질 세 값을 baseline과 scenario별로 비교한다. 하나라도 나빠지면 history를 수정하지 않고 `/bouncer-plan`으로 에스컬레이션한다.
- [ ] `docs/benchmark/history.md`의 baseline 바로 다음에 최종 7행과 측정일·출처를 추가한다.
- [ ] `node --test test/benchmark-context-cost.test.js`가 통과한다.
- [ ] `npm run ci`가 통과한다.
