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
      quiz_score: '2/2'
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
