---
type: bouncer.blueprint
title: 마감 검증 의존성 준비
description: Prepare existing npm dependencies before finalize verification and return structured installation failures.
resource: .bouncer/context/epics/090-drive-reliability/blueprints/003-finalize-dependency-readiness/index.md
tags:
  - bouncer
  - blueprint
  - coordinator
  - recovery
  - finalize
timestamp: '2026-10-10T11:51:50.289+09:00'
bouncer:
  id: '003'
  epic_id: '090'
  blueprint_id: '003'
  status: closed
  commit_type: fix
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 003 마감 검증 의존성 준비

Epic: [090](../../index.md)

## Intent
integration checkout의 의존성 누락으로 검증이 실패하지 않도록 finalize 검증 직전에 기존 설치 함수를 호출하고 설치 실패를 별도 결과로 반환함.

## Contract
- 인터페이스: finalize의 선택적 dependencyExec 주입으로 기존 prepareDependencies(repoRoot, deps)를 재사용한다. 실패는 { ok: false, reason: 'dependency-install-failed', code: 'DEPENDENCY_INSTALL_FAILED', cause, next, integration, branch } JSON으로 반환한다.
- 실행 조건: yes가 true이고 실제 검증 경로에 들어가 verify command 해석까지 성공한 경우만 설치한다. 설치 cwd와 verify cwd는 기존 repoRoot로 같게 한다.
- 데이터·상태: package-lock.json 부재와 node_modules/.package-lock.json 존재 시 skip 계약 및 npm install flags를 유지한다. 설치 성공 뒤 기존 verify와 종료 절차로 간다.
- 실패 모드·엣지 케이스: malformed verify config는 설치 전에 기존 실패를 반환한다. 설치 실패는 검증·삭제·닫힘 전이·stage·commit·pointer 해제 전에 반환한다. npm stdout/stderr는 capture하여 CLI JSON stdout과 섞지 않는다.
- 수용 기준: 에픽 수용 기준 7·8·9·11·12.
- 검증: npm run ci로 최종 검증하고 execute gate가 성공 증거를 기록한다. 아래 task Checklist의 focused tests는 구현 중간 검사다.

## Out of scope
- 코디네이터 Close와 shared prepareDependencies의 marker·lockfile freshness 정책 변경.
- finalize prepare/digest, 설치가 필요 없는 경로에 npm 실행, 라이브러리 추가.

## One-commit justification
하나의 TASKS-001이 위 계약과 회귀 검사·생성 산출물·변경 기록을 함께 반영한다. 이 BP를 하나의 리뷰와 PR 단위로 검토한다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - execute가 작성하는 검증 증거
* [Review](review.md) - 실행 결과 리뷰
* [Context review](context-review.md) - 계획 문서 정합성 판정
