---
type: bouncer.epic
title: 122 benchmark-cost
description: 'Evaluation and cost: benchmark harness, DeepSWE, token and time baselines'
resource: .bouncer/context/epics/benchmark-cost/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-10-20T16:05:56.908+09:00'
bouncer:
  id: benchmark-cost
  epic_id: benchmark-cost
  status: approved
  supersedes: []
---
# 122 benchmark-cost

## Intent
- 문제: 기능 영역이 같은 작업이 legacy epic 63개에 흩어져 있고, 등록부 도입 뒤 이 저장소에는 새 blueprint를 만들 활성 epic이 없다.
- 목표: 이 epic이 `benchmark-cost` 영역의 새 blueprint를 받는다. 포함: 평가와 비용: 벤치마크 하네스, DeepSWE, 토큰·시간 측정 기준선, 비용 절감 계획의 측정 부분

## Success criteria
1. `benchmark-cost` 영역에 속하는 새 계획은 이 epic 아래 blueprint로 만든다.
2. 아래 legacy epic은 `legacy`로 그대로 두고 조회·이력에만 쓴다. 승인·검증 해시와 trailer 연결을 바꾸지 않는다.

## Out of scope
- 특정 단계의 동작을 바꾸는 비용 절감 구현 → 해당 단계 영역
- legacy epic의 물리적 이관. 이 epic은 논리적 병합만 한다.
- legacy epic에 남은 미완료 blueprint는 모두 closed로 간주하고 상태를 바꾸지 않았다.

## Legacy epic 귀속
[Epic 기능 분류와 재배치 제안](../../../../EPIC-CLASSIFICATION-PROPOSAL.md)의 매핑이다. △는 일부 blueprint가 다른 영역에 귀속된다는 뜻이다.

- [evaluation-benchmarking](../evaluation-benchmarking/index.md)
- [bouncer-cost-improvement](../bouncer-cost-improvement/index.md) △
- [benchmark-contract-stability](../benchmark-contract-stability/index.md)
- [deepswe-benchmark](../deepswe-benchmark/index.md)
- [workflow-cost-reduction](../workflow-cost-reduction/index.md)

### 다른 epic에서 이 영역으로 귀속되는 blueprint
| legacy epic | blueprint | 이유 |
| --- | --- | --- |
| 009 | 012 plugin-arm-benchmark | 벤치마크 프로토콜 |
| 062 | 004 benchmark-skill-removal | 벤치마크 스킬 제거 |

## Blueprints
없음. 첫 blueprint는 `/bouncer-plan`으로 추가한다.
