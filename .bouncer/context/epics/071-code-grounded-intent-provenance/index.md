---
type: bouncer.epic
title: 코드 기반 의도 provenance
description: Connects code changes to durable task intent through stable task identifiers and commit provenance.
resource: .bouncer/context/epics/071-code-grounded-intent-provenance/index.md
tags:
  - bouncer
  - epic
  - commit-provenance
  - stable-task-id
  - intent
timestamp: '2026-09-14T10:15:00.281+09:00'
bouncer:
  id: '071'
  epic_id: '071'
  status: approved
  supersedes: []
---
# 코드 기반 의도 provenance

## Intent

현재 코드가 왜 그 형태가 되었는지 알려면 변경 커밋과 당시 승인한 Task·Explain을 연결해야 한다. stable Task ID를 Git trailer와 Explain에 보존하고, 현재 함수 정의에서 그 연결을 역추적하는 조회 경로를 제공한다.

## Success criteria

1. 새 commit message에 `Bouncer-Task`와 `Bouncer-Intent` trailer가 각각 한 번 기록된다.
2. dry-run이 표시한 commit message와 실제 Git commit message가 같다.
3. Explain의 새 `task_commits` 행이 stable Task ID와 소문자 8자리 SHA를 보존한다.
4. 기존 `{ id, sha }` Explain 행과 기존 8자리 `commit_sha`를 계속 읽을 수 있다.
5. standalone과 coordinator worker commit이 같은 trailer 규칙을 사용한다.
6. `execution_kind: verification` Task는 commit provenance를 만들지 않는다.
7. coordinator가 worker commit을 cherry-pick한 뒤에도 Task trailer가 유지된다.
8. 고유한 TypeScript 또는 JavaScript 함수명은 현재 source 정의의 경로·qualified name·line range·blob SHA로 해석된다.
9. 동명 source 정의가 둘 이상이면 하나를 추측하지 않고 opaque candidate 목록을 반환한다.
10. TypeScript source와 생성 JavaScript가 겹치면 source를 정본으로 선택하고 generated 후보를 구분한다.
11. 함수 line의 Git commit을 stable Task trailer 또는 Explain SHA 역색인으로 Task·Explain에 연결한다.
12. 후속 변경이 있는 과거 의도는 `possibly-superseded` 또는 `historical`로 구분한다.
13. `unresolved`와 `unlinked`는 계획을 중단시키는 예외가 아니라 exit 0의 상태 payload다.
14. resolver는 candidate를 기본 3개·최대 5개로 제한하고, 반환하는 Explain 선택 본문을 합계 2,000 UTF-8 byte 이하로 자른다.
15. `npm run ci`가 통과한다.

## Out of scope

- Plan의 code-first 전환과 `scope_evidence` gate 변경
- context graph 생성·질의·설정 제거
- 과거 Explain과 commit의 일괄 변환
- 8자리 SHA 계약을 full SHA로 바꾸는 작업
- TypeScript와 JavaScript 밖의 언어, 익명 callback, 계산된 property, runtime 생성 함수 지원

## Blueprints

* [001 Task commit provenance](blueprints/001-task-commit-provenance/index.md) - commit message와 Explain에 stable Task ID 기반 provenance를 기록한다.
* [002 Function intent resolver](blueprints/002-function-intent-resolver/index.md) - 현재 함수 정의에서 Git commit과 연결된 Task·Explain 의도를 역추적한다.
