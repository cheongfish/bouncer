---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/018-task-unit-commits/blueprints/014-scale-light-convention/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-11T11:02:15.573+09:00'
bouncer:
  id: EXPLAIN-014
  epic_id: '018'
  blueprint_id: '014'
  status: published
  comprehension:
    - task: '001'
      range_from: develop
      range_to: d811a2d0de072134b2163f23a552817d64ac7378
      diff_sha: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
      quiz_score: '2/2'
      disposition: 두 문항 모두 정답. 경량 경로는 사용자 선언과 maintenance epic 재사용이 핵심임을 확인함.
      recorded_at: '2026-08-11T11:03:52+09:00'
    - task: '002'
      range_from: d811a2d0de072134b2163f23a552817d64ac7378
      range_to: 1bb9ad253a80a16735578ad1eefe1b62eab2e8cb
      diff_sha: d4944aba56991719b6123231bfbd623489aeebc9be0598660ea12afb1cfbf371
      quiz_score: '0/1'
      disposition: 오답. 경량 경로에서도 debugger는 named 디스패치를 유지하고 implementer·reviewer만 인라인임.
      recorded_at: '2026-08-11T11:15:02+09:00'
---
# Explain

## Background
작은 수정도 epic을 새로 만들고, execute에서 서브에이전트를 돌리고,
explain-diff 퀴즈를 diff 규모로 키우는 고정비를 그대로 치렀다. 사용자가
경량으로 가겠다고 말해도 그 말이 plan 이후 단계에 남을 자리가 없어,
다음 스킬이 다시 일반 경로로 돌아갔다.

TASKS-001은 선언 자리를 blueprint `index.md`의 `bouncer.scale: light`로
정하고, `/bouncer-plan`이 묻고 쓰게 하며, `docs/workflow.md`에 줄이는 셋과
줄이지 않는 것을 남긴다. TASKS-002는 그 선언을 읽는 쪽을 만든다 —
`/bouncer-execute`는 implementer·reviewer를 인라인으로 돌리고,
`explain-diff`는 질문을 1문항으로 고정한다. `scripts/`는 읽지 않는다.

## Intuition
경량 여부는 plan이 사용자에게 물은 뒤 frontmatter 한 줄에 꽂고, execute와
explain-diff가 그 줄을 읽는다. verify 실패용 debugger는 줄이지 않는다.

## Code
- `skills/bouncer-plan/SKILL.md` — 경량 여부를 묻고 slug `maintenance` epic을
  재사용한다. 선언을 받으면 `bouncer.scale: light`를 쓰고, 없으면 키를 넣지
  않는다.
- `docs/workflow.md` — `## 경량 경로`. epic 신설·서브에이전트 왕복·퀴즈
  규모는 줄이고, 문서 수와 게이트는 그대로 둔다. 이탈은 `scale` 줄을 지운다.
- `skills/bouncer-execute/SKILL.md` — `scale: light`면 3·5단계에서 named
  디스패치 네 단계를 건너뛰고 `implementation` / `review`를 인라인으로
  실행한다. 4단계 `bouncer-debugger`와 호스트 fallback 문구는 그대로 둔다.
- `skills/explain-diff/SKILL.md` — `scale: light`면 질문 수 1 고정.
- `test/skill-bouncer-plan.test.js`, `test/skill-bouncer-execute.test.js`,
  `test/skill-explain-diff.test.js` — 위 산문 계약을 고정한다.

## Quiz
1. `bouncer.scale: light`일 때 `/bouncer-execute`가 줄이는 것과 줄이지 않는 것은?
   - A) implementer·reviewer는 인라인으로 돌리고, `bouncer-debugger`는 named
     디스패치를 유지한다
   - B) implementer·reviewer·debugger를 모두 인라인으로 돌린다
   - C) debugger만 인라인으로 돌리고, implementer·reviewer는 named 디스패치를
     유지한다

## 이해 상태
- task 001: 정답 1-B·2-C / 응답 1-B·2-C / 2/2. disposition: 경량 경로는
  사용자 선언과 maintenance epic 재사용이 핵심임을 확인함.
- task 002: 정답 1-A / 응답 1-B / 0/1. disposition: 오답. 경량 경로에서도
  debugger는 named 디스패치를 유지하고 implementer·reviewer만 인라인임.
