---
type: bouncer.blueprint
title: Dispatch revision과 attempt 증적
description: Binds implementer dispatches and reports to one task brief hash and attempt so stale work cannot be recorded.
resource: .bouncer/context/epics/074-plan-context-quality-efficiency/blueprints/002-dispatch-revision-attempt-evidence/index.md
tags:
  - bouncer
  - blueprint
  - coordinator
  - dispatch
  - provenance
timestamp: '2026-09-18T12:06:20.412+09:00'
bouncer:
  id: '002'
  epic_id: '074'
  blueprint_id: '002'
  status: closed
  commit_type: feat
  scale: full
  supersedes: []
---
# Dispatch revision과 attempt 증적

Epic: [074](../../index.md)

## Intent
Coordinator가 implementer dispatch와 보고를 현재 task brief hash 및 attempt에 연결함.
현재 dispatch와 맞지 않는 보고를 stale 증적으로 남기고 수락이나 `coordinate record`로 넘기지 않음.

## Contract
<!-- Contract-First: 계약만. 구현 코드 금지.
     시그니처·타입·의사코드는 블록당 20줄 이하.
     길어지면 구현 상세가 새는 신호이니 tasks.md로 넘기거나 blueprint를 쪼갭니다.
     금지: 계약 클래스·메서드 본문, As-Is/To-Be 코드 덤프, 단계별 구현 시퀀스,
     실행 가능한 테스트 본문 → tasks.md로 이연.
     본문 분량 예산 ~250줄. 초과는 구현 상세 누출 신호 — 쪼개거나 이연. -->
- 인터페이스:
  - `bouncer coordinate dispatch --blueprint <dir> --task <ddd>`는 할당된 worker worktree에서 새 attempt를 열고 `attempt`, `task_brief_hash`, `base_head`, `initial_worktree_state`를 반환한다. 두 번째 attempt부터 직전 보고의 `outcome`과 `summary`를 `previous_outcome`으로 함께 반환한다.
  - `bouncer coordinate report --blueprint <dir> --task <ddd> --attempt <n> --task-brief-hash <sha256> --outcome <accepted|rework|scope_revision|task_change|blocked> --summary <text>`는 implementer 보고가 활성 attempt와 일치할 때만 그 attempt를 닫는다.
  - implementer 보고는 `Brief revision`에 `attempt`와 `task_brief_hash`를 돌려준다. named dispatch와 generic fallback은 같은 dispatch metadata shape를 받는다.
- 데이터·상태:
  - coordinator task ledger는 최신 dispatch의 attempt, brief hash, 시작 HEAD, 시작 working-tree 상태, `active|reported` 상태와 보고 outcome을 보존한다. `attempt`는 task별로 1부터 단조 증가한다.
  - `coordinate report`가 받은 attempt 또는 hash가 활성 값과 다르면 `stale-report` 결정을 expected/received 값과 함께 append하고 활성 attempt는 닫지 않는다.
  - `coordinate record`는 최신 reported outcome이 `accepted`이고 현재 task brief bytes의 SHA-256이 dispatch hash와 같을 때만 worker HEAD를 기록한다.
- 수용 기준: Epic 성공 기준 5, 6, 9. 최초 dispatch에는 `previous_outcome`이 없고, 재디스패치는 직전 outcome을 싣는다. coordinator는 활성 attempt가 끝나기 전 해당 task brief를 revise하지 않는다.
- 검증 명령: `npm test` (전역 `config.verify`).
- 실패 모드·엣지 케이스:
  - 활성 attempt가 있는데 다시 dispatch하면 `dispatch-already-active`로 거부한다.
  - report에 attempt/hash가 없거나 형식이 틀리면 usage 또는 runtime 거절로 끝내며 ledger의 활성 attempt를 바꾸지 않는다.
  - 늦게 도착한 이전 attempt 보고와 수정 전 brief hash는 `stale-report` 결정만 남기고 현재 attempt를 닫지 않는다.
  - task brief가 accepted report 뒤 record 전에 바뀌면 `coordinate record`가 `stale-worker-report`로 거부한다.
  - worker HEAD나 `git status --porcelain=v1`을 읽지 못하면 dispatch를 열지 않는다.
  - coordinator 재개는 ledger의 최신 attempt 번호와 상태를 사용하며 attempt를 1로 되돌리지 않는다.
  - named/fallback 어느 한쪽도 다른 task brief, 전체 ledger, 과거 대화나 commit 제목을 payload에 넣지 않는다.

## Out of scope
- `task_brief_hash`와 별개인 `brief_sha256` 도입
- debugger·reviewer payload와 intent bundle revision 규칙 변경
- baseline 실패를 이유로 한 dispatch 차단과 자연어 source symbol 추출
- coordinator DAG, scope revision, repair-wave 상태 모델의 재설계

## One-commit justification
<!-- rules/governance.md: blueprint는 한 번에 리뷰 가능한 커밋 하나에 맞춘다.
     이 칸을 못 채우겠으면 blueprint를 쪼갤 신호입니다. -->
- 이 blueprint는 두 task commit으로 나눈다. 첫 commit이 runtime 상태와 CLI 경계를 만들고, 두 번째 commit이 같은 인터페이스를 역할·workflow 계약과 generated TOML에 연결한다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - dispatch attempt 상태와 stale report 거부
* [Tasks 002](tasks/002/tasks.md) - 역할·workflow dispatch/report 계약과 generated TOML
* [Verification 001](tasks/001/verification.md) - runtime·CLI 검증 명령과 증적
* [Review 001](tasks/001/review.md) - runtime·CLI 리뷰 발견사항
* [Verification 002](tasks/002/verification.md) - 역할·workflow 계약 검증 명령과 증적
* [Review 002](tasks/002/review.md) - 역할·workflow 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
