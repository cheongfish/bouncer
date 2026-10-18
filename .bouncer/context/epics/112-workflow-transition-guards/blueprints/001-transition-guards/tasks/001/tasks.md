---
type: bouncer.tasks
title: 복구 task 생성값 검증 추가
description: Make coordinate repair and revise reject invalid verify and path metadata before writing the ledger or task documents.
resource: .bouncer/context/epics/112-workflow-transition-guards/blueprints/001-transition-guards/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
  - repair
  - scoped-terminal
  - affected-paths
timestamp: '2026-10-18T14:00:19.642+09:00'
bouncer:
  id: TASKS-001
  epic_id: '112'
  blueprint_id: '001'
  status: verified
  execution_kind: commit
  depends_on: []
  parallel_safe: true
  dependency_gate: integrated
  verify: node --test test/coordinator.test.js test/cli-coordinate.test.js test/coordinator-e2e.test.js test/commit-task.test.js
  review_risk:
    - public_interface
  affected_paths:
    - scripts/src/lib/coordinator.ts
    - scripts/src/lib/cli-git-commands.ts
    - scripts/src/lib/scope.ts
    - scripts/src/lib/command-argv.ts
    - scripts/src/lib/validate-gates.ts
    - test/coordinator.test.js
    - test/cli-coordinate.test.js
    - test/coordinator-e2e.test.js
    - test/commit-task.test.js
    - agents/bouncer-coordinator.md
    - references/coordinator-cards/blocked.md
    - skills/bouncer-run/SKILL.md
    - rules/cli.md
  commit_intent:
    - scoped_terminal blueprint의 복구 task가 종단 전체 명령과 추측한 경로를 받아 재배정이 반복되던 문제를 생성 시점에 막음.
  commit_summary:
    - coordinate repair가 task 전용 --verify와 integration HEAD에 추적된 경로만 받고, scope revision과 재검증 실패 증거도 같은 경로 규칙을 따르게 함.
  commit_sha: 6d10ba68
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`bouncer coordinate repair`와 `coordinate revise`가 처음부터 유효한 복구 task만 만든다. 그렇지 않으면 ledger와 task 문서를 쓰기 전에 거절한다. 수용 기준은 epic Success criteria 1–3이고, 완료 명령은 frontmatter `verify`다.

## Current behavior
- `resolveRepairVerify`(`scripts/src/lib/coordinator.ts:1182-1230`)는 종단 task의 `bouncer.verify`를 먼저 반환한다. 그다음 첫 integrated leaf의 verify를 반환한다. `verification_policy`(`verificationPolicyAt`, `:1597`)는 보지 않는다. 그래서 `scoped_terminal`에서도 repair task가 `npm run ci`를 받는다. G20(`checkScopedTerminalPolicy`, `scripts/src/lib/validate-gates.ts:646-763`)이 금지하는 상태다.
- `writeRepairDocuments`(`coordinator.ts:1312`)는 그 값을 `verify`에 쓰고(`:1334`, `:1346`) `--paths`를 `affected_paths`·Touch에 그대로 쓴다(`:1343`, `:1386`).
- 경로 검사는 `sourceRepairPaths`(`coordinator.ts:655-666`)의 문법 검사(절대경로·glob·`..`·`.git`·`.bouncer` 금지)뿐이다. 추적 여부는 보지 않는다.
- CLI 파싱(`scripts/src/lib/cli-git-commands.ts`):
  - `--paths`는 `collectPathValues`(`:223-233`)가 모은다.
  - repair 전용 플래그 검사는 `:800-833`, core 호출은 `:1000-1002`, help는 `:439-475`(repair)·`:422-437`(revise)다.
  - `--verify`·`--new-path`는 없다.
- 실행 순서(CI 원인 분기 `coordinator.ts:4275-4330`, 리뷰 원인 분기 `:4194-4269`):
  1. `sourceRepairPaths`(`:4285`·`:4205`)
  2. ledger 객체 수정
  3. `writeRepairDocuments`(`:4313`·`:4256`)
  4. `commitWrite`

  새 검사는 1번 직후에 들어가야 mutation 전 거절이 된다.
- `reviseTaskScope`(`scripts/src/lib/scope.ts:662-797`)는 glob·범위 밖 경로만 검사하고(`:673-680`) task 문서를 먼저 쓴다(`:715`). integration 경로는 `coordinatorPaths`(`scope.ts:438-445`)로 얻을 수 있다.
- 재검증 실패 증거는 `paths: lastRepair.nextScope`(`coordinator.ts:2786-2789`)를 쓴다. 이 값은 r1 scope라서 scope revision 뒤에는 낡는다. 현재 scope는 `currentScopePaths(task)`(`:1611`)에 있다.
- 관찰된 사례(blueprint 111/002 ledger, 읽기 전용):
  - decision 7: repair wave 1의 `nextScope`가 존재하지 않는 `scripts/src/commands/ontology.ts`, `test/ontology.test.ts`였다. 이 decision보다 앞선 debugger 보고는 없다. coordinator가 추측한 `--paths`를 CLI가 받아들인 것이다.
  - 이어서 r2 scope 정정(decision 8)과 `task_change` 두 번(decision 10·12)이 나왔다. 하나는 전체 CI verify 때문이고, 하나는 셸 연산자 verify 때문이었다.
- 재사용할 부품:
  - `parseVerifyArgv`(`scripts/src/lib/command-argv.ts:26`, export `:112`).
  - G20의 정규화 규칙 `trim().replace(/\s+/g,' ')`. 지금은 `validate-gates.ts:677-678`의 지역 closure에 있다.
  - 추적 검사 선례: `git ls-files --`(`coordinator.ts:4066`).
- 테스트:
  - `test/coordinator.test.js:3457`은 legacy blueprint에서 repair verify가 종단 값이라고 고정한다.
  - repair 호출 24곳 다수가 fixture에 없는 `paths: ['src/fix.js']`를 쓴다.
  - `test/cli-coordinate.test.js:175` fixture는 디렉터리 scope `src/auth/`를 쓴다.
  - revise 단위 테스트는 `test/commit-task.test.js:532-890`에 있다.
- 재현: `npm run build` 후 `scoped_terminal` fixture에서 `coordinate repair --failure-command "npm run ci" --paths missing.js ...`를 실행하면 `ok: true`가 나오고, repair 문서의 verify는 `npm run ci`다.

## Target behavior
- 성공:
  - `scoped_terminal`에서 repair는 `--verify`로 받은 값을 repair 문서 `bouncer.verify`에 쓴다.
  - 경로가 모두 통과하면 지금과 같은 ledger·문서 구조를 만든다.
  - legacy blueprint에서 `--verify`가 없으면 지금의 `resolveRepairVerify` 결과를 그대로 쓴다. `--verify`가 있으면 단일 argv 검사(`repair-verify-not-single-argv`)만 적용하고 그 값을 쓴다. 종단 명령 비교(`repair-verify-is-terminal`)와 필수 검사(`repair-verify-required`)는 `scoped_terminal` 전용이다.
- 실패(ledger·문서 바이트 불변, exit 1, `cause`·`next` 포함):
  - `scoped_terminal`에 `--verify` 없음 → `repair-verify-required`. next는 실패 원인 파일만 검사하는 단일 argv를 `--verify`로 넘기라는 안내다.
  - `parseVerifyArgv` 실패(셸 연산자·빈 값) → `repair-verify-not-single-argv`.
  - 정규화한 값이 종단 verify와 같음 → `repair-verify-is-terminal`.
  - `--paths` 항목이 integration HEAD에서 `git ls-files -- <p>` 결과 0건 → `scope-path-untracked`. 출력의 `paths`에 해당 항목을 싣는다.
  - `--new-path` 항목의 부모 디렉터리가 integration HEAD 추적 파일의 조상이 아님 → `scope-new-path-parent-missing`.
  - revise의 같은 경로 위반도 같은 코드로 task 문서 쓰기 전에 거절한다.
- 보존:
  - `--resume-task` 경로, 리뷰 원인 repair의 finding 처리, wave 상한, 종단 의존 재배선(`:4297`)은 바뀌지 않는다.
  - 재검증 실패 증거 `paths`는 복구 task의 현재 scope다.

## Interface
- 제공:
  - `coordinate repair`에 `--verify <argv>`(단일 값)와 `--new-path <p>`(반복 가능)를 추가한다.
  - `coordinate revise`에 `--new-path <p>`(반복 가능)를 추가한다. 최종 scope는 `--paths` ∪ `--new-path`다.
  - `command-argv.ts`에서 `normalizeVerifyCommand(cmd: string): string`을 export하고, G20도 이 함수를 쓴다.
  - 공유 경로 검사 `신규 추출 지점: trackedScopeViolations(exec, integrationPath, paths, newPaths) → { untracked: string[], parentMissing: string[] }`.
- 거부(throw 없이 `ok:false` 반환): 위 Target behavior의 다섯 코드.
- 거부(사용법 exit 2): `--verify` 값 누락, `--new-path` 값 누락, `--resume-task`와 `--verify` 동시 사용.
- 용어:
  - "추적 경로"는 integration worktree에서 `git ls-files -- <p>`가 1줄 이상 내는 경로다. 예: `scripts/src/lib/scope.ts`, `src/auth/`.

## Touch
| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinator.ts` | `resolveRepairVerify`, `sourceRepairPaths`, `coordinate` repair 분기, 재검증 실패 증거 | Modify | repair 생성, verify 결정, 실패 증거 기록 | 정책별 verify 검사, 추적 경로 검사, `nextScope` → 현재 scope | `:1182`, `:655`, `:4194-4330`, `:2789` |
| `scripts/src/lib/cli-git-commands.ts` | repair·revise 파싱과 help | Modify | 플래그 수집과 usage | `--verify`·`--new-path` 파싱, 배타 검사, help | `:223`, `:422-475`, `:800-833`, `:877-918` |
| `scripts/src/lib/scope.ts` | `reviseTaskScope` | Modify | scope revision 기록 | 문서 쓰기 전 추적 경로 검사 | `:662-797` |
| `scripts/src/lib/command-argv.ts` | `normalizeVerifyCommand` | Modify | verify argv 파싱 | 정규화 함수 export | `:26`, `:112` |
| `scripts/src/lib/validate-gates.ts` | `checkScopedTerminalPolicy` | Modify | G20 판정 | 지역 정규화를 공유 함수로 교체(동작 불변) | `:677-678` |
| `test/coordinator.test.js` | repair 테스트 | Modify | repair 동작 고정 | `scoped_terminal` 거절·성공 케이스 추가, legacy `:3457` 유지, fixture 경로를 추적 파일로 변경 | `:3322-3500`, `:525`, `:4966` |
| `test/cli-coordinate.test.js` | repair·revise 플래그 테스트 | Modify | CLI 플래그 고정 | 새 플래그·exit 2 케이스 | `:705-1372`, `:367-503` |
| `test/coordinator-e2e.test.js` | repair 통합 e2e | Modify | repair 통합 증적 | `scoped_terminal` repair → 통합 → 재검증 경로 | `:659` |
| `test/commit-task.test.js` | revise 단위 테스트 | Modify | scope revision 고정 | 미추적 경로 거절, `--new-path` 허용 | `:532-890` |
| `agents/bouncer-coordinator.md` | repair 절차 | Modify | coordinator repair 지시 | `--verify`·경로 출처(실패 증거·debugger 보고) 규칙 | `:100-118` |
| `references/coordinator-cards/blocked.md` | repair 카드 | Modify | 차단 시 repair 안내 | 같은 규칙과 거절 코드 대응 | `:27-41` |
| `skills/bouncer-run/SKILL.md` | repair 단락 | Modify | run 스킬의 repair 안내 | 같은 규칙 한 줄 | `:60-69` |
| `rules/cli.md` | coordinate repair·revise 항목 | Modify | CLI 계약 표 | 새 플래그와 거절 코드 | `:111-120` |

## Do not touch
- `.worktrees/` — blueprint 111 실행 증적이며 수정하지 않는다.
- `scripts/src/lib/current.ts` — TASKS-004 범위.
- `scripts/src/lib/commit-hook.ts` — TASKS-005 범위.
- `test/cli-ontology.test.js` — CT-001 범위 밖.
- `scripts/src/lib/context-ontology.ts` — ontology 검색 동작 범위 밖.

## Constraints
- 모든 새 검사는 ledger 객체 수정과 문서 쓰기보다 먼저 실행한다.
- legacy blueprint(`verification_policy` 없음)에서 `--verify`를 주지 않은 repair의 verify 결정은 바이트 단위로 같다.
- G20 판정 결과는 바뀌지 않는다. 정규화 함수를 옮길 뿐이다.
- 새 거절 코드는 `COORDINATE_FAILURE_HINTS`(`coordinator.ts:4609`)에 `cause`·`next`를 함께 등록한다. 등록 누락은 reason 완전성 테스트(`test/coordinator.test.js:130-169`)가 잡는다.
- 문서 수정은 `scripts/check-doc-shape.js`가 요구하는 heading·link를 유지한다.
- 사용자 표시 문구 원칙(AGENTS.md hard rule 5)과 기존 CLI 출력 언어 관례를 따른다.

## Checklist
- [ ] `npm run build`.
- [ ] 실패 테스트 작성:
  - `scoped_terminal` fixture에서 `--verify` 없는 CI repair는 `repair-verify-required`를 반환하고 ledger·`tasks/` 바이트가 같다.
  - `--verify "npm run ci"`(종단과 같음) → `repair-verify-is-terminal`.
  - `--verify "a && b"` → `repair-verify-not-single-argv`.
  - `--paths scripts/src/commands/ontology.ts`(미추적) → `scope-path-untracked`, `paths`에 해당 항목.
- [ ] 실패 테스트 작성(경로 규칙):
  - repair에 `--new-path scripts/src/lib/new-guard.ts`(부모 추적됨)를 주면 성공한다. 그 경로가 repair 문서 `affected_paths`에 들어간다.
  - `--new-path nope/dir/x.ts`(부모 없음) → `scope-new-path-parent-missing`, ledger·문서 바이트가 같다.
  - `coordinate revise --paths scripts/src/commands/ontology.ts` → `scope-path-untracked`. task 문서와 ledger 바이트가 같다(`reviseTaskScope`가 문서를 쓰기 전에 거절).
  - `coordinate revise --new-path <부모 추적 경로>` → 성공. 최종 scope는 `--paths` ∪ `--new-path`다.
  - legacy fixture에서 `--verify "a && b"` → `repair-verify-not-single-argv`. `--verify` 없이 실행하면 기존 종단 값을 쓴다.
- [ ] 위 테스트가 기대한 assertion에서 실패하는지 확인한다(`ok: true`가 나와 실패해야 한다).
- [ ] `normalizeVerifyCommand` 추출 → G20 사용처 교체.
- [ ] `trackedScopeViolations`를 구현하고 repair 두 분기의 `sourceRepairPaths` 직후, `reviseTaskScope`의 문서 쓰기 전에 호출한다.
- [ ] `resolveRepairVerify`를 정책별로 분기하고 CLI 플래그를 파싱한다.
- [ ] 재검증 실패 증거 `paths`를 `currentScopePaths(repairTask)`로 바꾸고, r2 revision 뒤 실패 증거가 r2 경로를 담는 테스트를 추가한다.
- [ ] 성공 케이스: `--verify "node --test test/a.test.js"`와 추적 경로로 만든 repair 문서의 `verify`·`affected_paths`가 입력과 같고, 그 blueprint가 `bouncer validate --gate plan`의 G20을 통과한다.
- [ ] legacy repair 테스트(`:3457`)가 수정 없이 통과한다. 미추적 `src/fix.js`를 쓰던 fixture는 추적 파일로 바꾼다.
- [ ] 문서 4개에 규칙을 반영한다: repair 경로는 실패 증거·debugger 보고에 나온 추적 파일에서 가져오고, `scoped_terminal`에서는 원인 파일만 검사하는 `--verify`를 넘긴다. 그다음 `npm run lint:docs`.
- [ ] 완료 명령: `node --test test/coordinator.test.js test/cli-coordinate.test.js test/coordinator-e2e.test.js test/commit-task.test.js`.
