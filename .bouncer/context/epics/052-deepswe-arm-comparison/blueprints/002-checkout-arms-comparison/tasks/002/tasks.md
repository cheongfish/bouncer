---
type: bouncer.tasks
title: arm 값이 실행 조건을 만들게 함
description: '`run_deepswe.py --arm`이 라벨이 아니라 vanilla·superpowers·bouncer 실행 조건을 러너 한 줄로 세우게 한다.'
resource: .bouncer/context/epics/052-deepswe-arm-comparison/blueprints/002-checkout-arms-comparison/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-26T09:47:03.291+09:00'
bouncer:
  id: TASKS-002
  epic_id: '052'
  blueprint_id: '002'
  status: verified
  verify: npm run ci
  commit_intent:
    - 러너의 --arm이 산출물 라벨이라 세 arm을 한 줄로 세울 수 없었음
    - vanilla·superpowers·bouncer가 각자 실행 조건으로 갈라지게 함
  affected_paths:
    - skills/agentic-code-benchmark/scripts/run_deepswe.py
    - test/skill-agentic-code-benchmark.test.js
    - docs/benchmark/deepswe/protocol.md
    - skills/agentic-code-benchmark/SKILL.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-26T09:50:00+09:00'
    suggested_paths:
      - test
      - .bouncer/context/epics/052-deepswe-arm-comparison
    basis:
      - graph: source
        status: updated
        query: run_deepswe arm superpowers bouncer vanilla pier
        result: >-
          2 nodes. test/skill-agentic-code-benchmark.test.js (RUN_DEEPSWE).
          skills/ 러너는 source_dirs 밖.
      - graph: context
        status: updated
        query: 052 deepswe-arm-comparison checkout protocol sample
        result: >-
          9 nodes. 이 BP의 tasks/001–003 본문. protocol.md는 컨텍스트 그래프 밖.
---
# Tasks

Blueprint: [002](../../index.md)

## Goal & intent
`--arm vanilla|superpowers|bouncer`가 라벨이 아니라 그 arm의 실행 조건을
러너 한 줄로 세우게 한다.

## Interface
- 제공: 같은 인자 표면. vanilla는 플러그인 없이 `pier run --agent`.
  superpowers는 그 플러그인만 켠 세션이고 `.bouncer/`를 만들지 않는다.
  bouncer는 `pier run` 전에 `bouncer init`과 light scaffold·
  `bouncer current --set`까지 워크스페이스에 남긴다. 스텁이 확인하는 것은
  `.bouncer/` 존재와 vanilla/superpowers에 그것이 없음이다. plan 게이트
  이후 본문(execute/commit)은 Pier 에이전트가 돌리고 러너가 CLI로 대신
  부르지 않는다. `--help`의 `--arm` 설명이 라벨 전용이 아니다.
- 거부: superpowers가 호스트에 없으면 설치를 시도하지 않고 비영 코드와 이유
  한 줄을 내고 결과 JSON을 만들지 않는다. `--no-verify`나 게이트 우회로
  bouncer arm을 통과시키지 않는다. `--arm` 값 집합을 넷 이상으로 늘리지 않는다.

## Touch
- Modify `skills/agentic-code-benchmark/scripts/run_deepswe.py` — `--arm`이
  호출·워크스페이스 준비를 고르게 한다.
- Modify `test/skill-agentic-code-benchmark.test.js` — arm별로 스텁이 본
  명령·파일이 갈라지는 단언, superpowers 부재 시 비영 코드 단언.
- Modify `docs/benchmark/deepswe/protocol.md` — Arm 표의 「러너가 직접 모는가」를
  세 arm 모두 예로 바꾸고, 사람 절차 절을 러너가 하는 일로 옮긴다.
- Modify `skills/agentic-code-benchmark/SKILL.md` — DeepSWE 절에서
  superpowers·bouncer가 손 절차라는 문장을 러너 `--arm`으로 고친다.

## Do not touch
- `skills/agentic-code-benchmark/scripts/bridge_pier.py`
- `skills/agentic-code-benchmark/scripts/scorecard.py`
- `docs/benchmark/history.md`
- `docs/benchmark/protocol.md`
- `docs/benchmark/task-selection.md`
- `docs/benchmark/tasks/`
- `docs/benchmark/deepswe/results`
- `docs/benchmark/deepswe/sample.md`

## Constraints
- 판정은 세 arm 모두 Pier verifier다. 러너가 통과를 다시 매기지 않는다.
- bouncer arm의 `.bouncer/**`는 심사 diff(패치)에서 뺀다. 001 protocol과 같다.
- `SKILL.md`에 `BOUNCER_ROOT`와 `scripts/bouncer`를 적지 않는다.
  `test/skill-agentic-code-benchmark.test.js`가 요구하는 대로 본문에서
  `40`과 `60`이 80자 이내로 붙어 있어야 한다.
- 9런을 이 태스크에서 돌리지 않는다.

## Checklist
- [ ] `--help`에 `--arm`이 라벨 전용이라고 적힌 현재 문구를 테스트가 잡을 수
      있으면 그 단언을 먼저 빨갛게 만든다. 없으면 스텁이 기록한 `pier` argv·
      워크스페이스 파일로 arm 세 갈래를 단언하는 테스트를 추가하고 구현 전에
      실패를 확인한다.
- [ ] bouncer 스텁에서 `pier run` 전에 `.bouncer/`가 있고, vanilla·superpowers
      스텁에는 없는지 단언한다.
- [ ] superpowers 부재 스텁에서 종료 코드가 0이 아니고 결과 경로가 없는지
      확인한다.
- [ ] protocol Arm 표와 SKILL.md DeepSWE 절을 맞춘다.
- [ ] `node --test test/skill-agentic-code-benchmark.test.js` 통과 후
      `npm run ci`.
