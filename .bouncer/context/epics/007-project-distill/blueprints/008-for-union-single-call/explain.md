---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/007-project-distill/blueprints/008-for-union-single-call/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-27T11:43:08.245+09:00'
bouncer:
  id: EXPLAIN-008
  epic_id: '007'
  blueprint_id: '008'
  status: published
  comprehension:
    - range_from: develop
      range_to: a752e5ff1350070a6dde664e6bf8b7192f95c613
      diff_sha: 60ad681c63f6deff857e0ddc199e7c2ec282d45d20c7779374f8872f8b390da4
      quiz_score: '2/2'
      disposition: 반복 --for의 합집합과 중복 제거 계약을 이해함
      recorded_at: '2026-08-27T11:46:50+09:00'
---
# Explain

## Background
재접지 지시가 확정 경로마다 `bouncer distill --for`를 따로 실행하게 해 `always` 샤드와 공통 `pulls` 본문을 같은 회차에 여러 번 주입했다. CLI는 반복 `--for` 플래그를 받아 선택 결과를 합집합으로 만들고 중복 샤드를 한 번만 렌더링한다. 이 blueprint는 그 동작을 테스트로 고정한 뒤, 네 workflow 문서와 core Distill 결정을 한 번의 호출 방식으로 맞췄다.

## Intuition
여러 장의 규칙 묶음을 따로 배달하지 않고, 필요한 묶음의 합집합을 한 상자에 담아 한 번만 전달하는 변경이다.

## Code
- `test/cli-project-commands.test.js`는 반복 `--for`의 ids 순서, 공통 shard 중복 제거, 잘못된 bare path 거부를 고정한다.
- `CLAUDE.md`, `skills/bouncer-plan/SKILL.md`, `skills/bouncer-execute/SKILL.md`, `skills/bouncer-run/SKILL.md`는 재접지 호출을 한 번으로 지시한다.
- `.bouncer/distill/core.md`는 런타임 결정에 같은 호출 형태를 남기고, `test/master-rules.test.js`는 다섯 문서에서 경로별 반복 문구가 돌아오지 않게 막는다.

## Quiz
1. 여러 확정 경로를 재접지할 때 올바른 CLI 형태는 무엇인가?
   - A) `bouncer distill --for a b --repo "${PROJECT_ROOT}"`
   - B) `bouncer distill --for a --for b --repo "${PROJECT_ROOT}"`
   - C) 경로마다 `bouncer distill --for <path>`를 따로 실행함

2. 반복 `--for` 테스트가 공통 shard를 확인하는 이유는 무엇인가?
   - A) 모든 shard를 `--all`처럼 강제로 선택하려고
   - B) 경로 입력 순서를 정렬하려고
   - C) 두 경로가 같은 shard로 라우팅되어도 본문과 ids가 중복되지 않음을 보이려고

## 이해 상태
정답은 1-B, 2-C이며 응답도 1-B, 2-C였다. 반복 `--for`는 여러 경로의 선택 결과를 한 번에 합치고, 같은 shard가 겹쳐도 ids와 본문을 중복하지 않는다. 점수는 2/2로 기록했다.
