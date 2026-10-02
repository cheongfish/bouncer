---
type: bouncer.blueprint
title: finalize 메인 사본 정리와 pointer 자동 이동
description: Add finalize release-main to delete closed blueprint plan copies from main, drop coordinate release, and make finalize cleanup force-remove worktrees and auto-set the next blueprint.
resource: .bouncer/context/epics/084-drive-plan-copy-hygiene/blueprints/001-finalize-main-release/index.md
tags:
  - bouncer
  - blueprint
  - finalize
  - worktree
  - current-pointer
timestamp: '2026-10-02T12:23:54.328+09:00'
bouncer:
  id: '001'
  epic_id: '084'
  blueprint_id: '001'
  status: closed
  commit_type: feat
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 001 finalize-main-release

Epic: [084](../../index.md)

## Intent
finalize가 메인에 남은 닫힌 blueprint 사본을 직접 지운 뒤 worktree를 강제로 제거하게 해 병합 overwrite를 없앰.
같은 epic의 다음 blueprint가 메인에 준비돼 있으면 묻지 않고 pointer를 옮기고 결과만 알림.

## Contract
- 인터페이스:
  - `bouncer finalize release-main --blueprint <dir> [--repo <main>]`(신규): 메인 checkout에서만 실행한다. 닫힌 blueprint 트리의 메인 사본을 정리하고 같은 epic의 다음 blueprint를 돌려준다. 성공 exit 0, 거절 exit 1(JSON `reason`), `--blueprint` 누락 exit 2.
  - `bouncer coordinate release`: 삭제. command 목록·fence 목록·usage·실패 힌트에서 빠지고 호출은 기존 unknown command 경로(exit 2)를 탄다.
  - finalize 스킬: `finalize.remainder`는 A) `--yes` 커밋, C) 수정, D) 취소만 남는다. 4단계는 `release-main` 성공 뒤 `worktrees` 전부를 `git worktree remove --force`로 지운다. 5단계는 `release-main`의 `next`로 `bouncer current --set`을 질문 없이 실행한다. `finalize.next_blueprint` ACQ는 없다.
- 데이터·상태: 성공 payload는 아래 모양이다. 원장 `seedManifest` 필드와 `releaseSeedManifest`는 유지하고, `release-main`이 epic·context `index.md` 두 항목에만 쓴다.
  ```ts
  type ReleaseMainResult = {
    ok: true; blueprint: string;
    removed: string[];   // 지운 파일: blueprint 트리의 미추적·staged 신규 + manifest로 삭제된 index
    restored: string[];  // HEAD로 되돌린 파일 (트리 안 수정 tracked + index 복원)
    preserved: string[]; // manifest와 해시가 달라 둔 index 파일
    next: { blueprint: string } | null; // 메인 기준 같은 epic 첫 ready blueprint
  };
  // 거절: { ok: false, reason: 'release-main-requires-main-checkout'
  //   | 'blueprint-not-closed' | 'drive-not-closed' | 'invalid-blueprint-path'
  //   | 'coordinator-ledger' }
  ```
- 수용 기준: epic 성공 기준 1–7, 11.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - worktree를 지우기 전에는 두 번 실행해도 같은 결과로 수렴한다. worktree 제거 뒤처럼 원장이 없고 메인에 blueprint 디렉터리도 없으면 닫힘 판정 없이 `removed: []`로 성공한다(지울 것이 없다).
  - 원장에 `seedManifest`가 없으면(구 원장) epic·context `index.md`는 건드리지 않고 `preserved`에 담는다. blueprint 트리 정리는 그대로 한다.
  - 닫힘 판정 근거는 원장이 있으면 integration 사본 `index.md`, 없으면 단독 execute worktree(`worktreePathFor`) 사본, 둘 다 없으면 메인 `HEAD`의 `index.md`다. 어느 것도 `closed`가 아니면 `blueprint-not-closed`다.
  - 원장이 `awaiting_confirmation`·`partial_closed`이거나 `integrated`가 아닌 task가 있으면 `drive-not-closed`다. 원장이 손상됐으면 `coordinator-ledger`다. 어느 거절도 파일을 바꾸지 않는다.
  - blueprint 인자가 `.bouncer/context/epics/<epic>/blueprints/<bp>` 정규형이 아니면(`..`, 절대 경로, 다른 루트) `invalid-blueprint-path`다.
  - sibling blueprint, epic·context `index.md` 외 공유 파일, source는 건드리지 않는다.
  - `next` 후보가 plan gate에 막히면 스킬은 pointer를 비운 채 거절 내용을 알리고 다른 후보를 시도하지 않는다.

## Out of scope
- `finalize --yes` 자체의 커밋·잠금·task 문서 삭제 순서 변경
- 다른 epic의 blueprint로 pointer 이동
- 테스트 헬퍼 `__FENCED` 복제 목록에 남는 `'release'` 정리 (명령이 사라지면 쓰이지 않는 이름일 뿐이다)
- PR merge 뒤 worktree 제거 경로
- `benchmarks/` 평가 정책·responder (`finalize.next_blueprint` 응답과 `commit_and_keep_worktree` 답은 과거 run 호환용으로 남기고, 테스트는 legacy gate로 허용한다)

## One-commit justification
- TASKS-001은 새 CLI와 그 e2e를, TASKS-002는 대체된 `coordinate release` 제거를, TASKS-003은 `release-main`을 쓰도록 바뀌는 스킬·규칙 문서를 한 커밋씩 닫는다. TASKS-004는 통합 head의 전체 CI를 한 번 확인한다.

## Documents
* [Task 001](tasks/001/tasks.md) - `finalize release-main` CLI와 메인 사본 정리
* [Task 002](tasks/002/tasks.md) - `coordinate release` 제거
* [Task 003](tasks/003/tasks.md) - finalize 스킬·pointer 규칙 개정
* [Task 004](tasks/004/tasks.md) - 종단 CI 검증
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
