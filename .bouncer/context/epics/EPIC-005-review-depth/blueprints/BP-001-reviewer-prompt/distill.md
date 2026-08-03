---
type: bouncer.distill
title: BP-001 distill
description: Distill for BP-001
resource: .bouncer/context/epics/EPIC-005-review-depth/blueprints/BP-001-reviewer-prompt/distill.md
tags:
  - bouncer
  - distill
timestamp: '2026-08-03T00:37:28.416Z'
bouncer:
  id: DISTILL-BP-001
  epic_id: EPIC-005
  blueprint_id: BP-001
  status: published
---
# Distill

BP-001에서 배운 것. review Findings 계약에 Spec/Quality 루브릭과 sibling
`reviewer-prompt.md`를 두고, execute가 fresh generic 서브에이전트 Findings를
컨트롤러가 `review.md`에 기록하도록 연결한 커밋이다.

## 구현에서

- 루브릭과 dispatch prompt는 한 쌍이다. prompt만 있으면 execute가 안 부르고,
  execute만 바꾸면 페르소나·severity 매핑이 없다. 스킬 표면 세 곳
  (`review/SKILL.md`, `review/reviewer-prompt.md`, `bouncer-execute` step 5)을
  같은 커밋에 묶는 게 맞다.
- Calibration에서 Do-not-touch breach와 Spec Extra(scope creep)를 한 줄로
  묶으면 severity가 충돌한다. Extra는 범주이고, Do-not-touch는 항상 `blocker`,
  Do-not-touch 없는 Extra는 `major`로 명시해야 한다(R1).
- 서브에이전트는 Findings만 내고 status를 건드리지 않는다. `review → accepted`는
  컨트롤러 전용이다. 서브에이전트 도구가 없는 하네스는 동일 prompt 인라인
  읽기 전용 폴백 한 줄이면 충분하다 — named `agents/`는 필요 없다.
- 계약 테스트가 `superpowers`/`profile` 문자열 금지를 고정한다. 역사 문서
  (`docs/superpowers/`)를 런타임 표면에 옮기지 말 것.

## 사이클에서 관찰한 것

- Plan 산출 EPIC 문서는 develop에 아직 없으면 worktree에 복사해야 execute
  게이트가 blueprint 경로를 읽는다. finalize가 blueprint dir를 allowed-set에
  넣으므로 그 문서들은 나머지 커밋으로 들어간다.
- Fresh generic 서브에이전트 리뷰가 Calibration 불일치를 실제로 잡았다.
  같은 세션 인라인만 쓰면 구현자가 쓴 매핑을 그대로 통과시키기 쉽다.

## 다음

- scoped re-review 전용 두 번째 prompt·N회 fix 루프 오케스트레이션은 Out of
  scope로 남겼다. Findings 계약이 안정된 뒤 별도 blueprint로 쪼갠다.
- `minimality`는 advisory로 유지; review 본문에 의존성/추상화 여부를 한 줄
  Findings로 남기면 충분했다.
