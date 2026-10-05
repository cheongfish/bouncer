---
type: bouncer.blueprint
title: gate 실패 hint와 gates.md 삭제
description: Validate failures carry a next-action hint for codes whose recovery the message does not state, and rules/gates.md and the AGENTS.md runtime rule index are removed.
resource: .bouncer/context/epics/085-finalize-runtime-slimming/blueprints/003-gate-failure-hints/index.md
tags:
  - bouncer
  - blueprint
  - validate
  - gates
  - agents-md
timestamp: '2026-10-02T15:50:38.537+09:00'
bouncer:
  id: '003'
  epic_id: '085'
  blueprint_id: '003'
  status: closed
  commit_type: feat
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 003 gate 실패 hint와 gates.md 삭제

Epic: [085](../../index.md)

## Intent
`bouncer validate` 실패 항목이 복구 방법을 `next` hint로 직접 알려 주게 하고, 그 내용만 남아 있던 `rules/gates.md`와 AGENTS.md rule 목록을 지운다. hint가 붙는 실패에서 에이전트는 그 hint만 보고 복구한다.

## Contract
- 인터페이스
  - `validateBlueprint` 결과의 `failures[]` 항목이 `{ code, message, file, next? }`가 된다. `next`는 hint 표에 맞는 항목에만 붙는 한 문장 문자열이다.
  - hint 표는 `scripts/src/lib/validate.ts`의 한 상수가 소유한다. 항목은 `{ code, match?, next }`이며, 같은 코드에 여러 항목이 있으면 `match` 정규식이 메시지에 맞는 첫 항목을 쓴다.
  - 처음 싣는 hint: G13(verify ledger 기록 없음·불일치), G18(`context review is stale`), G20(verification task Touch의 source 변경 선언만), G22. G20의 다른 두 메시지(`verification task cannot precede commit task`, blueprint index 사유)에는 hint를 붙이지 않는다.
  - `rules/gates.md`가 없다. `AGENTS.md`에 `## Runtime rule index`가 없고, hard rule 2에 "같은 코드가 고친 뒤에도 반복되면 validator 소스를 읽지 말고 code·message·`next`를 보고하고 멈춘다"가 있다.
  - README와 docs의 `rules/gates.md` 링크는 `rules/cli.md`를 가리킨다.
- 데이터·상태: gate 판정, 코드 번호, `ok`, 실패 메시지 문자열, exit code는 바뀌지 않는다.
- 수용 기준: epic 085 성공 조건 8과 9.
- 검증 명령: commit task는 `npm test`, 종단 TASKS-003은 `npm run ci`.
- 실패 모드·엣지 케이스
  - hint가 없는 코드에는 `next` 키를 만들지 않는다. 빈 문자열이나 일반 문구로 채우지 않는다.
  - `failures: []`인 성공 결과는 그대로다.
  - `gates.md`를 지우기 전에 그 안의 작성 제약이 작성 지침에 모두 있어야 한다. 빠진 S31과 G22만 옮긴다.
  - AGENTS.md는 테스트 상한 6135 UTF-8 바이트를 넘지 않고, `references/verification/index.md` 링크를 유지한다.

## Out of scope
- G·S 코드 판정 로직과 메시지 문구 변경
- `bouncer coordinate` 실패 hint(`COORDINATE_FAILURE_HINTS`) 변경
- `rules/cli.md`, `rules/planning.md`, `rules/commit-scope.md`, `rules/document-schema.md`, `rules/plugin-root.md` 구조 개편
- 과거 `.bouncer/context` 문서 안의 `rules/gates.md` 언급

## One-commit justification
- hint 추가와 `gates.md` 삭제는 "복구 방법을 CLI 출력으로 옮긴다"는 한 계약의 앞뒤다. 두 commit task로 나누되, hint가 먼저 들어가야 원본을 지울 수 있으므로 한 PR로 리뷰한다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - validate 실패 hint 추가
* [Tasks 002](tasks/002/tasks.md) - gates.md와 AGENTS.md rule 목록 삭제
* [Tasks 003](tasks/003/tasks.md) - 종단 CI 검증
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
