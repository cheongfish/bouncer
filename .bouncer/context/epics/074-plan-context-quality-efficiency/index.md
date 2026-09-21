---
type: bouncer.epic
title: 계획 맥락 품질과 실행 효율 개선
description: Makes task briefs settle test seams and failure classes, ties worker reports to brief revisions, and trims plan-time context use.
resource: .bouncer/context/epics/074-plan-context-quality-efficiency/index.md
tags:
  - bouncer
  - epic
  - spec-authoring
  - context-review
  - dispatch
  - graph-suggest
timestamp: '2026-09-18T10:49:10.816+09:00'
bouncer:
  id: '074'
  epic_id: '074'
  status: approved
  supersedes: []
---
# 계획 맥락 품질과 실행 효율 개선

## Intent
- 문제: Epic 073 TASKS-001 brief는 Checklist가 주입 runner의 호출 횟수를 검사하라고 하면서 Interface에 seam 이름과 shape를 두지 않았고, throw 조건과 cache miss 조건을 한 목록에 섞었다. implementer 보고는 자신이 받은 brief revision과 attempt를 증명하지 못하며, plan 단계는 광역 검색·전체 대화 fork·과도한 Graphify traversal로 컨텍스트를 낭비했다.
- 목표: 기존 8개 brief 절 안에서 seam·실패 분류·기대 red를 확정하고(BP 001), 기존 `task_brief_hash`로 보고와 brief를 묶어 stale 보고를 거부하며(후속 BP 002), reviewer 입력과 Graphify 질의를 필요한 만큼으로 줄인다(후속 BP 003, BP 001 통합 뒤).

## Success criteria
1. `references/spec-authoring/index.md` tasks 규칙은 Checklist가 호출 횟수·I/O 부재·주입 오류를 검사할 때 Interface에 injection parameter 이름과 shape를 적도록 요구한다.
2. 같은 규칙은 Interface에서 즉시 throw하는 입력 오류와 cache miss·fallback으로 처리하는 상태를 서로 다른 목록으로 적도록 요구한다.
3. 같은 규칙은 Checklist red 단계에 기대 실패 assertion 또는 실패 지점을 적고, staging을 전제로 하는 생성물 검사에는 build → `git add` → 검사 순서를 적도록 요구한다.
4. `agents/bouncer-context-reviewer.md` rubric은 Checklist 검사 대상과 Interface seam의 불일치, throw/miss 혼합, 기대 red 누락을 finding 조건으로 명시한다.
5. implementer Output contract는 실행한 brief의 `task_brief_hash`를 돌려주고, coordinator는 현재 hash와 다른 보고를 accepted 또는 `coordinate record`로 넘기지 않는다.
6. coordinator는 implementer 실행 중 해당 brief를 revise하지 않고, 재디스패치 payload에 `attempt`와 `previous_outcome`을 싣는다.
7. named context reviewer dispatch는 대화 이력 없이 controller input만 받고, generic fallback은 role 본문 전체와 controller input을 받는다.
8. Graphify plan query 규칙(짧은 query, entry seed 1~2개, debug 1회·축소 재시도 1회)은 한 문서에만 정본으로 있고 다른 지침은 그 문서를 참조한다.
9. 각 blueprint의 커밋은 자신의 `affected_paths` 밖을 바꾸지 않고, 기존 계약 테스트(`test/skill-spec-authoring.test.js`의 8개 절·light 규칙, `test/skill-bouncer-plan.test.js`의 context reviewer fallback 본문 전달, `test/agents.test.js`의 TOML byte 비교)를 포함한 `npm test`가 통과한다.

## Out of scope
- task schema에 `Context`·`Done` 절 추가
- `task_brief_hash`와 별개인 두 번째 brief hash(`brief_sha256`) 도입
- 과거 epic, 전체 ledger, 다른 worker 보고를 implementer에 주입
- `bouncer.verify`와 별개인 두 번째 완료 기준
- 자연어 키워드(`주입`, `runner`, `deps` 등)에 의존하는 plan gate
- baseline 실패를 이유로 한 일괄 dispatch 거부
- Graphify traversal 상한 변경
- context-review 네 관점 또는 delta 인증 횟수 축소
- epic 067(coordinator)·070(brief 구체화)·073(intent bundle)이 확정한 계약의 재설계

## Blueprints
* [001 task-brief-contract-precision](blueprints/001-task-brief-contract-precision/index.md) - 성공 기준 1~4, 9: spec-authoring tasks 규칙·예시와 context reviewer rubric에 seam·실패 분류·기대 red 판정 추가
* [002 dispatch-revision-attempt-evidence](blueprints/002-dispatch-revision-attempt-evidence/index.md) - 성공 기준 5~6, 9: implementer dispatch와 보고를 task brief hash·attempt에 묶고 stale 보고의 수락과 record를 거부
