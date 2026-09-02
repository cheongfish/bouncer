---
type: bouncer.tasks
title: 호스트 체크아웃 없이도 패치에서 measured를 내게 함
description: 'Pier가 단위 안에 `.git`을 안 남겨도 패치와 태스크 base가 있으면 태스크 프로젝트 트리에서 metrics.json을 낸다.'
resource: .bouncer/context/epics/034-evaluation-benchmarking/blueprints/004-checkout-arms-comparison/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-26T09:47:03.243+09:00'
bouncer:
  id: TASKS-001
  epic_id: '034'
  blueprint_id: '004'
  status: verified
  verify: npm run ci
  commit_intent:
    - Pier가 호스트에 워크스페이스를 안 남겨 패치가 있어도 measured를 건너뜀
    - 태스크 프로젝트 트리를 복원해 같은 패치에서 metrics.json을 내게 함
  affected_paths:
    - skills/agentic-code-benchmark/scripts/run_deepswe.py
    - test/skill-agentic-code-benchmark.test.js
    - docs/benchmark/deepswe/protocol.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-26T09:50:00+09:00'
    suggested_paths:
      - test
      - .bouncer/context/epics/034-evaluation-benchmarking
    basis:
      - graph: source
        status: updated
        query: deepswe runner host checkout workspace metrics.json patch collect_metrics
        result: >-
          33 nodes. Top file test/skill-agentic-code-benchmark.test.js
          (COLLECT_METRICS). skills/ 러너는 source_dirs 밖. migrate-ids 히트는
          json 토큰 충돌.
      - graph: context
        status: updated
        query: 052 deepswe-arm-comparison checkout protocol sample
        result: >-
          9 nodes. 이 BP의 tasks/001–003 본문. protocol.md·sample.md는
          컨텍스트 그래프 밖.
---
# Tasks

Blueprint: [004](../../index.md)

## Goal & intent
Pier가 단위 안에 `.git`을 안 남겨도 패치와 태스크 base가 있으면 태스크
프로젝트 트리에서 `metrics.json`을 낸다. 스위트 클론은 측정하지 않는다.

## Interface
- 제공: 가짜 pier가 `reward.json`과 적용 가능한 패치만 남기고 단위 디렉터리에
  `git init`을 하지 않아도, 러너가 `docs/benchmark/deepswe/results/<run-id>/tasks/<task-id>/metrics.json`을
  만든다. `run.log`에 어떤 트리를 복원했는지가 남는다.
- 거부: 패치가 없으면 `metrics.json`을 만들지 않는다. 스위트 클론 안의
  `reward.json`·gold 패치를 이 런의 단위로 옮기지 않는다. 빈 diff로 measured를
  채우지 않는다. 이 태스크에서 `--arm` 의미와 브리지 인자 표면을 바꾸지 않는다.

## Touch
- Modify `skills/agentic-code-benchmark/scripts/run_deepswe.py` — `.git` 부재를
  즉시 skip하지 않고 태스크 프로젝트 트리(base+패치)를 복원한다.
- Modify `test/skill-agentic-code-benchmark.test.js` — 패치만 있고 워크스페이스
  `.git`이 없는 스텁에서 `metrics.json`이 생기는 테스트와, 패치 없음 skip이
  유지되는 테스트를 둔다.
- Modify `docs/benchmark/deepswe/protocol.md` — 측정 사본이 호스트 체크아웃
  없이도 태스크 프로젝트 트리에서 나온다고 고친다. 2026-08-25 실패 원문은 유지한다.

## Do not touch
- `skills/agentic-code-benchmark/scripts/bridge_pier.py`
- `skills/agentic-code-benchmark/scripts/collect_metrics.py`
- `skills/agentic-code-benchmark/scripts/scorecard.py`
- `docs/benchmark/history.md`
- `docs/benchmark/protocol.md`
- `docs/benchmark/task-selection.md`
- `docs/benchmark/tasks/`
- `docs/benchmark/deepswe/results`
- `docs/benchmark/deepswe/sample.md`

## Constraints
- 측정 대상은 DeepSWE 태스크가 가리키는 프로젝트 저장소다. `deep-swe` 클론의
  `tasks/` 트리를 `--repo`로 넘기지 않는다.
- 결과 레이아웃 `tasks/<task-id>/`와 `metrics.json` 스키마는 001과 같다.
- 실제 스모크를 다시 돌리지 않는다. 증적은 단위 테스트다.

## Checklist
- [ ] 패치 없이 끝나는 기존 테스트가 아직 초록인지 확인한다.
- [ ] 워크스페이스 `git init`을 빼되 패치와 `reward.json`은 남기는 스텁으로
      테스트를 추가하고, 구현 전에 아래가 실패하는지 확인한다.
      ```
      assert.ok(fs.existsSync(path.join(results, 'tasks', '<id>', 'metrics.json')))
      assert.doesNotMatch(run.stderr, /pier left no host-side workspace checkout/)
      ```
- [ ] 러너가 태스크 프로젝트 트리(base+패치)에서 `collect_metrics.py`를 돌리게
      고친다. 클론 픽스처 오인 테스트는 그대로 통과해야 한다.
- [ ] protocol 측정 절을 위 동작에 맞추고, 2026-08-25 stderr 원문은 그대로 둔다.
- [ ] `npm run ci` 통과.
