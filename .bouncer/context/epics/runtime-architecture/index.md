---
type: bouncer.epic
title: 121 runtime-architecture
description: 'CLI and runtime base: modules, rule structure, pointer, state transition guards'
resource: .bouncer/context/epics/runtime-architecture/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-10-20T16:05:56.802+09:00'
bouncer:
  id: runtime-architecture
  epic_id: runtime-architecture
  status: approved
  supersedes: []
---
# 121 runtime-architecture

## Intent
- 문제: 기능 영역이 같은 작업이 legacy epic 63개에 흩어져 있고, 등록부 도입 뒤 이 저장소에는 새 blueprint를 만들 활성 epic이 없다.
- 목표: 이 epic이 `runtime-architecture` 영역의 새 blueprint를 받는다. 포함: CLI·런타임 기반: TypeScript 전환, 모듈 책임 분해, 규칙·스킬 구조, 현재 작업 포인터, 상태 전이 가드, 소스·테스트 위생

## Success criteria
1. `runtime-architecture` 영역에 속하는 새 계획은 이 epic 아래 blueprint로 만든다.
2. 아래 legacy epic은 `legacy`로 그대로 두고 조회·이력에만 쓴다. 승인·검증 해시와 trailer 연결을 바꾸지 않는다.

## Out of scope
- 특정 단계의 기능 → 해당 단계 영역
- legacy epic의 물리적 이관. 이 epic은 논리적 병합만 한다.
- legacy epic에 남은 미완료 blueprint는 모두 closed로 간주하고 상태를 바꾸지 않았다.

## Legacy epic 귀속
[Epic 기능 분류와 재배치 제안](../../../../EPIC-CLASSIFICATION-PROPOSAL.md)의 매핑이다. △는 일부 blueprint가 다른 영역에 귀속된다는 뜻이다.

- [platform-architecture](../platform-architecture/index.md)
- [structural-audit-remediation](../structural-audit-remediation/index.md) △
- [maintenance](../maintenance/index.md) △
- [runtime-policy-pointer-safety](../runtime-policy-pointer-safety/index.md)
- [workflow-contract-followup](../workflow-contract-followup/index.md)
- [workflow-improvement](../workflow-improvement/index.md) △
- [rules-reorganization](../rules-reorganization/index.md)
- [cli-deterministic-procedures](../cli-deterministic-procedures/index.md)
- [v153-evaluation-remediation](../v153-evaluation-remediation/index.md) △
- [source-test-hygiene](../source-test-hygiene/index.md)
- [source-restructuring](../source-restructuring/index.md)
- [workflow-transition-guards](../workflow-transition-guards/index.md)

### 다른 epic에서 이 영역으로 귀속되는 blueprint
| legacy epic | blueprint | 이유 |
| --- | --- | --- |
| 001 | 008 instruction-layers, 009 debt-items | 지시문 층 경계와 감사 부채는 호스트 배포가 아님 |
| 043 | 005~008, 010 | 에이전트 rubric·reference 분리·규칙 블록 구조 |
| 113 | 002 lint-baseline-cleanup | CI lint 기준선 |

## Blueprints
없음. 첫 blueprint는 `/bouncer-plan`으로 추가한다.
