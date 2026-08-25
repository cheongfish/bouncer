---
type: bouncer.tasks
title: 3 arm 프로토콜과 usage 기록 필드를 붙임
description: vanilla·superpowers·bouncer 세 arm 통제 조건을 프로토콜로 적고 collect_metrics에 토큰·시간 기록 플래그를 더한다
resource: .bouncer/context/epics/050-cycle-friction/blueprints/003-plugin-arm-benchmark/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-25T14:08:20.386+09:00'
bouncer:
  id: TASKS-003
  epic_id: '050'
  blueprint_id: '003'
  status: verified
  verify: npm run ci
  commit_intent:
    - 벤치마크가 Bouncer on/off 2 arm이라 다른 플러그인과 견줄 축이 없고 토큰이 아예 기록되지 않았음
    - 세 arm 통제 조건을 프로토콜로 세우고 채점하지 않는 usage 블록을 기록에 더함
  affected_paths:
    - docs/benchmark/protocol.md
    - skills/agentic-code-benchmark/scripts/collect_metrics.py
    - skills/agentic-code-benchmark/SKILL.md
    - skills/agentic-code-benchmark/references/task-suite.md
    - test/skill-agentic-code-benchmark.test.js
    - test/public-name-regression.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-25T14:10:00+09:00'
    suggested_paths:
      - test/skill-agentic-code-benchmark.test.js
      - docs/benchmark
    basis:
      - graph: source
        status: reused
        query: query 'agentic code benchmark scorecard' (BFS depth=2)
        result: COLLECT_METRICS 상수를 통해 skill-agentic-code-benchmark.test.js가 하네스 스크립트에 붙어 있음을 확인
      - graph: context
        status: reused
        query: query '벤치마크 arm 프로토콜'
        result: 003 태스크 문서만 매칭 — 하네스 스킬은 context_dirs 밖
---
# Tasks

Blueprint: [003](../../index.md)

## Goal & intent
`docs/benchmark/protocol.md`를 vanilla · superpowers · bouncer 세 arm 기준으로
새로 쓰고, `collect_metrics.py`가 토큰·벽시계·툴콜을 받아 metrics JSON에
채점하지 않는 `usage` 블록으로 싣게 한다. 이 둘이 서면 태스크 002의 스위트를
다음 회차에 그대로 돌릴 수 있다. 완료 판정은 프로토콜이 세 arm을 각각
정의하고, 플래그를 준 호출만 `usage`를 내며, `npm run ci`가 통과하는 것이다.

## Interface
- 제공:
  - `docs/benchmark/protocol.md`: arm 표(vanilla = 플러그인 없음,
    superpowers = superpowers만, bouncer = Bouncer 사이클 강제), 세 arm에
    공통인 통제 조건(같은 base, 같은 모델, 같은 프롬프트, 사람 개입 0,
    같은 checks), arm별 실행 절차, 그리고 런당 기록해야 할 값의 목록.
  - superpowers arm은 그 플러그인이 설치되어 있어야 한다는 선행 조건을
    적는다. 설치 절차 자체는 이 문서 밖이다.
  - `collect_metrics.py`에 `--tokens-in`, `--tokens-out`, `--wall-s`,
    `--tool-calls` 네 플래그(모두 선택, 정수). 하나 이상 주어지면 metrics
    JSON 최상위에 `usage` 객체를 싣고, 준 키만 담는다.
  - `skills/agentic-code-benchmark/SKILL.md`와 `references/task-suite.md`에
    `usage` 기록과 arm 축을 한 문단씩 반영한다.
- 거부:
  - 플래그를 하나도 주지 않은 호출에 빈 `usage: {}`를 넣는 것. 키 자체를
    만들지 않는다.
  - 주지 않은 값을 `0`이나 `null`로 채우는 것. "재지 않음"과 "0이었음"이
    구분되어야 한다.
  - `usage`를 `objective_breakdown`이나 합성 점수에 넣는 것. 기록 전용이다.
  - `metrics` 스키마 문자열 변경. 선택 키만 늘었으므로 `…/metrics/1`을
    유지한다.

## Touch
- Create `docs/benchmark/protocol.md` — 3 arm 통제 조건과 실행 절차.
- Modify `skills/agentic-code-benchmark/scripts/collect_metrics.py` —
  네 플래그 추가와 `usage` 조립.
- Modify `skills/agentic-code-benchmark/SKILL.md` — `usage` 기록과 arm 축
  반영.
- Modify `skills/agentic-code-benchmark/references/task-suite.md` —
  A/B 절을 3 arm으로 넓힌다.
- Modify `test/skill-agentic-code-benchmark.test.js` — 플래그 유무에 따른
  `usage` 존재/부재 assert 추가.
- Modify `test/public-name-regression.test.js` — 벤치마크 비교 arm으로
  세 번째 플러그인 이름을 적는 파일만 허용한다. Bouncer가 그 플러그인을
  워크플로로 통합했다는 서술은 계속 막는다.

## Do not touch
- `skills/agentic-code-benchmark/scripts/scorecard.py` — `.get()`으로만
  읽으므로 `usage`를 무시한다. 고칠 이유가 없고, 고치면 채점이 바뀐다.
- `skills/agentic-code-benchmark/references/rubric.md` — 루브릭과 가중치는
  epic Out of scope다.
- `docs/benchmark/tasks/`, `docs/benchmark/task-selection.md` — 태스크 002.
- `docs/benchmark/history.md` — 태스크 001.
- `.bouncer/config.json` — 벤치마크는 이 저장소 설정을 바꾸지 않는다.

## Constraints
- `usage`는 채점 입력이 아니다. 합성 점수는 같은 metrics에 대해 이 변경
  전후로 같은 값을 내야 한다.
- 기존 필드는 하나도 이름이 바뀌거나 사라지지 않는다.
- 플래그 파싱은 `argparse`의 기존 패턴을 그대로 쓴다. 새 의존성이나 별도
  설정 파일을 만들지 않는다.
- 프로토콜은 3회차까지의 통제 조건(같은 모델, 사람 개입 0, 동일 checks,
  측정치를 다른 실행 전에 수집)을 그대로 승계한다. 승계하는 줄임을
  문서에서 알아볼 수 있게 적는다.
- `agentic-code-benchmark`는 워크플로 밖 특화 스킬이다. `collect_metrics.py`에
  `BOUNCER_ROOT` 해석이나 `scripts/bouncer` 호출을 넣지 않고, `usage` 값이
  `verification.md`·`review.md`·게이트 판정으로 흘러가게 하지 않는다.
- 프로토콜의 plan 단계 스냅샷 절차를 승계한다. 하네스는 런별 plan 단계
  `.bouncer/context` 트리를 보관하지 않고 실행 clone은 커밋 하나로 squash되므로,
  그 절차가 빠지면 계획 단계 비용을 사후에 잴 수 없다.
- 파이썬 주석은 영어, 문서 본문은 한국어.
- 공개 이름 회귀는 Bouncer 제품 표면에 세 번째 플러그인 통합을 쓰지
  못하게 한다. 벤치마크 프로토콜·하네스 스킬이 비교 arm으로 그 이름을
  적는 것은 통합이 아니다. 허용 목록은 그 비교 문서에만 열고, 목록을
  비우거나 제품 문서를 넣지 않는다.

## Checklist
- [ ] `test/skill-agentic-code-benchmark.test.js`에 실패 테스트를 먼저
      넣는다: `--tokens-in 1200 --wall-s 300`을 준 호출의 JSON에
      `usage.tokens_in === 1200`이고 `usage.tool_calls`가 없으며,
      플래그 없는 호출의 JSON에는 `usage` 키 자체가 없다.
- [ ] `node --test test/skill-agentic-code-benchmark.test.js`로 실패를
      확인한다.
- [ ] `collect_metrics.py`의 `argparse`에 네 플래그를 `type=int,
      default=None`으로 더한다.
- [ ] `metrics` 딕셔너리 조립 뒤에 준 값만 모아 `usage`를 만들고, 비어
      있으면 키를 넣지 않는다.
- [ ] `docs/benchmark/protocol.md`를 arm 표 · 공통 통제 조건 · arm별 절차 ·
      런당 기록 값 순으로 쓴다.
- [ ] `SKILL.md`와 `references/task-suite.md`에 `usage`와 arm 축을 반영한다.
- [ ] `test/public-name-regression.test.js`에 비교 arm 문서 허용 목록을
      넣고, `docs/ARCHITECTURE.md`와 설치 문서에는 그 이름이 계속
      없는지 확인한다.
- [ ] 같은 metrics로 `scorecard.py`를 변경 전후 한 번씩 돌려 합성 점수가
      같은지 확인한다.
- [ ] `npm run ci` 통과를 확인한다.
