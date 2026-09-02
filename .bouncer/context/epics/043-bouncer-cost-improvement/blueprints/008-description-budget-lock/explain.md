---
type: bouncer.explain
title: 005 explain
description: Explain for 005
resource: .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/008-description-budget-lock/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-28T11:00:00.711+09:00'
bouncer:
  id: EXPLAIN-008
  epic_id: '043'
  blueprint_id: '008'
  status: published
  comprehension:
    - range_from: develop
      range_to: 2c3589b3c053c2e9806ca6823a0e2bea1cb0dfea
      diff_sha: 078549c2d6016e3baaaa29949e62f60814e1f973d1ef7518c1d555be4a1b72bb
      quiz_score: '2/4'
      disposition: 길이 측정과 품질 방향은 맞혔고, 총합 상한의 사람 결정과 최종 출처 `.final.metrics.json`은 틀렸다.
      recorded_at: '2026-08-28T11:03:10+09:00'
---
# Explain

## Background
스킬 목록 `description`에 같은 상투 문장이 반복되어 합계가 6,090자까지 커졌다. 앞 단계에서 역할 rubric과 조건부 절차를 옮긴 뒤에도, 정본 19개와 3,000자 예산이 테스트 없이 문서에만 있으면 다음 변경이 조용히 되돌릴 수 있다. 이 브랜치는 19개 description을 핵심 트리거가 앞에 오는 100~180자 한 문장으로 줄이고, 개수·길이·총합·역할 rubric 역류를 `test/skill-bouncer-surface.test.js`에 잠근 다음, 006과 같은 일곱 시나리오의 `.final.*` 산출물을 `docs/benchmark/history.md` 지시문 비용 표의 baseline 다음에 붙였다.

## Intuition
목록 문구는 짧게 고치고, 그 한도와 최종 측정값은 사람이 기억하지 않고 테스트와 표가 막는다.

## Code
- `skills/*/SKILL.md` frontmatter `description`만 바꿨다. 길이는 `description:` 접두어를 뺀 YAML 원문 scalar다.
- `test/skill-bouncer-surface.test.js`가 정본 19개, 개별 100~180자, 총합 3,000, 네 역할의 rubric 문구 금지를 단정한다. 상한을 올리려면 사람이 상수를 바꿔야 한다.
- `docs/benchmark/history.md` `## 지시문 비용 회차`는 baseline 7행 다음이 최종 7행이다. 출처는 `.benchmarks/<id>.final.metrics.json`이고, 품질 숫자는 짝 `.final.manifest.json`의 `gates`·`review_findings`·`scope_violations`다.
- `test/benchmark-context-cost.test.js`는 표에서 두 회차를 읽어 열과 품질 방향(통과율 ≥, finding ≤, scope ≤)을 비교한다. 측정값을 코드 상수로 복제하지 않는다.

## Quiz
1. 개별 description 길이와 총합은 무엇으로 재는가?
   - A) `parseFrontmatter(...).data.description.length`
   - B) `description:` 접두어만 제거한 YAML 원문 scalar(인용부호 포함)
   - C) 렌더된 본문 첫 문단의 글자 수

2. 스킬이 하나 늘면 description 총합 상한 3,000은 어떻게 되는가?
   - A) 테스트가 스킬 수에 비례해 상한을 올린다
   - B) CI가 자동으로 예산을 재계산한다
   - C) 고정값이라 올릴지는 사람이 계약을 보고 정한다

3. 지시문 비용 최종 행의 산출물 경로는 무엇인가?
   - A) `.benchmarks/<id>.final.metrics.json`
   - B) `.benchmarks/<id>.recovery.metrics.json`
   - C) s5–s7의 접미사 없는 `.metrics.json`

4. history 표에서 최종 회차 품질이 통과하려면 scenario별로 무엇이 성립해야 하는가?
   - A) tokens_in과 wall_s가 baseline보다 작다
   - B) gate 통과율 ≥, review finding 수 ≤, scope 위반 수 ≤
   - C) 일곱 시나리오 합산 tokens가 줄면 품질 세 값은 무시한다

## 이해 상태
정답: 1B, 2C, 3A, 4B

응답: 1B, 2B, 3B, 4B

결과: 2/4. description 길이의 YAML 원문 scalar 기준과 품질 세 값의 방향은 맞혔다. 총합 3,000은 스킬 수 함수가 아니라 사람이 올리는 고정값이고, 최종 행 출처는 `.recovery.*`가 아니라 `.final.metrics.json`이다.
