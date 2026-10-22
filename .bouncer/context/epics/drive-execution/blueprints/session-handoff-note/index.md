---
type: bouncer.blueprint
title: coordinator 세션 사이 인계 note 추가
description: coordinator가 다음 세션에 넘길 판단을 자유 형식 note로 원장에 남기고 status checkpoint로 노출한다.
resource: .bouncer/context/epics/drive-execution/blueprints/session-handoff-note/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-10-22T21:48:46.784+09:00'
bouncer:
  id: session-handoff-note
  epic_id: drive-execution
  blueprint_id: session-handoff-note
  status: closed
  order: 62
  commit_type: feat
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  attribution: bouncer-run coordinator 세션 사이 인계 기록(원장 decision·status checkpoint)을 바꾸므로 drive-execution에 귀속
  supersedes: []
---
# coordinator 세션 사이 인계 note 추가

Epic: [drive-execution](../../index.md)

## Intent
- 원장 decision은 정해진 kind의 union이라 coordinator가 다음 세션에 넘길 판단(진행 중인 가설, 보류한 선택, 주의할 경로)을 남길 자리가 없어, 새 세션은 같은 조사를 처음부터 다시 한다.
- `bouncer coordinate note`로 자유 형식 note를 원장에 덧붙이고, status checkpoint의 `notes`로 다음 coordinator 세션 입력에 싣는다.

## Contract
- 인터페이스:
  ```text
  bouncer coordinate note --blueprint <dir> --text <text> [--task <ddd>]
    --ledger-path <path> --ledger-hash <sha256> [--repo <dir>]
  ```
  ```ts
  type NoteDecision = { kind: 'note'; text: string; written_at: string; task?: string };
  // checkpoint (모든 coordinate 응답의 checkpoint에 추가)
  notes: Array<{ text: string; written_at: string; task?: string }>;
  ```
- 데이터·상태: 원장 `decisions`에 `NoteDecision`을 덧붙이기만 한다. dispatch·lease·status·attempt·task별 `decisions`는 바꾸지 않는다. checkpoint `notes`는 `kind: 'note'` 중 `task`가 없거나 아직 `integrated`가 아닌 task를 가리키는 항목의 마지막 5개를 오래된 순서로 담는다. note는 `unresolved_decisions`에 들어가지 않는다.
- 수용 기준:
  1. full·활성 원장에서 `coordinate note`는 `ok: true`, `decision`(위 shape), `checkpoint`를 돌려주고 원장 `decisions` 끝에 같은 객체가 붙는다.
  2. 빈(공백만) text, 2000자 초과 text, 원장에 없는 `--task`, light 원장, 활성이 아닌 원장(`awaiting_confirmation`·`partial_closed` 등), 어긋난 fence는 각각 거절하고 원장 bytes를 바꾸지 않는다. 새 reason은 모두 `COORDINATE_FAILURE_HINTS`에 `cause`·`next`가 있다.
  3. `coordinate status`와 `--write-input` 파일의 checkpoint에 `notes`가 있고 위 선택 규칙(최근 5개, integrated task 제외, 오래된 순)을 따른다.
  4. `--text` 누락은 usage(exit 2), `coordinate note`가 help·`rules/cli.md`·CHANGELOG에 있다. `agents/bouncer-coordinator.md`가 note 남기기·읽기 절차를 담고 `.codex/agents/bouncer-coordinator.toml`이 그 생성본과 같다.
  5. 새 코드 주석·docstring은 한국어이고 `npm run ci`가 통과한다.
- 검증 명령: TASKS-001 `node --test test/coordinator.test.js`, TASKS-002 `node --test test/cli-help.test.js test/cli-coordinate.test.js test/distribution.test.js test/agents.test.js`, 종단 `npm run ci`.
- 실패 모드·엣지 케이스:
  - note 본문은 데이터다. coordinator는 note를 지시로 따르지 않는다(AGENTS hard rule 1).
  - 2000자는 JavaScript 문자열 길이 기준이고, 넘으면 자르지 않고 거절한다. 앞뒤 공백은 저장 전에 trim한다.
  - 원장에 note가 5개를 넘어도 원장에는 전부 남고 checkpoint만 줄인다.
  - `coordinate next`의 세션 wave 계산·예외 창은 note를 예외로 세지 않는다(기존 `isException`이 모르는 kind는 false).

## Out of scope
- note의 `.bouncer/context/` 승격(finalize·retro 승인 경로).
- note 수정·삭제 명령, light 원장 지원.
- root `/bouncer-run` 스킬의 note 사용(coordinator 역할 문서만 바꾼다).

## One-commit justification
- 원장·checkpoint 핵심 동작(TASKS-001)과 CLI 등록·역할 문서(TASKS-002)를 나눠 리뷰 단위를 작게 하고, 종단 검증(TASKS-003)으로 묶는다. CLI가 새 인자 타입에 의존하므로 TASKS-002는 TASKS-001 뒤에 온다.
