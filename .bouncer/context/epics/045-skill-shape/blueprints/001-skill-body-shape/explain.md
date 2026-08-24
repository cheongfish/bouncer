---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/045-skill-shape/blueprints/001-skill-body-shape/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-24T11:51:54.984+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '045'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: develop
      range_to: 0bef82a3e46b699a59be2d087a47d07c87c9af25
      diff_sha: 2975776ae1339a6c393a94f2152f14345548a05805c0ffa1ee46741b0b078d5e
      quiz_score: '5/5'
      disposition: 세 계열 골격 위치·CLAUDE 비링크·Steps 면제·implementer Hard guards·ARCHITECTURE 표 밖 링크를 모두 맞춤
      recorded_at: '2026-08-24T11:57:28+09:00'
---
# Explain

## Background
스킬·에이전트 본문 H2가 계열마다 제각각이었다. 같은 역할이 `Flow`·`Stages`·`Steps`로
갈라지고, 산출을 보고하는 절은 소수에만 있었으며, `bouncer-run`만 한국어 H2를 썼다.
강제 수단은 개별 계약 테스트의 토큰뿐이라 “골격”이라는 문서가 없었다.

이 브랜치는 `rules/skill-shape.md`에 세 계열(워크플로 6 · 서브스킬 12 · 에이전트 4)의
필수 절과 순서를 적고, 22개 문서를 그 순서에 맞춘 뒤 surface/agents 테스트가 골격을
걷도록 했다. `CLAUDE.md`에는 링크하지 않았다 — 저술 규칙은 세션 하드룰이 아니라
플러그인 스킬 저자에게 걸린다. 발견 경로는 `docs/ARCHITECTURE.md` §4 표 밖 산문
한 줄이다.

## Intuition
도서관 서가 라벨을 먼저 붙인 뒤, 이미 꽂혀 있던 책을 그 라벨 순서로만 다시 꽂는다.
책 내용(절차·루브릭 문장)은 옮기지 않는다.

## Code
- `rules/skill-shape.md` — 세 계열 골격 SSOT (`assets/` vs `references/`, Steps 면제
  `minimality`·`stop-slop` 포함)
- `docs/ARCHITECTURE.md` — §4 **표 밖** 산문의 `rules/skill-shape.md` 링크 한 줄
- `skills/bouncer-*/SKILL.md` (6) — 번호 절차 뒤 마지막 H2가
  `## ACQ (AskUserQuestion) gates`; `bouncer-run` Role H2 영어화
- `skills/{discovery,spec-authoring,implementation,verification,review,minimality,debugging,stop-slop,graphify-runner,explain-diff,migrate-ids,context-review}/SKILL.md`
  — `When this applies` → `Steps`(면제 2) → … → `Guardrails` → `Return`
- `agents/bouncer-{implementer,reviewer,debugger,context-reviewer}.md` —
  `Authority` → `Hard guards` → … → `Output contract` 마지막 (implementer 재배치가
  핵심)
- `test/skill-bouncer-surface.test.js`, `test/skill-discovery.test.js`,
  `test/agents.test.js` — 계열별 골격 단정

## Quiz
1. 워크플로 스킬 여섯 개에서 `## ACQ (AskUserQuestion) gates`는 어디에 있어야 하는가?
   - A) frontmatter 직후, 제목 앞
   - B) 번호 절차 뒤 **마지막** H2
   - C) Plugin root 블록 안

2. `rules/skill-shape.md`를 `CLAUDE.md`에 링크하지 않은 이유는?
   - A) 파일이 영어라 하드룰에 못 넣는다
   - B) 세션 런타임 에이전트에게 걸리는 하드룰이 아니라 스킬 저술 규칙이라서
   - C) ARCHITECTURE 표에 이미 행이 있어서

3. 서브스킬 중 `## Steps` 면제인 둘은?
   - A) `minimality`, `stop-slop`
   - B) `discovery`, `review`
   - C) `graphify-runner`, `explain-diff`

4. `agents/bouncer-implementer.md`에 `## Hard guards (read-only)`를 붙이면 안 되는
   이유는?
   - A) Output contract 필드 이름이 바뀐다
   - B) 파일을 쓰는 에이전트인데 읽기 전용으로 읽히기 때문
   - C) test/agents.test.js가 Authority 헤딩을 금지하기 때문

5. ARCHITECTURE §4에서 이 브랜치가 연 것은?
   - A) 표에 skill-shape 행 추가
   - B) 표 **밖** 산문 링크 한 줄
   - C) APPROVED_GENERIC_SKILLS 배열 갱신

## 이해 상태
- quiz_score: 5/5
- 응답: 1B 2B 3A 4B 5B (전부 정답)
- 정답: 1B (ACQ는 번호 절차 뒤 마지막 H2) · 2B (CLAUDE 비링크 — 세션 하드룰이 아님) ·
  3A (Steps 면제 minimality·stop-slop) · 4B (implementer는 쓰기 에이전트) ·
  5B (표 밖 산문 링크만)
- disposition: 세 계열 골격 위치·CLAUDE 비링크·Steps 면제·implementer Hard guards·ARCHITECTURE 표 밖 링크를 모두 맞춤
- range: develop..0bef82a3e46b699a59be2d087a47d07c87c9af25
- diff_sha: 2975776ae1339a6c393a94f2152f14345548a05805c0ffa1ee46741b0b078d5e
