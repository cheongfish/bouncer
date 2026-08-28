---
type: bouncer.tasks
title: 지시문 비용 최종 회차 기록
description: 006 baseline과 같은 일곱 시나리오의 최종 산출물이 history 지시문 비용 표에서 baseline 다음 7행으로 남는다
resource: .bouncer/context/epics/054-skill-context-optimization/blueprints/005-description-budget-lock/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-27T15:18:31.189+09:00'
bouncer:
  id: TASKS-003
  epic_id: '054'
  blueprint_id: '005'
  status: verified
  verify: npm run ci
  commit_intent:
    - 005 실행 워크트리에 006 baseline 절이 없고 최종 `.final.*` 산출물도 없어 전사가 입력을 추정하게 됨
    - 산출물 경로와 워크트리 전제를 고정한 뒤 같은 일곱 시나리오의 최종 회차만 남기려 함
  affected_paths:
    - docs/benchmark/history.md
    - test/benchmark-context-cost.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-28T10:35:00+09:00'
    suggested_paths:
      - test
      - .bouncer/context/epics/050-cycle-friction/blueprints/001-finalize-pointer-scope
      - .bouncer/context/epics/050-cycle-friction/blueprints/001-finalize-pointer-scope/tasks/001
    # 유효 엔트리 필드: graph, status, query, result — 예시는 주석이라 파싱되지 않는다
    # - graph: source | context
    #   status: updated | reused | fail-skip | skip-disabled | missing
    #   query: <graphify 조회>
    #   result: <한 줄 요약>
    basis:
      - graph: source
        status: updated
        query: instruction cost final benchmark history scenario quality regression final metrics manifest
        result: '23 nodes; top files: test/benchmark-context-cost.test.js, test/skill-agentic-code-benchmark.test.js'
      - graph: context
        status: updated
        query: instruction cost final benchmark history scenario quality regression final metrics manifest
        result: '10 nodes; hits were unrelated epic 050 finalize-pointer-scope context documents'
---
# Tasks

Blueprint: [005](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | context
     status: updated | reused | fail-skip | skip-disabled | missing
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
blueprint 006 baseline과 같은 일곱 시나리오의 최종 산출물이 `docs/benchmark/history.md`의 `## 지시문 비용 회차` 표에서 baseline 7행 바로 다음 7행으로 남는다. gate 통과율은 baseline 이상, review finding 수와 scope 위반 수는 baseline 이하다. 워크트리에 baseline 절이 없거나 `.final.*` 산출물이 빠졌거나 품질이 나빠지면 추정하지 않고 중단한다.

## Interface
- 제공:
  - 같은 절의 서두를 baseline 7행과 최종 7행이 함께 있음을 가리키게 고치고, 같은 열에 `s1-light-cycle`부터 `s7-run-multitask` 순서의 최종 7행을 더한다. 각 행의 산출물 경로는 해당 `.benchmarks/<id>.final.metrics.json`이다.
  - `test/benchmark-context-cost.test.js`가 history에서 baseline 7행과 최종 7행, 열 일치, scenario별 품질 방향(gate 통과율 ≥, finding 수 ≤, scope 위반 수 ≤)을 표 숫자로 단정한다.
- 거부:
  - 006이 `closed`가 아니거나, 실행 워크트리 history에 baseline 7행이 없거나, 아래 최종 파일이 하나라도 없으면 두 파일을 수정하지 않는다.
  - `.benchmarks/<id>.recovery.*` 또는 s5–s7의 무접미사 `.metrics.json`·`.manifest.json`을 최종 출처로 쓰지 않는다.
  - 측정하지 않은 `usage` 값을 0으로 채우거나, 1–3회차·DeepSWE 수치를 대리값으로 쓰지 않는다.
  - 품질 세 값 중 하나라도 나빠지면 최종 행을 쓰지 않고 `/bouncer-plan`으로 돌려보낸다.

## Touch
- Modify `docs/benchmark/history.md` — 지시문 비용 절의 baseline 다음에 같은 일곱 시나리오의 최종 회차 수치와 출처를 기록한다.
- Modify `test/benchmark-context-cost.test.js` — history의 두 회차 완결성, 열 일치, 품질 비회귀를 구조적으로 단정한다.

## Do not touch
- `docs/benchmark/context-cost.md` — 측정 계약과 baseline은 blueprint 001·006의 산출물이다.
- `.benchmarks` — 읽기 전용 입력이며 git에 기록하거나 수정하지 않는다.
- `skills/agentic-code-benchmark` — 수집기·루브릭·점수 계산은 epic Out of scope다.

## Constraints
- `docs/benchmark/context-cost.md`의 `## 고정 실행 입력` 표(일곱 id, base `1c73980`, 모델 `gpt-5.6-terra`, reasoning effort `medium`, 사람 개입 0회, fixture·실행 프롬프트·완료 조건)를 그대로 쓴다.
- `docs/benchmark/history.md`에서는 `## 지시문 비용 회차` 절만 수정하고 1–3회차·DeepSWE 절은 유지한다.
- 최종 입력은 시나리오마다 `.benchmarks/<id>.final.metrics.json`과 `.benchmarks/<id>.final.manifest.json`이다. `s5-finalize-distill`과 `s6-finalize-bare`는 `.benchmarks/<id>.final.finalize.json`도 있어야 한다. manifest의 `gates`·`review_findings`·`scope_violations`가 품질 세 값의 출처다.
- 실행 워크트리 history에 baseline 7행이 없으면 implementer는 merge/rebase를 하지 않고 중단한다. 컨트롤러가 `develop`을 `.worktrees/054/005`에 반영한 뒤에 다시 시작한다.
- `tokens_in`, `tokens_out`, `wall_s`, `tool_calls`는 metrics `usage`에 있는 키만 옮기고 없으면 빈칸으로 둔다.
- gate 통과율은 높을수록, review finding 수와 scope 위반 수는 낮을수록 좋다는 방향으로 scenario별로 비교한다.
- 테스트는 표 행을 읽어 비교하며 측정값을 코드 상수로 한 벌 더 두지 않는다. 기존 「baseline 표 7행」단정은 최종 7행을 더한 뒤에도 baseline 구간이 7행임을 유지해야 한다.

## Checklist
- [ ] 006 `index.md`의 `bouncer.status`가 `closed`인지, 실행 워크트리 `docs/benchmark/history.md`의 `## 지시문 비용 회차` 표가 `s1-light-cycle`부터 `s7-run-multitask`까지 데이터 행 7개인지 확인한다. 아니면 수정하지 않고 중단한다.
- [ ] 일곱 id 각각에 `.benchmarks/<id>.final.metrics.json`과 `.benchmarks/<id>.final.manifest.json`이 있는지 확인한다. 각 manifest의 base·모델·reasoning effort·사람 개입·프롬프트·fixture·완료 조건이 `docs/benchmark/context-cost.md`의 `## 고정 실행 입력` 해당 행과 같은지 확인한다. `s5`·`s6`은 `.final.finalize.json`의 `outcome`이 `blocked`, `blocked_by`가 `quiz-unanswered`인지도 확인한다. 하나라도 다르거나 없으면 추정하지 않고 중단한다.
- [ ] `test/benchmark-context-cost.test.js`에 history 같은 표의 최종 7행·열 일치·scenario별 품질 방향 비교를 먼저 넣는다. 최종 행이 없으면 그 단정이 실패해야 한다.
- [ ] `node --test test/benchmark-context-cost.test.js`가 최종 행 부재로 실패하는지 확인한다.
- [ ] 각 `.final.metrics.json`의 `usage`와 `.final.manifest.json`의 `gates`·`review_findings`·`scope_violations`에서 표 값을 전사한다. 없는 `usage` 키는 빈칸이다.
- [ ] 품질 세 값을 baseline 행과 scenario별로 비교한다. 하나라도 나빠지면 history에 최종 행을 쓰지 않고 `/bouncer-plan`으로 돌린다.
- [ ] 같은 절 서두를 baseline 7행과 최종 7행을 함께 담은 전사로 고치고, baseline 7행 바로 아래에 최종 7행과 측정일·`.final.metrics.json` 경로를 추가한다.
- [ ] `node --test test/benchmark-context-cost.test.js`가 통과한다.
- [ ] `npm run ci`가 통과한다.
