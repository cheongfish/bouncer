---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/024-lightweight-cycle/blueprints/001-lightweight-cycle-guidance/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-10T17:16:46.640+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '024'
  blueprint_id: '001'
  status: published
  comprehension:
    - task: '001'
      range_from: develop
      range_to: d811a2d0de072134b2163f23a552817d64ac7378
      diff_sha: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
      quiz_score: '1/2'
      disposition: 발동 조건을 자동 임계값으로 읽었으나, 문서·게이트 불변은 맞게 짚음
      recorded_at: '2026-08-10T17:18:18+09:00'
---
# Explain

## Background

좁은 수정에도 새 epic을 열고 네임드 에이전트를 왕복하는 기본 경로가 길어서,
일부 작업이 Bouncer 루프 밖으로 새 나갔다. 게이트와 문서 종류는 그대로 두고,
사용자가 경량을 선언했을 때만 epic 신설·에이전트 왕복·퀴즈 문항 수를 줄이도록
`docs/governance.md`에 정의를 두고 plan·execute·explain-diff가 그걸 읽게 했다.

## Intuition

스위치 하나: 사용자가 「경량」이라고 말하면 준비 비용만 줄고, 통과해야 할
게이트 목록은 그대로다.

## Code

- `docs/governance.md` — `## Lightweight cycle` (발동·축소 셋·불변·인라인 리뷰 한계)
- `skills/bouncer-plan/SKILL.md` step 2 — 공용 maintenance epic 아래로 blueprint만 할당
- `skills/bouncer-execute/SKILL.md` step 3·5 — 인라인 허용에 경량 선언 OR 추가
- `skills/explain-diff/SKILL.md` step 3 — 경량이면 퀴즈 1문항
- `test/lightweight-cycle.test.js` — 위 네 파일 문자열 계약

## Quiz

1. 경량 사이클이 켜지는 조건은?
   - A) diff 줄 수가 임계값 이하일 때 자동
   - B) 사용자가 이번 세션에서 좁은 범위라고 선언했을 때
   - C) `bouncer.lightweight: true` 프론트매터가 있을 때

2. 경량 선언 시 그대로인 것은?
   - A) 새 epic을 반드시 만드는 규칙
   - B) 네임드 implementer/reviewer 왕복
   - C) task·verification·review·explain 문서와 G1–G16 판정

## 이해 상태

- 정답: 1-B, 2-C
- 응답: 1-A, 2-C
- 채점: 1번 틀림, 2번 맞음 → `1/2`
- disposition: 발동 조건을 자동 임계값으로 읽었으나, 문서·게이트 불변은 맞게 짚음
