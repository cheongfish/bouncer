---
type: bouncer.blueprint
title: 지침 읽기 범위 축소
description: Route the coordinator to the execute references it needs and stop drive roles from re-reading documents already in context
resource: .bouncer/context/epics/083-drive-context-reduction/blueprints/002-instruction-read-scope/index.md
tags:
  - bouncer
  - blueprint
  - coordinator
  - agents
  - token-cost
timestamp: '2026-10-01T16:50:55.013+09:00'
bouncer:
  id: '002'
  epic_id: '083'
  blueprint_id: '002'
  status: closed
  commit_type: feat
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 002 지침 읽기 범위 축소

Epic: [083](../../index.md)

## Intent
coordinator 역할 문서가 worker payload·리뷰 라운드·verify 복구 절차로 `bouncer-execute`의 참조 세 개를 직접 가리키고, `bouncer-execute/SKILL.md`는 세션당 한 번만 읽게 한다.
drive 역할 문서와 run 스킬은 이미 문맥에 있는 역할 문서와 payload 문서를 다시 읽으라고 시키지 않는다.

## Contract
- 인터페이스
  - `agents/bouncer-coordinator.md` Drive 단계의 "run the task workflow"는 `skills/bouncer-execute/references/agent-dispatch.md`(worker payload), `review-round.md`(리뷰 라운드), `verification-recovery.md`(verify 실패 복구)를 경로로 가리킨다. task workflow의 verify 증적 준비·`tasks → verified`·execute gate는 `skills/bouncer-execute/SKILL.md` 4·6단계에만 있으므로 그 SKILL은 coordinator 세션에서 처음 한 번 읽고, 이후 task에서는 다시 읽지 않는다고 적는다.
  - `agents/bouncer-{coordinator,implementer,reviewer,debugger}.md` Hard guards에 재읽기 금지 한 항목: 자기 역할 문서가 named agent 로드, generic fallback payload, print prompt로 이미 문맥에 있으면 다시 Read하지 않고, dispatch payload가 본문을 실은 문서(task brief 등)도 다시 Read하지 않는다. inline fallback이 역할 문서를 처음 한 번 읽는 `rules/subagent-model.md` 4항은 그대로다.
  - `skills/bouncer-run/SKILL.md` 4단계에서 "read `agents/bouncer-coordinator.md` for coordinator authority"를 지운다.
- 데이터·상태: 문서만 바뀐다. CLI·원장·gate는 바뀌지 않는다.
- 수용 기준: epic Success criteria 3, 4, 7과 8 중 이 blueprint의 CHANGELOG 항목·CI 통과.
- 검증 명령: 구현 task 001은 `npm test`, 종단 task 002는 `npm run ci`.
- 실패 모드·엣지 케이스
  - inline fallback 경로(역할 문서가 문맥에 없음)는 여전히 역할 문서를 한 번 읽어야 한다. 재읽기 금지 문장은 "이미 문맥에 있을 때"로 한정한다.
  - run 스킬은 Role 절에서 `agents/bouncer-coordinator.md`를 여전히 이름으로 가리킨다(`test/skill-bouncer-run.test.js`가 경로 언급을 요구한다).
  - 진입 SKILL 단어 수 합계가 baseline(7795) 미만이어야 한다. 현재 7681이다.

## Out of scope
- epic Out of scope 전부.
- `skills/bouncer-execute/SKILL.md`와 그 `references/` 본문. 참조는 이미 나뉘어 있고 이번에는 가리키는 쪽만 바꾼다. SKILL의 verify·gate 단계를 참조로 옮기는 일도 하지 않는다.
- `rules/subagent-model.md`, `rules/cursor-print-dispatch.md`의 fallback·print payload 규칙.
- `agents/bouncer-context-reviewer.md`(plan 단계 역할).
- coordinator의 wave 종료·outcome 계약(blueprint 003).

## One-commit justification
- 구현 task 001이 역할 문서 네 개, 생성 TOML 네 개, run 스킬 한 줄, 문서 계약 테스트, CHANGELOG를 한 커밋으로 바꾼다. 문서와 그 문서를 고정하는 테스트·생성물이 함께 움직여야 CI가 통과한다.
- 종단 task 002는 통합 뒤 전체 CI만 실행한다.

## Documents
* [001 역할 문서 읽기 범위](tasks/001/tasks.md) - coordinator를 execute 참조로 안내하고 재읽기 금지를 적는다
* [002 종단 검증](tasks/002/tasks.md) - 통합 뒤 전체 CI
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
