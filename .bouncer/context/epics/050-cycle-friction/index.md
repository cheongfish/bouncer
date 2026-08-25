---
type: bouncer.epic
title: 050 사이클 마찰 제거
description: finalize 포인터 인계, Distill 읽기 범위, 플러그인 간 비교 근거
resource: .bouncer/context/epics/050-cycle-friction/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-25T11:09:18.744+09:00'
bouncer:
  id: '050'
  epic_id: '050'
  status: approved
---
# 050 사이클 마찰 제거

## Intent
- 문제: 한 사이클을 끝냈을 때 같은 epic에 남은 blueprint가 아직 계획 단계면
  finalize가 아무 말도 하지 않아 사용자가 직접 기억해야 한다. 한편 Distill은
  필요 없는 구간에서도 통째로 읽혀 비용이 붙는데, 그 비용이 다른 플러그인 대비
  값을 하는지 확인할 측정치가 없다.
- 목표: 인계는 finalize가 먼저 말하고, Distill은 필요한 구간만 읽고, 그 둘의
  효과를 같은 메트릭으로 다른 플러그인과 비교한 수치가 저장소에 남는다.

## Success criteria
1. finalize 대상과 같은 epic에 `closed`가 아닌 blueprint가 남아 있으면 finalize가
   그 목록과 각 상태를 보여주고, 포인터를 옮길지 ACQ로 묻는다.
2. 그 잔여 blueprint가 `approved` + 열린 task를 가진 경우에만 `bouncer current --set`을
   제안하고, `draft`인 경우에는 `--set`을 시도하지 않고 `/bouncer-plan`으로 안내한다.
3. 같은 epic에 `closed` 아닌 잔여 blueprint가 없으면 잔여 목록 보고가 뜨지 않는다.
   다른 epic 후보만 있을 때의 기존 인계 확인 동작은 그대로다.
4. Distill을 읽는 모든 구간이 한 문서에 목록으로 남고, 구간마다 유지 또는 축소
   판단과 그 근거가 함께 적힌다.
5. 축소하기로 한 구간의 스킬 지침이 실제로 바뀌고, 축소 후에도 execute가 받는
   Invariant·Gotcha·Decision이 `affected_paths` 기준으로는 줄지 않는다.
6. DeepSWE 기반 태스크 10개의 정본 명세가 `docs/benchmark/tasks/`에 남고,
   vanilla·superpowers·bouncer 세 arm의 통제 조건과 실행 절차가
   `docs/benchmark/protocol.md`에 적힌다. 런 기록은 토큰·툴콜·벽시계를 채점하지
   않는 `usage` 블록으로 싣고, 0–100 합성 점수 계산은 그대로다.

## Out of scope
- 기존 `--for` / `--all` / `--route` / `--audit`의 출력 스키마와 라우팅 규칙 변경 — CLI에 더하는 것은 프리플라이트 선택 모드 하나이고, 나머지는 읽는 쪽 지침만 손댄다.
- 새 게이트 번호 신설과 기존 G/S 코드의 판정 변경.
- `agentic-code-benchmark` 채점 루브릭과 0–100 합성 점수의 가중치 변경 — 런 기록에 채점하지 않는 `usage` 블록을 더하는 것까지만 허용한다.
- 포인터 자동 전진 — 인계는 언제나 확인 후 `bouncer current --set`이다.
- 034·012·036이 만든 계약(측정 프로토콜, `nextBlueprint` 정렬, 샤드 라우팅) 자체의 재설계.

## Blueprints
* [001 finalize 포인터 인계 범위](blueprints/001-finalize-pointer-scope/index.md) - finalize 인계 후보에 같은 epic의 `closed` 아닌 blueprint를 더한다 — `scripts/src/lib/current.ts`, `finalize.ts`, `skills/bouncer-finalize`
* [002 Distill 읽기 범위](blueprints/002-distill-read-scope/index.md) - Distill을 읽는 구간을 전수 조사해 불필요한 읽기를 걷어낸다 — `skills/bouncer-*`, `skills/discovery`, `docs/`
* [003 플러그인 arm 벤치마크](blueprints/003-plugin-arm-benchmark/index.md) - DeepSWE 태스크 10개로 vanilla·superpowers·bouncer 3 arm을 측정한다 — `.benchmarks/`
