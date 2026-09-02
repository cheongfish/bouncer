---
type: bouncer.tasks
title: scaffold 변경 전 강화 게이트 기준선 측정
description: c7df084에서 기존 네 on-arm 사례를 독립 clone으로 실행해 scaffold 변경 전 비용과 품질을 고정한다
resource: .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/001-measured-cost-reduction/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-21T20:32:39.421+09:00'
bouncer:
  id: TASKS-001
  epic_id: '043'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - 강화된 게이트만 적용된 비용 기준선이 없어 개선 원인을 분리할 수 없었음
    - scaffold 변경 전에 같은 네 사례의 비용과 품질을 고정함
  affected_paths:
    - docs/benchmark/round-2/baseline.md
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
        query: benchmark c7df084 on arm metrics scorecard blind review docs benchmark
        result: '16 hits; top paths test/validate-gates.test.js, test/finalize-pure.test.js'
      - graph: context
        status: updated
        query: benchmark c7df084 on arm metrics scorecard blind review docs benchmark
        result: '10 hits; top paths epic 034 agentic-benchmark, epic 033 quality-security'
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`c7df084`에서 t1~t4의 on arm을 각각 독립 clone으로 실행해 PR #53의 게이트 강화만 반영된 기준선을 남긴다. 이 결과가 Task 005의 scaffold 개선 후 측정과 원인 분리를 가능하게 한다.

## Interface
- 제공: `docs/benchmark/round-2/baseline.md`에 네 런의 토큰·툴 호출·시간·검증 결과·품질 점수·blind label·revert check 실행 여부와 합계/평균을 기록한다.
- 거부: `c7df084`가 아닌 베이스, 수정된 프롬프트, linked worktree, 공유 `.bouncer/context`, 누락된 네 검증 명령, 자가 심사 런은 기준선 표본에서 제외하고 제외 사유를 같은 보고서에 남긴다.

## Touch
- Create `docs/benchmark/round-2/baseline.md` — 변경 전 on-arm 4런의 통합 측정·심사 근거를 기록한다.

## Do not touch
- `docs/benchmark/runs/` — 1회차 원시 결과를 덮어쓰지 않는다.
- `docs/benchmark/tasks/` — 네 프롬프트와 `done_when`을 바꾸지 않는다.
- `scripts/` — 기준선은 제품 코드 변경 전 측정이다.

## Constraints
- 실행 순서는 Task 002보다 앞이며 베이스는 `c7df084`다.
- 런마다 별도 clone과 별도 Git common directory를 사용한다.
- 구현 에이전트에는 task JSON의 `prompt`만 주고 `done_when`은 심사자에게만 준다.
- 체크 명령은 `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` 순서와 argv를 유지한다.
- 측정 원시 파일은 clone 밖 임시 `.benchmarks/`에 보관하고 저장소에는 한 통합 보고서만 추가한다. 새 의존성·수집 스크립트를 만들지 않는다.

## Checklist
- [ ] `docs/benchmark/tasks/t1-verify-dry-run.json`부터 `t4-slow-verify-signal.json`까지 prompt와 `done_when` 해시를 기록한다.
- [ ] `c7df084`에서 독립 clone 네 개를 만들고 각 clone에 Bouncer on 조건으로 t1~t4를 한 번씩 실행한다.
- [ ] 각 런에서 네 검증 명령을 실행하고 diff·토큰·툴 호출·시간을 측정한다.
- [ ] arm label을 가린 독립 심사에서 scorecard와 실제 revert check 결과를 얻는다.
- [ ] `baseline.md`에 런별 결과와 합계/평균, 제외 표본, n=4·단일 모델·단일 반복 한계를 기록한다.
- [ ] 보고서에 Task 005가 비교할 기준값과 PR #53만 적용된 상태라는 설명이 있다.
