---
type: bouncer.epic
title: 검색 입력과 완료 컨텍스트 경량화
description: Bounds search payloads and retained context while preserving provenance and Node-only distribution.
resource: .bouncer/context/epics/072-search-payload-context-retention/index.md
tags:
  - bouncer
  - epic
  - graphify
  - intent
  - retention
  - payload
timestamp: '2026-09-17T09:36:51.608+09:00'
bouncer:
  id: '072'
  epic_id: '072'
  status: approved
  supersedes: []
---
# 검색 입력과 완료 컨텍스트 경량화

## Intent

- 문제: 검색 후보와 완료 작업 원문이 상한 없이 기본 입력에 남고, intent 구현과 생성 CommonJS가 일반 탐색 표면에 함께 노출된다.
- 목표: 검색·계획·마감 단계가 필요한 코드 관계와 장기 의도만 읽고, 사용자는 사전 컴파일된 CommonJS를 Node.js로 계속 실행한다.

## Success criteria

1. `graph-suggest` 기본 후보는 역할별 3개, 전체 8개를 넘지 않는다.
2. 구현 후보는 medium 이상이고 테스트 후보는 구현 관계가 확인된 파일이며, 각 기본 후보는 `path`, `role`, `score`와 문서화된 폐쇄형 enum의 ASCII basis code만 가진다. 각 basis code는 24자를 넘지 않는다.
3. 함수명과 명시적 저장소 상대 경로만 seed로 승격하며 generic label, seed별 file fan-out 8 초과와 BFS frontier 32 초과를 추천 경로로 사용하지 않는다.
4. `--debug`는 상한 안에서 발견한 전체 후보, 상세 근거와 traversal 통계를 제공하되 기본 status, ranking과 `suggested_paths`를 바꾸지 않는다.
5. `bouncer help`, init, graph-sync, graph-suggest와 다른 일반 CLI 호출은 `symbol-index`와 `intent-provenance`를 적재하지 않는다.
6. `bouncer intent`의 `resolved`, `ambiguous`, `unresolved`, `unlinked`, JSON과 exit code 계약은 유지된다.
7. 새로 닫는 Blueprint의 Explain은 Goal & intent, 선택적 Current/Target behavior, Interface, Touch 이유와 Constraints를 보존하고 실행 시점의 `Do not touch`를 장기 설계로 승격하지 않는다.
8. retention audit는 Explain 승격에 성공한 closed Blueprint만 transient 문서 삭제 대상으로 판정하고, 없는 commit SHA나 stable provenance를 만들지 않는다.
9. 감사에 통과한 legacy Blueprint의 task, verification, review와 context-review 원문은 정확한 Blueprint 경로 단위로 정리되고 index와 Explain은 남는다.
10. 사용자는 Bun, ts-node, tsx나 TypeScript compiler 없이 Node.js와 사전 컴파일된 CommonJS로 Bouncer를 실행한다.
11. marketplace가 빌드된 release artifact를 보장하기 전에는 `scripts/lib/*.js`와 `check:emit`을 유지한다.
12. 각 Blueprint의 회귀와 저장소 전체 `npm run ci`가 통과한다.

## Out of scope

- context graph, `context-search`, `scope_evidence`, G4 또는 S9 복구
- Graphify 외부 패키지의 graph schema와 query 구현 변경
- `affected_paths` 자동 확정과 token usage telemetry
- 과거 문서에 없는 commit SHA, trailer 또는 stable Task provenance 합성
- Bun이나 TypeScript runtime을 사용자 설치 요구사항으로 추가
- 빌드된 marketplace artifact 없이 `scripts/lib/*.js`의 Git 추적 제거

## Blueprints

* [Graphify 추천 payload 상한](blueprints/001-graphify-compact-payload/index.md) - `graph-search` traversal과 `graph-suggest` 기본·debug payload를 결정적 상한으로 제한한다.
* [Intent 런타임 지연 적재 경계](blueprints/002-lazy-intent-runtime-boundary/index.md) - 일반 CLI 호출에서 intent 구현을 제외하고 `bouncer intent` 실행 시점에만 resolver를 적재한다.
