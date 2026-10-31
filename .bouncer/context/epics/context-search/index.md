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
2. 아래 legacy epic의 blueprint는 `bouncer migrate merge-legacy-epics`로 귀속된 도메인 epic 아래로 물리 이관할 수 있다. 이관은 문서 안 ID·경로를 새 위치로 옮기고 원래 공식과 일치한 파생 해시만 다시 계산하며, 이관 뒤 legacy epic 디렉터리는 도메인 epic으로 흡수해 지운다. 등록부 legacy 항목은 `moved_to`를 더해 유지하고, 과거 커밋 trailer(번호·legacy slug)는 별칭 표와 `moved_to`로 새 위치에 계속 연결한다. 이 저장소에 실제로 적용하는 일은 병합 뒤 사용자 승인을 받는 별도 단계다.

## Out of scope
- 문서를 쓰는 워크플로 단계 동작 → 해당 단계 영역
- 등록부 legacy 항목 삭제. legacy epic 디렉터리는 흡수해 지웠지만 항목은 옛 trailer 해석을 위해 남긴다.
- legacy epic에 남은 미완료 blueprint의 상태 변경. 물리 이관도 상태를 바꾸지 않고 그대로 옮긴다.

## Legacy epic 귀속
Epic 기능 분류의 매핑이다. △는 일부 blueprint가 다른 영역에 귀속된다는 뜻이다. legacy epic 디렉터리는 흡수해 지웠으므로 링크 대상 파일은 없고, 목록은 `bouncer migrate merge-legacy-epics`가 읽는 귀속 표로만 남는다. 원문은 git 이력에 있다.

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
- [legacy-epic-merge](blueprints/legacy-epic-merge/index.md) — legacy epic blueprint를 도메인 epic 아래로 옮기는 `migrate merge-legacy-epics`와 옛 trailer 해석(`moved_to`), v2 `plan inspect` 요약을 고친다.
- [moved-slug-stable-ids](blueprints/moved-slug-stable-ids/index.md) — 병합 이관이 옮긴 문서의 slug 형식 stable ID(`task_commits`·`### ` 제목)를 `moved_to`를 따라 도메인 epic 위치로 다시 쓴다.
- [ontology-output-and-rename-lookup](blueprints/ontology-output-and-rename-lookup/index.md) — `bouncer ontology`의 파이프 출력 절단, 기본 경고 개수 요약(`--warnings`), `file`·`impact`의 git rename 이력 추적을 고친다. (이후 `bouncer ontology` 명령과 `bouncer.supersedes` 필드는 폐기·삭제됐다.)
