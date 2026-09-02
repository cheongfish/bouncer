---
type: bouncer.tasks
title: 정적 지표 baseline 수치 기록
description: 계약 문서의 다섯 명령을 돌려 변경 전 정적 지표를 Baseline 표에 적는다
resource: .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/004-baseline-measurement/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-26T14:55:29.191+09:00'
bouncer:
  id: TASKS-002
  epic_id: '043'
  blueprint_id: '004'
  status: verified
  verify: npm run ci
  commit_intent:
    - 재구조화 전 정적 지표가 어디에도 기록되지 않아 절감폭을 사후에 판정할 수 없었음
    - 계약 문서의 명령으로 뽑은 변경 전 수치를 고정하려 함
  affected_paths:
    - docs/benchmark/context-cost.md
    - test/benchmark-context-cost.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-26T15:05:00.000+09:00'
    suggested_paths:
      - test
      - .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/004-baseline-measurement
    basis:
      - graph: source
        status: reused
        query: 'benchmark context cost measurement docs protocol history static metrics scenarios'
        result: '18 nodes; hits roll up to test/ only (skill-agentic-code-benchmark.test.js, validate-gates.test.js, finalize-pure.test.js). config.source_dirs is scripts/hooks/test so docs/ cannot be suggested.'
      - graph: context
        status: updated
        query: 'benchmark context cost measurement docs protocol history static metrics scenarios'
        result: '9 nodes; hits are this blueprint plus epic 052 deepswe-run-plumbing plan docs — self and adjacent-plan noise, no new scope.'
---
# Tasks

Blueprint: [004](../../index.md)

## Goal & intent
`docs/benchmark/context-cost.md`의 정적 Baseline 표가 실제 수치로 채워져서, blueprint 002~005가 끝난 뒤 같은 명령을 다시 돌려 뺄셈으로 절감폭을 판정할 수 있다. 수치와 함께 측정 커밋 sha와 측정 시점 스킬 수를 남겨, 모수가 달라진 회차를 서로 빼는 실수를 막는다.

## Interface
- 제공: `docs/benchmark/context-cost.md`의 `## Baseline` 정적 표에 다섯 지표 행과 헤더(측정일, 베이스 커밋, 스킬 수)가 채워진다. `test/benchmark-context-cost.test.js`가 그 표에 데이터 행이 있음을 단정한다.
- 거부: task 001이 정의하지 않은 지표를 새로 추가하는 것, 명령을 바꿔 뽑은 수치, 실행 지표(`tokens_in` 등)를 이 표에 섞는 것. 실행 표는 헤더만 둔 채 blueprint 006에 넘긴다.

## Touch
- Modify `docs/benchmark/context-cost.md` — `## Baseline` 정적 표에 다섯 지표 행과 측정 메타(측정일, 베이스 커밋 sha, 스킬 수)를 채운다.
- Modify `test/benchmark-context-cost.test.js` — 정적 Baseline 표가 헤더 외에 데이터 행을 가진다고 단정하는 케이스를 더한다.

## Do not touch
- `docs/benchmark/history.md` — 실행 회차 기록은 blueprint 006 소관이다.
- `docs/benchmark/protocol.md` — task 001이 링크 한 줄을 이미 넣었다.
- `docs/benchmark/deepswe` — 별도 스위트다.
- `skills/bouncer-plan` — 구조 변경은 blueprint 002 이후다.
- `agents` — 역할별 정본화는 blueprint 002 소관이다.
- `rules` — 반복 규칙 공통화는 blueprint 004 소관이다.

## Constraints
- 수치는 task 001이 적어 둔 명령을 그대로 돌려서만 얻는다. 명령을 고쳐야 한다면 그것은 task 001 계약이 틀렸다는 신호이므로 `/bouncer-plan`으로 에스컬레이션한다.
- 측정 대상 커밋은 이 task의 실행 워크트리 `HEAD`, 즉 task 001 커밋이 올라간 시점이다. `git rev-parse --short HEAD`가 내는 값을 그대로 표에 적는다. 별도 커밋을 checkout해서 재지 않는다 — task 001은 `docs/`와 `test/`만 만졌으므로 `skills/`·`agents/` 모수가 그 사이에 달라지지 않는다.
- 지표 정의와 명령 문장은 이 task에서 바꾸지 않는다.
- 문서 산문은 한국어, 명령·경로·지표 이름은 그대로 둔다.

## Checklist
- [ ] `test/benchmark-context-cost.test.js`에 정적 Baseline 표의 데이터 행 존재를 단정하는 케이스를 먼저 더한다. 구분선(`| ---`) 아래에 `|`로 시작하는 행이 하나 이상 있어야 한다.
- [ ] `npm test`로 그 케이스가 실패하는 것을 확인한다.
- [ ] 실행 워크트리에서 `git rev-parse --short HEAD`로 베이스 커밋 sha를 기록한다. 이 값이 표의 측정 대상 커밋이다.
- [ ] `docs/benchmark/context-cost.md`의 `## 정적 지표` 절에 있는 다섯 명령을 순서대로 돌리고 출력을 그대로 표에 옮긴다. 2번 명령은 상위 항목만 옮기지 말고 진입 스킬 6개(`bouncer-init`, `bouncer-plan`, `bouncer-execute`, `bouncer-commit`, `bouncer-run`, `bouncer-finalize`) 값을 모두 적는다.
- [ ] 3번 명령의 여덟 단어 수를 역할 네 쌍(`스킬 / agent`)으로 묶어 적는다. 기대값을 미리 두지 않는다 — 이 표의 쓰임은 blueprint 002 이후 같은 명령을 다시 돌려 스킬 쪽 값이 줄었는지 보는 것이다.
- [ ] 표 위에 측정일, 베이스 커밋 sha, 측정 시점 스킬 수를 적는다.
- [ ] `npm test`가 통과하는 것을 확인한다.
- [ ] `npm run ci`가 통과한다.
