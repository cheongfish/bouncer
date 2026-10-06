---
type: bouncer.blueprint
title: 실수 방지 커밋 강제력 보강
description: Makes post-verify source edits, hookless-host commits, and mid-execution scope edits fail gates, and documents the mistake-prevention threat model.
resource: .bouncer/context/epics/087-v153-evaluation-remediation/blueprints/001-commit-enforcement/index.md
tags:
  - bouncer
  - blueprint
  - enforcement
  - verification
  - pre-commit
  - threat-model
timestamp: '2026-10-06T12:17:33.913+09:00'
bouncer:
  id: '001'
  epic_id: '087'
  blueprint_id: '001'
  status: closed
  commit_type: feat
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 실수 방지 커밋 강제력 보강

Epic: [087](../../index.md)

## Intent
verify 뒤 소스 수정, PreToolUse 훅이 없는 환경의 범위 밖 커밋, 실행 중 승인 범위 변경이 게이트에서 실패하도록 함. Bouncer가 막는 것과 막지 않는 것을 실수 방지 위협 모델 문서로 명시함.

## Contract
- 인터페이스
  - commit 게이트 신규 코드 `G23`: verify 증거의 HEAD 또는 `source_digest`가 현재 checkout과 다르면 실패한다.
  - execute·commit 게이트 신규 코드 `G24`: 최초 활성화 때 기록한 승인 범위 digest가 현재 값과 다르면 실패한다.
  - CLI `bouncer commit-guard --staged`: 현재 index의 staged 파일을 PreToolUse 훅과 같은 판정으로 검사한다. 허용은 exit 0, 차단은 exit 1과 stderr 사유.
  - CLI `bouncer current --set <bp> --reapprove`: 승인 범위 스냅샷을 다시 기록한다.
  - `bouncer init --pre-commit-hook`(사용자 동의 뒤에만, ACQ `init.pre_commit_hook`)과 결과 필드 `preCommitHook`: `installed` | `chained` | `already-installed` | `skipped-hooks-path` | `skipped-no-git`. 플래그가 없거나 legacy·partial 상태이면 이 필드를 넣지 않는다.
  - Bouncer 내부 커밋(commit·finalize·import)은 env `BOUNCER_INTERNAL_COMMIT=1`로 hook 검사를 건너뛴다.
- 데이터·상태
  - verify 원장 레코드와 `verification.md` 메타에 `source_digest`(hex)를 추가한다. 기존 `identity`와 `evidence_id` 계산은 바꾸지 않는다.
  - git common dir에 `bouncer/approvals/<epic>/<bp>.json`을 새로 둔다: `{ version: 1, blueprint, digest, recorded_at }`.
  - 동의한 저장소의 git common dir `hooks/pre-commit`에 marker를 가진 Bouncer hook을 둔다. 기존 hook은 `pre-commit.bouncer-prev`로 옮겨 먼저 호출한다.
- 수용 기준: epic Success criteria 1~4와 7.
- 검증 명령: `npm test`. 머지 전 `npm run ci`는 PR CI가 실행한다.
- 실패 모드·엣지 케이스
  - `source_digest`가 없는 예전 증거, `repoRoot`가 없는 호출은 G23 대조를, 승인 파일이 없는 blueprint는 G24 대조를 건너뛴다. git 실행 자체가 실패하면 G23은 `verification freshness check failed`로 실패한다.
  - Node 버전·config 변경으로 생기는 environment 차이는 G23 판정에 쓰지 않는다.
  - coordinator 원장이 있는 blueprint는 G24 대조를 건너뛴다. 범위 정본은 `scope_revision`이다.
  - `core.hooksPath`가 설정된 저장소는 hook을 설치하지 않고 경고만 반환한다.
  - hook이 CLI를 찾지 못하면 경고하고 커밋을 허용한다. CLI가 판정 중 오류를 내면 커밋을 막는다.
  - task를 넘기려고 같은 blueprint에 `current --set`을 다시 실행해도 스냅샷은 바뀌지 않는다.
  - G24는 execute·commit 게이트에서만 판정한다. 게이트를 거치지 않는 raw `git commit`은 PreToolUse 훅·pre-commit hook이 현재 문서의 `affected_paths`로 판정한다.

## Out of scope
- 의도적 우회 방어: 경로 지정 git, 서브셸·인터프리터 경유 커밋, `--no-verify`, `core.hooksPath` 변경, 원장 위조.
- coordinator 경로의 범위 검사, PreToolUse 훅의 명령 탐지 규칙(E-4·E-6·E-8), 훅 입력 파싱 실패 방침(E-7).
- 플러그인 업그레이드 때 끊기는 CLI 심볼릭 링크(D-3).

## One-commit justification
- 하나의 PR로 묶는 이유: 네 task가 모두 "실수 방지" 위협 모델의 보증 항목이고, 위협 모델 문서(TASKS-001)는 나머지 세 task가 구현한 보증만 서술해야 한다. 각 task는 독립 커밋이다.

## Documents
* [Tasks 001 — 위협 모델 문서](tasks/001/tasks.md) - 막는 것·막지 않는 것 문서와 CHANGELOG
* [Tasks 002 — 증거 최신성](tasks/002/tasks.md) - `source_digest`와 G23
* [Tasks 003 — pre-commit hook](tasks/003/tasks.md) - `commit-guard` CLI와 init hook 설치
* [Tasks 004 — 승인 범위 스냅샷](tasks/004/tasks.md) - approvals 파일, `--reapprove`, G24
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
