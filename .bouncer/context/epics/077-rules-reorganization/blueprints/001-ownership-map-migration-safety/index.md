---
type: bouncer.blueprint
title: 규칙 소유권 지도와 마이그레이션 안전망
description: Maps current and target rule ownership and adds migration characterization checks.
resource: .bouncer/context/epics/077-rules-reorganization/blueprints/001-ownership-map-migration-safety/index.md
tags:
  - bouncer
  - blueprint
  - rule-ownership
  - characterization
  - workflow
timestamp: '2026-09-21T17:15:43.953+09:00'
bouncer:
  id: '001'
  epic_id: '077'
  blueprint_id: '001'
  status: closed
  commit_type: test
  scale: full
  supersedes: []
---
# 001 규칙 소유권 지도와 마이그레이션 안전망

Epic: [077](../../index.md)

## Intent
- `governance.md`의 규범과 workflow별 rule 적재 관계를 이동 전에 식별할 수 없어 후속 정본 이전에서 누락과 의미 변화를 판별하기 어려움.
- 현재·목표 소유권 지도와 동작 보존 검사를 함께 고정해 후속 Blueprint가 같은 기준선을 사용하게 함.

## Contract
- 인터페이스: 개발자용 ownership 문서는 각 규범 단위에 stable id, 현재 소유자, 목표 소유자, 소비자와 이전 Blueprint를 제공하고, load graph는 소비자별 시작·단계별·실패 시 적재를 구분한다. 공개 CLI와 사용자 workflow 인터페이스는 바꾸지 않는다.
- 데이터·상태: runtime 상태와 OKF schema는 변하지 않는다. ownership 문서와 characterization 테스트만 추가하며 `governance.md`는 현행 정본으로 남긴다.
- 수용 기준: Epic 성공 조건 1·2의 기준선이 문서화되고 성공 조건 3·4의 검사가 이를 소비하며, 성공 조건 5의 보호 경로에 diff가 없다.
- 검증 명령: 두 task 모두 `npm run ci`를 실행한다.
- 실패 모드·엣지 케이스: 한 규범이 복수 목표 소유자를 갖거나 소비자가 비어 있으면 실패한다. conditional 또는 failure-only reference를 기본 preload로 분류하면 실패한다. 테스트가 현재 파일 경로를 코드에 다시 고정하거나 동결 제안서와 `governance.md`를 변경하면 범위 위반이다.

## Out of scope
- 규범 문장을 새 rule, skill 또는 agent 문서로 이동하지 않는다.
- `governance.md`를 수정하거나 삭제하지 않는다.
- 기존 workflow, CLI, gate, scaffold와 coordinator 실행 의미를 변경하지 않는다.
- Primary/Operational 공개 문서 정리와 배포 목록 변경은 후속 Blueprint로 남긴다.
- 동결된 `rules-reorganization-proposal.md`를 수정하거나 commit하지 않는다.

## One-commit justification
- TASKS-001의 ownership 기준선이 TASKS-002의 검사 입력이 되므로 두 task commit은 하나의 마이그레이션 안전망 PR로 함께 리뷰해야 한다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
* [Explain](explain.md) - 변경 배경과 이해도 기록
