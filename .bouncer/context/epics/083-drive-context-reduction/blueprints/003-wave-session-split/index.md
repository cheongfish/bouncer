---
type: bouncer.blueprint
title: wave 단위 coordinator 세션
description: End each coordinator session after its ready wave integrates and let run dispatch a fresh coordinator from the checkpoint
resource: .bouncer/context/epics/083-drive-context-reduction/blueprints/003-wave-session-split/index.md
tags:
  - bouncer
  - blueprint
  - coordinator
  - run
  - token-cost
timestamp: '2026-10-01T16:50:55.131+09:00'
bouncer:
  id: '003'
  epic_id: '083'
  blueprint_id: '003'
  status: closed
  commit_type: feat
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 003 wave 단위 coordinator 세션

Epic: [083](../../index.md)

## Intent
coordinator는 자기가 연 ready wave를 모두 통합한 뒤 남은 task가 있으면 outcome `continue`로 돌아오고, `/bouncer-run`은 새 checkpoint로 다음 coordinator 세션을 띄운다.
한 세션의 문맥이 blueprint 전체가 아니라 wave 하나만큼만 쌓이게 한다.

## Contract
- 인터페이스
  - coordinator Output contract의 **Outcome**은 `continue`, `completed`, `blocked`, `partial_closed` 중 정확히 하나다. `continue`만 non-terminal이다.
  - `continue` 조건: 이번 세션이 prepare로 연 task가 모두 `integrated`이고, 그 뒤 `coordinate status` checkpoint의 `active_tasks`가 비어 있지 않다. 이때 coordinator는 다음 prepare를 하지 않고 Progress, 이번 세션에서 integrated된 task id, `checkpoint.ledger` ref를 돌려준다.
  - `active_tasks`가 비면 같은 세션이 Close(blueprint 최종 리뷰 뒤 `/bouncer-finalize`를 첫 동의 단계까지)로 진행한다.
  - `/bouncer-run` 4단계: coordinator를 한 번에 하나씩 디스패치하고 foreground로 기다린다. outcome이 `continue`이면 `integrationPath`에서 `coordinate status`를 다시 받아, 디스패치 전보다 `checkpoint.completed_tasks` 수가 늘었을 때만 같은 payload에 새 checkpoint를 넣어 새 coordinator를 띄운다. 늘지 않았으면 디스패치하지 않고 `blocked`(원인 `no-progress`)로 보고한다.
- 선행: blueprint 002가 통합된 뒤 실행한다(같은 coordinator 문서와 run 스킬을 고친다).
- 데이터·상태: CLI·원장 형식은 바뀌지 않는다. 새 세션은 bootstrap을 다시 부르지 않고 `coordinate status` checkpoint에서 재개한다.
- 수용 기준: epic Success criteria 5, 6과 7.
- 검증 명령: 구현 task 001은 `npm test`, 종단 task 002는 `npm run ci`.
- 실패 모드·엣지 케이스
  - wave 일부만 integrated(fan-in 거절, revoke 뒤 재배정)이면 `continue`하지 않고 같은 세션이 그 wave를 끝낸다.
  - 세션 중 `blocked`·`partial_closed`면 run이 원장·worktree·pointer를 보존한 채 루프를 멈추고 기존 5단계 형식으로 보고한다.
  - `continue` 뒤 원장 hash가 바뀌어 있으면 새 세션은 기존처럼 `stale-ledger-checkpoint` 거절을 받고 `coordinate status`부터 다시 한다.
  - repair wave가 task를 더하면 그 task는 다음 세션의 `active_tasks`에 나타난다.
  - 종단 verification task가 마지막 wave면 그 세션이 integrate 뒤 Close까지 간다.

## Out of scope
- epic Out of scope 전부.
- `scripts/src/lib/coordinator.ts`와 `bouncer coordinate` 명령. outcome은 coordinator 보고 계약이고 CLI 상태가 아니다.
- `rules/subagent-model.md`, `rules/cursor-print-dispatch.md`의 디스패치 방식.
- wave 안 병렬 실행과 ceiling(repair 2, critical recovery 1) 규칙.
- finalize 위치 변경. closing action은 `active_tasks`가 빈 마지막 coordinator 세션이 맡는다.

## One-commit justification
- 구현 task 001이 coordinator 역할 문서, 생성 TOML, run 스킬, 출력 규칙, 두 문서 계약 테스트, CHANGELOG를 한 커밋으로 바꾼다. coordinator의 반환 조건과 run의 재디스패치 루프는 한쪽만 바뀌면 drive가 멈추거나 이중 디스패치된다.
- 종단 task 002는 통합 뒤 전체 CI만 실행한다.

## Documents
* [001 wave 경계 continue와 run 재디스패치](tasks/001/tasks.md) - coordinator 반환 조건과 run 루프
* [002 종단 검증](tasks/002/tasks.md) - 통합 뒤 전체 CI
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
