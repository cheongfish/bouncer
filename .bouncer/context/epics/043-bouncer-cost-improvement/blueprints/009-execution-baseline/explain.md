---
type: bouncer.explain
title: 006 explain
description: Explain for 006
resource: .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/009-execution-baseline/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-28T10:07:38.931+09:00'
bouncer:
  id: EXPLAIN-009
  epic_id: '043'
  blueprint_id: '009'
  status: published
  comprehension:
    - range_from: develop
      range_to: a16d53edc333fdd74a75110f8e376cfbb69f78e2
      diff_sha: 437e04e84c9b1344876f9b588b781dd60b2694673377079dafd77ba30d917ad8
      quiz_score: 2/2
      disposition: 두 문항 모두 정답. 실행 입력과 차단 결과의 기록 목적을 이해함.
      recorded_at: '2026-08-28T10:09:44+09:00'
---
# Explain

## Background
정적 계약만 남긴 이전 회차로는 실제 Bouncer 주행 비용을 비교할 수 없었다. 같은 base·모델·프롬프트·fixture로 실행한 7개 런의 산출물에서 비용과 gate 결과를 전사해, 이후 회차가 같은 입력을 재현할 기준을 남겼다. finalize는 사용자 퀴즈가 필수라서 `s5`·`s6`의 무응답 차단도 성공으로 바꾸지 않고 `blocked`로 기록한다.

## Intuition
실행 baseline은 실험 노트의 원본 영수증과 요약 장부를 나란히 두는 작업이다.

## Code
- `docs/benchmark/context-cost.md`는 7개 고정 입력과 시나리오별 실행 baseline의 정본이다.
- `docs/benchmark/history.md`는 다른 회차 표와 섞지 않는 동일 열의 전사본을 둔다.
- `test/benchmark-context-cost.test.js`는 고정 프롬프트·fixture·7행·측정일·산출물 경로가 빠지지 않았는지 확인한다.

## Quiz
1. `s5-finalize-distill`과 `s6-finalize-bare`의 `blocked` 결과를 baseline 표에 남기는 이유는 무엇인가?
   - A. 두 런을 성공한 finalize 횟수로 합산하기 위해
   - B. 필수 퀴즈 무응답으로 인한 실제 차단 상태를 보존하기 위해
   - C. metrics의 빈 usage 값을 0으로 채우기 위해

2. 이 회차의 두 baseline 표가 기존 1–3회차 표에 행을 추가하지 않는 이유는 무엇인가?
   - A. 실행 조건과 열 구성이 달라 별도 절에서 비교 기준을 보존하기 위해
   - B. history 문서에는 표를 하나만 둘 수 있어서
   - C. `.benchmarks` 산출물을 git에 커밋해야 해서

## 이해 상태
정답: 1-B, 2-A. 응답: 1-B, 2-A. 결과: 2/2. 고정 입력을 보존하고 finalize 차단을 성공으로 환산하지 않는 기준을 확인함.

## Tasks

### Task 001

#### Goal & intent

`1c73980`에서 같은 프롬프트·fixture·완료 조건으로 실행한 일곱 시나리오의 비용과 품질이 측정 계약과 회차 이력에 남는다. `s5`·`s6`의 무응답 퀴즈 차단은 실행 실패로 전사하며 성공 수치로 바꾸지 않는다. `npm run ci` 통과로 표 구조와 기존 회차 보존을 확인한다.

#### Interface

- 제공:
  - `docs/benchmark/context-cost.md`에 시나리오별 시작 fixture, 실행 프롬프트, 완료 조건과 baseline 실행 표 7행을 제공한다. 차단 런은 gate 결과를 `blocked`로 명시한다.
  - `docs/benchmark/history.md`에 같은 열을 쓰는 지시문 비용 baseline 7행을 새 절로 제공한다.
  - `test/benchmark-context-cost.test.js`가 고정 입력 7개와 두 baseline 표의 완결성을 단정한다.
- 거부:
  - base, 프롬프트, fixture, 완료 조건 중 하나라도 다른 런은 baseline 입력으로 받지 않는다.
  - 산출물이 없거나 출처에서 확인되지 않는 값을 추정하지 않는다. 미측정 `usage` 값은 빈칸으로 둔다.

#### Touch

- Modify `docs/benchmark/context-cost.md` — 고정 런 입력과 실행 baseline 7행을 측정 정본에 기록한다.
- Modify `docs/benchmark/history.md` — 다른 회차와 열을 섞지 않는 지시문 비용 baseline 절을 추가한다.
- Modify `test/benchmark-context-cost.test.js` — 고정 입력과 두 표의 7개 scenario id·열·출처를 구조적으로 단정한다.

#### Constraints

- Minimality: 기존 측정 문서 두 개와 계약 테스트 하나로 닫고 새 스크립트·fixture 파일·dependency를 만들지 않는다.
- baseline과 최종 회차는 `1c73980`에서 만든 독립 clone, 모델 `gpt-5.6-terra`, reasoning effort `medium`, 사람 개입 0회, 동일한 시나리오별 실행 프롬프트를 쓴다. 이 조건에서 finalize의 필수 퀴즈는 무응답 차단 결과로만 기록한다.
- 시작 fixture 준비 비용은 런의 `usage`와 품질 값에서 제외한다.
- `tokens_in`, `tokens_out`, `wall_s`, `tool_calls`는 metrics의 `usage`에 존재하는 키만 옮긴다.
- gate 통과율은 실행한 게이트 수와 통과 수, review finding 수는 해당 런 review의 Findings, scope 위반 수는 commit-safety·scope 실패에서 센다.
- 1–3회차와 DeepSWE 표는 열 구성이 다르므로 행을 추가하거나 수치를 고치지 않는다.
