---
type: bouncer.tasks
title: 테스트 코드 줄 길이 제한 예외
description: 테스트 파일의 max-len 예외를 설정해 조건부 reference 계약의 긴 테스트 데이터를 lint가 막지 않게 한다
resource: .bouncer/context/epics/054-skill-context-optimization/blueprints/003-conditional-reference-split/tasks/005/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-27T12:49:53.199+09:00'
bouncer:
  id: TASKS-005
  epic_id: '054'
  blueprint_id: '003'
  status: verified
  verify: npm run ci
  commit_intent:
    - 테스트 계약 데이터가 줄 길이 규칙으로 CI를 막지 않게 함
    - 운영 코드의 기존 줄 길이 제한을 유지함
  affected_paths:
    - eslint.config.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-27T12:54:48.000+09:00'
    suggested_paths:
      - test
    # 유효 엔트리 필드: graph, status, query, result — 예시는 주석이라 파싱되지 않는다
    # - graph: source | context
    #   status: updated | reused | fail-skip | skip-disabled | missing
    #   query: <graphify 조회>
    #   result: <한 줄 요약>
    basis:
      - graph: source
        status: updated
        query: ESLint max-len test-only override conditional reference contract CI
        result: 81개 node; 상위 경로 test
      - graph: context
        status: updated
        query: ESLint max-len test-only override conditional reference contract CI
        result: 9개 node; 현재 blueprint 계약 문서
---
# Tasks

Blueprint: [003](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | context
     status: updated | reused | fail-skip | skip-disabled | missing
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
테스트 파일에는 `max-len`을 적용하지 않아, 조건부 reference의 로딩 조건처럼 긴 계약 문자열이 lint 실패를 만들지 않게 한다. 운영 코드에는 현재 120자 제한을 유지한다.

## Interface
- 제공: `test/**` 파일은 `max-len` 예외를 받아 긴 계약 데이터도 lint 대상에 남는다.
- 거부: 테스트 밖 파일의 `max-len` 120자 제한을 완화하거나 다른 ESLint 규칙을 끄지 않는다.

## Touch
- Modify `eslint.config.js` — `test/**`에만 적용되는 `max-len` 예외를 추가한다.

## Do not touch
- `skills/bouncer-finalize/**` — task 001의 조건부 reference 설계와 구현은 바꾸지 않는다.
- `test/skill-bouncer-finalize.test.js` — 이미 작성된 계약 테스트를 줄바꿈만을 위해 바꾸지 않는다.

## Constraints
- 테스트 경로에만 예외를 두고, 설정 파일의 기존 규칙과 순서를 불필요하게 재구성하지 않는다.
- 새 의존성이나 별도 lint 명령을 추가하지 않고 기존 `npm run ci`로 검증한다.

## Checklist
- [ ] 현재 `test/skill-bouncer-finalize.test.js`의 긴 로딩 조건 문자열이 `npm run ci`의 `max-len` 오류를 재현하는지 확인한다.
- [ ] `eslint.config.js`에 `test/**` 전용 `max-len` 예외를 추가한다.
- [ ] `npm run ci`로 테스트 파일의 줄 길이 오류가 사라지고 테스트 밖 규칙이 유지되는지 확인한다.
