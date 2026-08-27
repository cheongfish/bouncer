---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/054-skill-context-optimization/blueprints/001-baseline-measurement/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-27T09:06:01.115+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '054'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: develop
      range_to: 181e96d97663219dde40c3be527b59ebe6833ea4
      diff_sha: '072484b61380c5300176117f6008bd7b4647c60be1050b732ceae3fac8bb6257'
      quiz_score: '3/3'
      disposition: 측정 계약과 정적 baseline 범위, superpowers 스캔, 측정 커밋을 질문으로 확인했고 전부 맞힘
      recorded_at: '2026-08-27T09:07:21+09:00'
---
# Explain

## Background
epic 054는 스킬 지시문 비용을 줄이려 한다. 계획 문서에 적은 최악값(plan 11,007단어 같은)은 보조 문서를 전부 읽었다는 가정이고, 실제로 그 사이클이 얼마나 읽는지 재지 않았다. `docs/benchmark/protocol.md`는 arm별 코드 품질 비교용이라 Bouncer 지시문 비용의 시나리오와 기록 칸이 없었다.

이 단위는 재구조화 전에 측정 계약을 고정한다. 회귀 시나리오 7종, 정적 지표 5종과 붙여넣기 명령, 런당 기록 키를 `docs/benchmark/context-cost.md`에 두고, 같은 명령으로 뽑은 변경 전 정적 수치를 Baseline 표에 남긴다. 사람이 돌린 7런의 실행 지표는 입력이 없어서 실행 표는 헤더만 두고 006이 채운다.

## Intuition
자를 먼저 만들고, 그 자로 지금 길이를 적어 둔다.

## Code
- `docs/benchmark/context-cost.md` — 시나리오 7행, 정적 명령 5개, 런당 `usage` 키, 정적 Baseline 수치, 실행 표 헤더
- `docs/benchmark/protocol.md` — 지시문 비용 측정이 `context-cost.md`에 있다는 한 줄
- `test/benchmark-context-cost.test.js` — 네 절·백틱 시나리오 id 7개, 정적 표에 데이터 행이 있음을 단정
- 정적 수치는 실행 워크트리 HEAD `1c73980`에서 문서에 적힌 명령을 그대로 돌린 값이다. `superpowers` 리터럴은 `test/public-name-regression.test.js`가 `git ls-files`로 스캔하므로 새 문서에 적지 않는다.

## Quiz
1. 이 blueprint가 저장소에 남기는 측정 산출물은?
   - A) 7런 실행 지표(`tokens_in` 등)까지 채운 Baseline 표
   - B) `history.md`에 더한 1–3회차 행
   - C) 시나리오·정적 명령·런당 키 계약과, 정적 지표만 채운 Baseline 표(실행 표는 헤더)

2. `context-cost.md`에 `superpowers`를 쓰지 않는 이유는?
   - A) `test/public-name-regression.test.js`가 `git ls-files`로 그 리터럴을 스캔하고, 추적되는 순간 테스트가 깨지기 때문
   - B) vanilla·bouncer arm 이름이 같은 스캔 대상이라서
   - C) `collect_metrics.py`가 그 문자열을 usage 키로 쓰기 때문

3. 정적 Baseline의 측정 대상 커밋은?
   - A) `develop`의 최신 커밋을 따로 checkout한 시점
   - B) task 001이 올라간 실행 워크트리 HEAD (`git rev-parse --short HEAD`)
   - C) task 002 커밋 이후의 HEAD

## 이해 상태
퀴즈 3/3. 응답 C A B.
정답: (1) C 계약과 정적 Baseline(실행 표는 헤더) (2) A git ls-files 스캔으로 추적 직후 깨짐 (3) B task 001이 올라간 워크트리 HEAD.
disposition: 측정 계약과 정적 baseline 범위, superpowers 스캔, 측정 커밋을 질문으로 확인했고 전부 맞힘.
