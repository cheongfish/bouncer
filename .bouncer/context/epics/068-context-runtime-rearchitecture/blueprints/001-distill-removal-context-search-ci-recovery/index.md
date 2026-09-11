---
type: bouncer.blueprint
title: Distill 제거와 컨텍스트 검색·CI 복구 전환
description: Removes Distill runtime dependencies and introduces ranked context retrieval with bounded terminal CI recovery.
resource: .bouncer/context/epics/068-context-runtime-rearchitecture/blueprints/001-distill-removal-context-search-ci-recovery/index.md
tags:
  - bouncer
  - blueprint
  - distill-removal
  - context-search
  - graphify-lock
  - terminal-ci
  - partial-close
timestamp: '2026-09-09T15:40:37.592+09:00'
bouncer:
  id: '001'
  epic_id: '068'
  blueprint_id: '001'
  status: closed
  commit_type: feat
  scale: full
  supersedes: []
---
# Distill 제거와 컨텍스트 검색·CI 복구 전환

Epic: [068](../../index.md)

## Intent
- 중복된 장기 기억 계층을 제거하고 정본 문서를 직접 찾는 검색 경계로 전환함
- 통합 검증과 제한된 복구 절차를 기록하여 남은 실패를 후속 계획으로 인계함

## Contract
- 인터페이스: `bouncer distill`과 Distill promotion을 제거한다. 새 context 검색은 `decision`·`implementation`·`history` 모드, 정규화 terms와 seed, 문서 역할 필터, 최대 후보 수를 받아 파일 후보와 관측 metadata를 JSON으로 반환한다.
- 검색 결과: 후보마다 원본 context 경로, 역할, tag·anchor, 점수와 근거를 제공한다. stale graph, 실행 파일 부재, `version-incompatible`, `zero-hit`, `broad-query`를 서로 다른 상태로 반환하며 낮은 신뢰도에서는 후보를 꾸며내지 않는다.
- Graphify 상태: plugin-owned compatibility manifest가 exact package·CLI·graph schema·Python 조건을 정본으로 가진다. 소비 저장소 lock은 실제 설치·검증 결과만 기록하고 `--upgrade-graphify`에서만 공유 venv와 세 graph를 바꾼다.
- 실행 DAG: 일반 task는 국소 verify를 가진다. 새 verification-only 종단 노드는 모든 integrated leaf를 의존하고 전체 CI를 한 번 실행하며 source commit을 만들지 않는다. 현재 설치된 plan gate는 이 blueprint가 도입할 node 형식을 아직 승인할 수 없으므로, 이 blueprint는 기존 commit task DAG를 사용하고 마지막 TASKS-008에서 전체 CI를 한 번 실행한다. 이후 계획부터 verification-only node를 작성한다.
- 복구 상태: 종단 CI 실패 시 coordinator는 최대 두 repair wave에서 task·edge·scope를 고치고 append-only 결정을 남긴다. 이후에도 실패하면 사용자 확인 전까지 멈추며, 동의 뒤에만 `partial_closed`와 untracked `NEXT_PLAN.md`를 기록한다.
- 수용 기준: Epic 성공 기준 1–12를 자동 테스트와 고정 평가 corpus가 증명한다.
- 검증 명령: task별 국소 `node --test ...`; 마지막 통합 검산은 `npm run ci`다.
- 실패 모드·엣지 케이스:
  - Distill bullet의 현재 유효 결정이 canonical context에 없으면 삭제 전에 감사 산출물에서 미해결로 남기고 cutover를 멈춘다.
  - Distill consumer가 남은 상태에서 파일을 먼저 지우거나 self-hosted finalize가 마지막 audit을 읽기 전에 master를 지우면 안 된다.
  - 공통 heading·범용 token·역사 task가 file ranking을 지배하면 broad query로 판정한다.
  - 조회 경로가 version 불일치를 고치기 위해 설치나 network를 실행하면 실패다.
  - repair task는 저장소 밖, `.git/`, `.bouncer/` governance tree를 source scope로 추가할 수 없다.
  - 두 repair wave 뒤에도 CI가 실패하면 일반 완료·자동 정리를 거부하고 integration 상태와 worktree를 보존한다.

```mermaid
flowchart LR
  A[보존 감사] --> B[문서 후보 검색]
  B --> C[호환성 검사]
  C --> D[workflow 전환]
  D --> E[런타임 제거]
  E --> F[전체 CI 검산]
  F --> G[복구 또는 종결]
```

## Out of scope
- 완료된 epic·blueprint·task·explain 본문의 Distill 역사 표현 소급 변경
- Graphify Python package 내부 구현과 graph schema 변경
- 의미 검색 모델, remote scheduler, cross-blueprint dependency
- 사용자의 확인 없이 `affected_paths`, Graphify upgrade, `partial_closed`를 적용하는 동작

## One-commit justification
- 한 PR에서 기억 계층 제거, 대체 검색, 실행 복구 계약을 함께 전환해야 중간 상태의 workflow가 사라진 파일을 읽지 않는다. 여덟 task는 감사, 검색, 설치 호환성, workflow 전환, 런타임 제거, verification-only node 지원, 복구 상태, 전체 검산을 각각 독립 commit으로 닫는다.

## Documents
* [Task 001](tasks/001/tasks.md) - Distill 보존 감사와 정본 매핑
* [Task 002](tasks/002/tasks.md) - 역할 기반 context 검색과 다이제스트 metadata
* [Task 003](tasks/003/tasks.md) - Graphify 호환 manifest·lock·명시적 upgrade
* [Task 004](tasks/004/tasks.md) - runtime·workflow consumer의 context 검색 전환
* [Task 005](tasks/005/tasks.md) - Distill CLI·설정·생성물 제거
* [Task 006](tasks/006/tasks.md) - verification-only 종단 CI 노드
* [Task 007](tasks/007/tasks.md) - coordinator repair wave와 partial close
* [Task 008](tasks/008/tasks.md) - 평가 corpus·Distill 생성물 제거·전체 검산
* [Verification](tasks/001/verification.md) · [002](tasks/002/verification.md) · [003](tasks/003/verification.md) · [004](tasks/004/verification.md) · [005](tasks/005/verification.md) · [006](tasks/006/verification.md) · [007](tasks/007/verification.md) · [008](tasks/008/verification.md) - task별 명령과 증적
* [Review](tasks/001/review.md) · [002](tasks/002/review.md) · [003](tasks/003/review.md) · [004](tasks/004/review.md) · [005](tasks/005/review.md) · [006](tasks/006/review.md) · [007](tasks/007/review.md) · [008](tasks/008/review.md) - task별 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
