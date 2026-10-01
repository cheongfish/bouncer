---
type: bouncer.blueprint
title: explain coordinator 인덱스 축소와 intent sections 거부 정합
description: Write only a task index into explain coordinator frontmatter and return exit 1 intent-task-invalid for a non-canonical intent sections --task
resource: .bouncer/context/epics/082-explain-index-intent-exit/blueprints/001-coordinator-index-sections-exit/index.md
tags:
  - bouncer
  - blueprint
  - explain
  - finalize
  - intent
timestamp: '2026-10-01T15:11:05.501+09:00'
bouncer:
  id: '001'
  epic_id: '082'
  blueprint_id: '001'
  status: closed
  commit_type: fix
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 001 explain coordinator 인덱스 축소와 intent sections 거부 정합

Epic: [082](../../index.md)

## Intent
- explain.md frontmatter의 coordinator 기록을 task 인덱스로 줄여 머신 경로와 decisions 로그가 닫힌 문서에 남지 않게 함.
- intent sections가 비정규 task 경로를 계약대로 exit 1 intent-task-invalid로 거절하게 함.

## Contract
- 인터페이스:
  - explain.md `bouncer.coordinator`는 아래 형태다. 값의 출처는 `buildCoordinatorProvenance` 결과이고 이 함수의 반환 shape는 바뀌지 않는다.
    ```yaml
    coordinator:
      integration_branch: <string|null>
      tasks:
        - id: <string|null>
          branch: <string|null>
          scope_revision: <string|null>
          actual_paths: [<string>...]
    ```
  - `bouncer intent sections --task <path> --role <role>`: `--task` 값이 비어 있지 않으면 파서는 그 값을 받는다. canonical 판정은 `loadExecutionTask`가 하고, 실패하면 exit 1과 stdout JSON `{ ok: false, reason: "intent-task-invalid", cause, next }`다. 이 reason의 `next`는 bundle 재생성이 아니라 canonical 경로 형식을 보여 주는 `bouncer intent sections --task .bouncer/context/epics/<ddd>-<slug>/blueprints/<ddd>-<slug>/tasks/<ddd>/tasks.md --role <요청한 role>`다.
- 데이터·상태: explain frontmatter에서 `base`, `integration_head`, `revision`, `worktrees`, `decisions`, `tasks[].status`, `tasks[].sha`, `tasks[].paths`가 빠진다. 원장, finalize digest `coordinator`, finalize 반환값의 `coordinator`·`worktrees`는 그대로다.
- 수용 기준: epic Success criteria 1–7.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - provenance가 `null`(원장 없음)이면 `writeExplainCoordinator`는 `false`를 돌려주고 explain을 쓰지 않는다.
  - explain.md가 없으면 쓰지 않는다(기존 동작).
  - `actual_paths`가 빈 task도 `actual_paths: []` 키를 유지한다.
  - legacy 원장에서 branch를 못 찾은 task는 `branch: null`로 남는다.
  - `--task`가 절대경로·`..` 포함·비정규 layout이면 모두 exit 1 `intent-task-invalid`다.
  - `--task` 누락, 값 없음, 빈 문자열, 중복은 exit 2 usage다.

## Out of scope
- 닫힌 explain.md 재작성, migrate 명령.
- finalize digest `coordinator`와 `buildCoordinatorProvenance` 반환 shape.
- `intent bundle` 인자 파서(`parseBundleArgs`)의 exit 2 경계.

## One-commit justification
- 두 변경은 source·test·rules 파일이 겹치지 않아 task 커밋 둘로 나눈다. 공유 파일은 `CHANGELOG.md` 하나라서 TASKS-002가 TASKS-001 뒤에 오고(`depends_on`), 종단 `npm run ci` 뒤 blueprint 리뷰 한 번으로 PR 하나가 된다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - explain coordinator 인덱스 축소
* [Tasks 002](tasks/002/tasks.md) - intent sections 비정규 task exit 1
* [Tasks 003](tasks/003/tasks.md) - 종단 CI 검증
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
