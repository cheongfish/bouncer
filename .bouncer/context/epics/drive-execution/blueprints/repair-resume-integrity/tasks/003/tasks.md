---
type: bouncer.tasks
title: scope 개정 시 승인된 .bouncer 경로 유지 허용
description: Let coordinate revise carry over out-of-bounds paths already in the approved scope
resource: .bouncer/context/epics/drive-execution/blueprints/repair-resume-integrity/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
  - coordinator
  - scope
  - revise
timestamp: '2026-10-20T21:02:18.243+09:00'
bouncer:
  id: TASKS-003
  epic_id: drive-execution
  blueprint_id: repair-resume-integrity
  status: ready
  execution_kind: commit
  depends_on: []
  parallel_safe: true
  dependency_gate: integrated
  affected_paths:
    - scripts/src/lib/scope.ts
    - test/current.test.js
  commit_intent:
    - 승인 scope에 .bouncer/epics.json이 있는 task는 revise가 그 경로를 거절해 scope를 바꿀 수 없던 문제를 막음.
  commit_summary:
    - 직전 승인 scope에 정확히 있던 경로만 bounds 검사에서 면제함.
  review_risk: []
  verify: node --test test/current.test.js
---
# Tasks

Blueprint: [repair-resume-integrity](../../index.md)

## Goal & intent
`coordinate revise`가 직전 승인 scope에 이미 있던 경로를 bounds 검사에서 면제해, `.bouncer/epics.json`처럼 plan에서 승인된 경로를 가진 task도 scope를 개정할 수 있게 한다. 수용 기준은 blueprint Contract 4이고 검증 명령은 `node --test test/current.test.js`다.

## Current behavior
- `reviseTaskScope`(`scripts/src/lib/scope.ts:762`)는 lock 전에 `outOfBoundsScopePaths(next)`(`:452-460`: 빈 값·트리 전체·절대·`~`·`..`·`.bouncer`·`.git`)로 거절한다(`:782-785`). 이 시점에는 원장·문서를 읽지 않아 승인 scope를 모른다.
- 승인 scope는 lock 안에서 `previous = entry.scope ? entry.scope.paths : declared`(`:811`, declared = task 문서 `affected_paths`)로 읽는다. 추적 검사 `trackedScopeViolations`(`:816-827`)도 쓰기 전에 거절한다.
- plan gate G5는 `affected_paths` 비어 있음만 보므로 `.bouncer/epics.json`을 승인할 수 있다.
- 기존 테스트: `test/cli-coordinate.test.js:472`(새 `.bouncer/context/` 경로 거절), `test/current.test.js:1243-1284`(revise 직접 호출). 승인 경로 유지 사례는 없다.

## Target behavior
- 성공: `next` 중 정규화 값(앞 `./` 제거, 뒤 `/` 제거, POSIX 구분자)이 `previous`의 정규화 값과 정확히 같은 경로는 bounds 검사에서 면제한다. 예: 승인 `['.bouncer/epics.json', 'src/a.js']` → revise `['.bouncer/epics.json', 'src/a.js', 'src/b.js']` 성공.
- 실패: 면제되지 않은 경로가 `outOfBoundsScopePaths`에 걸리면 `scope-path-out-of-bounds`와 그 `paths`로 거절하고 원장·문서 바이트를 바꾸지 않는다. 승인 경로의 하위 경로(`.bouncer/context/x` 아래 등)와 새 `.bouncer/`·`.git/` 경로는 면제하지 않는다.
- 판정 순서: 옮긴 bounds 검사는 lock 안에서 `previous` 계산 직후, `trackedScopeViolations`보다 앞에서 실행한다. 그래서 새 범위 밖 경로는 `scope-path-untracked`가 아니라 `scope-path-out-of-bounds`로 거절된다.
- 보존: glob 거절(`scope-path-glob`)과 빈 집합 거절은 lock 전 그대로. `test/cli-coordinate.test.js:472` 결과도 같다.

## Interface
- 제공: `reviseTaskScope` 성공 조건 확장(직전 승인 경로 정확 일치 면제). 반환 모양은 같다.
- 거부: `scope-path-out-of-bounds` — 면제되지 않은 범위 밖 경로. 판정 위치가 lock 안(쓰기 전)으로 옮겨진다.
- 용어: "직전 승인 scope" = `entry.scope.paths`, 없으면 task 문서 `affected_paths`. 예: `['.bouncer/epics.json']`.

## Touch
| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/scope.ts` | `reviseTaskScope`, `outOfBoundsScopePaths` 주석 | Modify | lock 전 범위 밖 경로 일괄 거절 | lock 안에서 직전 승인 경로를 뺀 나머지만 거절, 주석·JSDoc 갱신 | 상태 변경 진입점(`:438-460`, `:752`, `:782-811`) |
| `test/current.test.js` | revise 직접 호출 테스트 | Modify | 승인 경로 유지 사례 없음 | 승인 `.bouncer/epics.json` 유지 성공·새 `.bouncer/` 경로 거절·하위 경로 거절 단언 추가 | 검증 지점(`:1243-1284`) |

## Do not touch
- `scripts/src/lib/coordinator-commands.ts` — 힌트 문구는 새 경로 거절 안내로 그대로 유효하고 TASKS-001·004가 소유
- `test/cli-coordinate.test.js` — TASKS-001 범위, 기존 거절 단언은 그대로 통과해야 함
- `scripts/src/lib/validate-gates.ts` — plan gate 규칙은 바꾸지 않음

## Constraints
- 거절된 revise는 원장·task 문서 바이트를 바꾸지 않는다.
- 면제는 정확 일치만 허용한다. `isUnder` 접두 비교로 넓히지 않는다.

## Checklist
- [ ] `test/current.test.js`에 승인 `affected_paths: ['.bouncer/epics.json', 'src/a/']`인 task로 `reviseTaskScope({ paths: ['.bouncer/epics.json', 'src/a/', 'src/b/'] ... })` 테스트를 추가한다. 기대 red: `ok: false, reason: 'scope-path-out-of-bounds'`라 `assert.strictEqual(res.ok, true)`가 실패한다.
- [ ] fixture 조건: 성공 사례가 쓰는 `.bouncer/epics.json`, `src/a/`, `src/b/`를 fixture의 integration checkout에 커밋해 둔다. 커밋하지 않으면 `trackedScopeViolations`가 `scope-path-untracked`로 거절해 면제 판정을 검증하지 못한다.
- [ ] 새 `.bouncer/context/x.md` 추가와 `.bouncer/epics.json/child` 하위 경로는 `scope-path-out-of-bounds`이고 파일 바이트가 같다는 단언을 추가한다.
- [ ] `npm run build` 후 `node --test test/current.test.js`로 red를 확인한다.
- [ ] bounds 검사를 lock 안 `previous` 계산 직후, `trackedScopeViolations` 앞으로 옮기고 정확 일치 면제를 넣는다.
- [ ] `node --test test/current.test.js`가 통과한다.
