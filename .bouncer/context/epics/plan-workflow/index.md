---
type: bouncer.epic
title: 116 plan-workflow
description: 'Plan workflow: discovery, scaffold, task briefs, light plans and plan gate rules'
resource: .bouncer/context/epics/plan-workflow/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-10-20T16:05:56.272+09:00'
bouncer:
  id: plan-workflow
  epic_id: plan-workflow
  status: approved
  supersedes: []
---
# 116 plan-workflow

## Intent
- 문제: 기능 영역이 같은 작업이 legacy epic 63개에 흩어져 있고, 등록부 도입 뒤 이 저장소에는 새 blueprint를 만들 활성 epic이 없다.
- 목표: 이 epic이 `plan-workflow` 영역의 새 blueprint를 받는다. 포함: `/bouncer-plan`: 발견, spec-authoring, scaffold, task brief·intent bundle·경량 계획, plan gate와 context review의 계획 단계 규칙

## Success criteria
1. `plan-workflow` 영역에 속하는 새 계획은 이 epic 아래 blueprint로 만든다.
2. 아래 legacy epic은 `legacy`로 그대로 두고 조회·이력에만 쓴다. 승인·검증 해시와 trailer 연결을 바꾸지 않는다.

## Out of scope
- review 심사 자체의 기준·디스패치 → `gates-review`
- legacy epic의 물리적 이관. 이 epic은 논리적 병합만 한다.
- legacy epic에 남은 미완료 blueprint는 모두 closed로 간주하고 상태를 바꾸지 않았다.

## Legacy epic 귀속
Epic 기능 분류의 매핑이다. △는 일부 blueprint가 다른 영역에 귀속된다는 뜻이다.

- [planning-quality-governance](../planning-quality-governance/index.md) △
- [document-commit-contracts](../document-commit-contracts/index.md) △
- [task-brief-specificity](../task-brief-specificity/index.md)
- [code-grounded-intent-provenance](../code-grounded-intent-provenance/index.md)
- [task-intent-bundle-reuse](../task-intent-bundle-reuse/index.md)
- [plan-context-quality-efficiency](../plan-context-quality-efficiency/index.md)
- [plan-review-convergence](../plan-review-convergence/index.md)
- [intent-fence-guard](../intent-fence-guard/index.md)
- [plan-review-call-reduction](../plan-review-call-reduction/index.md)
- [plan-review-loop-guard](../plan-review-loop-guard/index.md)
- [drive-retro-104-followups](../drive-retro-104-followups/index.md) △

### 다른 epic에서 이 영역으로 귀속되는 blueprint
| legacy epic | blueprint | 이유 |
| --- | --- | --- |
| 043 | 002 light-plan-contract | 경량 plan |
| 063 | 002, 003, 004 | context review·발견 안내 |

## Blueprints
- [context-review-fix-restart](blueprints/context-review-fix-restart/index.md) — delta 뒤 열린 `must_fix` 대상 섹션을 고치면 `context-review restart`·`route`가 restart를 허용하고 skill 안내를 맞춘다.
