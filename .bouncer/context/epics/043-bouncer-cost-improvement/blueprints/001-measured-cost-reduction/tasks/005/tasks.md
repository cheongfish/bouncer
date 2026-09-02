---
type: bouncer.tasks
title: scaffold 개선 후 비용 재측정
description: 같은 네 on-arm 사례를 재실행해 기준선과 비용·품질·게이트 실패를 비교한다
resource: .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/001-measured-cost-reduction/tasks/005/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-21T20:32:39.561+09:00'
bouncer:
  id: TASKS-005
  epic_id: '043'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - scaffold 힌트가 실제 비용과 품질에 미친 효과를 같은 조건에서 확인해야 했음
    - 기준선과 개선 후 네 런을 나란히 기록해 성공 기준을 판정함
  affected_paths:
    - docs/benchmark/round-2/improved.md
    - docs/benchmark/round-2/README.md
    - docs/benchmark/README.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-21T20:41:35.000+09:00'
    suggested_paths:
      - test
      - .bouncer/context/epics/034-evaluation-benchmarking
      - .bouncer/context/epics/033-quality-security
    basis:
      - graph: source
        status: reused
        query: benchmark round comparison metrics quality gate failures docs benchmark
        result: '44 hits; top paths validate-gates and validate-structural tests'
      - graph: context
        status: updated
        query: benchmark round comparison metrics quality gate failures docs benchmark
        result: '8 hits; epics 034 agentic-benchmark and 033 quality-security'
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
Task 002~004가 반영된 HEAD에서 t1~t4 on arm을 다시 실행해 Task 001 기준선 및 1회차 off arm과 비교한다. 스키마 발견 실패 제거, 시간 2.5배 이하, test quality 증가분 3.00, 실격 0건을 판정한다.

## Interface
- 제공: `docs/benchmark/round-2/improved.md`에 네 개선 런의 근거를, `docs/benchmark/round-2/README.md`에 baseline·improved·1회차 off 비교와 변수 분리 결론을 기록한다. 상위 benchmark README가 round 2를 링크한다.
- 거부: 프롬프트·모델·검증 명령·심사 규약이 기준선과 다른 런은 비교값에 넣지 않는다. n=4 결과를 일반적 인과로 과장하지 않는다.

## Touch
- Create `docs/benchmark/round-2/improved.md` — scaffold 개선 후 네 런의 통합 측정·심사 근거를 기록한다.
- Create `docs/benchmark/round-2/README.md` — 기준선·개선 후·1회차 off를 나란히 비교하고 성공 조건을 판정한다.
- Modify `docs/benchmark/README.md` — 1회차를 보존한 채 round 2 링크와 요약을 추가한다.

## Do not touch
- `docs/benchmark/runs/` — 1회차 원시 결과를 수정하지 않는다.
- `docs/benchmark/tasks/` — 비교 입력을 바꾸지 않는다.
- `scripts/` — 이 task는 측정과 보고만 한다.

## Constraints
- Task 001과 같은 독립 clone·prompt hash·검증 argv·blind review·revert check 규약을 사용한다.
- 개선 런에는 Task 002~004가 모두 포함되어야 한다.
- `G18`, `S9`, `G4` 발생 횟수를 런별로 세고 다른 실패와 구분한다.
- 원시 산출물은 임시 `.benchmarks/`에 두고 저장소에는 세 문서만 변경한다.

## Checklist
- [ ] Task 001에 기록된 prompt와 `done_when` 해시가 현재 네 task JSON과 같은지 확인한다.
- [ ] 독립 clone 네 개에서 t1~t4 on arm을 실행하고 네 검증 명령과 metrics를 수집한다.
- [ ] blind label을 쓴 독립 심사자가 revert check를 실제 실행하게 한다.
- [ ] `improved.md`에 네 런의 비용·점수·검증·게이트 실패를 기록한다.
- [ ] `README.md`에서 시간 배수 `≤ 2.5`, test quality Δ `= +3.00`, on 실격 `= 0`, G18/S9/G4 `= 0`을 각각 판정한다.
- [ ] 기준선과 개선 런에 섞인 변수를 명시하고 1회차 자료를 덮어쓰지 않는다.
