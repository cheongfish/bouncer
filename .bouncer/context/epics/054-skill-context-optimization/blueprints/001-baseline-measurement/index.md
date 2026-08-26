---
type: bouncer.blueprint
title: 컨텍스트 비용 baseline 측정 계약과 기록
description: 회귀 시나리오 7종과 정적·실행 지표 수집 절차를 고정하고 변경 전 baseline을 기록한다
resource: .bouncer/context/epics/054-skill-context-optimization/blueprints/001-baseline-measurement/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-26T14:53:09.105+09:00'
bouncer:
  id: '001'
  epic_id: '054'
  blueprint_id: '001'
  status: approved
  commit_type: docs
  scale: full
  supersedes: []
---
# 001 baseline-measurement

Epic: [054](../../index.md)

## Intent
- 문제: epic 054의 잠재 로딩량(plan 11,007단어 등)은 모든 보조 문서를 읽는 최악값이고 실측이 아니다. 실제 격차를 모른 채 스킬 4계열을 재구조화하면 절감폭도 품질 회귀도 판정할 수 없다. `docs/benchmark/protocol.md`는 arm별 코드 품질 비교를 위한 문서라 "Bouncer 자신의 지시문 비용"을 재는 시나리오와 기록 값이 없다.
- 완료 조건: 7개 회귀 시나리오와 정적·실행 지표의 기록 양식이 문서로 고정되고, 정적 지표의 변경 전 수치가 baseline으로 남아 있다. 실행 지표 baseline은 사람이 돌린 7런 산출물이 입력이라 blueprint 006이 따로 맡는다.

## Contract
- 인터페이스: 새 문서 `docs/benchmark/context-cost.md`가 (a) 회귀 시나리오 7종의 id와 실행 조건, (b) 정적 지표 5종과 각 지표를 뽑는 명령 리터럴, (c) 런당 기록 값과 baseline 표 양식을 정의한다. `docs/benchmark/protocol.md`는 이 문서를 「지시문 비용 측정」으로 한 줄 링크한다.
- 데이터·상태: 실행 지표는 `collect_metrics.py`가 이미 쓰는 `usage` 키(`tokens_in`, `tokens_out`, `wall_s`, `tool_calls`)를 그대로 쓴다. 새 스키마 키나 새 수집 스크립트를 만들지 않는다. 정적 지표는 저장소에 이미 있는 도구(`wc`, `awk`, `grep`)로만 뽑는다.
- 수용 기준: 측정 계약이 7개 시나리오·정해진 기록 값으로 고정되고, 정적 baseline 수치가 `docs/benchmark/context-cost.md`의 정적 Baseline 표에 있다. 실행 Baseline 표는 헤더만 있는 상태로 blueprint 006에 넘긴다.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - 실행 baseline은 사람이 돌린 7런의 산출물이 입력이라 이 blueprint의 두 task로 닫히지 않는다. 그래서 blueprint 006으로 분리했다. 이 blueprint는 실행 Baseline 표의 헤더까지만 만들고 값은 비운다.
  - `collect_metrics.py`에 플래그를 주지 않은 값은 `usage` 키를 만들지 않는다. 재지 않은 칸은 0이 아니라 빈칸으로 남긴다.
  - plan 단계 `.bouncer/context` 트리는 clone이 squash되면 사라진다. 시나리오 정의는 `protocol.md`의 「plan 단계 스냅샷」 절차를 그대로 인용하고 다시 쓰지 않는다.
  - `test/public-name-regression.test.js`가 잡는 것은 `superpowers` 리터럴 하나뿐이고(`SUPERPOWERS_RE`), 그 이름을 담은 추적 파일은 `COMPARISON_ARM_ALLOWLIST`가 열거한다. 새 문서는 커밋 전 untracked라 `git ls-files` 스캔에서 빠지므로, 그 리터럴을 적으면 파일이 추적되는 커밋 직후에야 테스트가 깨진다. 새 문서는 그 이름을 쓰지 않고 `protocol.md` 링크로 대신한다. `vanilla`·`bouncer`는 이 스캔과 무관하다.
  - 정적 지표 명령이 `skills/*/SKILL.md` 집합에 의존하므로, 스킬이 추가·삭제되면 baseline과 최종 회차의 모수가 달라진다. 명령과 함께 측정 시점 스킬 수를 기록한다.

## Out of scope
- 루브릭·합성 점수·arm 정의 변경. `skills/agentic-code-benchmark/**`는 만지지 않는다.
- 1~4단계의 실제 구조 변경. 이 blueprint는 재기만 한다.
- 1–3회차와 DeepSWE 표의 기존 수치. 두 표는 열 구성이 이 측정과 달라 행을 더할 자리가 아니다.
- `docs/benchmark/history.md`. 실행 회차 기록은 blueprint 006 소관이다.

## One-commit justification
- task 001은 새 문서 하나와 그 문서를 고정하는 테스트 하나, task 002는 그 문서의 정적 수치 절이다. 계약과 수치는 서로 독립적으로 리뷰 가능한 커밋이고 — 계약이 틀리면 수치를 뽑기 전에 되돌린다 — blueprint 전체가 "정적 측정 계약과 그 첫 수치" 하나의 PR 단위다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 측정 계약 문서와 계약 테스트
* [Verification 001](tasks/001/verification.md) - 검증 명령과 증적
* [Review 001](tasks/001/review.md) - 리뷰 발견사항
* [Tasks 002](tasks/002/tasks.md) - 정적 지표 baseline 기록
* [Verification 002](tasks/002/verification.md) - 검증 명령과 증적
* [Review 002](tasks/002/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
