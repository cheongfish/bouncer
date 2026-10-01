---
type: bouncer.blueprint
title: coordinate 출력 축소
description: Drop full ledger copies from coordinate CLI stdout and print it as one-line JSON
resource: .bouncer/context/epics/083-drive-context-reduction/blueprints/001-coordinate-output-compaction/index.md
tags:
  - bouncer
  - blueprint
  - coordinator
  - cli
  - token-cost
timestamp: '2026-10-01T16:50:54.895+09:00'
bouncer:
  id: '001'
  epic_id: '083'
  blueprint_id: '001'
  status: closed
  commit_type: feat
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 001 coordinate 출력 축소

Epic: [083](../../index.md)

## Intent
`bouncer coordinate` 성공 응답이 checkpoint와 함께 싣던 원장 전체 `tasks`·`decisions` 사본을 빼고, prepare는 coordinator가 lease를 받아야 하는 task만 `opened[]`로 낸다.
`coordinate` stdout은 성공·실패 모두 한 줄 JSON으로 출력한다.

## Contract
- 인터페이스
  - `bouncer coordinate <sub>` 성공 stdout: `coordinate()` 결과에서 top-level `tasks`·`decisions` 키를 뺀 객체. 그 밖의 키(`checkpoint`, `task`, `decision`, `metadata`, `verification`, `ready`, `integrationPath`, `integrationBranch` 등)는 그대로다.
  - `coordinate prepare` 성공 stdout은 `tasks` 대신 `opened: [{ id, status, workerPath?, branch?, lease? }]`를 낸다. 항목은 결과 `tasks` 중 id가 `ready`에 있거나, `status`가 `integrated`가 아니면서 `lease.status`가 `active`인 task마다 하나이고, 순서는 원장 `tasks` 순서다. 두 번째 조건은 이전 prepare에서 열려 `ready`에 다시 나오지 않는 재개 task의 lease를 넘기기 위한 것이다. integrate는 lease를 revoke하지 않으므로 `integrated` task는 lease가 active여도 넣지 않는다. verification task 항목에는 `workerPath`·`branch`·`lease`가 없다.
  - `coordinate` stdout은 `JSON.stringify(payload)` + `\n` 한 줄이다. 실패(`ok: false`)의 `reason`·`cause`·`next`와 exit code는 바뀌지 않는다.
- 데이터·상태
  - 원장 파일 `.bouncer/runtime/coordinator.json`의 형식과 쓰기 내용은 바뀌지 않는다. 축소는 CLI stdout 투영에서만 하며, 투영 함수는 새 모듈 `scripts/src/lib/coordinate-output.ts`에 둔다.
  - `scripts/src/lib/coordinator.ts`의 `coordinate()`·`projectCheckpoint`·`withCheckpoint` 반환값은 바뀌지 않는다.
- 수용 기준: epic Success criteria 1, 2와 7의 coordinator TOML 부분.
- 검증 명령: 구현 task 001은 `npm test`, 종단 task 002는 `npm run ci`.
- 실패 모드·엣지 케이스
  - coordinator Drive 단계는 `ready`가 아니라 `opened[]`의 commit task를 잇는다. 재개로 들어온 task를 빠뜨리지 않기 위해서다.
  - `ready`가 비고 active lease도 없는 prepare는 `opened: []`다. 재개 prepare는 `ready`가 비어도 이미 prepared된 task를 active lease와 함께 `opened`에 낸다.
  - `coordinate revise` 성공 payload에는 원래 `tasks`·`decisions`가 없으므로 한 줄 형식만 바뀐다. revise 거절은 지금처럼 stderr 한 줄과 exit 1이다.
  - fence 누락·`ledger-checkpoint-invalid`처럼 `coordinate()` 호출 전에 내는 `ok: false`도 한 줄 JSON이다.
  - `coordinate` 밖 명령의 stdout은 2칸 들여쓰기를 유지한다.

## Out of scope
- epic Out of scope 전부.
- `scripts/src/lib/coordinator.ts`. 반환 객체와 원장 쓰기는 손대지 않는다.
- coordinate 하위 명령 추가·삭제, argv와 usage 문자열 변경.

## One-commit justification
- 구현 task 001이 CLI 투영, CLI 테스트, coordinator 역할 문서의 prepare 서술, 생성 TOML, `rules/cli.md`, CHANGELOG를 한 커밋으로 바꾼다. 출력 형식과 그것을 읽는 지침이 함께 바뀌어야 drive가 깨지지 않는다.
- 종단 task 002는 통합 뒤 전체 CI만 실행한다.

## Documents
* [001 coordinate 출력 투영](tasks/001/tasks.md) - CLI stdout에서 원장 사본을 빼고 한 줄 JSON으로 낸다
* [002 종단 검증](tasks/002/tasks.md) - 통합 뒤 전체 CI
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
