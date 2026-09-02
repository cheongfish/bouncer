---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/007-project-distill/blueprints/004-promotion-proposal-acq/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-14T17:08:57.200+09:00'
bouncer:
  id: EXPLAIN-004
  epic_id: '007'
  blueprint_id: '004'
  status: published
  comprehension:
    - range_from: develop
      range_to: 44c99e0a873bb694fd0059789551eba44108fc8b
      diff_sha: a2a15f8f916e04c7f2dcee35c5cea14d3bb09f0e0ad5d171c2996e22db2d35e5
      quiz_score: '3/3'
      disposition: '세 문항 모두 정확히 답해 CLI 메타데이터와 승격 동의 경계를 이해했음.'
      recorded_at: '2026-08-14T17:12:00.000+09:00'
---
# Explain

## Background
Distill 샤드의 배치 근거는 CLI 출력만으로 확인할 수 있어야 한다. 그래서 `distill --json`의 `audit`에 등록된 샤드 메타데이터를 추가했다. finalize 단계에서는 후보를 곧바로 Distill에 쓰지 않고, 대상과 동작을 한 목록으로 제시해 한 번의 동의를 받은 뒤에만 반영하도록 절차를 바꿨다.

## Intuition
CLI는 지도, finalize는 변경 제안서, 사용자의 한 번의 동의는 서명이다.

## Code
- `scripts/src/lib/cli-project-commands.ts`와 생성물 `scripts/lib/cli-project-commands.js`: `audit.shards`에 본문 없이 샤드 메타데이터를 투영한다.
- `skills/bouncer-finalize/SKILL.md`: 등록 샤드를 `PROJECT_ROOT` 기준으로 각각 읽어 제안 목록과 단일 동의를 처리한다.
- `skills/spec-authoring/SKILL.md`: finalize가 공급한 샤드별 본문 맵만 사용해 승격 후보를 만든다.
- `CLAUDE.md`와 관련 테스트: Distill 승격은 사용자 동의를 거치며, 합산 route 본문을 개별 샤드 본문으로 취급하지 않는 계약을 고정한다.

## Quiz
1. `audit.shards`가 본문을 포함하지 않는 주된 이유는 무엇인가?
   - A) 샤드 수를 줄이기 위해
   - B) CLI 출력에 본문이 중복되는 것을 막기 위해
   - C) 라우팅을 비활성화하기 위해

2. Distill 승격 후보를 실제로 쓰기 전에 필요한 절차는 무엇인가?
   - A) 후보 전체에 대한 한 번의 승인
   - B) 각 불릿에 대한 별도 승인
   - C) `config.autonomy`가 auto인지 확인

3. finalize가 개별 샤드의 현재 본문을 만들 때 올바른 방법은 무엇인가?
   - A) `--route`의 합산 본문을 대상 샤드에 붙인다
   - B) plugin root에서 상대 경로를 읽는다
   - C) `PROJECT_ROOT` 기준으로 각 등록 샤드 경로를 따로 읽는다

## 이해 상태
정답은 1-B, 2-A, 3-C이며 응답도 모두 일치했다. 결과는 3/3이다. CLI 메타데이터가 본문을 중복하지 않는 이유, 목록 전체에 대한 단일 동의, `PROJECT_ROOT` 기준의 개별 샤드 읽기를 이해했음.
