---
type: bouncer.blueprint
title: 전이 가드 후속 보완
description: Fix the detach, revise, next, and pathspec gaps left by the transition guards and add a CLI path that closes a blocked final review by explicit risk acceptance.
resource: .bouncer/context/epics/workflow-transition-guards/blueprints/transition-guard-followups/index.md
tags:
  - bouncer
  - blueprint
  - detach
  - revise
  - review
  - pathspec
timestamp: '2026-10-18T16:21:24.349+09:00'
bouncer:
  id: transition-guard-followups
  epic_id: workflow-transition-guards
  blueprint_id: transition-guard-followups
  status: closed
  order: 2
  commit_type: fix
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  supersedes: []
---
# 전이 가드 후속 보완

Epic: [112](../../index.md)

## Intent
blueprint 001 최종 리뷰에서 이월된 결함을 고침. 정상 완료 drive에서도 `run detach`가 거절되던 문제, 거절 응답의 `cause`·`next` 누락, revise 거절 필드 유실, next의 commit 미선택, pathspec magic 우회가 대상임. blocked 최종 리뷰를 실제로 없었던 round 없이 사용자 위험 수용으로 닫는 CLI 경로를 추가함.

## Contract
- 인터페이스:
  - 새 명령 `bouncer review accept-risk --blueprint <dir> --finding <id> --note <text> --yes`.
  - `bouncer run detach`의 모든 거절에 `cause`·`next`를 붙인다.
  - `bouncer coordinate revise`의 모든 거절을 stdout JSON `{ ok: false, reason, paths?, cause, next }`와 exit 1로 낸다(지금은 stderr에 reason만 낸다).
  - `CURRENT_WOULD_BE_AMBIGUOUS`에 `cause`(string)를 추가한다. `next`는 기존대로 string 배열이다.
  - `coordinate next`는 커밋할 scope 변경이 있는 worker에 `commit`을 고르고, 깨끗한 tree의 낡은 stamp에는 `blocked`와 `worker-commit-stamp-mismatch`를 낸다.
  - 새 거절 코드: `review-accept-risk-confirmation-required`, `review-finding-missing`, `review-finding-not-open`, `review-note-required`, `review-accept-risk-task-scope`.
- 데이터·상태:
  - TypeScript `Ledger.status` union에 `detached`가 추가된다. 저장 형식은 그대로다.
  - accept-risk는 blueprint-root `review.md`의 대상 finding을 `status: accepted`, `accepted_risk: true`, `note`로 바꾸고 `rounds`는 건드리지 않는다.
  - G21은 `review_scope: blueprint` 최종 리뷰에서 `accepted_risk: true`와 비어 있지 않은 note를 함께 가진 `must_fix`를 닫힌 finding으로 본다. task 리뷰 규칙은 그대로다.
- 수용 기준: epic Success criteria 12–20.
- 검증 명령:
  - task별 `bouncer.verify`(task 전용 `node --test` argv).
  - 종단 TASKS-008의 `npm run ci`.
- 실패 모드·엣지 케이스:
  - 쓰기 전의 모든 거절은 ledger·포인터·`review.md`·task 문서 바이트를 바꾸지 않는다. 테스트는 거절 전후 바이트를 비교한다.
  - detach가 잠금 임계 구역에서 소유를 잃으면 ledger와 포인터를 쓰지 않고 `ledger-lock-lost`를 낸다.
  - 쓰기 뒤 잠금 해제가 실패하면 `withLedgerLock`이 `ledger-lock-lost`를 낸다. 이 경우만 바이트 불변의 예외다. detach는 재실행으로 `already: true`를 확인하라고 안내한다.
  - 이미 detached인 ledger는 지금처럼 `already: true`로 성공한다.
  - accept-risk로 일부 finding만 수용하면 문서는 `requested`로 남고, `next`는 계속 `final-review-blocked`다.
  - 같은 finding을 다시 수용하면 `review-finding-not-open`이다.
  - literal pathspec 적용 뒤에도 추적 경로와 추적 디렉터리 아래 새 경로의 판정은 같다.
  - commit이 할 일이 없는 상태(낡은 stamp, 깨끗한 tree)에서 next가 `commit`을 반복 선택하지 않는다.

## Out of scope
- epic Out of scope 전부.
- `salvageRevokedWorker` porcelain 파싱 통합과 liveHead 지연 계산. 의미가 달라지거나 실패 경로가 바뀐다.
- `reported+accepted → record` next 분기 변경.
- `:`로 시작하는 경로의 별도 사전 거절 코드.

## One-commit justification
- 일곱 commit task 모두 blueprint 001의 사전 거절 계약(`{ ok:false, reason, cause, next }`, 바이트 보존, 사용자 승인 경계)을 다시 맞춘다. 리뷰어는 이 계약과 위험 수용 종료가 일관되는지 한 PR에서 판정해야 한다.
