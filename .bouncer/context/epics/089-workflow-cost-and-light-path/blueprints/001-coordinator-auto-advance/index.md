---
type: bouncer.blueprint
title: coordinator 연쇄 실행과 판단 문맥 제한
description: Add a coordinate advance command that chains deterministic next actions and trim what the coordinator model receives at judgment points.
resource: .bouncer/context/epics/089-workflow-cost-and-light-path/blueprints/001-coordinator-auto-advance/index.md
tags:
  - bouncer
  - blueprint
  - coordinator
  - cli
  - token-cost
timestamp: '2026-10-09T21:12:43.205+09:00'
bouncer:
  id: '001'
  epic_id: '089'
  blueprint_id: '001'
  status: closed
  commit_type: feat
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 001 coordinator 연쇄 실행과 판단 문맥 제한

Epic: [089](../../index.md)

## Intent
- 문제: coordinator는 `coordinate next`로 행동을 조회하고 `argv`를 실행하는 왕복을 매번 모델 턴으로 거치며, 응답마다 아홉 장의 카드 본문 중 해당 카드 전문을 다시 받는다.
- 완료 조건: 판단 없이 실행할 수 있는 행동은 `coordinate advance`가 CLI 안에서 이어 가고, 모델은 정지 지점의 판단 대상만 받는다.

## Contract
- 인터페이스: `bouncer coordinate advance --blueprint <dir> [--task <NNN>] [--max-steps <n>]`. 한 줄 JSON을 낸다. 성공(exit 0)은 `{ ok: true, executed: [{action, task?, exit}], stop: { reason, next } }`, 실패(exit 1)는 `{ ok: false, reason, cause, next, executed }`다. `stop.next`는 정지 시점의 `coordinate next` 응답이다.
- 정지 사유(`stop.reason`, ok: true): `judge`(판단 필요), `worker`(worker 위임 필요, light 원장의 inline 구현 포함), `blocked`, `done`, `none`, `max-steps`. 실패 reason(ok: false): `repeated-failure`(재시도 대상 stale reason이 같은 행동에서 다시 발생), `unclear-result`(JSON이 아닌 stdout 또는 종료 코드 0·1 밖), `advance-argv-invalid`, 그리고 자동 행동이 낸 실패 reason 그대로.
- 데이터·상태: `advance`는 상태를 직접 쓰지 않는다. 각 행동의 `argv`가 기존 명령으로 원장을 바꾸고, 매 단계 `next`를 다시 불러 최신 fence를 쓴다. 판단 응답의 `card`는 유지하되 `payload.report`(판단 대상 보고서 요약)와 `evidence`(경로·hash 포인터)를 싣고, 완료 task 본문·원장 전체는 싣지 않는다.
- 수용 기준: 위 정지 사유마다 테스트가 있고, 판단 응답이 `payload.report`·`payload.evidence`(이번에 추가, 기존 `payload.previous_outcome`은 `payload.report`로 대체)를 싣고 `completed_tasks`·`decisions`·`tasks` 키가 없다는 것을 회귀 가드로 고정하며, coordinator 문서의 Procedure가 `advance` 반복이다.
- 검증 명령: `npm run build && node --test test/coordinate-advance.test.js test/coordinate-next.test.js test/cli-coordinate.test.js test/cli-help.test.js test/distribution.test.js test/agents.test.js test/skill-bouncer-surface.test.js`
- 실패 모드·엣지 케이스: 실행한 `argv`가 `ok: false`를 내면 그 응답을 그대로 돌려주고 멈춘다. 예외로 `stale-ledger-checkpoint`·`stale-integration-head`는 `next`를 다시 불러 한 번만 재실행하고, 같은 행동에서 같은 reason이 다시 나오면 `repeated-failure`로 코드·메시지·`next`를 보고하고 멈춘다. `drive_tasks`는 `argv`가 없으므로 `worker` 정지로 처리한다. `commit` 행동은 `--yes` 커밋이므로 `next`가 `verify`·`review` 단계를 끝낸 뒤 `commit`을 줄 때만 실행되고, `advance`는 `judge`가 있는 `review`에서 멈춰 `commit`을 직접 호출하지 않는다. `advance`가 자동으로 실행하는 행동은 `prepare`·`integrate`·`verification_node`·`verify`·`commit`뿐이다.

## Out of scope
- `coordinate next` 판단 규칙, 카드 내용의 의미 변경, 리뷰 상한 규칙 변경.
- `coordinate status`의 `checkpoint` 필드 축소(epic 076 계약 유지).
- worker 디스패치 payload 형식, 벤치마크.

## One-commit justification
- 새 명령 하나와 그 응답 계약, 이를 쓰도록 바뀌는 coordinator 문서가 한 리뷰 단위다. task 001이 명령을, task 002가 판단 문맥과 문서를 맡고 둘은 한 PR로 리뷰한다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - `coordinate advance` 명령
* [Tasks 002](tasks/002/tasks.md) - 판단 문맥 제한과 coordinator 문서
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
