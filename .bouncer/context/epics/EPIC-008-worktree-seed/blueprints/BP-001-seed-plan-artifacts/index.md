---
type: bouncer.blueprint
title: execute worktree로 plan 산출물 이전
description: Blueprint BP-001
resource: .bouncer/context/epics/EPIC-008-worktree-seed/blueprints/BP-001-seed-plan-artifacts/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-03T05:30:59.813Z'
bouncer:
  id: BP-001
  epic_id: EPIC-008
  blueprint_id: BP-001
  status: approved
  commit_type: feat
---
# BP-001 seed-plan-artifacts

Epic: [EPIC-008](../../index.md)

## Intent
- 문제: base에만 존재하는 plan 산출물이 worktree에 없어 execute가 브리프를 읽지
  못하고, 같은 파일이 base에 ghost로 남는다. 에이전트의 임시 `cp`/`rm`에 맡기면
  이전 규칙이 비결정적이고, base cwd에서 작업하면 `commit-safety` 훅이 잘못된
  index를 본다.
- 완료 조건: `bouncer seed-worktree` 한 명령이 이전 규칙을 고정하고,
  `/bouncer-execute` step 2가 이를 호출한다. Epic 성공 기준 1–7.

## Contract
- 인터페이스 (CLI): `bouncer seed-worktree --blueprint <dir> --to <worktree-abs>
  [--repo <dir>]`. `--repo`(기본 cwd)는 **base 체크아웃**, `--to`는 방금 만든
  worktree의 절대 경로. 결과 JSON을 stdout에, 사용법 오류는 stderr에 낸다.
  종료 코드는 기존 명령과 같은 규약 — 성공 0, 실패 1, 사용법 오류 2.
- 인터페이스 (라이브러리): `scripts/src/lib/seed-worktree.ts`가
  `seedWorktree({ repoRoot, blueprintDir, worktreePath, git })`를 export한다.
  `git`은 주입 가능한 포트로 두어 테스트가 실제 저장소 없이도 분기를 덮는다
  (`finalize.realGit`과 같은 모양).
- 데이터·상태: 성공은 `{ ok: true, moved: [], restored: [] }`, 실패는
  `{ ok: false, reason, ... }`. 새 문서 kind·프론트매터 필드·게이트 코드는 없다.
- 이전 대상 (닫힌 집합): blueprint dir 트리 아래 · `<epicDir>/index.md` ·
  `.bouncer/context/index.md` 중 `git diff --name-only HEAD`(staged 포함) 또는
  `git ls-files --others --exclude-standard`에 잡힌 경로. 그 밖의 dirty는 무시.
- 동작 순서: (1) worktree에 동일 상대경로로 복사(부모 dir 생성), (2) 복사본
  내용 일치 확인, (3) 확인된 경로만 base에서 정리. base 정리는 HEAD 존재
  여부로 분기한다 — tracked dirty는 `git checkout --`, HEAD에 없고 staged면
  `git rm --cached` 후 삭제, 순수 untracked면 삭제.
- 수용 기준: Epic Success criteria 1–7.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스: 대상 없음 → no-op 성공. worktree에 같은 경로가 있고
  내용이 다름 → `reason: 'conflict'`로 실패하고 base는 무변경(중간 재실행
  보호). 복사 실패 → base 무변경으로 중단. `--to`가 존재하지 않는 경로 →
  사용법 오류. HEAD에 없는 신규 문서를 `git add`한 staged 상태는 지배적
  시나리오이며, 단일 `git checkout --` 경로만 두면 `pathspec did not match`로
  깨진다.

## Out of scope
- `/bouncer-plan`을 worktree 안에서 실행하도록 바꾸기.
- finalize 이후 추가 base cleanup, worktree 삭제·merge 자동화.
- `affected_paths` 코드 파일이나 로컬 전용 dirty 파일 이전.
- 게이트 코드(G*/S*)·스키마·`makeAllowed` 자체의 변경.

## One-commit justification
- 라이브러리만 있고 CLI·SKILL 배선이 없으면 execute는 여전히 브리프를 못 읽고,
  SKILL만 고치면 없는 명령을 호출한다. 명령·배선·문서·테스트가 같은 계약이다.
- 기존 게이트·스키마를 건드리지 않아 회귀 범위가 새 모듈과 CLI 표면 테스트로
  한정된다.

## Documents
* [Tasks](tasks.md) - 구현 브리프
* [Verification](verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
* [Distill](distill.md) - 배운 것
