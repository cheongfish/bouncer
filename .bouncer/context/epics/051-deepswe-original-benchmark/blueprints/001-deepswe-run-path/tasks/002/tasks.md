---
type: bouncer.tasks
title: Pier 판정을 metrics JSON 한 장에 실음
description: reward.json의 통과 판정을 collect_metrics.py 출력에 verdict 블록으로 병합해 scorecard.py를 고치지 않고 채점되게 한다
resource: .bouncer/context/epics/051-deepswe-original-benchmark/blueprints/001-deepswe-run-path/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-25T16:24:47.632+09:00'
bouncer:
  id: TASKS-002
  epic_id: '051'
  blueprint_id: '001'
  status: verified
  verify: npm run ci
  commit_intent:
    - Pier가 내는 통과 판정과 이 저장소가 내는 measured 필드가 서로 다른 파일에 흩어져 런 하나를 한 장으로 볼 수 없었음
    - reward.json을 metrics JSON의 verdict 블록으로 병합하는 브리지를 붙이고, 러너가 tracked가 되며 깨진 공개 이름 회귀를 같은 커밋에서 되살림
  affected_paths:
    - skills/agentic-code-benchmark/scripts/bridge_pier.py
    - test/skill-agentic-code-benchmark.test.js
    - test/public-name-regression.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-25T16:40:00+09:00'
    suggested_paths:
      - test/skill-agentic-code-benchmark.test.js
      - skills/agentic-code-benchmark/scripts
      - docs/benchmark
    basis:
      - graph: source
        status: updated
        query: >-
          query 'benchmark metrics collect scorecard pier deepswe runner'
          (BFS depth=2, 47 nodes)
        result: >-
          COLLECT_METRICS / collectMetrics()에서 출발한 이웃이 전부
          test/skill-agentic-code-benchmark.test.js 안에 모인다. 하네스
          스크립트의 유일한 호출·고정 지점이 그 테스트라는 뜻이다. 나머지
          히트(scripts/src/lib/validate.ts)는 collectFindingFailures() 이름
          충돌이라 이 작업과 무관하다.
      - graph: context
        status: updated
        query: >-
          query 'agentic code benchmark protocol arms superpowers naming
          allowlist' (BFS depth=2, 12 nodes)
        result: >-
          034/001과 050/002·003의 explain.md만 걸린다. 벤치마크 하네스와
          arm 프로토콜의 선행 결정이 그 셋에 있고, 새로 건드릴 컨텍스트
          문서는 없다. 이름 허용 목록은 그래프에 노드로 잡히지 않아
          test/public-name-regression.test.js를 직접 읽어 확인했다.
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`python3 skills/agentic-code-benchmark/scripts/bridge_pier.py --metrics <m> --reward <r> --arm <arm> --out <o>`
가 Pier verifier의 통과 판정을 `collect_metrics.py` 출력에 `verdict` 블록으로
실어 같은 모양의 JSON 한 장으로 다시 쓴다. `schema`는
`agentic-code-benchmark/metrics/1` 그대로이고 `verdict`는 `usage`와 같은
선택 키이므로, `scorecard.py score --metrics <o> --judgment <j> --out <s>`가 코드 수정 없이
그대로 돈다.

이 태스크가 이름 허용 목록 한 줄을 함께 지는 이유가 있다. 001이 커밋되면서
`run_deepswe.py`가 tracked가 되었고, `test/public-name-regression.test.js`의
비교 arm 스캔이 `git ls-files` 기준이라 그 순간부터 `--arm`의 `choices`에 있는
`superpowers`를 위반으로 잡는다. 001의 execute 게이트가 녹색이었던 것은 그때
그 파일이 untracked라 스캔 대상이 아니었기 때문이다. 001은 이미 닫혔고 003은
`protocol.md`만 그 목록에 올리므로, 이 한 줄을 여기서 지지 않으면 002의
`npm run ci`가 통과할 수 없다.

## Interface
- 제공:
  - `bridge_pier.py`. 필수 `--metrics`, `--reward`, `--arm`, `--out`.
    선택 `--ctrf`.
  - 출력 JSON = 입력 metrics JSON의 모든 키 + `verdict`.
  - `verdict` = `{ "source": "pier", "task_id": <str>, "arm": <str>,
    "passed": <bool>, "reward": <number> }`. `--ctrf`를 주고 그 파일에서 통과
    비율을 읽을 수 있으면 `"pass_fraction": <number>`를 더한다. 읽지 못하면
    그 키를 만들지 않는다 — `usage`와 같은 규칙으로, 없는 값을 `0`으로 채우면
    "재지 않음"과 "0이었음"이 구분되지 않는다.
- 거부:
  - `--reward` 파일이 없거나 JSON 파싱에 실패하면 비영 코드로 끝나고 `--out`을
    만들지 않는다. 부분 결과를 남기면 "판정 없음"이 "실패"로 읽힌다.
  - `--metrics`의 `task_id`와 `--reward`가 가리키는 태스크 id가 서로 다르면
    거부한다. 두 런의 조각이 한 장으로 붙는 것을 막는다.
  - `--metrics`의 `task_id`가 `null`이어도 거부한다. `collect_metrics.py`는
    `--task-id`를 주지 않으면 그 자리에 `null`을 넣으므로, `null`을 통과시키면
    대조가 통째로 무력해진다. 001의 러너는 `--task-id`를 항상 준다.
  - `--metrics`의 `schema`가 `agentic-code-benchmark/metrics/1`이 아니면
    거부한다.
  - `--out` 경로가 이미 있으면 덮어쓰지 않고 거부한다.

## Touch
- Create `skills/agentic-code-benchmark/scripts/bridge_pier.py` — reward/ctrf를
  읽어 metrics JSON에 `verdict`를 실어 다시 쓴다. python3 stdlib만.
- Modify `test/skill-agentic-code-benchmark.test.js` — 파일 존재 목록에
  `scripts/bridge_pier.py`를 더하고, 병합 결과가 입력 키를 잃지 않는 것,
  거부 네 가지, 그리고 병합 결과가 `scorecard.py`에 그대로 들어가는 것을
  고정한다.
- Modify `test/public-name-regression.test.js` — `COMPARISON_ARM_ALLOWLIST`에
  `skills/agentic-code-benchmark/scripts/run_deepswe.py`를 더한다. 그 목록의
  다른 항목이 저마다 이유 주석을 달고 있으므로, 스크립트가 문서 목록에 끼는
  이유(`--arm` 값이 사용자가 치는 실제 값이라 리터럴을 피할 수 없음)를 한 줄
  주석으로 남긴다. 그 두 줄 외의 편집은 하지 않는다 — 다른 목록·정규식·스캔
  기준은 그대로 둔다.

## Do not touch
- `skills/agentic-code-benchmark/scripts/scorecard.py` — 이 태스크의 요지는
  그 파일을 고치지 않고도 돈다는 것이다. 고치면 계약이 무너진다.
- `skills/agentic-code-benchmark/scripts/collect_metrics.py` — 기존 필드와
  플래그는 그대로 둔다.
- `skills/agentic-code-benchmark/scripts/run_deepswe.py` — 001이 세운 러너다.
- `skills/agentic-code-benchmark/references/rubric.md` — 루브릭 차원은
  에픽 Out of scope다.

## Constraints
- python3 stdlib만 쓴다.
- `schema` 문자열을 올리지 않는다. 기존 키가 사라지지 않고 선택 키만 늘기
  때문이다 — 003이 `usage`를 더할 때 쓴 판단과 같다.
- `verdict`는 채점 입력이 아니다. `scorecard.py`가 읽는 필드 이름을 재사용해
  가중치에 새어 들어가게 하지 않는다.
- 비자명한 의도는 한국어 주석으로 남긴다.

## Checklist
- [ ] `test/skill-agentic-code-benchmark.test.js`에 실패하는 테스트를 먼저
      더한다: 존재 목록에 `scripts/bridge_pier.py`; 병합 출력이 입력 metrics의
      모든 최상위 키를 유지하고 `verdict.passed`가 reward의 통과 값을 따르며
      `verdict.arm`이 `--arm` 값과 같다; `--reward` 부재·파싱 실패·태스크 id
      불일치·`task_id`가 `null`·`schema` 불일치·`--out` 선점 각각에서 종료
      코드가 0이 아니고 `--out`이 만들어지지 않는다.
- [ ] `node --test test/skill-agentic-code-benchmark.test.js`로 실패를 확인한다.
- [ ] `bridge_pier.py`를 구현한다.
- [ ] 병합 결과를 `scorecard.py score --metrics <병합본> --judgment <더미>
      --out <임시>`에 넣어 점수가 나오는 것을 테스트로 고정한다. `--out`은
      `scorecard.py`의 `score`에서 필수라 빠뜨리면 그 호출이 비영으로 끝난다.
      `scorecard.py`는 손대지 않는다.
- [ ] `--ctrf`를 주지 않은 호출의 출력에 `pass_fraction` 키가 없는 것을
      테스트로 고정한다.
- [ ] `test/public-name-regression.test.js`의 `COMPARISON_ARM_ALLOWLIST`에
      `skills/agentic-code-benchmark/scripts/run_deepswe.py`를 더한다. 더하기
      전에 `node --test test/public-name-regression.test.js`로 그 파일이
      위반으로 잡히는 것을 보고, 더한 뒤 통과하는 것을 본다.
- [ ] `npm run ci` 통과.
