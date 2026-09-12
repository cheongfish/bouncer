---
type: bouncer.blueprint
title: 드라이브 계획 문서 흐름과 마감 정리
description: Makes the integration worktree the single plan-document source for a coordinator drive, returns worker evidence to it, releases main plan copies after finalize, and relaxes authored commit sentence parsing.
resource: .bouncer/context/epics/069-workflow-improvement/blueprints/004-drive-document-flow/index.md
tags:
  - bouncer
  - blueprint
  - coordinator
  - worktree
  - finalize
  - seed
  - commit-message
timestamp: '2026-09-12T11:05:38.555+09:00'
bouncer:
  id: '004'
  epic_id: '069'
  blueprint_id: '004'
  status: closed
  commit_type: fix
  scale: full
  supersedes: []
---
# 004 drive-document-flow

Epic: [069](../../index.md)

## Intent
드라이브가 메인 작업 트리의 커밋되지 않은 계획 문서에 기대어 준비와 증적과 마감 단계마다 끊기던 문제를 해소함.
통합 작업 트리를 문서 정본으로 삼아 작업자 준비와 증적 반환을 잇고, 마감 뒤 메인 사본을 돌려놓아 병합 충돌을 없애며, 커밋 문장에서 영문 식별자를 허용함.

## Contract
- 인터페이스:
  - `coordinate bootstrap`: ledger가 없을 때만 메인 working tree의 계획 문서 집합(blueprint 트리, 상위 epic `index.md`, context `index.md`)과 `.bouncer/config.json`을 integration으로 복사하고, 계획 문서마다 `{ path, sha256 }`을 ledger `seedManifest`에 기록한다. seed가 실패하면 ledger를 쓰지 않는다.
  - `coordinate prepare`: worker seed의 출처는 항상 integration이다. `--repo` 유무나 동적 repair 여부로 갈라지지 않는다.
  - `coordinate integrate`(commit task): cherry-pick 전에 worker bundle이 `verified`/`passed`/`accepted`이고 `commit_sha`가 ledger SHA와 맞는지 확인한 뒤 그 bundle만 integration의 같은 경로로 가져온다.
  - `bouncer finalize`(drive): ledger에서 `integrated`인 task의 integration 문서 상태가 어긋나면 G16 판정 전에 `coordinator-evidence-mismatch`로 멈춘다.
  - `coordinate release`(신규, 메인 checkout): integration에서 blueprint가 `closed`일 때 manifest와 바이트가 같은 메인 계획 문서만 되돌린다. tracked는 `HEAD`로 복원하고 untracked는 삭제한다. 달라진 문서는 보존하고 `preserved`로 보고한다.
  - `normalizeAuthoredLines`: 줄 수(1–2), 줄바꿈·빈 문장, 한국어 포함, 한국어 종결형만 판정한다. blueprint Intent, `commit_intent`, `commit_summary`에 같은 규칙을 적용한다.
- 데이터·상태: ledger에 선택 필드 `seedManifest: Array<{ path, sha256 }>`를 추가한다. 필드가 없는 기존 ledger도 계속 유효하지만 `release`는 거절한다. task와 verification node의 상태 전이는 바꾸지 않는다.
- 수용 기준: epic 성공 기준 11–15.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - 재개된 bootstrap(ledger 존재)은 seed하지 않는다. integration 사본이 정본이라 fan-in된 증적과 repair 문서를 덮지 않는다.
  - integration 사본이 메인 바이트와도 `HEAD` blob과도 다르면 덮지 않고 `seed-conflict`로 멈춘다.
  - worker 증적이 terminal이 아니거나 SHA가 다르면 integrate는 cherry-pick 전에 거절하고 main, integration, ledger를 바꾸지 않는다.
  - blueprint가 `closed`가 아니거나 drive가 `awaiting_confirmation`/`partial_closed`면 `release`는 메인을 건드리지 않고 거절한다.
  - `release`는 manifest 밖 경로와 source를 건드리지 않는다. drive 도중 메인에서 고친 계획 문서는 삭제하지 않는다.
  - verification node는 기존 `ready → verifying → integrated` 계약을 유지한다.

## Out of scope
- 단독 `/bouncer-execute`의 이동 seed(`seedWorktree`) 변경.
- 이미 준비된 worker에 수정된 brief를 다시 복사하는 동기화.
- finalize 동의 단계(explain 퀴즈, remainder, PR, 다음 blueprint)의 자동화.
- finalize remainder 범위가 첫 task의 `affected_paths`만 참조하는 문제.
- 기존 ledger와 worktree의 migration, graphify lock 복구.

## One-commit justification
- TASKS-001–004가 integration 문서 정본이라는 한 계약을 시작, 준비, 통합, 마감 순서로 한 커밋씩 닫는다.
- TASKS-005는 독립된 parser 정책 변경이라 병렬로 두고 rollback 범위를 분리한다. TASKS-006은 통합 head의 전체 CI를 한 번 확인한다.

## 이연 항목
드라이브 중 coordinator가 계약·검증 결과를 바꾸지 않는다고 판단해 넘긴 후속 항목이다. 후속 소유자는 epic 069의 다음 sibling blueprint다.
- TASKS-003-tests-readBouncerBlock-null-branches-uncovered: `readBouncerBlock`의 ENOENT·YAMLException 분기를 integrate와 finalize 양쪽에서 거절·`actual: null`로 고정하는 테스트를 더한다.
- TASKS-003-quality-fence-regex-duplicates-parser: `frontmatter.ts`의 frontmatter 정규식을 공개해 `coordinator.ts`의 사본을 없애거나, 두 정규식의 일치를 테스트로 고정한다.
- TASKS-005 후속: `docs/contributing.md` 33–39행의 옛 `commit_intent` 조립 설명(정확히 2줄, 최고 번호 task 사용)을 현재 동작과 맞춘다.

## Documents
* [Task 001](tasks/001/tasks.md) - bootstrap의 integration seed와 manifest
* [Task 002](tasks/002/tasks.md) - worker seed 출처를 integration으로 통일
* [Task 003](tasks/003/tasks.md) - worker 증적 반환과 finalize 대조
* [Task 004](tasks/004/tasks.md) - finalize 뒤 메인 계획 문서 반환
* [Task 005](tasks/005/tasks.md) - 커밋 문장 parser 완화
* [Task 006](tasks/006/tasks.md) - 종단 CI 검증
* [Context review](context-review.md) - 계획 문서 정합성 판정
