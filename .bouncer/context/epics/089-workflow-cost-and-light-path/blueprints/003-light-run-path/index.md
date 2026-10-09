---
type: bouncer.blueprint
title: light run 경로 개편
description: Run a light blueprint in the run session with one independent reviewer instead of a coordinator, track it in a light ledger mode, and preserve state and stop on promotion signals.
resource: .bouncer/context/epics/089-workflow-cost-and-light-path/blueprints/003-light-run-path/index.md
tags:
  - bouncer
  - blueprint
  - light
  - run
  - ledger
timestamp: '2026-10-09T21:12:43.205+09:00'
bouncer:
  id: '003'
  epic_id: '089'
  blueprint_id: '003'
  status: closed
  commit_type: feat
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 003 light run 경로 개편

Epic: [089](../../index.md)

## Intent
- 문제: light blueprint도 `/bouncer-run`에서는 coordinator와 named worker 계층을 그대로 거치고, run·execute 규칙과 테스트가 "drive에서는 light inline 금지"를 고정하고 있다.
- 완료 조건: light blueprint는 run 세션이 CLI가 배정한 integration worktree에서 단일 task를 직접 구현하고 독립 reviewer 1세션이 검토하며, 위험 신호에서는 상태를 원장에 남기고 멈춘다.

## Contract
- 인터페이스: 새 최상위 명령 없이 기존 `coordinate` 명령이 원장 `mode: 'light'`를 인식한다. `coordinate bootstrap`이 `scale: light`이고 blueprint의 task가 의존 없는 commit task 정확히 1개뿐일 때(verification task 포함 두 번째 task가 없을 때)만 `mode: 'light'` 원장을 만들고, 그 밖이면 `light-requires-single-task`로 거부한다. `report --outcome accepted`는 blueprint 루트 `review.md`에 `bouncer review record`가 쓴 라운드가 하나 이상 있고 문서 status가 `accepted`일 때만 받는다(없으면 `light-review-required`). reviewer의 독립성은 CLI가 아니라 run 절차가 보장한다. `coordinate promote-stop --blueprint <dir> --reason <enum> --summary <text>`는 `promotion_stopped` 상태를 기록한다.
- 데이터·상태: 원장에 `mode?: 'light'`와 `status: 'promotion_stopped'`, `promotion?: { reason, summary, task, diff_sha, verify_evidence_id?, review_evidence_id? }`가 추가된다. `reason`은 `security-risk`, `out-of-scope`, `task-split`, `interface-semantics`, `reviewer-wider-scope` 다섯 값이다. light 원장의 task `workerPath`는 integration 경로 자체이고 cherry-pick은 건너뛰되 `fanin`은 `verified`로 기록한다. lease·fence 계약은 full과 같다.
- 수용 기준: 에픽 Success criteria 7·8.
- 검증 명령: `npm run build && node --test test/coordinator.test.js test/coordinator-e2e.test.js test/coordinate-next.test.js test/run-preflight.test.js test/cli-coordinate.test.js test/cli-help.test.js test/lightweight-cycle.test.js test/review-dispatch.test.js test/rule-ownership.test.js test/skill-bouncer-execute.test.js test/skill-bouncer-surface.test.js test/agents.test.js test/subagents.test.js`
- 실패 모드·엣지 케이스: 구현 세션이 reviewer를 겸하면 안 된다(reviewer는 읽기 전용 named 세션). reviewer 수정 요청은 run 세션이 고치고 같은 reviewer 역할의 delta review가 확인한다. 멈춘 light 원장은 `prepare`·`dispatch`·`report`·`record`·`integrate`를 거부하고 preflight는 `delegable: false`, `reason: 'promotion-stopped'`를 낸다. full → light 하향과 worker 이전은 지원하지 않는다.

## Out of scope
- light 실행 중 full worker 구조로 diff를 옮기는 절차, 승격 후 자동 재개.
- full 경로의 coordinator·named worker 동작, reviewer 수 변경.
- light quiz 정책.

## One-commit justification
- 원장 모드, run·execute 규칙 개정, 정지 상태가 서로 의존하며 한 PR로 리뷰해야 "drive에서는 light inline 금지" 규칙의 제거와 대체가 일관된다. 구현 순서는 task 001(원장) → 002(규칙) → 003(정지)다. 이 blueprint는 blueprint 001의 `coordinate advance`와 판단 응답 계약이 통합된 뒤 실행한다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - light 원장 모드
* [Tasks 002](tasks/002/tasks.md) - run·execute 규칙과 단일 reviewer
* [Tasks 003](tasks/003/tasks.md) - 승격 신호에서 상태 보존 정지
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
