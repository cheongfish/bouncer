---
type: bouncer.blueprint
title: prepare 원장 잠금 구간 분리
description: Moves coordinate prepare's git worktree add and worker seed outside the ledger lock so seeds longer than the stale-lock threshold cannot split the ledger from Git worktree registrations.
resource: .bouncer/context/epics/087-v153-evaluation-remediation/blueprints/002-prepare-lock-split/index.md
tags:
  - bouncer
  - blueprint
  - coordinator
  - ledger-lock
  - worktree
timestamp: '2026-10-06T15:43:42.432+09:00'
bouncer:
  id: '002'
  epic_id: '087'
  blueprint_id: '002'
  status: closed
  commit_type: feat
  scale: full
  review_scope: blueprint
  supersedes: []
---
# prepare 원장 잠금 구간 분리

Epic: [087](../../index.md)

## Intent
`coordinate prepare`가 `git worktree add`와 worker seed(`npm ci`)를 원장 잠금 밖에서 실행하도록 단계를 나눔. seed가 30초 stale 기준을 넘거나 도중 원장이 바뀌어도 원장과 Git worktree 등록이 어긋나지 않게 함.

## Contract
- 인터페이스
  - `bouncer coordinate prepare`의 입력·성공 출력(`ready`, `tasks`, `decisions`, checkpoint)은 바꾸지 않는다.
  - 실패 reason은 기존 집합만 쓴다: `stale-ledger-checkpoint`(seed 중 원장이 바뀜), `dependency-install-failed`·`copy-failed`(seed 실패), `ledger-locked`(③ 잠금 획득 실패), `ledger-lock-lost`(③ 도중 잠금 상실). `dependency-install-failed` 실패 힌트는 prepare 재시도도 안내한다.
- 데이터·상태
  - 원장 스키마는 바뀌지 않는다. 1단계는 원장을 쓰지 않는다.
  - prepare 흐름: ① 잠금 안 판정(fence, ready wave, branch 계획, revoke 정리) → ② 잠금 밖 `worktree add`·seed → ③ 잠금 재획득, 원장 bytes hash가 ①과 같고 계획한 worker가 모두 Git에 등록돼 있을 때만 상태 전이·lease 발급·원장 쓰기.
  - ②·③ 실패 시 이번 호출이 `create`로 만든 worktree와 branch만, 이 프로세스가 소유한 원장 잠금 안에서 현재 원장이 참조하지 않는 경우에 지운다. 잠금을 잃었으면 정리 전용 잠금을 새로 잡는다. 재사용(`reuse`) worktree는 건드리지 않는다.
- 수용 기준: epic Success criteria 5와 7.
- 검증 명령: task `bouncer.verify`. 머지 전 `npm run ci`는 PR CI가 실행한다.
- 실패 모드·엣지 케이스
  - 같은 checkpoint로 prepare 두 개가 겹치면 ③에 먼저 닿은 쪽만 성공한다. 진 쪽은 `stale-ledger-checkpoint`를 반환하고, 이긴 쪽 원장이 참조하는 worktree는 지우지 않는다. 진 쪽 정리가 아직 ③에 닿지 않은 쪽의 `reuse` worktree를 지웠다면, 그쪽 ③이 등록 소실을 보고 `unassigned-worker-worktree`로 원장을 쓰지 않는다.
  - ②가 끝난 뒤 프로세스가 죽으면 등록된 worktree가 남는다. 다음 prepare가 `reuse`로 받아 seed를 다시 실행한다.
  - 정리(`worktree remove`·`branch -D`) 자체가 실패하면 오류를 삼키지 않고 올린다.
  - seed 중 다른 프로세스가 남긴 오래된 잠금은 ③의 `withLedgerLock`이 기존 규칙대로 회수한다.

## Out of scope
- `LOCK_STALE_MS` 값, `withLedgerLock` 구현, 잠금 모듈 분리(A-5).
- `bootstrap` 경로, fan-in·verification integrate 경로, `atomicWrite` fsync(A-7), `coordinate()` 핸들러 분리(A-2).
- 릴리스 링크·호스트 표기(D-1·D-2) — 다음 blueprint가 맡는다.

## One-commit justification
- 단계 분리, 롤백, 실패 힌트, 회귀 테스트가 모두 `prepare` 분기 하나의 계약이라 따로 커밋하면 중간 커밋에서 기존 테스트(이번 호출 worker 잔존 기대)가 깨진다.

## Documents
* [Tasks 001 — prepare 단계 분리](tasks/001/tasks.md) - 잠금 밖 worktree·seed, ③ hash 대조, 생성 worker 롤백, 회귀 테스트, CHANGELOG
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
