---
type: bouncer.epic
title: 규칙 소유권과 런타임 계약 재구성
description: Maps Bouncer rule ownership and preserves current workflow loading and behavior during reorganization.
resource: .bouncer/context/epics/077-rules-reorganization/index.md
tags:
  - bouncer
  - epic
  - rule-ownership
  - workflow
  - governance
timestamp: '2026-09-21T17:15:43.785+09:00'
bouncer:
  id: '077'
  epic_id: '077'
  status: approved
  supersedes: []
---
# 077 규칙 소유권과 런타임 계약 재구성

## Intent
- 문제: `rules/governance.md`가 계획 정책, coordinator 절차, CLI 구현 설명을 함께 소유해 각 workflow가 필요하지 않은 규칙까지 읽고 파일 위치에 결합된 테스트가 정본 이전을 막는다.
- 목표: 후속 Blueprint가 정본을 옮기기 전에 `governance.md`의 규범 소유권, workflow별 적재 관계와 현행 동작을 검증 가능한 기준선으로 고정한다.

## Success criteria
1. `rules/governance.md`의 모든 규범 단위에 stable id, 현재 소유자, 목표 소유자 하나, 하나 이상의 소비자와 이전 Blueprint가 기록된다.
2. `init`, `plan`, `run`, `execute`, `commit`, `finalize`, coordinator의 rule load graph가 startup, numbered step, failure branch를 구분한다.
3. 새 characterization 테스트가 source digest drift, ownership 누락·중복과 load graph 누락·오분류를 실패로 보고한다.
4. 새 테스트가 Blueprint sizing, light/full, DAG·approved scope, coordinator revision·worktree·commit scope·repair 계약을 current owner locator를 통해 확인한다.
5. `npm run ci`가 통과하고 `rules/governance.md`, 기존 skill·agent·runtime 파일과 동결 제안서에는 diff가 없다.

## Out of scope
- BP 2의 planning 규칙·schema 이전과 관련 skill·template·scaffold 변경을 수행하지 않는다.
- BP 3의 execution 규칙·coordinator 절차·commit scope·pointer·dispatch·output 이전을 수행하지 않는다.
- BP 4의 Primary/Operational 공개 문서 정리, 배포 목록 변경과 `governance.md` 삭제를 수행하지 않는다.
- 새로운 gate code, CLI 상태 전이, 문서 schema, runtime config 또는 dependency를 도입하지 않는다.
- 동결된 `rules-reorganization-proposal.md`를 수정하거나 commit하지 않는다.

## Blueprints
* [001 규칙 소유권 지도와 마이그레이션 안전망](blueprints/001-ownership-map-migration-safety/index.md) - 현재·목표 소유권과 workflow load graph를 기록하고 동작 보존 검사를 추가한다.
