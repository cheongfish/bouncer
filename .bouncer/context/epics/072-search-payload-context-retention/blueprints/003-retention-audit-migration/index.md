---
type: bouncer.blueprint
title: 완료 컨텍스트 보존 감사와 이관
description: Audits closed blueprints and migrates only durable intent before removing transient context.
resource: .bouncer/context/epics/072-search-payload-context-retention/blueprints/003-retention-audit-migration/index.md
tags:
  - bouncer
  - blueprint
  - retention
  - migration
  - finalize
timestamp: '2026-09-17T13:37:57.505+09:00'
bouncer:
  id: '003'
  epic_id: '072'
  blueprint_id: '003'
  status: closed
  commit_type: feat
  scale: full
  supersedes: []
---
# 완료 컨텍스트 보존 감사와 이관

Epic: [072](../../index.md)

## Intent

신규 finalize는 task의 장기 설계 의도만 Explain으로 승격하고 실행 시점의 범위 통제는 남기지 않도록 보존 계약을 바로잡음. `bouncer migrate retention`은 과거 closed Blueprint를 기본 dry-run으로 분류하고, 명시한 단일 경로의 승격이 성공한 경우에만 transient 문서를 원자적으로 정리함.

## Contract
- 인터페이스: `bouncer migrate retention [--apply --blueprint <dir>]`를 제공한다. 옵션이 없으면 모든 closed Blueprint를 읽기 전용으로 감사하고, `--apply`는 저장소 상대 단일 Blueprint 경로가 함께 있을 때만 쓴다.
- 데이터·상태: 감사 결과는 Blueprint 경로마다 `eligible`, `blocked-missing-explain`, `blocked-invalid-task`, `blocked-insufficient-intent`, `already-compacted` 중 하나와 근거, 승격·삭제 예정 경로를 반환한다. 적용은 `index.md`와 `explain.md`를 보존하며 기존 `task_commits`를 재작성하거나 합성하지 않는다.
- 수용 기준: Epic success criteria 7, 8, 10, 11, 12가 참이고 criterion 9를 수행할 단일 경로 적용 경계가 준비된다. 적용 대상은 감사 결과가 `eligible`인 정확한 Blueprint 하나뿐이고, Explain 승격이나 task·verification·review·context-review 삭제 중 실패하면 적용 전 바이트로 복구된다. 실제 legacy corpus 정리는 BP-004가 감사 결과를 승인받아 수행한다.
- 검증 명령: 구현 task는 각 브리프의 회귀 명령을 실행하고 terminal verification node는 저장소 루트에서 `npm run ci`를 실행한다.
- 실패 모드·엣지 케이스: Explain 부재·파싱 실패, task 문서 부재·파싱 실패·부모 ID 불일치, 승격할 장기 intent 부족을 서로 다른 차단 상태로 보고한다. open Blueprint, 저장소 밖 경로, `--apply`만 단독 입력한 호출은 쓰기 전에 거부한다. 일부 task만 유효한 Blueprint는 전체 적용을 거부하고, 이미 transient 문서가 없는 대상은 변경 없이 `already-compacted`로 끝낸다.

## Out of scope
- 감사가 반환한 legacy Blueprint에 대한 실제 일괄 적용과 `.bouncer/context/epics` 전체 수정
- 과거 문서에 없는 commit SHA, trailer, stable Task provenance 합성
- 원본 verification log, reviewer 대화, 디버깅 transcript와 Graphify 후보의 장기 보존
- `bouncer intent` 응답 계약, Graphify ranking, 생성 CommonJS 배포 방식 변경

## One-commit justification
- 이 Blueprint는 두 reviewable implementation commit으로 나눈다. 첫 commit은 신규 finalize의 승격 계약을 고정하고, 둘째 commit은 그 계약을 재사용하는 감사·적용 명령과 안전 경계를 제공한다. 전체 CI는 source diff가 없는 terminal verification node가 두 commit 통합 뒤 실행한다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
* [Retention audit task](tasks/002/tasks.md) - 감사·적용 명령 구현 브리프
* [Retention audit verification](tasks/002/verification.md) - 감사·적용 명령 검증 증적
* [Retention audit review](tasks/002/review.md) - 감사·적용 명령 리뷰 발견사항
* [Terminal verification task](tasks/003/tasks.md) - 통합 checkout 전체 CI 브리프
* [Terminal verification evidence](tasks/003/verification.md) - 전체 CI 증적
* [Context review](context-review.md) - 계획 문서 정합성 판정
