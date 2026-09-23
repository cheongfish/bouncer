---
type: bouncer.blueprint
title: 실행 규칙 수직 이전
description: Moves execution scope and coordinator contracts to consumer-aligned canonical owners without changing runtime behavior.
resource: .bouncer/context/epics/077-rules-reorganization/blueprints/003-execution-rule-vertical-migration/index.md
tags:
  - bouncer
  - blueprint
  - execution
  - coordinator
  - commit-scope
timestamp: '2026-09-22T16:42:19.372+09:00'
bouncer:
  id: '003'
  epic_id: '077'
  blueprint_id: '003'
  status: closed
  commit_type: refactor
  scale: full
  supersedes: []
---
# 003 실행 규칙 수직 이전

Epic: [077](../../index.md)

## Intent
- 실행 scope와 coordinator 절차가 `rules/governance.md`에 함께 있어 각 workflow가 판단에 필요하지 않은 규칙까지 읽는 결합을 제거함.
- commit scope, coordinator 권한과 light·finalize 실행 계약을 실제 판단 주체에 옮기고 현행 실행·복구 동작을 보존함.

## Contract
- 인터페이스: 실행 workflow는 commit 단위·scope·worktree 경계를 공유 정본에서 읽고, coordinator는 역할 문서의 권한·절차와 기존 pointer·dispatch·output 정본만 조합한다. 공개 CLI 명령과 payload shape는 바꾸지 않는다.
- 데이터·상태: `bouncer.*`, coordinator ledger, pointer, gate code와 상태 전이는 변하지 않는다. ownership 표와 load graph만 새 정본 경로와 소비자를 가리킨다.
- 수용 기준: Epic 성공 조건 11–14가 충족되고 BP3 stable id마다 current owner가 하나이며 `run`, `execute`, `commit`, `finalize`, coordinator가 `rules/governance.md`를 실행 정본으로 읽지 않는다.
- 검증 명령: 전체 검증은 `npm run ci`로 수행한다.
- 실패 모드·엣지 케이스: dynamic scope의 source-path 경계와 상한 없음이 축소되거나 G17을 coordinator authorization으로 강화하면 실패다. ledger 없는 standalone commit, light inline과 drive named dispatch의 차이, 공유 pointer의 confirm-then-set, 두 repair 뒤 partial-close 보존이 달라져도 실패다. BP4 소유 구현 설명을 먼저 옮기거나 `governance.md`를 삭제해서도 안 된다.

## Out of scope
- `rules/governance.md` 삭제, 배포 목록과 Primary/Operational 사용자 문서 정리는 BP04로 남긴다.
- CLI 상태 전이, gate code, coordinator ledger schema, pointer 저장 형식, repair 횟수와 runtime dependency를 바꾸지 않는다.
- BP02가 옮긴 planning·document-schema 계약을 다시 재배치하지 않는다.
- 동결된 `rules-reorganization-proposal.md`를 수정하거나 commit하지 않는다.

## One-commit justification
- 세 task는 공유 scope 정본, coordinator 역할 정본, light·finalize 실행 정본을 차례로 전환하는 하나의 load graph 변경이다. 각 task는 중간 상태에서도 ownership 검사를 통과하는 독립 commit이고, 세 commit이 모여야 BP3 규범의 중복 정본이 사라진다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
* [Tasks 002](tasks/002/tasks.md) - coordinator 역할 계약과 run 소비자 전환
* [Verification 002](tasks/002/verification.md) - coordinator 규칙 이전 검증 명령과 증적
* [Review 002](tasks/002/review.md) - coordinator 규칙 이전 리뷰 발견사항
* [Tasks 003](tasks/003/tasks.md) - light·finalize 실행 규칙과 최종 ownership 전환
* [Verification 003](tasks/003/verification.md) - 실행 규칙 정리 검증 명령과 증적
* [Review 003](tasks/003/review.md) - 실행 규칙 정리 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
