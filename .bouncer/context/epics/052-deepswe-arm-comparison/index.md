---
type: bouncer.epic
title: 052 DeepSWE arm 비교 회차
description: DeepSWE 원본 배관을 실제로 도는 상태로 만들고 세 arm을 같은 조건에서 돌려 비교표 한 장을 낸다
resource: .bouncer/context/epics/052-deepswe-arm-comparison/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-25T21:30:51.708+09:00'
bouncer:
  id: '052'
  epic_id: '052'
  status: approved
  supersedes: []
---
# 052 DeepSWE arm 비교 회차

## Intent
- 문제: 051이 DeepSWE 원본을 돌릴 경로를 세웠지만, 그 경로로 끝까지 도는 데
  성공한 런이 아직 하나도 없다. 러너가 안내하는 설치 명령은 이름이 같은 다른
  패키지를 가리키고, 표본 런은 태스크가 둘 이상이면 measured 한 장도 내지
  않으며, 세 arm 중 러너가 실제로 모는 것은 vanilla뿐이다. 그래서 "Bouncer
  사이클이 처음 보는 저장소에서 값을 하는가"는 여전히 답이 없다.
- 목표: 배관을 실제로 도는 상태로 만든 뒤 세 arm을 같은 태스크·같은 base에서
  돌리고, 통과율과 소모(시간·토큰)를 arm별로 나란히 놓는 비교표 한 장을 남긴다.

## Success criteria
1. `pier`가 없는 호스트에서 러너가 출력하는 설치 명령이 실제로 `pier`를 놓는
   명령이다. `pier-cli`처럼 이름만 비슷한 다른 패키지를 가리키지 않는다.
2. 태스크를 둘 이상 도는 표본 런이 태스크마다 measured JSON 한 장을 남기고,
   그 파일이 어느 경로에 어떤 이름으로 앉는지가 `docs/benchmark/deepswe/`
   문서에 정본으로 있다. 태스크 하나짜리 런도 같은 레이아웃을 따른다.
3. vanilla arm 스모크 1런이 실제로 성공해 `verdict`가 실린 병합 JSON이
   `docs/benchmark/deepswe/results/` 아래에 있다. 실패한 시도를 성공으로 적거나
   합성한 결과 JSON을 그 자리에 두지 않는다.
4. `--arm superpowers`와 `--arm bouncer`가 라벨이 아니라 그 arm의 실행 조건을
   만든다. 러너 한 줄로 세 arm이 모두 선다.
5. 태스크 3개 × arm 3개 = 9런이 같은 태스크 집합·같은 base에서 돌고, 통과
   판정은 아홉 런 모두 Pier verifier가 낸다.
6. arm 비교표 한 장이 arm별 통과율과 `usage`(`wall_s`, `tokens_in`,
   `tokens_out`)를 나란히 놓고, 그 표가 `docs/benchmark/deepswe/`와
   `docs/benchmark/history.md`의 회차 기록에 남는다.

## Out of scope
- 태스크 10개 전수(30런). 9런 비교표가 선 뒤의 다음 회차다. `sample.md`의
  seed와 `--n-tasks 10` 명령줄은 그대로 두고, 이 에픽은 그 표본의 앞 3개만
  돈다.
- `scorecard.py`의 루브릭 차원·가중치·40/60 합성 점수 구성 변경.
- 050이 만든 이 저장소 스위트 — `docs/benchmark/protocol.md`,
  `docs/benchmark/task-selection.md`, `docs/benchmark/tasks/*.json`. 회차
  결과를 `docs/benchmark/history.md`에 덧붙이는 것만 예외다.
- Pier 자체 포크·패치. 배포된 `datacurve-pier`를 그대로 쓴다.
- superpowers 플러그인 자체의 개발·설정 변경. 이미 설치된 것을 쓴다.
- Modal 등 원격 샌드박스(`--env modal`) 경로.
- `.benchmarks/`를 `.gitignore`에서 빼는 일.

## Blueprints
* [001 DeepSWE 실행 배관](blueprints/001-deepswe-run-plumbing/index.md) - 설치 안내 정정, 태스크별 measured 레이아웃, vanilla 스모크 성공 — `skills/agentic-code-benchmark/scripts/run_deepswe.py`, `docs/benchmark/deepswe/`

성공 조건 1–3은 001이 닫는다. 4(arm 자동화), 5(9런 실행), 6(비교표)은 아직
blueprint에 배정되지 않았다 — 001이 실제로 도는 배관을 세운 뒤 `/bouncer-plan`을
다시 열어 배정한다. 배관이 서기 전에 자동화와 실행을 계획하면 그 계획이 첫
실행에서 무너진다. 그때까지 이 목록은 001 한 줄이다.
