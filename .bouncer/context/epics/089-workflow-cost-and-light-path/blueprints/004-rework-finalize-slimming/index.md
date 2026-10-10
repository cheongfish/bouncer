---
type: bouncer.blueprint
title: 재작업 분류와 finalize 입력 축소
description: Close in-scope test supplements found by final review through an in-place fix and one delta review, and give finalize a diff summary and evidence references so it stops re-reading history.
resource: .bouncer/context/epics/089-workflow-cost-and-light-path/blueprints/004-rework-finalize-slimming/index.md
tags:
  - bouncer
  - blueprint
  - repair
  - finalize
  - review
timestamp: '2026-10-09T21:12:43.205+09:00'
bouncer:
  id: '004'
  epic_id: '089'
  blueprint_id: '004'
  status: closed
  commit_type: feat
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 004 재작업 분류와 finalize 입력 축소

Epic: [089](../../index.md)

## Intent
- 문제: 최종 리뷰가 테스트 근거 보완만 요구해도 새 repair task가 만들어져 dispatch → implement → verify → review 전체를 다시 돌고 repair wave 한도를 쓴다. finalize는 diff 전체와 이력을 모델이 다시 읽어 퀴즈와 설명을 만든다.
- 완료 조건: 범위 내 테스트 보완은 제자리 수정과 검증, 독립 delta review 한 번으로 닫히고, finalize는 diff 요약과 증거 참조만으로 설명 근거를 얻는다.

## Contract
- 인터페이스: `bouncer coordinate repair --blueprint <dir> --kind supplement --review-finding <id>... --summary <text> --paths <p> --decision <reason>`. `--kind`가 없으면 기존 repair(`product`)다. `supplement`는 모든 `--paths`가 테스트 경로(첫 조각이 `test`·`tests`이거나 파일명이 `*.test.*`·`*.spec.*`, `fixtures` 조각이 있는 경로 제외)이고 이미 integrated된 task의 `affected_paths` 안일 때만 허용된다. `coordinate repair --kind supplement --done --blueprint <dir> --summary <text>`는 보완 완료를 선언하고 관련 verify를 실행한다. `coordinate next`는 `supplement` 행동(카드 `supplement`)을 낸 뒤 검증이 통과하면 `final_review`를 `payload.mode: 'delta'`로 낸다. `bouncer finalize prepare` 응답은 `version: 2`이고 `diff: { files, insertions, deletions, per_file: [{path, added, deleted}] } | null`와 `evidence: { verification: [{task, evidence_id}], review: { path, rounds, target_digest } | null }`를 더한다(`rounds`는 라운드 수, `target_digest`는 마지막 라운드의 digest).
- 데이터·상태: `supplement` 결정은 `ledger.decisions`에 `{ kind: 'supplement', outcome: 'pending'|'done'|'verified', paths, findings }`로 남고 새 task도 `terminalFailure`도 만들지 않는다. repair wave 한도 검사 앞에서 처리하므로 wave를 쓰지 않고 한도가 찬 뒤에도 접수된다. 최종 리뷰당 한 번만 가능하며 delta 라운드가 이미 있으면 `supplement-delta-used`로 거부해 기존 repair 경로로 간다. 전이: `pending`(next → `supplement`) → `--done`이 integration 변경 경로가 `paths` 안임을 확인하고 관련 verify(해당 경로를 포함한 integrated task의 `verify`를 중복 없이)를 실행해 통과하면 `verified`(next → delta `final_review`), 실패하면 `done`에 두고 `supplement-verify-failed`. 범위·인터페이스·제품 동작 변경은 기존 repair 또는 `blocked`를 따른다.
- 수용 기준: 에픽 Success criteria 9·10.
- 검증 명령: `npm run build && node --test test/coordinator.test.js test/coordinate-next.test.js test/cli-coordinate.test.js test/cli-help.test.js test/agents.test.js test/distribution.test.js test/finalize-digest.test.js test/finalize-pr.test.js test/finalize.test.js test/skill-bouncer-finalize.test.js`
- 실패 모드·엣지 케이스: 테스트 파일만 바꾼다고 보완으로 분류하지 않는다(경로 조건과 finding 성격을 함께 coordinator가 선언하고 CLI는 경로를 검증). 같은 실패 코드가 연속으로 나오면 기존대로 멈춘다. 이해 확인·잔여 처리·PR 동의는 자동 통과하지 않는다. numstat이 실패하면 `diff: null`, 리뷰 기록이 없으면 `evidence.review: null`, 검증 증거가 없으면 `evidence.verification: []`로 두고 digest를 실패시키지 않는다.

## Out of scope
- repair wave 한도(2), 리뷰 상한(discovery·fix·delta 각 1회), `must_fix` 판정 규칙 변경.
- finalize 동의 ACQ 순서, light quiz 정책, PR 템플릿 섹션 구조.
- 이미 published된 과거 digest 호환 변환.

## One-commit justification
- 두 task는 모두 "이미 있는 증거를 다시 읽히지 않는다"는 같은 목적이며 digest 버전과 리뷰 증거 참조가 서로 맞물린다. 한 PR로 리뷰한다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 테스트 보완 제자리 수정과 delta review
* [Tasks 002](tasks/002/tasks.md) - finalize digest 요약·증거 참조
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
