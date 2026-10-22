---
type: bouncer.blueprint
title: outside_scope로 닫은 drive도 release-main 정리 허용
description: outside_scope로 분류한 terminal 실패만 남은 drive를 release-main이 정리하고, drive-not-closed 거절에 이유와 복구 방법을 싣는다.
resource: .bouncer/context/epics/finalize-closeout/blueprints/release-main-outside-scope/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-10-22T21:45:20.438+09:00'
bouncer:
  id: release-main-outside-scope
  epic_id: finalize-closeout
  blueprint_id: release-main-outside-scope
  status: closed
  order: 19
  commit_type: feat
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  attribution: bouncer-finalize 정리 단계(release-main)의 drive 닫힘 판정을 바꾸므로 finalize-closeout에 귀속
  supersedes: []
---
# outside_scope로 닫은 drive도 release-main 정리 허용

Epic: [finalize-closeout](../../index.md)

## Intent
- `finalize --yes`는 `outside_scope`로 분류한 terminal 실패를 완료로 보고 blueprint를 닫는데, `finalize release-main`은 같은 drive를 `drive-not-closed`로 거절해 worktree 정리와 다음 blueprint handoff가 끊긴다.
- `release-main`이 `finalize`와 같은 `validOutsideScope` 판정으로 그 terminal을 미완료에서 빼고, 거절할 때는 이유·복구 방법·미통합 task를 함께 돌려주게 한다.

## Contract
- 인터페이스:
  ```ts
  // finalize release-main 성공 payload (추가 필드만)
  type ReleaseMainOk = { ok: true; /* 기존 필드 */ outside_scope?: {
    task: string; evidence_id: string; reason: string } };
  // drive-not-closed 거절 (추가 필드만)
  type DriveNotClosed = { ok: false; reason: 'drive-not-closed';
    cause: string; next: string; tasks: string[] };
  ```
- 데이터·상태: 원장·문서 스키마는 바꾸지 않는다. `outside_scope` terminal은 원장에서 `verifying`으로 남고, 정리 뒤 integration worktree와 함께 원장이 지워진다(증적은 PR 본문·finalize digest에 남는다).
- 수용 기준:
  1. 원장 `status`가 `awaiting_confirmation`·`partial_closed`가 아니고, `integrated`가 아닌 task가 `validOutsideScope`가 인정한 terminal 하나뿐이면 `release-main`은 `ok: true`이고 payload에 `outside_scope`(task·evidence_id·reason)가 있다.
  2. `validOutsideScope`가 null을 돌려주는 분류(소스 이동, evidence 불일치, paths 비어 있음 등)이거나 다른 task가 미통합이면 지금처럼 `drive-not-closed`다.
  3. `drive-not-closed` 응답은 언제나 비어 있지 않은 `cause`·`next`와 미통합 task id 배열 `tasks`를 갖는다. `tasks`는 원장 `status`와 무관하게 `validOutsideScope`로 분류되지 않은 미통합 task id를 정렬한 배열이다(모두 통합된 `partial_closed`·`awaiting_confirmation`이면 `[]`).
  4. `skills/bouncer-finalize/references/cleanup-handoff.md`와 `rules/cli.md`가 위 동작을 설명하고, CHANGELOG `[Unreleased]`에 항목이 있다.
  5. 새 코드 주석·docstring은 한국어이고 `npm run ci`가 통과한다.
- 검증 명령: TASKS-001 `node --test test/finalize-release-main.test.js`, 종단 `npm run ci`.
- 실패 모드·엣지 케이스:
  - `awaiting_confirmation`·`partial_closed` 원장은 `outside_scope`가 있어도 거절한다(partial merge 플래그 경로는 그대로).
  - commit task가 하나라도 미통합이면 `outside_scope`와 무관하게 거절한다.
  - 원장이 없는 단독 drive와 `blueprint-not-closed`·`coordinator-ledger` 판정은 바뀌지 않는다.
  - 거절은 메인 트리와 porcelain을 바꾸지 않는다(기존 보장 유지).

## Out of scope
- 원장·실패 증적 사본 보존(정리 시 원장은 worktree와 함께 지운다).
- `finalize-checks.ts`·finalize digest·`validOutsideScope` 판정 자체의 변경.
- `drive-not-closed` 이외 reason에 hint를 붙이는 일.
- `partial_closed` partial merge 경로의 동작 변경.

## One-commit justification
- 판정·응답 변경과 그 설명 문서가 같은 동작 하나를 이루므로 구현 commit task 하나와 종단 검증으로 충분하다.
