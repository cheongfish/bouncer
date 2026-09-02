---
type: bouncer.explain
title: 003 explain
description: Explain for 003
resource: .bouncer/context/epics/009-agent-orchestration/blueprints/012-plugin-arm-benchmark/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-25T16:09:52.245+09:00'
bouncer:
  id: EXPLAIN-012
  epic_id: '009'
  blueprint_id: '012'
  status: published
  comprehension:
    - range_from: develop
      range_to: 01b082aa55068e14b41d692dc6086df78dbb12aa
      diff_sha: 8c26e088f76e6351df6e36aa2ab3b13596604e19f35b204dad06a395bda1acdb
      quiz_score: '2/3'
      disposition: Q2를 빈 usage 객체로 골랐음. 플래그가 있을 때만 준 키를 싣는다.
      recorded_at: '2026-08-25T16:11:04+09:00'
---
# Explain

## Background
옛 벤치마크는 off/on 두 arm이었고, 태스크 넷은 이 저장소를 보고 손으로 골랐다.
토큰은 런 기록에 남지 않았다. 이 변경은 1–3회차 수치를 `docs/benchmark/history.md`
한 장으로 옮긴 뒤 나머지 옛 문서를 지우고, DeepSWE shape을 각색한 태스크 JSON
10개와 선정 근거를 세우고, vanilla / 비교 플러그인 / bouncer 세 arm 프로토콜과
`collect_metrics.py`의 선택 `usage` 플래그를 붙인다. 30런 실행은 여기 없다.

## Intuition
스위트(JSON 10)와 재는 축(프로토콜 3 arm)을 갈라 놓고, 토큰·시간은 채점하지
않는 `usage`에만 싣는다.

## Code
- `docs/benchmark/history.md` — 1–3회차 표. Distill light-contract 인용의 착지점.
- `docs/benchmark/tasks/*.json`, `tasks/README.md`, `task-selection.md` — 정본
  10개. `base`는 회차 일괄 갱신.
- `docs/benchmark/protocol.md` — 세 arm 통제·절차·plan 단계 스냅샷.
- `skills/agentic-code-benchmark/scripts/collect_metrics.py` — `--tokens-in` 등
  네 플래그. 준 키만 `usage`. `scorecard.py`는 그대로.
- `test/skill-agentic-code-benchmark.test.js` — 플래그 유무.
- `test/public-name-regression.test.js` — 비교 arm 문서 셋만 세 번째 플러그인
  이름 허용.

## Quiz
1. 1–3회차 시간 배수·계획 문서 줄 수를 다음에 어디서 읽나?
2. `collect_metrics.py`가 metrics JSON에 `usage`를 넣는 조건은?
3. 벤치마크 arm은 어디에 정의되나?

## 이해 상태
3문항. 정답 1A / 2B / 3C. 응답 1A / 2A / 3C. 2/3 정답.
Q2는 빈 `usage: {}`를 골랐다. 플래그 하나 이상일 때만 준 키를 넣고, 없으면 키를
생략한다. 마감은 막지 않는다.
