---
type: bouncer.tasks
title: light 계약 적용 후 비용 재측정
description: 같은 네 사례의 3회차를 실행해 문서 100줄 상한과 비용·품질 유지 여부를 판정한다
resource: .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/002-light-plan-contract/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-21T20:32:39.631+09:00'
bouncer:
  id: TASKS-002
  epic_id: '043'
  blueprint_id: '002'
  status: verified
  commit_intent:
    - light 계약 축소가 실제 비용을 낮추면서 품질을 지키는지 재검증해야 했음
    - 같은 네 사례의 3회차를 1·2회차와 나란히 기록해 판정함
  affected_paths:
    - docs/benchmark/round-3/runs.md
    - docs/benchmark/round-3/README.md
    - docs/benchmark/README.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-21T20:41:35.000+09:00'
    suggested_paths:
      - test
      - .bouncer/context/epics/043-bouncer-cost-improvement
      - .bouncer/context/epics/034-evaluation-benchmarking
    basis:
      - graph: source
        status: reused
        query: benchmark light plan document lines cost quality round comparison
        result: '62 hits; query broadened to line-count fixtures under test/'
      - graph: context
        status: updated
        query: benchmark light plan document lines cost quality round comparison
        result: '8 hits; epics 043 cost improvement and 034 agentic-benchmark'
---
# Tasks

Blueprint: [002](../../index.md)

## Goal & intent
Task 001의 light 계약을 적용해 t1~t4 on arm 3회차를 실행한다. plan 문서 100줄 상한, 시간 배수 2.5 이하, test quality 증가분 3.00, 실격 0건을 1·2회차와 나란히 판정한다.

## Interface
- 제공: `docs/benchmark/round-3/README.md`와 `runs.md`에 네 런의 비용·품질·검증·문서 줄 수 및 이전 회차 비교를 기록하고 상위 benchmark README가 이를 링크한다.
- 거부: full로 실행된 런, 100줄을 넘긴 런, 이전 회차와 prompt hash·검증 argv·심사 규약이 다른 런은 성공 표본에서 제외한다.

## Touch
- Create `docs/benchmark/round-3/runs.md` — light on-arm 네 런의 통합 측정·심사 근거를 기록한다.
- Create `docs/benchmark/round-3/README.md` — 1·2·3회차 비교와 성공 조건 판정을 기록한다.
- Modify `docs/benchmark/README.md` — 1·2회차를 보존한 채 round 3 링크와 결론을 추가한다.

## Do not touch
- `docs/benchmark/runs/` — 1회차 원시 결과를 수정하지 않는다.
- `docs/benchmark/round-2/` — BP001 결과를 수정하지 않는다.
- `docs/benchmark/tasks/` — 네 입력을 바꾸지 않는다.
- `scripts/` — 측정 결과에 맞춰 구현을 재조정하지 않는다.

## Constraints
- BP001과 같은 독립 clone·prompt hash·네 검증 명령·블라인드 리뷰·revert check를 사용한다.
- 각 plan 단계에서 blueprint index와 task bundle 네 문서의 전체 줄 수를 기록한다.
- 비용 목표가 실패해도 결과를 누락하지 않고 적용 기준을 "코드 변경 200줄 이상"으로 제한할 근거를 보고서에 적는다.
- 원시 산출물은 임시 `.benchmarks/`에 두고 저장소에는 세 문서만 변경한다.

## Checklist
- [ ] round 2에 기록된 prompt·`done_when` 해시와 검증 argv를 확인한다.
- [ ] 독립 clone 네 개에서 `--scale light` on arm을 실행하고 plan 문서 줄 수와 측정값을 수집한다.
- [ ] 블라인드 라벨 독립 심사와 실제 revert check를 수행한다.
- [ ] `runs.md`에 네 런의 비용·점수·검증·게이트 실패·문서 줄 수를 기록한다.
- [ ] `README.md`에서 문서 `<= 100`, 시간 배수 `<= 2.5`, test quality Δ `= +3.00`, 실격 `= 0`을 판정한다.
- [ ] 실패 시 적용 기준을 200줄 이상 작업으로 제한하고 t1 2.10배·t2 7.26배 곡선을 근거로 적는다.
