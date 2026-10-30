---
type: bouncer.blueprint
title: 입력 검증과 PR 초안 계약 보완
description: repair 검증 입력과 PR 초안 필수 절 계약을 보완한다.
resource: .bouncer/context/epics/drive-execution/blueprints/repair-verify-pr-contract/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-10-30T12:55:15.628+09:00'
bouncer:
  id: repair-verify-pr-contract
  epic_id: drive-execution
  blueprint_id: repair-verify-pr-contract
  status: closed
  order: 76
  commit_type: feat
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  review_contract: brief
  supersedes: []
---
# 입력 검증과 PR 초안 계약 보완

Epic: [drive-execution](../../index.md)

## Intent
repair 검증 명령을 기록 전에 저장소 정책으로 검증한다. PR 초안에 필수 절과 worker note 출처를 보존한다.

## Contract
- `coordinate repair --verify`는 단일 argv와 저장소 `verify_allowlist`를 모두 만족해야 한다. 거절 시 원장과 task 문서는 바뀌지 않는다.
- `finalize pr-body`는 `변경 그림`, `변경 전후`, `되돌리기 · 영향 범위`를 항상 출력한다. flow가 없거나 근거가 필요한 절에는 작성 필요 표시를 둔다.
- 동일 worker note 문구는 중복 제거하고 모든 출처 task ID를 보존한다. 최종 작성자가 근거를 확인해 한국어로 요약한다.
- 누락·빈 값·경로형 명령·명령 체인, flow 부재 및 중복과 서로 다른 note를 회귀 검증한다. 종단 검증은 `npm run ci`다.

## Out of scope
- 후보 2 및 다른 retro 후보, 자동 번역, 근거 없는 전후·영향 내용 생성.

## One-commit justification
두 변경은 같은 retro 후속 작업의 입력과 출력 계약을 한 PR에서 검토하며 각각 독립적인 구현 task와 종단 검증으로 나눈다.
