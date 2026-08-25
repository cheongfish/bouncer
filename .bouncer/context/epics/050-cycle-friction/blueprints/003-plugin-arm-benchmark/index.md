---
type: bouncer.blueprint
title: 벤치마크를 DeepSWE 스위트와 3 arm 프로토콜로 갈아엎음
description: 기존 docs/benchmark를 걷어내고 DeepSWE 기반 태스크 10개와 vanilla·superpowers·bouncer 3 arm 프로토콜, usage 기록 필드를 세운다
resource: .bouncer/context/epics/050-cycle-friction/blueprints/003-plugin-arm-benchmark/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-25T11:09:18.849+09:00'
bouncer:
  id: '003'
  epic_id: '050'
  blueprint_id: '003'
  status: closed
  commit_type: feat
  scale: full
---
# 003 plugin-arm-benchmark

Epic: [050](../../index.md)

## Intent
- 문제: 지금 벤치마크는 Bouncer on/off 2 arm이고, 태스크 넷은 이 저장소를 보고
  손으로 만든 것이다. 다른 플러그인과 견줄 축이 없고, 태스크 선정 근거가
  "우리가 골랐다" 밖에 없다. 재는 것도 `wall_s`·`tool_calls_est`를 에이전트가
  본문에 손으로 적는 방식이라 토큰은 아예 남지 않는다.
- 완료 조건: DeepSWE 기반 태스크 10개가 정본 JSON으로 서고, vanilla ·
  superpowers · bouncer 세 arm의 통제 조건과 실행 절차가 프로토콜에 적히고,
  런 기록이 토큰·벽시계·툴콜을 `usage` 블록으로 싣는다. 30런 실행과 비교표는
  이 blueprint 밖이다.

## Contract
- 인터페이스:
  - `docs/benchmark/`를 통째로 걷어내고 다음 구조로 다시 세운다:
    `history.md`(1~3회차 요약), `tasks/*.json`(10개 정본),
    `task-selection.md`(선정 근거), `protocol.md`(3 arm).
  - `collect_metrics.py`에 `--tokens-in` / `--tokens-out` / `--wall-s` /
    `--tool-calls` 플래그를 더하고, 넷 중 하나라도 주어지면 metrics JSON에
    `usage` 객체를 싣는다. 하나도 없으면 키를 만들지 않는다.
  - `usage`는 채점 입력이 아니다. `scorecard.py`는 `.get()`으로만 읽으므로
    코드를 고치지 않아도 무시된다 — 이 blueprint는 그 파일을 건드리지 않는다.
  - `metrics` 스키마 문자열(`agentic-code-benchmark/metrics/1`)은 그대로
    둔다. 기존 필드가 사라지지 않고 선택적 키만 늘기 때문이다.
- 데이터·상태:
  - 태스크 JSON은 기존 계약(`id`·`base`·`prompt`·`done_when`·`checks`)을
    그대로 쓴다. arm은 태스크가 아니라 프로토콜이 가르는 축이다.
  - `.benchmarks/`는 `.gitignore` 대상이므로 정본이 그쪽에 서지 않는다.
    실행 산출물만 그 아래에 떨어진다.
- 수용 기준:
  1. `docs/benchmark/`의 기존 README·protocol·tasks·runs·diffs·round-2·
     round-3가 작업 트리에 없다.
  2. `docs/benchmark/history.md`가 1·2·3회차의 시간 배수, test quality Δ,
     계획 문서 줄 수, 실격 수를 표 하나로 담는다.
  3. `docs/benchmark/tasks/`에 JSON 10개가 있고 각각 네 필드를 갖는다.
  4. `docs/benchmark/task-selection.md`가 10개 각각의 shape과 이 저장소
     적합성 근거를 한 줄씩 적는다.
  5. `docs/benchmark/protocol.md`가 vanilla·superpowers·bouncer 세 arm의
     통제 조건과 arm별 실행 절차를 적는다.
  6. `collect_metrics.py`를 `--repo`·`--base`·`--head`와 함께 부르되
     `--tokens-in` / `--tokens-out`을 더한 호출은 `usage`를 실은 JSON을 내고,
     네 플래그를 하나도 주지 않은 같은 호출에는 `usage` 키가 없다.
  7. `npm run ci` 통과.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - DeepSWE 원본 목록을 네트워크로 가져오지 못하는 경우: shape 분류 기반
    각색으로 진행하고 그 사실과 대체 근거를 `task-selection.md`에 적는다.
    가져오지 못했다는 이유로 태스크 수를 10개 미만으로 줄이지 않는다.
  - 삭제 전에 요약 수치를 뽑지 못한 경우: 삭제와 `history.md` 작성은 같은
    태스크에 묶여 있으므로, 수치를 먼저 뽑고 나서 지운다. 순서를 뒤집으면
    같은 커밋 안에서 원본이 사라진다.
  - `usage` 플래그를 일부만 준 호출: 준 키만 담고 나머지는 넣지 않는다.
    없는 값을 `0`으로 채우면 "재지 않음"과 "0이었음"이 구분되지 않는다.
  - superpowers가 설치되어 있지 않은 환경: 프로토콜은 설치를 선행 조건으로
    적기만 한다. 이 blueprint는 설치를 하지 않고 설치 여부로 실패하지도
    않는다.
  - Distill `core`의 결정 하나가 3회차 수치를 인용한다. `history.md`가 그
    인용의 착지점이 되어야 하며, 결정 문장 자체는 이번에 고치지 않는다.

## Out of scope
- 30런(태스크 10 × arm 3) 실행과 비교표 작성 — 스위트와 프로토콜이 선 뒤의
  후속 작업이다.
- 0–100 합성 점수의 루브릭·가중치·측정 40점 구성 변경. `usage`는 기록만 한다.
- `scorecard.py` 수정.
- superpowers 설치와 그 플러그인 설정.
- 외부 SWE-bench 저장소를 복제해 원본 태스크를 그대로 실행하는 경로.
- `.benchmarks/` 를 `.gitignore` 에서 빼는 일.

## One-commit justification
- 세 태스크는 한 문장으로 읽힌다: 옛 기록을 요약만 남기고 걷어내고(001),
  새 스위트를 세우고(002), 그 스위트를 돌릴 프로토콜과 기록 필드를
  붙인다(003). 리뷰어는 "다음 회차를 이 저장소만 보고 돌릴 수 있는가"
  하나만 판단하면 되므로 blueprint 하나가 리뷰 단위로 맞다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 옛 벤치마크 걷어내고 요약 한 장 남기기
* [Tasks 002](tasks/002/tasks.md) - DeepSWE 기반 태스크 10개 정본과 선정 근거
* [Tasks 003](tasks/003/tasks.md) - 3 arm 프로토콜과 usage 기록 필드
* [Context review](context-review.md) - 계획 문서 정합성 판정
