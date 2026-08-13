---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/034-agentic-benchmark/blueprints/001-benchmark-skill/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-13T13:50:18.755+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '034'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: develop
      range_to: ce047149659a7d8a87cd7b27adee2cd4d057ea31
      diff_sha: dd6eec4f1bc2ec49a31ee76bdc6ff1ea0e20abb13039035de4f45b08eae17e7b
      quiz_score: '3/3'
      disposition: 전부 정답 — 게이트 비관여·NOTICE·DISTINCTION_RE 위치 구분
      recorded_at: '2026-08-13T13:57:40+09:00'
---
# Explain

## Background

게이트는 계약 준수만 pass/fail로 답한다. 모델·프롬프트·워크플로를 바꿨을 때
산출 코드가 나아졌는지는 그 축으로 비교할 수 없다. 이 변경은
`ComposioHQ/awesome-claude-skills`의 `agentic-code-benchmark`(Apache-2.0)를
재설계하지 않고 `skills/agentic-code-benchmark/`에 반입한다. 루브릭·측정·채점
스크립트는 그대로 두고 `SKILL.md`만 Bouncer 맥락으로 각색한다. 점수는
`verification.md` / `review.md` / 게이트에 들어가지 않는다. 워크플로 스킬
표(§4)에도 행을 넣지 않는다.

## Intuition

채점기는 사이드카다. 게이트 옆에 두고 런끼리만 비교한다.

## Code

- `skills/agentic-code-benchmark/SKILL.md` — 워크플로 밖 도구 선언, 게이트
  비관여, 고정 신뢰 경계 문장, worktree A/B 예시, `NOTICE.md` 참조.
- `skills/agentic-code-benchmark/references/rubric.md` ·
  `scripts/collect_metrics.py` · `scripts/scorecard.py` — 원본 그대로(40 측정 +
  60 판정, 5차원).
- `skills/agentic-code-benchmark/NOTICE.md` — 원 저장소·경로·Apache-2.0·URL
  (LICENSE 전문 없음).
- `test/skill-agentic-code-benchmark.test.js` — 이름·파일 존재·루브릭 제목·
  출처·§4 표 밖 위치 계약.
- `test/trust-boundary.test.js` — 데이터 판독 스킬 목록에 추가(길이 9).
- `docs/ARCHITECTURE.md` — §4 표 아래 문단, §F에 게이트와 별개 축 한 줄.
- `.gitignore` — `.benchmarks/`.

## Quiz

1. 이 스킬의 점수는 어디에 쓰이나?
   - A) execute 게이트 G7 입력
   - B) 런 간 품질 비교만 (게이트·verification·review와 무관)
   - C) `review.md` Findings severity 산출

2. Apache-2.0 고지는 어디에 두었나?
   - A) 스킬 디렉터리 `NOTICE.md` (원 저장소·경로·식별자·URL)
   - B) 저장소 루트 `LICENSE` 전문 사본
   - C) `docs/ARCHITECTURE.md` §4 표의 새 행

3. `SKILL.md` 신뢰 경계 문장이 맞춰야 하는 테스트는?
   - A) `test/public-name-regression.test.js`의 `APPROVED_GENERIC_SKILLS`
   - B) `test/cursor-plugin.test.js`의 `BOUNCER_ROOT` 블록 요구
   - C) `test/trust-boundary.test.js`의 `DISTINCTION_RE` (고정 영어 문형)

## 이해 상태

- 점수: 3/3
- 정답: 1B · 2A · 3C
- 응답: 1B · 2A · 3C
- 채점: 1✓ 2✓ 3✓
- disposition: 전부 정답 — 게이트 비관여·NOTICE·DISTINCTION_RE 위치 구분
- range: develop..ce047149659a7d8a87cd7b27adee2cd4d057ea31
- diff_sha: dd6eec4f1bc2ec49a31ee76bdc6ff1ea0e20abb13039035de4f45b08eae17e7b
