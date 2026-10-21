---
type: bouncer.blueprint
title: 테스트 이름 형식 검사
description: Rename every test in test/*.test.js to the condition-arrow-result form and fail npm run ci on any non-conforming test name.
resource: .bouncer/context/epics/gates-review/blueprints/test-name-lint/index.md
tags:
  - bouncer
  - blueprint
  - testing
  - lint
  - ci
timestamp: '2026-10-12T10:47:02.880+09:00'
bouncer:
  id: test-name-lint
  epic_id: gates-review
  blueprint_id: test-name-lint
  status: closed
  order: 10
  commit_type: test
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 002 테스트 이름 형식 검사

Epic: [095](../../../coding-standards-pr-retro/index.md)

## Intent
테스트 1,676개 가운데 33개만 `<조건> → <결과>` 이름 규칙을 지켜 사람이 실패 목록만 보고 깨진 조건을 알기 어려움.
모든 테스트 이름을 규칙에 맞추고 `npm run ci`가 어긋난 이름을 거절하게 함.

## Diagram
```mermaid
flowchart LR
  L[테스트 이름 검사]
```

## Contract
- 인터페이스: 새 스크립트 `scripts/check-test-names.js`와 npm script `lint:test-names`(TASKS-005). `ci` 체인은 `… && npm run typecheck && npm run lint:test-names && npm audit …`이 된다(TASKS-006).
- 데이터·상태: 기존 테스트의 본문·단언·파일 계층은 바뀌지 않는다. 이름 변경 task(TASKS-001~004)가 바꾸는 것은 `test(`·`it(` 첫 인자 문자열뿐이다. 예외는 두 가지다. TASKS-005는 새 테스트 파일 `test/check-test-names.test.js`를 만들고 `test/tiers.json` unit에 등록한다. TASKS-006은 `test/ci-contract.test.js`에 ci 순서 단언을 더한다.
- 규칙 정의 — 적합한 이름: 첫 인자가 문자열 리터럴 또는 template literal이고, 그 텍스트에 ` → `(공백, U+2192, 공백)가 있으며, 앞뒤 조각이 각각 공백 아닌 글자를 하나 이상 갖는다. template literal의 `${…}`는 글자로 친다. 예: `'빈 brief → G10 실패'`, `` `${skill} 카탈로그 → ACQ 절과 일치` ``.
- 수용 기준: epic Success criteria 4와 BP 범위의 10이 참이다.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - ASCII `->`는 부적합이다.
  - 첫 인자가 식별자·함수 호출이면 부적합이다(이름을 검사할 수 없다).
  - `.test(`(정규식 메서드)와 `submit(` 같은 다른 호출은 대상이 아니다.
  - 여러 줄에 걸친 호출도 첫 인자 기준으로 판정한다.

## Out of scope
- 기존 테스트의 본문·단언·fixture 변경(Contract의 두 예외 제외)
- `describe`·subtest 도입
- 테스트 이름의 언어 통일(기존 언어 유지)
- `test/helpers/` 아래 파일

## One-commit justification
- 검사기(TASKS-005)를 먼저 커밋한다. 이름 변경은 서로 겹치지 않는 파일 묶음 4개(TASKS-001~004)로 나눠, 그 검사기로 각자 검증하며 병렬 커밋한다. ci 연결(TASKS-006)은 모두 integrated된 뒤 커밋한다. 여섯 커밋 모두 같은 이름 규칙 하나를 고정하므로 한 PR로 리뷰한다.

## Documents
* [Tasks 005](tasks/005/tasks.md) - 이름 검사기(먼저 실행)
* [Tasks 001](tasks/001/tasks.md) - 묶음 1 이름 변경(acq-gate-ids … coordinator-e2e)
* [Tasks 002](tasks/002/tasks.md) - 묶음 2 이름 변경(coordinator … graph-search)
* [Tasks 003](tasks/003/tasks.md) - 묶음 3 이름 변경(graphify … scaffold)
* [Tasks 004](tasks/004/tasks.md) - 묶음 4 이름 변경(schema … verification-runner)
* [Tasks 006](tasks/006/tasks.md) - ci 연결
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
