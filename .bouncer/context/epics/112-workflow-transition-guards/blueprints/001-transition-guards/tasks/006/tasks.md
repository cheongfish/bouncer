---
type: bouncer.tasks
title: commit-hook 테스트 이름 형식 수정
description: Rename the commit-hook test at line 544 so lint:test-names accepts it without changing the test behavior.
resource: .bouncer/context/epics/112-workflow-transition-guards/blueprints/001-transition-guards/tasks/006/tasks.md
tags:
  - bouncer
  - tasks
  - test-names
  - ci
timestamp: '2026-10-18T14:06:45.651+09:00'
bouncer:
  id: TASKS-006
  epic_id: '112'
  blueprint_id: '001'
  status: verified
  execution_kind: commit
  depends_on: []
  parallel_safe: true
  dependency_gate: integrated
  verify: node scripts/check-test-names.js test/commit-hook.test.js
  review_risk: []
  affected_paths:
    - test/commit-hook.test.js
  commit_intent:
    - develop의 commit-hook 테스트 이름 하나가 필수 구분자를 빠뜨려 전체 CI가 이번 변경과 무관하게 실패하던 상태를 정리함.
  commit_summary:
    - test/commit-hook.test.js:544 테스트 이름을 조건 → 결과 형식으로 바꾸고 테스트 본문은 그대로 둠.
  commit_sha: 964b6713
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`test/commit-hook.test.js:544`의 테스트 이름을 `조건 → 결과` 형식으로 고친다. 그러면 `lint:test-names`가 통과하고 종단 `npm run ci`가 이 실패 없이 판정된다. 사용자가 이번 계획 범위에 포함하기로 결정했다. 수용 기준은 epic Success criteria 10이고, 완료 명령은 frontmatter `verify`다.

## Current behavior
- `test/commit-hook.test.js:544`: `test('a git -C worker commit uses its explicit worktree when the hook receives the main cwd', ...)`.
- `scripts/check-test-names.js:7`은 구분자 `' → '`를 요구한다.
- 재현: `node scripts/check-test-names.js test/commit-hook.test.js`를 실행하면 `missing-arrow`와 exit 1이 나온다(2026-10-18 develop `37b7801e`에서 확인).

## Target behavior
- 성공: 이름이 `git -C worker commit with the main cwd in the hook → uses the explicit worker worktree`가 되고, 위 명령이 exit 0으로 끝난다.
- 보존: 테스트 본문·assertion·순서는 바뀌지 않는다. 같은 파일의 다른 테스트 이름도 그대로다.

## Interface
- 제공: 테스트 이름 한 줄 변경.
- 거부: 테스트 본문 변경, 다른 테스트 추가·삭제.

## Touch
| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `test/commit-hook.test.js` | `:544` 테스트 이름 | Modify | hook의 `git -C` worktree 해석 검증 | 이름만 `조건 → 결과` 형식으로 | `scripts/check-test-names.js:7` |

## Do not touch
- `scripts/check-test-names.js` — 규칙은 그대로다.
- `scripts/src/lib/commit-hook.ts` — 동작 변경 없음.

## Constraints
- 이름 문자열만 바꾼다. 다른 줄의 diff는 0이어야 한다.

## Checklist
- [ ] `node scripts/check-test-names.js test/commit-hook.test.js`가 exit 1로 실패하는지 확인한다.
- [ ] `:544` 이름을 `git -C worker commit with the main cwd in the hook → uses the explicit worker worktree`로 바꾼다.
- [ ] `git diff --stat`이 1 file, 1 line 변경인지 확인한다.
- [ ] 완료 명령: `node scripts/check-test-names.js test/commit-hook.test.js`.
