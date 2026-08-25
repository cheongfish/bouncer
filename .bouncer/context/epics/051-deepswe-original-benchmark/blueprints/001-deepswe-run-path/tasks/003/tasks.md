---
type: bouncer.tasks
title: 3 arm 프로토콜을 원본 기준으로 적고 스모크로 증명함
description: DeepSWE 원본에서 vanilla·superpowers·bouncer 세 arm을 돌리는 절차를 적고 1태스크×1arm 스모크 실행 결과를 남긴다
resource: .bouncer/context/epics/051-deepswe-original-benchmark/blueprints/001-deepswe-run-path/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-25T16:24:47.670+09:00'
bouncer:
  id: TASKS-003
  epic_id: '051'
  blueprint_id: '001'
  status: ready
  verify: npm run ci
  commit_intent:
    - arm별 절차가 이 저장소 스위트 기준이라 남의 저장소에서는 그대로 쓸 수 없었음
    - DeepSWE 원본 기준 3 arm 절차를 적고 스모크 실행 한 건으로 배관을 증명함
  affected_paths:
    - docs/benchmark/deepswe/protocol.md
    - docs/benchmark/deepswe/results
    - test/public-name-regression.test.js
    - test/skill-agentic-code-benchmark.test.js
    - skills/agentic-code-benchmark/SKILL.md
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
`docs/benchmark/deepswe/protocol.md`가 DeepSWE 원본 태스크에서 vanilla ·
superpowers · bouncer 세 arm을 돌리는 통제 조건과 arm별 절차를 담는다. bouncer
arm 절차는 태스크 저장소에 `bouncer init`을 깐 뒤 사이클을 강제하는 단계를
실행 가능한 수준으로 적는다.

001의 러너가 `pier run --agent`로 직접 몰 수 있는 것은 vanilla arm뿐이다.
superpowers와 bouncer arm은 이 문서의 절차로 서고, 세 arm 모두 판정은 같은
Pier verifier가 낸다. 그 비대칭을 문서가 숨기지 않고 적는다.

그리고 태스크 1개 × arm 1개(vanilla) 스모크를 **시도**해, 001의 러너와 002의
브리지를 거친 JSON 한 장이 남는지로 배관을 확인한다. 성공이든 환경 문제로
끝나지 못했든 그 명령줄과 결과를 `protocol.md`에 그대로 적는다.

## Interface
- 제공:
  - `docs/benchmark/deepswe/protocol.md` — Arm 표, 공통 통제, arm별 절차,
    런당 기록 값, 스모크 시도 증적.
  - 스모크가 성공한 경우에 한해
    `docs/benchmark/deepswe/results/<smoke-run-id>/` 아래 병합된 metrics JSON.
- 거부:
  - 스모크가 환경 문제(이미지 pull 실패, 에이전트 자격 증명 부재, limits
    초과)로 끝나지 못하면 성공했다고 적지 않는다. 실패한 명령줄과 로그 위치를
    그대로 적고 그 사실을 보고한다. 합성한 결과 JSON을 결과 디렉터리에 두는
    것만이 이 태스크의 실패다 — 시도가 실패한 것 자체는 아니다.

## Touch
- Create `docs/benchmark/deepswe/protocol.md` — 3 arm 통제·절차·기록 값과
  스모크 시도 증적.
- Create `docs/benchmark/deepswe/results/` 아래 스모크 산출물 — 성공했을 때만
  생긴다. 결과가 커밋되는 착지점이므로 범위 안에 있어야 스테이징된다.
- Modify `test/public-name-regression.test.js` — `COMPARISON_ARM_ALLOWLIST`에
  `docs/benchmark/deepswe/protocol.md`를 더한다. 그 문서가 커밋되는 순간
  비교 arm 이름 스캔에 들어오는데 `docs/` 아래는 HISTORICAL 면제가 아니다.
- Modify `skills/agentic-code-benchmark/SKILL.md` — DeepSWE 원본 경로
  (`run_deepswe.py` → `bridge_pier.py` → `scorecard.py`)를 이 저장소 스위트와
  나란히 한 절로 적어 진입점을 만든다.
- Modify `test/skill-agentic-code-benchmark.test.js` — 위 SKILL.md 수정이
  기존 단언(40/60 근접 매칭, `BOUNCER_ROOT` 부재, `scripts/bouncer` 부재,
  `NOTICE.md` 언급)을 깨면 여기서 고친다. 깨지 않으면 손대지 않는다.

## Do not touch
- `docs/benchmark/protocol.md` — 050이 닫은 이 저장소 스위트용 프로토콜이다.
  원본용은 `deepswe/` 아래 별도 문서로 선다.
- `docs/benchmark/history.md`, `docs/benchmark/task-selection.md`,
  `docs/benchmark/tasks/` — 같은 이유로 그대로 둔다.
- `skills/agentic-code-benchmark/scripts/scorecard.py`,
  `skills/agentic-code-benchmark/references/rubric.md` — 루브릭·가중치는
  에픽 Out of scope다.
- `skills/agentic-code-benchmark/scripts/run_deepswe.py`,
  `skills/agentic-code-benchmark/scripts/bridge_pier.py` — 001·002가 세운
  계약이다. 이 태스크는 쓰기만 한다.

## Constraints
- 본문은 한국어. 경로·식별자·명령줄은 그대로 둔다.
- superpowers arm은 설치를 선행 조건으로 적기만 한다. 설치하지 않고 설치
  여부로 실패하지도 않는다.
- bouncer arm의 계획 문서(`.bouncer/**`)는 심사 diff에서 뺀다. 세 arm을 같은
  종류의 산출물로 비교하기 위해서다. 분량은 비용 지표로만 남긴다.
- `SKILL.md`를 고칠 때 `test/skill-agentic-code-benchmark.test.js`의 세 단언을
  깨지 않는다: 40과 60이 80자 이내로 붙어 있어야 하고, `BOUNCER_ROOT`와
  `scripts/bouncer`가 본문에 나오면 안 된다. bouncer arm 절차의 CLI 경로는
  `protocol.md`에만 적고 `SKILL.md`에는 적지 않는다.
- 스모크 증적은 실제 출력에서 옮긴다. 예시로 지어내지 않는다.

## Checklist
- [ ] `docs/benchmark/deepswe/protocol.md`에 Arm 표(vanilla / superpowers /
      bouncer)와 공통 통제를 적는다: 같은 태스크, 같은 base 커밋, 사람 개입
      0회, 판정은 Pier verifier 하나.
- [ ] 러너가 직접 모는 arm은 vanilla뿐이고 나머지 둘은 절차로 선다는 것을
      Arm 표에 명시한다.
- [ ] bouncer arm 절차를 적는다 — 태스크 워크스페이스에서 `bouncer init` →
      `/bouncer-plan`(light) → plan 게이트 → `bouncer current --set` →
      `/bouncer-execute` → execute 게이트 → `/bouncer-commit`. 게이트 실패
      코드는 고치고 `--no-verify`와 가드 우회는 금지한다.
- [ ] 런당 기록 값 표를 적는다: `arm`, `task_id`, Pier `verdict`,
      `collect_metrics.py` measured 필드, `usage.*`.
- [ ] `test/public-name-regression.test.js`의 `COMPARISON_ARM_ALLOWLIST`에
      새 문서를 더하기 **전에** `node --test test/public-name-regression.test.js`
      가 깨지는 것을 먼저 확인한다.
- [ ] `SKILL.md`에 DeepSWE 절을 더한 뒤
      `node --test test/skill-agentic-code-benchmark.test.js`를 돌린다. 깨지면
      그 테스트를 고치고, 깨지지 않으면 그 파일을 손대지 않는다.
- [ ] 스모크를 시도한다: `--task <id> --arm vanilla`로 `run_deepswe.py`,
      이어서 `bridge_pier.py`로 병합.
- [ ] 스모크가 끝난 뒤 `.benchmarks/deepswe/<run-id>/`가 없는 것을 확인하고
      그 확인 명령을 `protocol.md`에 적는다.
- [ ] 스모크에 쓴 명령줄과 결과를 `protocol.md`에 인용한다. 성공했으면 병합
      JSON 경로와 합성 점수를, 실패했으면 실패한 명령줄과 로그 위치를 적는다.
- [ ] `npm run ci` 통과.
