---
type: bouncer.epic
title: 119 context-search
description: 'Context document model: ids, schema, epic registry, Distill, Graphify and ontology search'
resource: .bouncer/context/epics/119-context-search/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-10-20T16:05:56.589+09:00'
bouncer:
  id: '119'
  epic_id: '119'
  status: approved
  supersedes: []
---
# 119 context-search

## Intent
- 문제: 기능 영역이 같은 작업이 legacy epic 63개에 흩어져 있고, 등록부 도입 뒤 이 저장소에는 새 blueprint를 만들 활성 epic이 없다.
- 목표: 이 epic이 `context-search` 영역의 새 blueprint를 받는다. 포함: 컨텍스트 문서 모델: epic·blueprint 식별자와 스키마, 등록부, Distill·정본 컨텍스트, Graphify·ontology 검색, 출처 추적

## Success criteria
1. `context-search` 영역에 속하는 새 계획은 이 epic 아래 blueprint로 만든다.
2. 아래 legacy epic은 `legacy`로 그대로 두고 조회·이력에만 쓴다. 승인·검증 해시와 trailer 연결을 바꾸지 않는다.

## Out of scope
- 문서를 쓰는 워크플로 단계 동작 → 해당 단계 영역
- legacy epic의 물리적 이관. 이 epic은 논리적 병합만 한다.
- legacy epic에 남은 미완료 blueprint는 모두 closed로 간주하고 상태를 바꾸지 않았다.

## Legacy epic 귀속
[Epic 기능 분류와 재배치 제안](../../../../EPIC-CLASSIFICATION-PROPOSAL.md)의 매핑이다. △는 일부 blueprint가 다른 영역에 귀속된다는 뜻이다.

- [project-distill](../007-project-distill/index.md)
- [numeric-context-ids](../014-numeric-context-ids/index.md) △
- [graphify-search-quality](../060-graphify-search-quality/index.md)
- [context-runtime-rearchitecture](../068-context-runtime-rearchitecture/index.md)
- [search-payload-context-retention](../072-search-payload-context-retention/index.md)
- [graphify-raw-query](../100-graphify-raw-query/index.md)
- [context-ontology](../111-context-ontology/index.md)
- [consumer-epic-registry](../114-consumer-epic-registry/index.md)

### 다른 epic에서 이 영역으로 귀속되는 blueprint
| legacy epic | blueprint | 이유 |
| --- | --- | --- |
| 014 | 001~003, 005~009 | 식별자·스키마·코퍼스 |
| 062 | 003 migrate-ids-removal | 식별자 이관 표면 제거 |
| 063 | 001 graphify-query-guidance | 검색 안내 |

## Blueprints
없음. 첫 blueprint는 `/bouncer-plan`으로 추가한다.
