---
type: bouncer.epic
title: 실패 drive의 부분 마감과 복구
description: Adds partial finalization and owner task recovery for failed Bouncer drives.
resource: .bouncer/context/epics/113-partial-finalize-recovery/index.md
tags:
  - bouncer
  - epic
  - partial-finalize
  - recovery
timestamp: '2026-10-19T16:08:18.369+09:00'
bouncer:
  id: '113'
  epic_id: '113'
  status: approved
  supersedes: []
---
# 실패 drive의 부분 마감과 복구

## Intent
- 문제: 실패한 drive는 `partial_closed` 뒤에 인계·선택 병합·정리 경로가 없어 worktree와 pointer를 점유한다.
- 목표: 실패를 성공으로 바꾸지 않고 명시 동의 기반 partial finalize와 owner task 재개를 제공한다.

## Success criteria
1. 사용자 확인 전에는 실패 drive의 상태·pointer·worktree가 바뀌지 않고, 확인 뒤에도 `closed`나 성공 verification으로 표기되지 않는다.
2. partial close는 main worktree의 `<epic-id>_<blueprint-id>_NEXT_PLAN.md`에 실패·source identity·owner·복구 범위·보존 경로를 기록하며, 기존 파일에는 `---`와 KST 오프셋 시각 뒤에 append한다.
3. partial finalize는 ledger decision·사용자 확인·handoff를 검증하고 일반 finalize 성공 gate와 상호 배타적이다.
4. `--allow-partial-merge`와 별도 동의가 없으면 main을 바꾸지 않으며, 허용된 partial merge는 integration HEAD와 `[partial]` 표식을 사용한다.
5. partial finalize는 pointer와 worktree를 정리하되 failure evidence·handoff·Git provenance를 보존한다.
6. owner task 재개는 승인된 범위와 source identity를 확인하고 새 generation·salvage·downstream 재연결을 사용한다.
7. 관련 테스트와 `npm run ci`가 통과한다.

## Out of scope
- 실패 verification을 성공 evidence로 대체하는 동작
- 사용자 동의 없는 main 병합, pointer 해제, worktree 삭제
- repair-wave 한도나 승인 범위를 우회하는 partial close

## Blueprints
* [부분 마감과 owner task 재개](blueprints/001-partial-finalize-recovery/index.md) - coordinator, finalize, gate와 CLI에 실패 인계·부분 마감·재개 계약을 연결한다.
* [lint baseline 정리](blueprints/002-lint-baseline-cleanup/index.md) - `npm run ci`의 lint 단계를 막는 eslint 오류 35개를 동작 변경 없이 정리하고 implementer에 120자 한도 규칙을 추가한다.
