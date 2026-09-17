---
type: bouncer.blueprint
title: 적격 레거시 컨텍스트 축약
description: Compacts only audit-eligible legacy blueprint paths while preserving durable context and provenance.
resource: .bouncer/context/epics/072-search-payload-context-retention/blueprints/004-legacy-context-compaction/index.md
tags:
  - bouncer
  - blueprint
  - retention
  - migration
  - context
timestamp: '2026-09-17T15:47:40.014+09:00'
bouncer:
  id: '004'
  epic_id: '072'
  blueprint_id: '004'
  status: closed
  commit_type: feat
  scale: full
  supersedes: []
---
# 적격 레거시 컨텍스트 축약

Epic: [072](../../index.md)

## Intent

BP-003 감사에서 `eligible`로 판정된 legacy Blueprint만 정확한 경로 단위로 축약해 Epic success criterion 9를 완료함. 기존 index와 Explain, commit SHA 및 provenance는 보존함.

## Contract
- 인터페이스: BP-003이 제공한 `bouncer migrate retention` 감사 결과를 기준선으로 삼고, 각 대상에 `bouncer migrate retention --apply --blueprint <exact-path>`를 한 번씩 호출한다.
- 데이터·상태: 승인된 54개 closed Blueprint의 Explain에는 장기 설계 절만 승격하고, 감사 결과가 열거한 `tasks.md`·`verification.md`·`review.md`·`context-review.md`만 삭제한다. index와 Explain 파일 자체, `bouncer.task_commits`, 기존 SHA와 provenance는 남긴다.
- 수용 기준: 적용 전 감사가 승인된 54개 경로를 모두 `eligible`로 반환하고 다른 상태를 적용 목록에 포함하지 않는다. 적용 후 같은 감사가 54개 경로를 `already-compacted`로 반환하면 Epic success criterion 9가 참이다. BP-003 retention 회귀와 `npm run ci`가 모두 통과하면 이번 Blueprint에 대한 criterion 12 근거가 성립한다.
- 검증 명령: 적용 전에 `node --test test/retention-migration.test.js test/cli-project-commands.test.js`로 BP-003 감사·적용 계약을 검증하고, 적용 전후 감사 JSON을 경로별로 대조한 뒤 `npm run ci`로 이전 Blueprint의 추적된 회귀를 포함한 저장소 전체 검증을 실행한다.
- 실패 모드·엣지 케이스: 감사 결과가 기준선과 달라지거나 한 경로라도 적용·복구에 실패하면 즉시 중단하고 남은 경로를 적용하지 않는다. 절대 경로, `..` 탈출, symlink 탈출, open Blueprint, 비적격 상태는 BP-003 계약대로 쓰기 전에 거절한다.

## Out of scope
- `.bouncer/context/epics` 전체 또는 epic 단위 경로를 수정 권한으로 열지 않는다.
- 대상 Blueprint의 `index.md`를 수정하거나 `explain.md`를 삭제·수동 재작성하지 않는다.
- `already-compacted`와 blocked 대상에는 apply를 호출하지 않는다.
- 누락된 commit SHA, trailer 또는 stable Task provenance를 합성하지 않는다.
- retention 구현, CLI, 테스트, 문서와 roadmap을 변경하지 않는다.

## One-commit justification
- BP-003의 동일한 원자 적용 계약을 현재 감사가 확정한 corpus에 반복하는 데이터 이관이다. 제품 코드 변경 없이 하나의 감사 전후 diff로 54개 경로의 보존·삭제 불변식을 함께 판정한다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
