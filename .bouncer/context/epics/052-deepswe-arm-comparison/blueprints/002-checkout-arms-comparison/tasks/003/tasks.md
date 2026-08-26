---
type: bouncer.tasks
title: 세 arm 9런 비교표를 남김
description: 같은 태스크 3개를 세 arm으로 돌려 통과율과 usage를 비교표와 history에 남긴다.
resource: .bouncer/context/epics/052-deepswe-arm-comparison/blueprints/002-checkout-arms-comparison/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-26T09:47:03.291+09:00'
bouncer:
  id: TASKS-003
  epic_id: '052'
  blueprint_id: '002'
  status: ready
  verify: npm run ci
  commit_intent:
    - 세 arm을 같은 태스크에서 나란히 본 숫자가 아직 없음
    - 9런 산출물로 비교표와 회차 기록을 남김
  affected_paths:
    - docs/benchmark/deepswe/sample.md
    - docs/benchmark/deepswe/comparison.md
    - docs/benchmark/history.md
    - docs/benchmark/deepswe/protocol.md
    - docs/benchmark/deepswe/results
    - test/public-name-regression.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-26T09:50:00+09:00'
    suggested_paths:
      - test
      - .bouncer/context/epics/052-deepswe-arm-comparison
    basis:
      - graph: source
        status: updated
        query: public-name-regression comparison arm allowlist history benchmark
        result: >-
          70 nodes. Top files test/public-name-regression.test.js
          (COMPARISON_ARM_ALLOWLIST), test/public-contract.test.js.
          docs/benchmark 는 source_dirs 밖.
      - graph: context
        status: updated
        query: 052 deepswe-arm-comparison checkout protocol sample
        result: >-
          9 nodes. 이 BP의 tasks/001–003 본문. comparison.md는 아직 없음.
---
# Tasks

Blueprint: [002](../../index.md)

## Goal & intent
같은 태스크 3개를 세 arm으로 돌려 통과율과 usage를 비교표와 history에 남긴다.

## Interface
- 제공: 태스크 3개가 `sample.md` 「052 비교 태스크 3개」에 고정된다. id는
  DeepSWE 원본 클론 `tasks/`에서 README가 아닌 앞 세 디렉터리이고 스모크 id
  `abs-module-cache-flags`를 포함한다. 런 id는 `052-<arm>-<task-id>`. 각 런에
  `run.log`와 `reward.json`이 있다. `metrics.json`이 있는 런만 `merged.json`이
  있고, 패치가 없으면 metrics와 merged가 없다. `comparison.md`에 arm별
  통과율·`wall_s`·`tokens_in`·`tokens_out` 표가 있다. `history.md`의
  `## DeepSWE 원본` 절에 이 회차 행이 있다.
- 거부: 합성한 `merged.json`·공개 점수 날조. 실패한 칸을 0으로 채워 성공처럼
  보이게 하기. `--n-tasks 10` 전수 런. 050 `protocol.md` 수정.

## Touch
- Modify `docs/benchmark/deepswe/sample.md` — 「052 비교 태스크 3개」절만
  채운다. 열 개 표본 표는 비워 둔다.
- Create `docs/benchmark/deepswe/comparison.md` — arm × 태스크 통과와 usage.
- Modify `docs/benchmark/history.md` — `## DeepSWE 원본` 절을 더한다. 1–3회차
  표는 그대로 둔다.
- Modify `docs/benchmark/deepswe/protocol.md` — 9런에 쓴 명령줄과 결과 경로를
  인용한다.
- Create `docs/benchmark/deepswe/results/` — 9런 산출물(`052-<arm>-<task-id>/`).
  `.gitkeep`은 유지하고 합성 JSON은 두지 않는다.
- Modify `test/public-name-regression.test.js` — `comparison.md`가 arm 이름
  스캔에 들어오면 허용 목록에 그 경로를 더한다. 깨지지 않으면 이 파일을
  스테이징하지 않는다.

## Do not touch
- `skills/agentic-code-benchmark/scripts/run_deepswe.py`
- `skills/agentic-code-benchmark/scripts/bridge_pier.py`
- `docs/benchmark/protocol.md`
- `docs/benchmark/task-selection.md`
- `docs/benchmark/tasks/`
- `skills/agentic-code-benchmark/scripts/scorecard.py`

## Constraints
- 숫자는 실제 런 산출물에서 옮긴다. 없는 값은 칸을 비운다.
- 러너·브리지는 001·002가 세운 것을 쓰기만 한다.
- `comparison.md`를 커밋하는 커밋에 공개 이름 회귀가 깨지면 허용 목록을 같은
  커밋에서 고친다.

## Checklist
- [ ] DeepSWE 클론 `tasks/`에서 README가 아닌 앞 세 디렉터리 id를
      `sample.md` 「052 비교 태스크 3개」에 적는다.
- [ ] 태스크마다 arm 세 번, run-id `052-<arm>-<task-id>`로 `run_deepswe.py`를
      돌리고, metrics가 있는 런은 `bridge_pier.py`로 `merged.json`을 만든다.
- [ ] 환경으로 죽은 런은 protocol에 명령줄과 종료를 적고 비교표 칸을 비운다.
- [ ] `comparison.md`에 통과율과 usage를 채운다.
- [ ] `history.md`에 `## DeepSWE 원본` 절과 행을 더하고 1–3회차 숫자를
      바꾸지 않았는지 확인한다.
- [ ] `git add`할 `comparison.md` 기준으로
      `node --test test/public-name-regression.test.js`를 돌리고, 깨지면
      허용 목록만 고친다.
- [ ] `npm run ci` 통과.
