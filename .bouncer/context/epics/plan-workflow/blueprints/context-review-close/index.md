---
type: bouncer.blueprint
title: 미해결 must_fix가 남은 context review 사이클을 사용자 동의로 닫음
description: Add a disposition-only context-review close transition with user-approved accepted risk, let restart and G18 honor it, and keep consent-free bypass refused.
resource: .bouncer/context/epics/plan-workflow/blueprints/context-review-close/index.md
tags:
  - bouncer
  - blueprint
  - context-review
  - plan-gate
timestamp: '2026-10-13T16:12:04.837+09:00'
bouncer:
  id: context-review-close
  epic_id: plan-workflow
  blueprint_id: context-review-close
  status: closed
  order: 14
  commit_type: fix
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 004 미해결 must_fix가 남은 context review 사이클을 사용자 동의로 닫음

Epic: [063](../../../maintenance/index.md)

## Intent
delta round 뒤 `open` must_fix가 하나라도 기록되면 round 재기록·다음 round·restart가 모두 거절되어 사용자가 동의해도 사이클을 닫을 수 없고, 기존 accepted-risk 기록도 G18이 must_fix 미해결로 거절한다.
처분 전용 `context-review close`가 사용자 동의를 `--accept-risk`와 note로 기록해 사이클을 닫고, restart와 G18이 그 처분을 인정하도록 하며, 동의 없는 우회는 계속 거절한다.

## Contract
- 인터페이스:
  - `bouncer context-review close --blueprint <dir> --dispositions <json> [--accept-risk <id[,id...]>]`. `--dispositions`는 `[{ id, status, note }]` 배열을 담은 JSON 파일 경로이고, round를 늘리지 않는다.
  - 성공 결과는 `record --status accepted`와 같은 `{ ok, noop, cycle, status: 'accepted', closed: true, projection }`이다.
  - projection의 must_fix 중 `--accept-risk`로 accepted된 finding에 `accepted_risk: true`가 붙는다(record·close 공통).
  - G18(context namespace)은 `status: accepted`·비어 있지 않은 `note`·`accepted_risk: true`인 must_fix를 미해결로 세지 않는다. execute review(G14) 판정은 바뀌지 않는다.
- 데이터·상태:
  - runtime `state.json`에 선택 필드 `closure: { dispositions: Ref, accept_risk: string[] }`가 생긴다. dispositions 파일은 cycle 아래 immutable 파일이다.
  - `close`는 `active_reports`·`latest_dispatch`를 바꾸지 않는다. restart는 이 cycle을 history로 보관할 때 `closure`도 함께 보관한다.
  - 닫힌 cycle의 restart 미해결 검사는 round 보고가 아니라 `projection`을 본다.
- 수용 기준: Checklist의 테스트와 `npm run ci`가 판정한다. reference·`rules/cli.md`·`rules/document-schema.md`의 문구는 BP 최종 리뷰가 판정한다.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - round가 하나도 없거나 이미 닫힌 cycle의 `close`는 `context-review-state-conflict`다.
  - 처분 뒤에도 `open`이 남거나 note가 없거나 `--accept-risk`와 accepted must_fix가 어긋나면 기존 `context-review-unresolved-findings`다.
  - 처분 id가 기록된 finding에 없으면 `context-review-input-invalid`다.
  - 같은 입력의 재실행은 no-op이다.
  - 문서가 마지막 round 뒤에 바뀌었으면 `close`는 성공하고 G18은 기존대로 `context review is stale`을 보고한다. route는 `restart_count`가 0이면 `restart`를, 1이면 기존 `context-review-restart-limit`(`user`)를 낸다.
  - 동의 없는(`close` 없는) restart는 delta 뒤 open must_fix가 있으면 계속 거절한다.

## Out of scope
- delta 1회·restart 1회·round 순서·세 번째 round 금지 규칙.
- review-dispatch 분류와 snapshot digest 계산.
- execute review(G14·`review-record`)의 must_fix 판정.
- 098/002 사이클 복구 자체. merge 뒤 별도 `/bouncer-plan`에서 이 명령으로 진행한다.

## One-commit justification
- 새 전이, restart·G18의 처분 인정, CLI·문서는 같은 "사용자 동의 accepted-risk" 계약 하나를 이룬다. 나누면 어느 커밋에서도 사이클을 닫은 뒤 gate를 통과하지 못한다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - close 전이와 accepted-risk 인정
* [Tasks 002](tasks/002/tasks.md) - 종단 `npm run ci`
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
