---
type: bouncer.blueprint
title: repair·rework 경로가 통합된 작업을 다시 돌리지 않도록 수정
description: Keep integrated downstream tasks on repair --resume-task and stop implement loops on rework
resource: .bouncer/context/epics/drive-execution/blueprints/repair-resume-integrity/index.md
tags:
  - bouncer
  - blueprint
  - coordinator
  - repair
  - rework
  - scope
timestamp: '2026-10-20T21:01:49.481+09:00'
bouncer:
  id: repair-resume-integrity
  epic_id: drive-execution
  blueprint_id: repair-resume-integrity
  status: approved
  order: 1
  commit_type: fix
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  attribution: 수용 기준의 중심이 bouncer-run coordinator repair·rework 동작이라 drive-execution 영역이다
  supersedes: []
---
# repair-resume-integrity

Epic: [drive-execution](../../index.md)

## Intent
- `coordinate repair --resume-task`가 지정 task만 재배정하고, 이미 통합된 다른 task를 `pending`으로 되돌리지 않게 함.
- rework 재시도·scope 개정·integration 직접 수정 거절이 drive를 멈추거나 잘못 안내하지 않게 함.

## Contract
- 인터페이스:
  - `bouncer coordinate repair --task <terminal> --resume-task <ddd>`: 지정 task만 lease 회수·salvage·`resumed` 표시한다. 출력 `reset_downstream`은 실제로 `pending`이 된 verification task id만 담는다.
  - `bouncer coordinate next`/`advance`: 현재 attempt 보고 파일이 있으면 HEAD·porcelain이 dispatch 기준과 같아도 `implement`를 돌려주지 않는다.
  - `bouncer coordinate revise`: 직전 승인 scope에 정확히 있던 경로는 bounds 검사에서 면제한다. 새로 추가하는 `.bouncer/`·`.git/`·저장소 밖 경로는 계속 `scope-path-out-of-bounds`다.
  - `integration-source-mutated` 힌트의 `cause`/`next`가 governance 변경을 main에 먼저 커밋하라고 안내한다.
- 데이터·상태: 원장 task `status`·`lease`·`resumed` 갱신 범위가 지정 task와 downstream verification task로 줄어든다. `RepairDecision.reset_downstream` 필드 이름과 타입은 유지한다.
- 수용 기준:
  1. 다중 task(001 → 002 → terminal)에서 001·002가 integrated인 채 terminal이 실패하고 `--resume-task 001`을 기록하면, 002는 `integrated`와 기존 `sha`를 유지하고 001과 terminal만 `pending`이 된다.
  2. resume한 001이 재통합되면 ready wave가 terminal만 연다.
  3. rework attempt 2에서 보고 파일이 쓰였고 worktree가 dispatch 기준과 같으면 `next`는 `implement`가 아닌 다음 단계(`verify` 등)를 낸다.
  4. 승인 scope에 `.bouncer/epics.json`이 있는 task의 revise가 그 경로를 유지한 채 성공한다.
  5. `integration-source-mutated` 힌트의 `cause`/`next`가 governance 변경은 drive 전에 main에 커밋하고, drive 중 변경은 worker task나 `bouncer coordinate repair`로 옮기라고 말한다(`test/coordinator.test.js`가 단언).
- 검증 명령: 각 task의 `bouncer.verify`, 종단은 `npm run ci`.
- 실패 모드·엣지 케이스:
  - `--resume-task` 대상이 terminal·verification·미통합 task이거나 scope 밖 경로면 지금처럼 `resume-task-invalid`/`repair-scope-out-of-bounds`로 거절한다.
  - repair wave 한도(2)를 넘으면 지금처럼 `repair-wave-limit`다.
  - 보고 파일의 `attempt:` 줄이 현재 attempt와 다르거나 파일이 비면 지금처럼 `implement`다.
  - revise에서 승인 경로의 하위 경로(`.bouncer/context/x` 등)는 면제하지 않는다.

## Out of scope
- coordinator 세션 metrics가 알림 전에 닫혀 0으로 기록되는 문제.
- repair wave 한도 변경, `advance` 출력(`next.card`) 접기.
- `integration-source-mutated` guard 완화(허용 경로 확대).

## One-commit justification
- 네 변경 모두 coordinator 드라이브가 이미 통합한 작업을 다시 돌리거나 멈추는 결함이고, 한 PR 리뷰에서 원장 상태 전이를 함께 확인해야 한다.
