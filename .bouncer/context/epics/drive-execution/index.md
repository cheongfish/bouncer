---
type: bouncer.epic
title: 117 drive-execution
description: 'Run workflow: coordinator, DAG, worktrees, worker dispatch, repair and drive cost'
resource: .bouncer/context/epics/drive-execution/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-10-20T16:05:56.378+09:00'
bouncer:
  id: drive-execution
  epic_id: drive-execution
  status: approved
  supersedes: []
---
# 117 drive-execution

## Intent
- 문제: 기능 영역이 같은 작업이 legacy epic 63개에 흩어져 있고, 등록부 도입 뒤 이 저장소에는 새 blueprint를 만들 활성 epic이 없다.
- 목표: 이 epic이 `drive-execution` 영역의 새 blueprint를 받는다. 포함: `/bouncer-run`: coordinator, DAG·wave·lease, worktree, worker 디스패치와 모델 설정, repair·재시도, 실행 비용 절감, implementer 탐색

## Success criteria
1. `drive-execution` 영역에 속하는 새 계획은 이 epic 아래 blueprint로 만든다.
2. 아래 legacy epic은 `legacy`로 그대로 두고 조회·이력에만 쓴다. 승인·검증 해시와 trailer 연결을 바꾸지 않는다.

## Out of scope
- 검증 증적 재사용·gate 판정 → `gates-review`
- legacy epic의 물리적 이관. 이 epic은 논리적 병합만 한다.
- legacy epic에 남은 미완료 blueprint는 모두 closed로 간주하고 상태를 바꾸지 않았다.

## Legacy epic 귀속
Epic 기능 분류의 매핑이다. △는 일부 blueprint가 다른 영역에 귀속된다는 뜻이다.

- [agent-orchestration](../agent-orchestration/index.md) △
- [task-unit-commits](../task-unit-commits/index.md) △
- [task-dag-coordinator](../task-dag-coordinator/index.md)
- [parallel-run-finalize-digest](../parallel-run-finalize-digest/index.md) △
- [execution-token-cost](../execution-token-cost/index.md)
- [drive-context-reduction](../drive-context-reduction/index.md)
- [drive-plan-copy-hygiene](../drive-plan-copy-hygiene/index.md)
- [drive-token-reduction](../drive-token-reduction/index.md)
- [workflow-cost-and-light-path](../workflow-cost-and-light-path/index.md)
- [drive-reliability](../drive-reliability/index.md)
- [drive-observation-cleanup](../drive-observation-cleanup/index.md)
- [drive-plan-cost-control](../drive-plan-cost-control/index.md)
- [bouncer-improvements-2026-10-14](../bouncer-improvements-2026-10-14/index.md) △
- [drive-repair-integrity](../drive-repair-integrity/index.md)
- [drive-retro-103-followups](../drive-retro-103-followups/index.md)
- [implementer-navigation](../implementer-navigation/index.md)

### 다른 epic에서 이 영역으로 귀속되는 blueprint
| legacy epic | blueprint | 이유 |
| --- | --- | --- |
| 061 | 002 | run 규칙 로딩 |
| 099 | 003, 005, 006 | repair·dispatch·worker 정리 |

## Blueprints
없음. 첫 blueprint는 `/bouncer-plan`으로 추가한다.
