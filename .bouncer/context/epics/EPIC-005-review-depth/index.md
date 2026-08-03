---
type: bouncer.epic
title: EPIC-005 review-depth
description: Epic EPIC-005
resource: .bouncer/context/epics/EPIC-005-review-depth/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-03T00:37:28.390Z'
bouncer:
  id: EPIC-005
  epic_id: EPIC-005
  status: approved
---
# EPIC-005 review-depth

## Intent
- 문제: `review` 스킬은 Findings 산출물 계약만 있어, execute 시 구현 세션이 자기
  diff를 얕게 보고 `review → accepted`를 찍기 쉽다. 실질 리뷰 루브릭과 fresh-eyes
  분리 절차가 없다.
- 목표: review 스킬에 Spec/Quality 루브릭과 sibling reviewer prompt를 두고,
  execute가 generic 서브에이전트로 Findings를 받은 뒤 컨트롤러가 `review.md`에
  기록하도록 한다. self-contained — 외부 플러그인 하드 의존 없음.

## Out of scope
- `agents/` named agent 도입 또는 하네스별 전용 리뷰어 타입 등록.
- 외부 플러그인 스킬 참조·어댑터·`superpowers` 문자열을 런타임 표면에 남기기.
- 풀 SDD 리뷰 루프(태스크별 리뷰 ×N, re-review ×5, 브랜치 최종 리뷰 오케스트레이션).
- 게이트 판정 로직(`scripts/lib/validate.js`)과 review frontmatter 스키마 변경.
- `receiving-code-review`를 별도 스킬로 분리.

## Blueprints
<!-- OKF §6 인덱스 형식. 새 blueprint를 만드는 기준은 하나 — 한 커밋으로
     리뷰 가능한 단위인가. 더 크면 blueprint를 쪼갠다. 하위 태스크 계층은
     만들지 않는다 (.bouncer/governance.md). -->
* [BP-001 reviewer-prompt](blueprints/BP-001-reviewer-prompt/index.md) - review 루브릭·reviewer-prompt·execute dispatch 계약을 한 커밋으로 넣는다
