---
type: bouncer.tasks
title: DeepSWE 기반 태스크 10개 정본과 선정 근거를 세움
description: DeepSWE 태스크 모양을 이 저장소에 맞게 각색한 정본 JSON 10개와 선정 근거 문서를 만든다
resource: .bouncer/context/epics/050-cycle-friction/blueprints/003-plugin-arm-benchmark/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-25T14:08:20.350+09:00'
bouncer:
  id: TASKS-002
  epic_id: '050'
  blueprint_id: '003'
  status: ready
  verify: npm run ci
  commit_intent:
    - 태스크 넷이 이 저장소를 보고 손으로 만든 것이라 선정 근거가 남아 있지 않았음
    - DeepSWE 태스크 모양을 기준으로 10개를 다시 고르고 근거를 문서로 남김
  affected_paths:
    - docs/benchmark/tasks
    - docs/benchmark/task-selection.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-25T14:10:00+09:00'
    suggested_paths:
      - test/skill-agentic-code-benchmark.test.js
    basis:
      - graph: source
        status: reused
        query: query 'benchmark metrics collect' (BFS depth=2)
        result: 태스크 정본 JSON은 source 그래프 범위 밖이라 경로 후보가 나오지 않음
      - graph: context
        status: reused
        query: query '벤치마크 arm 프로토콜'
        result: 003 태스크 문서만 매칭
---
# Tasks

Blueprint: [003](../../index.md)

## Goal & intent
`docs/benchmark/tasks/`에 태스크 10개의 정본 JSON을 세우고,
`docs/benchmark/task-selection.md`에 각 태스크가 어떤 shape이며 왜 이
저장소에 적합한지를 한 줄씩 남긴다. shape 분류는
`skills/agentic-code-benchmark/references/task-suite.md`의 표를 기준으로
쓰되, DeepSWE가 다루는 실패 유형(진단이 필요한 버그, 여러 모듈에 걸친
변경, 회귀 테스트가 있어야 통과하는 수정)이 표본에 들어가야 한다. 완료
판정은 JSON 10개가 네 필드를 모두 갖고 근거 문서가 10줄을 채우며
`npm run ci`가 통과하는 것이다.

## Interface
- 제공:
  - `docs/benchmark/tasks/<id>.json` 10개. 각각 `id`(kebab-case),
    `base`(고정 커밋 sha), `prompt`(두 arm에 토씨 하나 안 바꾸고 전달할
    한국어 또는 영어 지시), `done_when`(심사자용 판정 문장 배열),
    `checks`(이 저장소에서 실제로 도는 명령 맵)를 갖는다.
  - `docs/benchmark/tasks/README.md` — 파일 규약, 한 회차 안에서 `base`를
    하나로 통일한다는 규칙, 그리고 실행 회차가 열 파일의 `base`를 일괄
    갱신한다는 규약.
  - `docs/benchmark/task-selection.md` — 10행 표(태스크 id · shape ·
    DeepSWE에서 대응하는 실패 유형 · 이 저장소 적합성 근거)와, DeepSWE
    원본 목록을 어떤 경로로 확인했는지 또는 확인하지 못했는지 한 문단.
- 거부:
  - `done_when`을 프롬프트에 섞는 것. 판정 조건은 심사자에게만 간다.
  - 이 저장소에서 돌지 않는 `checks` 명령. 각 명령은 작성 시점에 실제로
    실행해 보고 적는다.
  - 10개 중 어느 하나라도 `base`가 비거나 브랜치 이름인 것. 재현이 깨진다.

## Touch
- Create `docs/benchmark/tasks/README.md` — 파일 규약과 `base` 고정 규칙.
- Create `docs/benchmark/task-selection.md` — 10행 선정 근거 표와 출처 문단.
- Create `docs/benchmark/tasks` — 태스크 정본 JSON 10개가 들어갈 자리.

## Do not touch
- `docs/benchmark/history.md` — 태스크 001의 산출물이고 요약 전용이다.
- `docs/benchmark/protocol.md` — 태스크 003이 만든다.
- `skills/agentic-code-benchmark/` — 하네스는 태스크 003 소관이다.
- `.benchmarks/` — gitignore 대상 실행 산출물이다.

## Constraints
- 10개는 shape이 겹치지 않게 고른다. 같은 shape을 셋 이상 넣으면 표본이
  한쪽으로 쏠려 arm 간 차이가 shape 차이에 묻힌다.
- 프롬프트는 arm 중립이어야 한다. Bouncer 용어(`blueprint`, `게이트`,
  `affected_paths`)나 다른 플러그인 용어를 프롬프트에 넣지 않는다 — 그것을
  가르는 것은 프로토콜이다.
- 한 회차 안에서 열 태스크의 `base`는 하나로 통일한다. 태스크마다 다른
  base를 쓰면 arm 간 비교가 태스크 간 비교와 섞인다.
- 정본에 적는 `base`는 작성 시점의 `develop` 커밋이고, 그것이 최종값은
  아니다. 이 blueprint가 머지되기 전 커밋에는 태스크 003이 붙일 `usage`
  플래그가 아직 없어서 그 base로는 토큰을 기록할 수 없다. 실행 회차가 그
  회차의 공통 base로 열 파일을 일괄 갱신한다는 규약을
  `docs/benchmark/tasks/README.md`에 적는다.
- 네트워크로 DeepSWE 원본 목록을 확인하지 못하면 shape 분류 기반 각색으로
  진행하고 그 사실을 `task-selection.md`에 적는다. 10개를 줄이지 않는다.
- 한국어 본문. JSON 안의 키와 명령 문자열은 그대로.

## Checklist
- [ ] `git rev-parse --short HEAD`로 작성 시점 `base`를 정하고, 열 파일에
      같은 값을 쓴다. 실행 회차 갱신 규약을 `tasks/README.md`에 적는다.
- [ ] `skills/agentic-code-benchmark/references/task-suite.md`의 shape 표를
      읽고, 10개에 배정할 shape 목록을 먼저 정한다.
- [ ] DeepSWE 원본 목록 확인을 시도하고, 성공하든 실패하든 그 경로를
      `task-selection.md` 출처 문단에 적는다.
- [ ] 태스크마다 이 저장소의 실제 코드 위치를 하나 이상 지목해 `prompt`를
      쓴다. 지목할 곳이 없으면 그 태스크는 후보에서 뺀다.
- [ ] 각 태스크의 `checks` 명령을 실제로 한 번씩 실행해 도는지 확인한다.
- [ ] JSON 10개와 `README.md`, `task-selection.md`를 쓴다.
- [ ] `for f in docs/benchmark/tasks/*.json; do python3 -c "import json,sys;d=json.load(open(sys.argv[1]));assert all(k in d for k in ('id','base','prompt','done_when','checks')),sys.argv[1]" "$f"; done`
      로 네 필드 존재를 확인한다.
- [ ] `ls docs/benchmark/tasks/*.json | wc -l`이 `10`인지 확인한다.
- [ ] `npm run ci` 통과를 확인한다.
