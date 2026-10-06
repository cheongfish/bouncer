---
type: bouncer.blueprint
title: finalize PR base 탐지와 결과 provenance 축소
description: Finalize digest resolves the PR base from config then origin/HEAD, and finalize results drop the coordinator provenance object.
resource: .bouncer/context/epics/086-finalize-output-cleanup/blueprints/001-pr-base-and-result-provenance/index.md
tags:
  - bouncer
  - blueprint
  - finalize
  - pr
  - coordinator
timestamp: '2026-10-06T10:11:03.205+09:00'
bouncer:
  id: '001'
  epic_id: '086'
  blueprint_id: '001'
  status: closed
  commit_type: feat
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 001 finalize PR base 탐지와 결과 provenance 축소

Epic: [086](../../index.md)

## Intent
finalize PR base를 config 다음에 `origin/HEAD`에서 정하고, 둘 다 없으면 추측하지 않고 사용자에게 묻게 한다. finalize 결과 JSON에서 drive 실행 기록을 담던 `coordinator`를 뺀다.

## Contract
- 인터페이스:
  - digest `git.pr_base: string | null`. 순서는 config `pr.base` → `base_branch` → `origin/HEAD`(앞의 `origin/` 제거) → `null`이다.
  - digest `pr.base: string | null`, `pr.title_prefix: string | null`, 신규 `pr.title_prefix_template: string`(`{base}` 자리 1개).
  - `finalize` 결과(dry-run, `--yes`, 빈 커밋, partial_closed, `coordinator-ledger` 거절)에서 `coordinator` 키를 제거한다. top-level `worktrees`·`branch`·`integration`·`ledgerFile`·`integrationPath`는 유지한다.
- 데이터·상태: finalize provenance는 `status`, `ledgerFile`, `base`, `integrationBranch`, `integrationPath`, `worktrees`만 가진다. 원장·config·문서 파일 형식은 바뀌지 않는다.
- 수용 기준: epic Success criteria 1–7.
- 검증 명령: commit task는 `npm test`, 종단 verification task는 `npm run ci`.
- 실패 모드·엣지 케이스:
  - `origin` remote가 없거나 `origin/HEAD` symbolic ref가 없는 clone(`git remote set-head` 미실행)은 `null`이다.
  - git 실행 실패는 digest를 실패시키지 않고 `null`로 접는다.
  - drive의 integration worktree에서 실행해도 `origin/HEAD`는 공용 ref라 같은 값이 나온다.
  - config 값이 빈 문자열·공백·비문자열이면 다음 후보로 넘어간다.
  - 원장이 깨진 경우의 `coordinator-ledger` 거절 reason과 `code`는 그대로다.

## Out of scope
- `bouncer init`의 `detectDefaultBranch` 결과와 init이 쓰는 config 키
- `finalize release-main`, `coordinate` 출력, finalize 결과에서 `coordinator` 이외 필드
- `validate-sections.ts`의 `## 이해 상태` heading, validate hint 표
- 이 저장소의 `.bouncer/config.json` 생성과 플러그인 릴리스

## One-commit justification
- 두 변경 모두 `/bouncer-finalize`가 모델에게 넘기는 출력(digest와 결과 JSON)을 저장소 사실에 맞추는 정리이고, 같은 finalize 지침과 테스트 묶음을 함께 바꾼다. 한 PR에서 리뷰하면 finalize 출력 계약 변경을 한 번에 확인할 수 있다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - PR base 탐지와 draft-pr 지침
* [Tasks 002](tasks/002/tasks.md) - finalize 결과 provenance 축소
* [Tasks 003](tasks/003/tasks.md) - 종단 `npm run ci`
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
