---
type: bouncer.tasks
title: 스모크 실패를 protocol과 sample에 고정함
description: 배관 001–002까지는 섰고, vanilla 1런은 Pier 산출물이 호스트에 없어 병합 JSON을 못 남긴 상태를 문서에 고정한다.
resource: .bouncer/context/epics/034-evaluation-benchmarking/blueprints/003-deepswe-run-plumbing/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-25T21:30:57.829+09:00'
bouncer:
  id: TASKS-003
  epic_id: '034'
  blueprint_id: '003'
  status: verified
  commit_intent:
    - 스모크가 호스트 체크아웃 없이 끝나 병합 JSON을 남기지 못함
    - 그 실패를 protocol과 sample에 고정함
  affected_paths:
    - docs/benchmark/deepswe/protocol.md
    - docs/benchmark/deepswe/sample.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-26T08:54:00+09:00'
    suggested_paths:
      - test
      - .bouncer/context/epics/034-evaluation-benchmarking
    basis:
      - graph: source
        status: updated
        query: deepswe protocol sample smoke checkout metrics results vanilla pier
        result: >-
          17 nodes. Top files test/skill-agentic-code-benchmark.test.js,
          test/subagents.test.js. skills/ 러너는 source_dirs 밖이라 그래프에 없음.
      - graph: context
        status: updated
        query: deepswe 스모크 실패 protocol sample 체크아웃 병합 JSON
        result: >-
          8 nodes. 052 index.md, 001 index.md, tasks/002/tasks.md.
          실행 대상 문서 protocol.md·sample.md는 컨텍스트 그래프 밖.
---
# Tasks

Blueprint: [003](../../index.md)

## Goal & intent
배관 001–002까지는 섰고, vanilla 1런은 Pier 산출물이 호스트에 없어 병합 JSON을
못 남긴 상태를 문서에 고정한다. 워크트리에 이미 있는 protocol·sample 초안을
이 브리프에 맞춘다. 스모크를 다시 돌리지 않는다.

## Interface
- 제공: `docs/benchmark/deepswe/protocol.md`에 실패 스모크의 명령·출력·원인
  한 줄이 있다. 2026-08-25 `pier-cli` 실패는 유지한다. Pier 설치 후 시도
  (`claude-code`, `abs-module-cache-flags`, 종료 0,
  `NonZeroAgentExitCodeError`, `no host-side workspace checkout`)는 실제
  출력으로 남긴다. `pipx`·결과 비어 있음 서술은 이미 과거형이다.
- 제공: `docs/benchmark/deepswe/sample.md`에 스모크 id
  `abs-module-cache-flags`가 있다. 열 개 표는 비어 있고 `--n-tasks 10` 이후에
  채운다고 적는다.
- 거부: `merged.json`을 손으로 만들지 않는다. 스크립트를 고치지 않는다.
  스모크를 다시 돌리지 않는다. `docs/benchmark/deepswe/results/`에 실패한
  JSON을 두지 않는다.

## Touch
- Modify `docs/benchmark/deepswe/protocol.md` — 설치 후 실패 시도 절의 실제
  출력을 유지하고, 「003에서 우회하지 않는다」를 이 BP가 실패를 문서로 닫고
  체크아웃 구멍은 다음 blueprint가 고친다는 문장으로 바꾼다.
- Modify `docs/benchmark/deepswe/sample.md` — 스모크 id와 빈 열 개 표를 현재
  상태에 맞게 둔다.

## Do not touch
- `skills/agentic-code-benchmark/scripts/`
- `test/skill-agentic-code-benchmark.test.js`
- `docs/benchmark/deepswe/results`
- `docs/benchmark/history.md`
- `docs/benchmark/protocol.md`
- `docs/benchmark/task-selection.md`
- `docs/benchmark/tasks/`

## Constraints
- protocol·sample에 적는 출력은 이미 나온 것을 옮긴다. 요약하거나 다듬지 않는다.
- `.gitkeep`만 있는 results 레이아웃을 유지한다.
- 호스트 체크아웃 구멍은 다음 blueprint가 고친다.

## Checklist
- [ ] protocol 「스모크 시도」 절에 Pier 설치 후 실패 명령·출력이 있고
  `pier-cli` 당일 stderr 원문은 남아 있는지 확인한다.
- [ ] 「003에서 우회하지 않는다」를 이 BP가 실패를 문서로 닫고 체크아웃
  구멍은 다음 blueprint가 고친다는 문장으로 바꾼다.
- [ ] sample에 `abs-module-cache-flags`가 있고 열 개 표가 비어 있는지 확인한다.
- [ ] `docs/benchmark/deepswe/results/`에 `.gitkeep` 외 JSON이 없는지 확인한다.
- [ ] `npm run ci` 통과.
