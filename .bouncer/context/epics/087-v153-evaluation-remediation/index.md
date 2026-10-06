---
type: bouncer.epic
title: v1.5.3 평가 개선 과제
description: Works through the v1.5.3 evaluation's improvement tasks under a mistake-prevention threat model, starting with enforcement, operations, and release alignment.
resource: .bouncer/context/epics/087-v153-evaluation-remediation/index.md
tags:
  - bouncer
  - epic
  - enforcement
  - threat-model
  - release
timestamp: '2026-10-06T12:17:33.788+09:00'
bouncer:
  id: '087'
  epic_id: '087'
  status: approved
  supersedes: []
---
# v1.5.3 평가 개선 과제

## Intent
- 문제: `plugin-evaluation-v1.5.3.md`가 확인한 결함이 develop(1.5.4)에도 남아 있다. verify 뒤에 소스를 고쳐도 증거가 유효하고, PreToolUse 훅이 없는 호스트의 커밋은 검사되지 않으며, prepare가 원장 잠금을 잃을 수 있고, 설치된 플러그인의 문서 링크가 깨진다.
- 목표: Bouncer가 막는 것과 막지 않는 것을 "실수 방지" 위협 모델로 문서화하고, 그 범위 안의 결함을 평가 문서의 우선순위 순서로 blueprint 단위로 없앤다.

## Success criteria
1. `docs/`에 위협 모델 문서가 있고 README가 링크한다. 문서는 의도적 우회(`/usr/bin/git`, `--no-verify`, 원장 위조)를 막지 않는 것으로 명시한다.
2. verify 뒤 git이 추적하거나 새로 생긴(무시되지 않은) 파일 중 `.bouncer/`와 runtime artifact(`node_modules/`, `graphify-out/`, `.worktrees/`) 밖 파일을 바꾸면 commit 게이트가 실패하고, verify 뒤 `.bouncer/` 문서만 바뀐 흐름은 통과한다.
3. 사용자가 동의해 `bouncer init --pre-commit-hook`으로 hook을 설치했고 `core.hooksPath`가 없으며 hook이 CLI를 찾을 수 있는 저장소에서, PreToolUse 훅 없이 범위 밖 파일을 커밋하면 git pre-commit 단계에서 차단된다.
4. 일반 execute 경로에서 `current --set` 뒤 `affected_paths`, `verify`, `verify_allowlist`를 바꾸면 execute·commit 게이트가 실패한다.
5. prepare가 원장 잠금 밖에서 `git worktree add`와 seed를 실행하고, 30초를 넘는 seed에서도 원장과 worktree가 일치한다.
6. release 트리 기준 상대 링크 검사에서 깨진 링크가 0개이고, README와 `docs/install.md`의 호스트 상태가 일치한다.
7. 각 blueprint는 `npm run ci`를 통과하고 CHANGELOG `[Unreleased]`에 항목을 남긴다.

## Out of scope
- 의도적 우회 방어: 경로 지정 git, 서브셸·인터프리터 경유 커밋, `--no-verify`, `BOUNCER_INTERNAL_COMMIT` 직접 설정, 서명 없는 원장 위조.
- coordinator 경로의 범위 검사 변경 — `scope_revision` 대조가 이미 맡는다.
- 호스트 설치 smoke 실행과 그에 따른 "검증됨" 표기 전환.
- 평가 문서의 P1 이하 태스크는 Success criteria에 넣지 않는다. 진행할 때 이 epic에 blueprint와 기준을 함께 추가한다.

## Blueprints
* [001 커밋 강제력 보강](blueprints/001-commit-enforcement/index.md) - 위협 모델 문서, commit 게이트 증거 최신성, git pre-commit hook, 승인 범위 스냅샷을 `docs/`·`scripts/src/lib`에 추가
* [002 prepare 원장 잠금 구간 분리](blueprints/002-prepare-lock-split/index.md) - `scripts/src/lib/coordinator.ts` prepare의 worktree 생성·seed를 원장 잠금 밖으로 옮기고 실패 시 생성 worker를 되돌림
