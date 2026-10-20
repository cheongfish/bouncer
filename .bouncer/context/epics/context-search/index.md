---
type: bouncer.epic
title: 119 context-search
description: 'Context document model: ids, schema, epic registry, Distill, Graphify and ontology search'
resource: .bouncer/context/epics/context-search/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-10-20T16:05:56.589+09:00'
bouncer:
  id: context-search
  epic_id: context-search
  status: approved
  supersedes: []
---
# 119 context-search

## Intent
- 문제: 기능 영역이 같은 작업이 legacy epic 63개에 흩어져 있고, 등록부 도입 뒤 이 저장소에는 새 blueprint를 만들 활성 epic이 없다.
- 목표: 이 epic이 `context-search` 영역의 새 blueprint를 받는다. 포함: 컨텍스트 문서 모델: epic·blueprint 식별자와 스키마, 등록부, Distill·정본 컨텍스트, Graphify·ontology 검색, 출처 추적

## Success criteria
1. `context-search` 영역에 속하는 새 계획은 이 epic 아래 blueprint로 만든다.
2. 아래 legacy epic은 `legacy`로 두고 조회·이력에만 쓴다. 번호 식별자를 slug로 바꾸는 이관(slug 식별자 결정 3)은 디렉터리·문서 안 ID·경로를 새 형식으로 옮기고 파생 해시를 다시 계산하되, 과거 커밋 trailer는 별칭 표로 계속 연결한다.

## Out of scope
- 문서를 쓰는 워크플로 단계 동작 → 해당 단계 영역
- legacy epic 사이의 blueprint 재배치. 귀속은 논리적 병합으로만 하고, 물리 이관은 식별자 형식 전환(번호 → slug)에 한한다.
- legacy epic에 남은 미완료 blueprint는 모두 closed로 간주하고 상태를 바꾸지 않았다.

## Legacy epic 귀속
Epic 기능 분류의 매핑이다. △는 일부 blueprint가 다른 영역에 귀속된다는 뜻이다.

- [project-distill](../project-distill/index.md)
- [numeric-context-ids](../numeric-context-ids/index.md) △
- [graphify-search-quality](../graphify-search-quality/index.md)
- [context-runtime-rearchitecture](../context-runtime-rearchitecture/index.md)
- [search-payload-context-retention](../search-payload-context-retention/index.md)
- [graphify-raw-query](../graphify-raw-query/index.md)
- [context-ontology](../context-ontology/index.md)
- [consumer-epic-registry](../consumer-epic-registry/index.md)

### 다른 epic에서 이 영역으로 귀속되는 blueprint
| legacy epic | blueprint | 이유 |
| --- | --- | --- |
| 014 | 001~003, 005~009 | 식별자·스키마·코퍼스 |
| 062 | 003 migrate-ids-removal | 식별자 이관 표면 제거 |
| 063 | 001 graphify-query-guidance | 검색 안내 |

## Blueprints
- [slug-identifiers](blueprints/slug-identifiers/index.md) — epic·blueprint 식별자를 번호에서 slug와 `order`로 바꾸고 trailer·실행 키·이관 명령을 새 형식으로 맞춘다.
