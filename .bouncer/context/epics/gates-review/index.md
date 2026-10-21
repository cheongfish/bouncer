---
type: bouncer.epic
title: 120 gates-review
description: 'Judgement: gate codes, verification evidence, review dispatch and coding standards'
resource: .bouncer/context/epics/gates-review/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-10-20T16:05:56.695+09:00'
bouncer:
  id: gates-review
  epic_id: gates-review
  status: approved
  supersedes: []
---
# 120 gates-review

## Intent
- 문제: 기능 영역이 같은 작업이 legacy epic 63개에 흩어져 있고, 등록부 도입 뒤 이 저장소에는 새 blueprint를 만들 활성 epic이 없다.
- 목표: 이 epic이 `gates-review` 영역의 새 blueprint를 받는다. 포함: 검증과 리뷰: `bouncer validate` gate 코드, verify 증적과 재사용, 리뷰 관점·디스패치·라운드, 코딩·테스트 표준

## Success criteria
1. `gates-review` 영역에 속하는 새 계획은 이 epic 아래 blueprint로 만든다.
2. 아래 legacy epic은 `legacy`로 그대로 두고 조회·이력에만 쓴다. 승인·검증 해시와 trailer 연결을 바꾸지 않는다.

## Out of scope
- gate가 나오는 계획 문서 형식 → `plan-workflow`
- legacy epic의 물리적 이관. 이 epic은 논리적 병합만 한다.
- legacy epic에 남은 미완료 blueprint는 모두 closed로 간주하고 상태를 바꾸지 않았다.

## Legacy epic 귀속
Epic 기능 분류의 매핑이다. △는 일부 blueprint가 다른 영역에 귀속된다는 뜻이다.

- [workflow-reliability](../workflow-reliability/index.md)
- [adaptive-review-dispatch](../adaptive-review-dispatch/index.md)
- [verification-reuse-checkpoint-compaction](../verification-reuse-checkpoint-compaction/index.md)
- [coding-standards-pr-retro](../coding-standards-pr-retro/index.md)

### 다른 epic에서 이 영역으로 귀속되는 blueprint
| legacy epic | blueprint | 이유 |
| --- | --- | --- |
| 004 | 007 context-review-guard | 리뷰 심사와 G18 |
| 009 | 006 debugger-agent | verify 실패 조사 |
| 018 | 018 gate-integrity | gate 집합과 verify 증적 |
| 061 | 001 | 셸 없는 검증, 커밋 스코프 검사 |
| 087 | 001 commit-enforcement | 커밋 강제력과 게이트 실패 조건 |
| 099 | 001 | 리뷰 입력 일관성 |

## Blueprints
없음. 첫 blueprint는 `/bouncer-plan`으로 추가한다.
