---
type: bouncer.tasks
title: 고정 입력과 실행 baseline 회차 기록
description: 동일한 입력으로 실행한 일곱 시나리오의 비용과 품질을 측정 계약과 이력에 기록한다
resource: .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/009-execution-baseline/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-27T08:29:39.832+09:00'
bouncer:
  id: TASKS-001
  epic_id: '043'
  blueprint_id: '009'
  status: verified
  verify: npm run ci
  commit_intent:
    - 실행 조건만으로는 baseline과 최종 회차의 입력 동등성을 재현할 수 없었음
    - 고정 입력과 실제 런 산출물을 한 회차의 비용·품질 증적으로 남기려 함
  affected_paths:
    - docs/benchmark/context-cost.md
    - docs/benchmark/history.md
    - test/benchmark-context-cost.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-27T16:12:29+09:00'
    suggested_paths:
      - test
      - .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/009-execution-baseline
      - .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/009-execution-baseline/tasks/001
      - .bouncer/context/epics/027-history-import
    # 유효 엔트리 필드: graph, status, query, result — 예시는 주석이라 파싱되지 않는다
    # - graph: source | context
    #   status: updated | reused | fail-skip | skip-disabled | missing
    #   query: <graphify 조회>
    #   result: <한 줄 요약>
    basis:
      - graph: source
        status: reused
        query: fixed input execution baseline benchmark history scenario test
        result: '16 nodes; top files: test/benchmark-context-cost.test.js, test/skill-agentic-code-benchmark.test.js, test/import-history.test.js'
      - graph: context
        status: updated
        query: fixed input execution baseline benchmark history scenario test
        result: '8 nodes; hits: current blueprint 006 documents and unrelated epic 027 history-import context'
---
# Tasks

Blueprint: [009](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | context
     status: updated | reused | fail-skip | skip-disabled | missing
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
`1c73980`에서 같은 프롬프트·fixture·완료 조건으로 실행한 일곱 시나리오의 비용과 품질이 측정 계약과 회차 이력에 남는다. `s5`·`s6`의 무응답 퀴즈 차단은 실행 실패로 전사하며 성공 수치로 바꾸지 않는다. `npm run ci` 통과로 표 구조와 기존 회차 보존을 확인한다.

## Interface
- 제공:
  - `docs/benchmark/context-cost.md`에 시나리오별 시작 fixture, 실행 프롬프트, 완료 조건과 baseline 실행 표 7행을 제공한다. 차단 런은 gate 결과를 `blocked`로 명시한다.
  - `docs/benchmark/history.md`에 같은 열을 쓰는 지시문 비용 baseline 7행을 새 절로 제공한다.
  - `test/benchmark-context-cost.test.js`가 고정 입력 7개와 두 baseline 표의 완결성을 단정한다.
- 거부:
  - base, 프롬프트, fixture, 완료 조건 중 하나라도 다른 런은 baseline 입력으로 받지 않는다.
  - 산출물이 없거나 출처에서 확인되지 않는 값을 추정하지 않는다. 미측정 `usage` 값은 빈칸으로 둔다.

## Touch
- Modify `docs/benchmark/context-cost.md` — 고정 런 입력과 실행 baseline 7행을 측정 정본에 기록한다.
- Modify `docs/benchmark/history.md` — 다른 회차와 열을 섞지 않는 지시문 비용 baseline 절을 추가한다.
- Modify `test/benchmark-context-cost.test.js` — 고정 입력과 두 표의 7개 scenario id·열·출처를 구조적으로 단정한다.

## Do not touch
- `.benchmarks/` — 읽기 전용 입력이며 git에 기록하거나 실행 중 수정하지 않는다.
- `skills/agentic-code-benchmark/` — 수집기 스키마·점수 계산·arm 정의는 이 task의 대상이 아니다.
- `docs/benchmark/deepswe/` — DeepSWE 원본 회차는 열과 실행 조건이 다르다.

## Constraints
- Minimality: 기존 측정 문서 두 개와 계약 테스트 하나로 닫고 새 스크립트·fixture 파일·dependency를 만들지 않는다.
- baseline과 최종 회차는 `1c73980`에서 만든 독립 clone, 모델 `gpt-5.6-terra`, reasoning effort `medium`, 사람 개입 0회, 동일한 시나리오별 실행 프롬프트를 쓴다. 이 조건에서 finalize의 필수 퀴즈는 무응답 차단 결과로만 기록한다.
- 시작 fixture 준비 비용은 런의 `usage`와 품질 값에서 제외한다.
- `tokens_in`, `tokens_out`, `wall_s`, `tool_calls`는 metrics의 `usage`에 존재하는 키만 옮긴다.
- gate 통과율은 실행한 게이트 수와 통과 수, review finding 수는 해당 런 review의 Findings, scope 위반 수는 commit-safety·scope 실패에서 센다.
- 1–3회차와 DeepSWE 표는 열 구성이 다르므로 행을 추가하거나 수치를 고치지 않는다.

## Checklist
- [ ] s1–s4의 `.recovery.metrics.json`·`.recovery.manifest.json`과 s5–s7의 metrics·manifest를 열거하고, 각 런의 base·프롬프트·fixture·완료 조건이 blueprint의 `## 고정 런 입력`과 같은지 확인한다. `s5`·`s6`은 퀴즈 무응답 차단·Distill 경로 증적을 함께 확인한다. 하나라도 다르거나 없으면 파일을 수정하지 않는다.
- [ ] 각 런 manifest와 metrics의 `usage`, verification, review, commit-safety·scope 결과에서 표에 들어갈 값을 전사 목록으로 만든다. `s5`·`s6`은 `.benchmarks/<label>.finalize.json`의 `outcome`, `blocked_by`, `explain_exists`, `blueprint_status`가 Contract 값과 같은지도 확인한다. 없는 `usage` 키는 빈칸으로 유지한다.
- [ ] `test/benchmark-context-cost.test.js`에 다음 실패 조건을 먼저 추가한다.
  - `docs/benchmark/context-cost.md`의 고정 입력 표에 7개 id, base `1c73980`, 모델 `gpt-5.6-terra`, reasoning effort `medium`, fixture·실행 프롬프트·완료 조건 열이 모두 있어야 한다.
  - `context-cost.md`와 `history.md`의 지시문 비용 baseline 표는 같은 7개 id와 기록 열을 가져야 한다.
  - 각 데이터 행은 비어 있지 않은 측정일과 산출물 경로를 가져야 한다.
- [ ] 아래 명령이 고정 입력과 baseline 행 부재로 실패하는지 확인한다.

  ```bash
  node --test test/benchmark-context-cost.test.js
  ```

- [ ] blueprint의 `## 고정 런 입력`을 `docs/benchmark/context-cost.md`로 옮기고, 실행 Baseline 표에 7개 런 값을 기록한다.
- [ ] `docs/benchmark/history.md`에 `## 지시문 비용 회차` 절과 같은 열의 baseline 7행을 추가한다. 1–3회차·DeepSWE 절은 유지한다.
- [ ] 아래 명령이 통과하는지 확인한다.

  ```bash
  node --test test/benchmark-context-cost.test.js
  npm run ci
  ```
