---
type: bouncer.blueprint
title: 실패 drive의 부분 마감과 owner task 재개
description: Defines explicit partial finalization and owner-task recovery without converting verification failure to success.
resource: .bouncer/context/epics/partial-finalize-recovery/blueprints/partial-finalize-recovery/index.md
tags:
  - bouncer
  - blueprint
  - partial-finalize
  - partial-merge
  - owner-recovery
timestamp: '2026-10-19T16:08:26.068+09:00'
bouncer:
  id: partial-finalize-recovery
  epic_id: partial-finalize-recovery
  blueprint_id: partial-finalize-recovery
  status: approved
  order: 1
  commit_type: feat
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  supersedes: []
---
# 실패 drive의 부분 마감과 owner task 재개

Epic: [113](../../index.md)

## Intent
- `partial_closed` drive가 실패 증적을 보존하면서 명시 동의에 따라 인계·병합·정리를 마치게 한다.
- in-scope owner task는 새 generation으로 다시 실행하고 downstream 및 terminal verification을 새 결과에 연결한다.

## Contract
- 인터페이스: `bouncer finalize`는 `partial_closed`를 감지해 partial-finalize 상태를 제공한다. partial merge는 `--allow-partial-merge`와 별도 명시 동의가 모두 있을 때만 integration HEAD에 적용하며 `[partial]` 표식과 handoff 참조를 남긴다. `coordinate repair --resume-task`는 새 generation과 fresh checkpoint로 재개한다.
- 데이터·상태: partial close는 main worktree의 `<epic>_<bp>_NEXT_PLAN.md`에 append한다. partial finalize는 ledger를 `partial_closed`로 유지하고, cleanup 전 failure decision·source identity·worktree provenance를 durable 기록으로 남긴다. owner 재개는 salvage 뒤 transitive downstream을 새 owner 결과에 연결한다.
- 수용 기준: Epic 성공 기준 1–7.
- 검증 명령: 구현 task는 task 전용 Node test를, 종단 node는 `npm run ci`를 실행한다.
- 실패 모드·엣지 케이스: confirmation·evidence·source identity·handoff·fresh fence가 없으면 무변경 거절한다. handoff 기존 파일은 `---`와 KST 시각 뒤에 append하며 write 실패는 rollback한다. merge/cleanup 실패는 `closed`나 passed 표기를 만들지 않는다.

## Out of scope
- 성공 evidence 위조 또는 일반 finalize gate 완화
- 사용자 동의 없는 main 병합, pointer 해제, worktree 삭제
- 승인 범위 밖 owner-task 재개

## One-commit justification
- TASKS-001은 partial close handoff·ledger·gate 경계를 닫는다.
- TASKS-002는 partial finalize, 명시적 merge, pointer/worktree lifecycle을 닫는다.
- TASKS-003은 owner generation과 downstream DAG 재개를 닫는다.
- TASKS-004는 통합 head의 전체 CI를 실행한다.

## Explain
[설계 설명](explain.md) — 실패를 성공 처리하지 않는 부분 마감, 명시 동의, owner 재개의 경계를 설명한다.
