---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/024-light-path/blueprints/001-scale-light-convention/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-11T11:02:15.573+09:00'
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
      quiz_score: '2/2'
      disposition: 두 문항 모두 정답. 경량 경로는 사용자 선언과 maintenance epic 재사용이 핵심임을 확인함.
      recorded_at: '2026-08-11T11:03:52+09:00'
---
# Explain

## Background
작은 수정도 epic을 새로 만들고, execute에서 서브에이전트를 돌리고,
explain-diff 퀴즈를 diff 규모로 키우는 고정비를 그대로 치렀다. 사용자가
경량으로 가겠다고 말해도 그 말이 plan 이후 단계에 남을 자리가 없어,
다음 스킬이 다시 일반 경로로 돌아갔다. 이 커밋은 선언 자리를
blueprint `index.md`의 `bouncer.scale: light`로 정하고, `/bouncer-plan`이
묻고 쓰게 하며, `docs/workflow.md`에 줄이는 셋과 줄이지 않는 것을 남긴다.
`scripts/`는 아직 읽지 않는다.

## Intuition
경량 여부는 plan이 추측하지 않고 사용자에게 물은 뒤, blueprint frontmatter
한 줄에 꽂아 둔다.

## Code
- `skills/bouncer-plan/SKILL.md` — 2단계 ID 할당에서 경량 여부를 묻고
  slug `maintenance` epic을 재사용한다. 4단계 Author에서 `bouncer.scale: light`
  를 쓰거나, 선언이 없으면 키를 넣지 않는다.
- `docs/workflow.md` — `## 경량 경로`. epic 신설·서브에이전트 왕복·퀴즈
  규모는 줄이고, 문서 수와 게이트는 그대로 둔다. 이탈은 `scale` 줄을 지운다.
- `test/skill-bouncer-plan.test.js` — `bouncer.scale` / `maintenance` /
  질문·자동 판정 금지를 산문 계약으로 고정한다.

## Quiz
1. `/bouncer-plan`이 경량 경로를 쓸지 어떻게 정하나?
   - A) diff가 작으면 자동으로 `bouncer.scale: light`를 쓴다
   - B) 사용자에게 묻고, 선언을 받으면 쓴다
   - C) execute 게이트가 통과하면 소급해서 쓴다

2. 경량 선언을 받은 뒤 epic id는 어떻게 잡나?
   - A) 새 epic을 항상 만들고 slug만 `maintenance`로 붙인다
   - B) 기존 `024-maintenance` 번호를 산문에 고정해 재사용한다
   - C) slug `maintenance` epic이 있으면 그 아래 blueprint id만 할당하고,
     없을 때만 비어 있는 `\d{3}`으로 한 번 만든다

## 이해 상태
- 정답: 1-B, 2-C
- 응답: 1-B, 2-C
- 채점: 2/2 (둘 다 맞음)
- disposition: 두 문항 모두 정답. 경량 경로는 사용자 선언과 maintenance epic 재사용이 핵심임을 확인함.
- task 001 comprehension 기록: range_from=develop → range_to=d811a2d0…, quiz_score=2/2
