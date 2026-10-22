---
type: bouncer.blueprint
title: 실패한 terminal 검증만 다시 실행하는 coordinate reverify 추가
description: Add coordinate reverify to rerun a failed terminal verification after an environment fix without spending a repair wave
resource: .bouncer/context/epics/drive-execution/blueprints/terminal-reverify/index.md
tags:
  - bouncer
  - blueprint
  - coordinator
  - terminal-verification
  - repair-wave
timestamp: '2026-10-22T18:16:23.192+09:00'
bouncer:
  id: terminal-reverify
  epic_id: drive-execution
  blueprint_id: terminal-reverify
  status: closed
  order: 61
  commit_type: feat
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  attribution: coordinator terminal 검증 재실행은 bouncer-run 단계 동작이라 drive-execution에 귀속
  supersedes: []
---
# 실패한 terminal 검증만 다시 실행하는 coordinate reverify 추가

Epic: [drive-execution](../../index.md)

## Intent
- 환경만 고치면 통과할 terminal 검증 실패도 지금은 repair wave를 쓰거나 `outside_scope`로 분류해야만 진행할 수 있다.
- `bouncer coordinate reverify --task <terminal>`이 같은 HEAD에서 terminal 검증만 다시 실행하고 repair wave는 쓰지 않게 한다.

## Contract
- 인터페이스: `bouncer coordinate reverify --task <terminal id>` 서브커맨드. `integrate`와 같은 fence 플래그를 받는다.
  `coordinate next`의 `terminal-verification-failed`·`repair-wave-limit` blocked 응답과 `blocked.md` 카드가 reverify를 선택지로 안내한다. `advance`는 reverify를 자동 실행하지 않는다.
- 데이터·상태:
  - 통과: terminal `verifying` → `integrated`, `verify_evidence_id` 기록. `terminalFailure`는 이력으로 남긴다. 원장 `status`가 `awaiting_confirmation`이면 `active`로 되돌린다.
  - 실패: integrate 실패와 같은 규칙으로 새 `FailureEvidence`(`command`·`summary`·`paths`·`exitCode`·`repairWave`·`evidence_id`·`source_digest`)를 만들어 `terminalFailure`를 덮는다. `repairWave`는 현재 `repairWaves.length`이고, 덮으면서 `disposition`(`outside_scope`)이 사라진다. `repairWaves`와 원장 `status`는 그대로다.
  - 거절: 원장·task 문서를 바꾸지 않는다.
- 수용 기준:
  1. `terminalFailure`가 기록된 `verifying` terminal에 reverify를 실행하면 검증 명령이 다시 실행되고 `repairWaves.length`는 바뀌지 않는다.
  2. 통과하면 terminal은 `integrated`, `terminalFailure`는 남고, `awaiting_confirmation`이던 원장은 `active`가 된다.
  3. 실패하면 `terminalFailure`가 새 증거로 바뀌고 기존 `outside_scope` 분류는 사라진다.
  4. integration HEAD가 `terminalFailure.source_digest`와 다르면 `reverify-source-moved`, 작업 트리에 terminal 증적 문서(integrate 검증 경로가 쓰는 `<blueprint>/tasks/<terminal>/tasks.md`·`<blueprint>/tasks/<terminal>/verification.md`·`<blueprint>/verification.md`) 밖의 변경이 있으면 `reverify-worktree-dirty`로 거절한다. 두 거절 모두 `cause`·`next`를 담고 `next`는 repair 경로를 안내한다. 실패 직후처럼 terminal 증적 문서만 바뀐 작업 트리는 받는다.
  5. terminal이 아니거나 `terminalFailure`가 없는 task는 거절한다.
  6. `coordinate next` blocked 응답과 `blocked.md` 카드가 reverify를 선택지로 보여 준다.
  7. 서브커맨드 목록 테스트·help·`rules/cli.md`·CHANGELOG `[Unreleased]`가 갱신되고 `npm run ci`가 통과한다.
- 검증 명령: `npm run ci` (terminal task `TASKS-003`)
- 실패 모드·엣지 케이스:
  - 검증 실행 중 원장이 바뀌면 phase 2 checkpoint 불일치로 거절하고 결과를 기록하지 않는다.
  - 의존성 설치가 실패하면 `dependency-install-failed`를 반환하고 상태를 바꾸지 않는다(사전 조건 거절이 아니라 실행 중 실패다).
  - 원장 잠금 경합은 `ledger-locked`·`ledger-lock-lost`로 거절한다.
  - 같은 terminal에 reverify를 여러 번 실행해도 횟수 제한은 없고, 실행마다 새 증거가 남는다.

## Out of scope
- terminal 실패를 검증 없이 풀어 주는 명령
- `REPAIR_WAVE_LIMIT` 값 변경
- `coordinate advance`가 reverify를 자동 실행하는 것
- 기존 `repair`·`--resume-task`·`--disposition outside_scope` 동작 변경

## One-commit justification
- 하나의 PR로 묶는다. TASKS-001(coordinator 동작)과 TASKS-002(CLI 등록·문서)는 경로가 겹치지 않아 병렬로 실행하고, TASKS-003이 둘을 기다려 전체 CI를 확인한다.
