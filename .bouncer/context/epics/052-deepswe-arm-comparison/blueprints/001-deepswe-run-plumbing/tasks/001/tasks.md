---
type: bouncer.tasks
title: pier 설치 안내를 실제 패키지로 고침
description: 러너가 없는 pier를 안내할 때 datacurve-pier와 uv/pipx/pip 설치 경로를 제시하도록 선행 조건 메시지를 고친다
resource: .bouncer/context/epics/052-deepswe-arm-comparison/blueprints/001-deepswe-run-plumbing/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-25T21:30:51.744+09:00'
bouncer:
  id: TASKS-001
  epic_id: '052'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - 러너가 안내하던 `pipx install pier-cli`가 DeepSWE와 무관한 다른 패키지를 가리켜, pier가 없는 호스트는 그 안내를 따라도 pier를 얻지 못했음
    - 선행 조건 메시지를 datacurve-pier로 바로잡고 uv·pipx·pip 세 설치 경로를 순서대로 제시함
  affected_paths:
    - skills/agentic-code-benchmark/scripts/run_deepswe.py
    - test/skill-agentic-code-benchmark.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-25T21:45:00.000+09:00'
    suggested_paths:
    - test
    # 유효 엔트리 필드: graph, status, query, result — 예시는 주석이라 파싱되지 않는다
    # - graph: source | context
    #   status: updated | reused | fail-skip | skip-disabled | missing
    #   query: <graphify 조회>
    #   result: <한 줄 요약>
    basis:
    - graph: source
      status: reused
      query: deepswe runner pier install hint per-task metrics results layout smoke benchmark
      result: 71 nodes, all under test/ (top - test/skill-agentic-code-benchmark.test.js, test/public-name-regression.test.js, test/public-contract.test.js); config.source_dirs is scripts/hooks/test so skills/agentic-code-benchmark/scripts is outside the graph
    - graph: context
      status: updated
      query: deepswe 벤치마크 러너 pier 설치 안내 태스크별 metrics 결과 레이아웃 스모크
      result: 8 nodes, all the freshly authored 052 plan documents themselves; no prior epic surfaced as an overlap
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`pier`가 PATH에 없는 호스트에서 러너가 내는 안내를 따라가면 실제로 `pier`가
설치된다. 지금은 `pipx install pier-cli`를 안내하는데, PyPI의 `pier-cli`
0.0.3은 로컬 이미지 배포 도구로 DeepSWE와 무관하다. DeepSWE가 쓰는 배포물은
`datacurve-pier`(현재 0.3.1)이고, 에픽 051도 본문에서 그 이름을 지목했다.
안내가 가리키는 곳과 실제로 필요한 것이 갈린 상태를 닫는다.

## Interface
- 제공: `run_deepswe.py`의 선행 조건 실패 stderr가 `datacurve-pier`와 세 설치
  경로를 담는다. 우선순위는 `uv tool install datacurve-pier` →
  `pipx install datacurve-pier` → `pip install datacurve-pier`. 종료 코드 2와
  "클론 전에 멈춘다"는 기존 동작은 그대로다.
- 거부: 러너는 설치를 대신 시도하지 않는다. `uv`나 `pipx`가 있어도 호출하지
  않고, 안내만 하고 비영 코드로 끝난다. 러너가 호스트에 도구를 깔기 시작하면
  측정 환경이 런마다 달라진다.

## Touch
- Modify `skills/agentic-code-benchmark/scripts/run_deepswe.py` — `INSTALL_HINT`의
  `pier` 항목을 `datacurve-pier`와 세 설치 경로로 바꾼다. `docker` 항목과
  선행 조건 검사 루프는 그대로 둔다.
- Modify `test/skill-agentic-code-benchmark.test.js` — 기존
  `run_deepswe.py refuses before cloning when pier is missing from PATH`
  테스트의 stderr 단언을 좁혀, `datacurve-pier`가 있고 `pier-cli`가 없음을
  함께 고정한다.

## Do not touch
- `skills/agentic-code-benchmark/scripts/collect_metrics.py` — 이 태스크는
  측정 계산을 건드리지 않는다.
- `skills/agentic-code-benchmark/scripts/bridge_pier.py` — 병합 계약은 그대로다.
- `skills/agentic-code-benchmark/scripts/scorecard.py` — 채점은 그대로다.
- `docs/benchmark/deepswe/protocol.md` — 이 문서의 「스모크 시도」 절은 003이
  실제 실행 결과로 갱신한다. 여기서 미리 고치면 아직 돌지 않은 실행을 적게 된다.
- `docs/benchmark/protocol.md`, `docs/benchmark/task-selection.md`,
  `docs/benchmark/tasks/` — 050이 만든 이 저장소 스위트다.

## Constraints
- 러너는 python3 표준 라이브러리만 쓴다. 새 의존성을 들이지 않는다.
- 안내 문자열은 영어를 유지한다. 이 스크립트의 다른 stderr 문구와 같은 계열이다.
- 설치 명령을 실제로 실행하는 코드를 넣지 않는다.
- 패키지 이름은 `datacurve-pier`로 고정한다. PyPI의 `pier`(도커 API 래퍼)와
  `pier-cli`(이미지 배포 도구)는 둘 다 다른 프로젝트다.

## Checklist
- [ ] `test/skill-agentic-code-benchmark.test.js`의 pier 부재 테스트 단언을 먼저 좁힌다.
  ```js
  assert.match(run.stderr, /datacurve-pier/);
  assert.doesNotMatch(run.stderr, /pier-cli/);
  ```
- [ ] `node --test test/skill-agentic-code-benchmark.test.js`로 이 단언이 실패하는 것을 확인한다.
- [ ] `run_deepswe.py`의 `INSTALL_HINT["pier"]`를 고친다. 세 경로가 한 줄에
  모두 보여야 한다 — 호스트마다 있는 도구가 달라서 하나만 적으면 다시 막힌다.
  ```
  "install Pier: uv tool install datacurve-pier (or pipx install datacurve-pier, "
  "or pip install datacurve-pier)  (see https://github.com/datacurve-ai/deep-swe)"
  ```
- [ ] `node --test test/skill-agentic-code-benchmark.test.js` 통과를 확인한다.
- [ ] `npm run ci` 통과.
