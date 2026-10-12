---
type: bouncer.blueprint
title: delta 리뷰를 reviewer 하나로
description: Makes the blueprint final review delta round dispatch exactly one reviewer and gives reviewers a relation value for prior findings that remain unfixed.
resource: .bouncer/context/epics/088-drive-token-reduction/blueprints/008-delta-single-reviewer/index.md
tags:
  - bouncer
  - blueprint
  - review
  - review-dispatch
  - coordinator
  - delta
timestamp: '2026-10-12T08:28:49.096+09:00'
bouncer:
  id: '008'
  epic_id: '088'
  blueprint_id: '008'
  status: closed
  commit_type: feat
  scale: full
  review_scope: blueprint
  supersedes: []
---
# delta 리뷰를 reviewer 하나로

Epic: [088](../../index.md)

## Intent
v088007 재측정에서 repair 뒤 final review의 delta 단계가 `review-dispatch execute`의 discovery 관점 4개를 그대로 따라 reviewer 4개를 띄웠고, 남은 finding을 적을 relation 값이 없어 reviewer들이 플러그인을 뒤졌다. 이 blueprint는 `coordinate next`와 `review-dispatch`가 delta에서 reviewer 하나만 가리키게 하고, 관점이 여러 개인 delta round 기록을 거부하며, reviewer 문서에 `unresolved` relation을 더한다.

## Contract
- 인터페이스
  - `bouncer review-dispatch execute --blueprint <dir> [--task <ddd>] --base <sha> --head <sha> [--mode discovery|delta]`. 기본은 `discovery`다. `delta`면 성공 JSON의 `strategy`가 `single`, `perspectives`가 `["combined"]`이고 `target`·`risk_flags`·통계는 discovery와 같은 규칙으로 계산한다.
  - `coordinate next`의 blueprint `final_review` 응답은 root `review.md`에 `mode: discovery` round가 있거나 최신 supplement 결정이 `verified`이면 argv 끝에 `--mode`, `delta` 두 칸을 붙이고 `payload: { mode: 'delta' }`를 싣는다.
  - `review record`와 G14·G21은 execute 리뷰 round 중 `mode: delta`이고 perspective가 2개 이상인 round를 `review round <N> delta perspectives invalid: <count>` 메시지로 거부한다.
  - execute reviewer 출력 계약(`agents/bouncer-reviewer.md`, `reviewer-prompt.md`)의 relation 값은 `new | resolved | regressed | unresolved`다. `unresolved`는 이전 finding이 같은 ID로 남아 있고 회귀가 아닌 경우이며, controller는 그 finding을 `status: open`으로 기록한다.
- 데이터·상태: round JSON과 `review.md` 스키마, round counter(`new`/`resolved`/`regressed`), finding status enum은 바뀌지 않는다. `coordinate next`는 계속 원장과 worktree를 쓰지 않는다.
- 수용 기준: epic Success criteria 6, 31~34.
- 검증 명령: 각 task `bouncer.verify`(`npm run ci`). CI(`test.yml`)가 merge 전에 도는 명령과 같다.
- 실패 모드·엣지 케이스
  - `--mode`에 값이 없거나 `discovery`·`delta` 밖의 값이면 분류기를 적재하기 전에 exit 2로 거절한다.
  - delta 모드도 frozen base/head 검증, S10·S30 거절은 discovery와 같다. `ok: false`면 perspectives가 없다.
  - root `review.md`가 없거나 YAML이 깨졌으면 `readBouncerBlock`이 null을 돌려주므로 discovery round가 없는 것으로 본다. 상태 판정(`bouncerStatus`)과 같은 경로다.
  - critical_recovery 뒤 두 번째 delta도 discovery round가 이미 있으므로 delta 표시를 받는다.
  - perspective 키가 없거나 빈 배열인 delta round는 지금처럼 통과한다. `critical_recovery` round에는 관점 수 제한을 두지 않는다.
  - per-task 리뷰 경로의 `review-dispatch execute --task` argv는 `coordinate next`가 바꾸지 않는다. 그 경로의 delta round도 관점 수 검증은 받는다(카드가 이미 reviewer 하나를 요구한다).

## Out of scope
- discovery 단계의 관점 목록과 `EXECUTE_SMALL_*` 임계값.
- per-task 리뷰 카드(`references/coordinator-cards/review.md`)와 execute skill reference 문구.
- plan context review(`context_review`) round 검증, `review-dispatch plan`, context reviewer 역할 문서의 relation 어휘(G18은 `status: open`을 받지 않는다).
- round counter에 `unresolved` 칸을 더하는 일.
- 벤치마크 재측정, fastify-001 기준 측정, `requirements-v088007-followups.md` 갱신, INV-1~3 조사.

## One-commit justification
- PR 하나로 리뷰하는 088 후속 묶음이고 task마다 한 커밋이 된다. TASKS-001은 dispatch와 `next`의 delta 표시, TASKS-002는 delta round 관점 수 검증, TASKS-003은 카드·reviewer 문서·CHANGELOG를 맡는다. 001과 002는 경로가 겹치지 않아 병렬로 돌고, 003은 두 task가 만든 CLI 동작을 문서에 적으므로 둘 다 통합된 뒤 돈다.

## Documents
* [Tasks 001 — delta dispatch와 next 표시](tasks/001/tasks.md) - `cli-review-dispatch-command.ts`, `review-dispatch.ts`, `coordinate-next.ts`, 테스트
* [Tasks 002 — delta round 관점 수 검증](tasks/002/tasks.md) - `validate-sections.ts`, 테스트
* [Tasks 003 — 카드와 reviewer 문서](tasks/003/tasks.md) - `final_review.md`, reviewer 역할 문서·prompt, `.codex` TOML, `rules/cli.md`, CHANGELOG
* [Verification 001](tasks/001/verification.md) - 검증 명령과 증적
* [Verification 002](tasks/002/verification.md) - 검증 명령과 증적
* [Verification 003](tasks/003/verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
