---
type: bouncer.explain
title: test-tiers-plan-gate explain
description: Explain for test-tiers-plan-gate
resource: .bouncer/context/epics/gates-review/blueprints/test-tiers-plan-gate/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-28T13:07:25.346+09:00'
bouncer:
  id: EXPLAIN-test-tiers-plan-gate
  epic_id: gates-review
  blueprint_id: test-tiers-plan-gate
  status: published
  comprehension:
    - range_from: 477e22e3639e6257d277c6ab814295cbde50a096
      range_to: 08d63e264a796b188b89d8c77bd282ce727c9793
      diff_sha: 74beec3140c956382613980aa29821a40e1fe6719783c1581b14694ea81d6af7
      recorded_at: '2026-10-28T13:10:44.197+09:00'
  task_commits:
    - task: gates-review/test-tiers-plan-gate/001
      sha: 131b4fe8
      intent_anchor: task-001
    - task: gates-review/test-tiers-plan-gate/002
      sha: 6b1b68d0
      intent_anchor: task-002
    - task: gates-review/test-tiers-plan-gate/003
      sha: 08d63e26
      intent_anchor: task-003
---
# Explain

## Background

새 테스트 파일을 추가하면서 `test/tiers.json`에 등록하지 않으면, 종단 `npm run ci`의 tier 검사에서야 실패가 드러난다. task 전용 verify는 단일 argv라 `&&`로 여러 검사를 묶을 수 없어 이름 규칙, tier 등록, 문서 인용 같은 정적 검사가 task 단계 밖에 있었다. 그 결과 늦게 발견된 실패가 repair wave를 반복해서 소모했다.

이 변경은 두 가지로 이를 앞당긴다. 하나는 tier 미등록을 승인 전에 막는 plan gate `G33`이다. 다른 하나는 정적 검사와 tier별 실행을 한 줄로 돌리는 `scripts/check-task.js`이다. plan 작성 지침에는 task verify에 이 래퍼를 넣으라는 문장을 더했다.

## Code

- `packages/cli/src/validate-gates-plan.ts`: `checkTaskScope`에 `G33`을 추가했다. 판정은 이 함수 한 곳에만 있어서 plan gate와 plan draft가 같은 답을 낸다. 저장소에 `test/tiers.json`이 있고, commit task가 새 `test/<name>.test.js`를 만들면서 `affected_paths`에 `test/tiers.json`이 없으면 실패한다.
  - 새 테스트 후보는 Touch 표의 `Create`와 `Rename` 도착 경로, 그리고 Touch가 `Modify`·`Delete`로 선언하지 않은 `affected_paths` 항목이다. `Modify` 행이 있는 파일은 선행 task가 만든다고 보고 새 파일로 세지 않는다. 후보 중 checkout에 이미 있는 파일은 제외한다.
  - 한계: Touch 셀 안에 `|`가 들어간 경로는 열이 밀려 인식되지 않는다.
  - `repoRoot`가 없는 순수 호출에서는 `tiers.json` 존재를 알 수 없어 G33을 건너뛴다.
- `packages/cli/src/composite-gates.ts`, `validate.ts`, `rules/cli.md`: 복합 gate 목록과 힌트, CLI 규칙 문서에 G33을 등록했다.
- `scripts/check-task.js`: 테스트 파일 경로를 받아 순서대로 검사한다. 사전 검사(형식, 존재, `tiers.json` 읽기), 이름 lint, tier 등록, 고정 검사 두 파일, unit tier(no-spawn guard 아래), integration tier 순이다. 단계가 실패해도 남은 단계를 끝까지 돌리고 마지막에 1로 끝난다. 인자가 없으면 2이다.
  - 설계 선택: 중첩 `node --test`가 부모의 `NODE_TEST_CONTEXT`를 물려받으면 파일을 건너뛰고 exit 0이 되므로 래퍼가 그 변수를 지운다.
  - 설계 선택: `tiers.json` 읽기 실패 중 ENOENT·EISDIR·파싱 오류만 같은 안내로 묶고, 권한 오류 같은 다른 원인은 그대로 던진다.
  - 알려진 빈틈: `tiers.json` 내용이 JSON `null`이면 이유를 쓰지 않고 1로 끝난다.
- `skills/bouncer-plan/SKILL.md`, `references/spec-authoring/index.md`: task verify에 정적 검사 래퍼를 구성하라는 지침 문장을 더했다.
- 테스트: `test/validate-gates.test.js`, `test/composite-gates.test.js`, `test/validate-hints.test.js`, `test/check-task.test.js`가 새 동작을 단언한다. `test/check-task.test.js`는 unit tier에 등록했고 실제 프로세스를 띄우지 않는다.

## Quiz

1. `G33`은 언제 실패하는가? (A) test 파일을 건드리는 모든 task가 `tiers.json`을 선언하지 않았을 때 / (B) 저장소에 `test/tiers.json`이 있고, commit task가 새 `test/<name>.test.js`를 만들면서 `affected_paths`에 `test/tiers.json`이 없을 때 / (C) verification task의 `affected_paths`가 비어 있을 때
2. Touch 표에 `test/foo.test.js`가 `Modify` 행이고 `affected_paths`에도 있다. 이 파일이 checkout에 아직 없고 `test/tiers.json`은 선언되지 않았다면 `G33`은? (A) 파일이 없으므로 실패한다 / (B) `tiers.json`이 없을 때만 실패한다 / (C) 새 파일로 세지 않는다. Modify 행은 선행 task가 만든 파일이라고 본다
3. `check-task.js`에 `tiers.json`에 등록되지 않은 테스트 파일을 넘기면? (A) `tiers: fail`을 쓰고 그 파일은 어느 tier에서도 실행하지 않으며, 남은 단계는 끝까지 돌린 뒤 1로 끝난다 / (B) 기본으로 unit tier에서 실행한다 / (C) 즉시 2로 종료하고 다른 검사는 돌리지 않는다
4. `check-task.js`에 `scripts/foo.js` 같은 `test/<name>.test.js` 형식이 아닌 경로를 넘기면? (A) 사용법을 출력하고 2로 끝난다 / (B) `not a test file`을 출력하고 어떤 검사도 돌리지 않은 채 1로 끝난다 / (C) 고정 검사 파일로 취급해 그대로 실행한다

## Tasks

### gates-review/test-tiers-plan-gate/001 · `131b4fe8`

#### Goal & intent

저장소 루트에 `test/tiers.json`이 있을 때, commit task가 checkout에 없는 `test/<name>.test.js`를 Touch나 `affected_paths`에 선언하면서 `affected_paths`에 `test/tiers.json`을 넣지 않으면 plan draft 검사와 plan gate가 같은 `G33`으로 실패한다. 수용 기준은 epic Success criteria 26이고, 완료 명령은 frontmatter `verify`다.

#### Current behavior

- `checkTaskScope`(`packages/cli/src/validate-gates-plan.ts:658-707`)는 task마다 G5(`:671-673`)와 비차단 경고 `task-split`(`:676-685`)·`review-risk-missing`(`:693-706`)을 낸다. Touch 본문이 없으면 `:692`에서 일찍 반환한다.
- plan gate(`checkPlanGate`, `:525` 이후 `:566`에서 호출)와 plan draft(`checkPlanDraft`, `:734`)가 이 함수를 공유한다. 두 경로 모두 `ctx.repoRoot`를 받는다(`validate-gates-shared.ts:94-104`, `validate.ts:452`).
- 이 파일에는 `fs` import가 없다(`:2-21`). 파일 I/O는 G32 helper(`plan-prerequisites.ts:202`)에만 있다.
- `plan approve`(`plan-approve.ts:136-240`)는 G32 helper만 공유하고 `checkTaskScope`를 부르지 않는다.
- 재현: `test/tiers.json`이 있는 임시 저장소에서 Touch에 `test/new.test.js`(없는 파일)를 적고 `affected_paths: [test/new.test.js]`만 둔 commit task를 plan draft로 검사하면 G 코드 없이 통과한다. 이후 종단 `npm run ci`의 `test/test-tiers.test.js:30`에서 실패한다.
- `G33` 문자열은 src·test·rules 어디에도 없다.

#### Target behavior

- 실패: 아래 조건을 모두 만족하면 task당 `G33` 한 건을 낸다. message는 `new test files need test/tiers.json in affected_paths: <정렬·중복 제거한 경로를 ', '로 연결>`, file은 task 문서 경로다.
  1. `executionKind === 'commit'`이다.
  2. `ctx.repoRoot`가 있다.
  3. `<repoRoot>/test/tiers.json`이 존재한다.
  4. 신규 테스트 경로가 하나 이상 있다.
  5. 정규화한 `affected_paths`에 `test/tiers.json`이 없다.
- 같은 task에서 G5와 함께 나면 G5 다음 순서다. Touch가 없는 task도 `affected_paths`만으로 판정한다.
- 통과(G33 없음):
  - `test/tiers.json`이 `affected_paths`에 있다.
  - 경로가 이미 존재한다.
  - 경로가 Touch의 `근거`·`계획한 변경` 열에만 인용되어 있다.
  - 없는 경로이지만 이 task Touch에서 `Modify` 행으로 선언되어 있다(선행 task가 만드는 파일).
  - 저장소에 `test/tiers.json`이 없다.
  - `repoRoot`가 없다.
  - verification task다.
  - 후보가 `test/` 하위 디렉터리에 있거나 `.test.js`로 끝나지 않는다.
- hint: `withGateFailureHints`가 `G33` 실패에 `next`를 붙인다. 복합 gate 요약은 `G33`을 `scope-declaration`으로 묶는다. 그 gate의 `next` 한 줄은 G5와 G33을 함께 안내하도록 바꾼다.
- 보존: G5·G19·G20·G32와 경고 두 종의 판정·메시지·순서는 바뀌지 않는다. `plan approve`는 바뀌지 않는다.

#### Interface

- 제공:
  - 실패 코드 `G33`: `{ code: 'G33', message: 'new test files need test/tiers.json in affected_paths: test/a.test.js, test/b.test.js', file: '<task 문서 경로>' }`
  - hint 행: `{ code: 'G33', next: 'Add test/tiers.json to this task\'s affected_paths and Touch (register the new test in the unit or integration list), then rerun the gate.' }`
  - `COMPOSITE_GATES`의 `scope-declaration`: `codes: ['G5', 'G33']`, `next: 'Confirm a non-empty \`affected_paths\` for every commit task through \`/bouncer-plan\` (a task that creates a test file also lists \`test/tiers.json\`), then rerun the plan gate.'`
- 용어 "신규 테스트 경로": 아래 두 집합의 합집합이다. 각 경로는 앞의 `./`를 떼고 POSIX로 바꾼 뒤 판정하며, `^test/[^/]+\.test\.js$`에 맞고 `fs.existsSync(path.join(repoRoot, p))`가 false여야 한다.
  1. Touch 생성 경로: `parseTasksSections(body).touch`의 Markdown 표 행에서 셋째 열(`변경`)이 `Create`인 행의 첫 열 경로, `Rename`인 행의 첫 열 `→` 뒤 경로. 첫 열의 백틱은 벗긴다. `근거`·`계획한 변경` 열은 읽지 않는다.
  2. `affected_paths` 문자열 항목 중, 이 task Touch에 같은 경로의 `Modify`·`Delete` 행이 없는 것.
  - 예: Touch `| \`./test/check-task.test.js\` | … | Create | …` (없는 파일) → `test/check-task.test.js`. 선행 task가 만드는 `test/x.test.js`를 Touch `Modify` 행과 `affected_paths`에 둔 task → 후보 아님.
  - Touch 표 행의 경로·변경 열을 읽는 helper는 `src`에 없다(`rg "'Create'" packages/cli/src` 결과 없음). `validate-gates-plan.ts` 안에 private 함수로 둔다(신규 추출 지점: Touch 표 행의 경로·변경 열 읽기).
- 거부(실패로 보고): 위 조건을 모두 만족하는 commit task.
- 판정하지 않음(조용히 건너뜀): `repoRoot` 없음, `test/tiers.json` 없음, verification task, 문자열이 아닌 `affected_paths` 항목.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/validate-gates-plan.ts` | `checkTaskScope`, `checkPlanDraft` | Modify | task별 G5와 경고, draft 검사 조립 | Touch 조기 반환 전에 G33 판정과 Touch 표 행 읽기 helper 추가, `fs` import, 두 함수 doc comment의 코드 목록에 G33 추가 | `validate-gates-plan.ts:658-707`, `:692` 조기 반환, `:709-712` doc comment |
| `packages/cli/src/validate.ts` | `GATE_FAILURE_HINTS` | Modify | 코드별 `next` hint 표 | `G33` 행 추가 | `validate.ts:64-125`, G32 행 `:86-89` |
| `packages/cli/src/composite-gates.ts` | `COMPOSITE_GATES` | Modify | G 코드를 복합 gate로 묶음 | `scope-declaration.codes`에 `G33` 추가, 같은 항목 `next`를 Interface 문자열로 교체 | `composite-gates.ts:37-39`. 소스의 G 리터럴이 표에 없으면 `test/composite-gates.test.js:31-36`이 실패 |
| `rules/cli.md` | plan dispatch draft 실패 서술 | Modify | draft 실패 코드 목록 `G5, G19, G20, and G32` | `G33`과 발동 조건 한 문장 추가 | `rules/cli.md:556` |
| `test/validate-gates.test.js` | 신규 G33 케이스 | Modify | plan gate·draft 판정 테스트, G32 draft/plan 동일성 패턴 | G33 draft·plan 동일성 케이스와 hint 케이스 추가 | `test/validate-gates.test.js:2406-2466`(G32 패턴), `:2468`(hint), integration tier |
| `test/composite-gates.test.js` | `live` 목록 | Modify | 살아 있는 G 코드 전체 목록 고정 | `live`에 `G33` 추가, `compositeGateForCode('G33')` 단언 추가 | `test/composite-gates.test.js:15` |
| `test/validate-hints.test.js` | hint 코드 목록 | Modify | hint 코드 전체 목록 고정 | 목록에 `G33` 추가(hint 부착 단언은 `test/validate-gates.test.js`에만 둔다) | `test/validate-hints.test.js:8-10` |

#### Constraints

- 결번(G10–G12·G18·G22·G25–G31)을 쓰지 않는다. 새 코드는 `G33` 하나다.
- G33 판정은 `checkTaskScope` 안에서 한 번만 구현한다. plan gate와 draft가 같은 답을 내야 한다.
- 기존 단언은 다음 두 곳만 바꾼다.
  - `test/composite-gates.test.js` 첫 테스트(`COMPOSITE_GATES when read → …`)의 `live` 배열에 `'G33'`을 추가한다.
  - `test/validate-hints.test.js` 첫 테스트의 정렬된 코드 배열에 `'G33'`을 추가한다(`'G32'` 다음).
  - 그 밖의 기존 단언은 바꾸지 않는다.
- 이 저장소처럼 `test/tiers.json`이 있는 실제 저장소를 `repoRoot`로 쓰는 기존 plan 테스트가 없는 `test/*.test.js`를 Touch에 적고 있으면 G33이 새로 날 수 있다. 그런 fixture를 만나면 단언을 바꾸지 말고 보고한다.
- ts·js 줄은 120자 이내로 쓴다. 테스트 이름은 `<조건> → <결과>` 형식을 따른다.

### gates-review/test-tiers-plan-gate/002 · `6b1b68d0`

#### Goal & intent

`node scripts/check-task.js <test files>` 한 줄로, 넘긴 테스트 파일에 대해 종단 `npm run ci`의 테스트 관련 정적 검사를 실행하고 각 파일을 자기 tier 규칙대로 실행한다. 정적 검사는 테스트 이름 lint, tier 등록, 문서 인용이다. tier 규칙은 unit이면 no-spawn guard 아래에서 실행하는 것이다. task 전용 `bouncer.verify`는 단일 argv라서 `&&`를 쓸 수 없는데, 이 래퍼가 그 제약 안에서 여러 검사를 묶는다. 수용 기준은 epic Success criteria 27이고, 완료 명령은 래퍼에 의존하지 않는 frontmatter `verify`(`node --test test/check-task.test.js`)다.

#### Current behavior

- 테스트 이름 lint `scripts/check-test-names.js`는 `main(argv, io)`(`:177`, io = `{ out, err, cwd }`)로 파일 인자를 받는다.
  - 위반은 err에 `<rel>:<line> <reason> <name>`으로 쓰고(`:194`) 1을 반환한다(`:198`).
  - 없는 파일은 `readFileSync`가 예외를 던진다(`:189`). 인자가 없으면 `test/*.test.js` 전체를 본다(`:178-183`).
  - export는 `{ findTestNames, classifyName, main }`이다(`:209`).
- `scripts/test-tier.js`:
  - `unitNodeOptions()`(`:21-24`)가 `--require "<abs test/helpers/no-spawn.js>"`를 붙인 NODE_OPTIONS를 만든다.
  - `run(tier)`는 tier 전체만 실행하고 임의 파일 목록을 받지 않는다(`:34-55`). 자식 env에서 `NODE_TEST_CONTEXT`를 지우지 않는다(`:46`).
  - `require.main` 실행은 `NODE_TEST_CONTEXT`가 없을 때만 일어난다(`:60-65`).
- `test/helpers/no-spawn.js`는 `NODE_TEST_CONTEXT`가 있는 테스트 자식 프로세스에서만 `child_process` 함수를 예외로 바꾼다(`:7-19`).
- 중첩 `node --test`가 부모의 `NODE_TEST_CONTEXT`를 물려받으면 파일을 건너뛰고 exit 0으로 끝난다(`test/test-tiers.test.js:81-83`, `cleanEnv` `:15-20`).
- 전체 저장소 검사 두 개:
  - `test/test-tiers.test.js`: tier 배정·중복·유령 검사(`:30-61`). 자신이 프로세스를 띄우므로 integration tier다.
  - `test/plugin-doc-cites.test.js`: `skills/**`·`rules/*.md`·`references/**` 인용 검사(`:47-56`, `:83`). 순수 fs라서 unit tier다.
- 스크립트 관례: 1행 `'use strict';`, 한국어 주석, 함수마다 JSDoc, 끝에 `if (require.main === module) process.exitCode = main(process.argv.slice(2));`(`scripts/check-distribution.js:287`). eslint의 scripts 규칙은 max-len 120, 작은따옴표, `__filename` 전역 없음이다(`eslint.config.js:38-63`).
- `scripts/` 파일 목록을 고정하는 테스트는 없다. `test/ci-contract.test.js:114-147`은 기존 npm script 항목만 고정한다.
- 재현: 이름이 `'no arrow'`인 테스트 파일은 `node --test <file>`로 통과하지만 `npm run lint:test-names`에서 `missing-arrow`로 실패한다.

#### Target behavior

- 성공: 모든 검사가 통과하면 exit 0이다. 각 단계는 out에 한 줄 요약을 쓴다.
- 실패(사전 검사 — 이름 lint보다 먼저 아래 순서로 돌고, 하나라도 걸리면 그 자리에서 exit하며 out에 단계 요약을 쓰지 않고 프로세스를 띄우지 않는다):
  - 인자 없음 → err에 `usage: node scripts/check-task.js <test/<name>.test.js>...`, exit 2.
  - 정규화한 경로가 `^test/[^/]+\.test\.js$`에 맞지 않음 → err에 `not a test file: <rel>`, exit 1.
  - 없거나 일반 파일이 아님(`fs.statSync(...).isFile()` false 또는 ENOENT) → err에 `missing test file: <rel>`, exit 1.
  - `test/tiers.json`이 없거나 JSON 파싱 실패 → err에 `cannot read test/tiers.json: <error.message>`, exit 1.
- 실패(단계 실패 — 남은 단계를 끝까지 돌린 뒤 exit 1):
  - 이름 위반.
  - tier 미등록 → err에 `not in test/tiers.json: <rel>`. 두 tier 모두에 있음 → err에 `in both tiers of test/tiers.json: <rel>`. 이런 파일은 5·6단계에서 실행하지 않는다.
  - 고정 검사 또는 파일 실행 spawn의 status ≠ 0, status null(시그널), `error` 있음.
- 실행 단계(순서 고정):
  1. 사전 검사(인자 → 형식 → 존재 → `test/tiers.json` 읽기)
  2. 이름 lint(같은 프로세스에서 `check-test-names.main`)
  3. tier 등록 확인(1단계에서 읽은 목록 사용)
  4. 고정 검사 spawn: `node --test test/test-tiers.test.js test/plugin-doc-cites.test.js`, guard 없음
  5. 넘긴 unit 파일 spawn(guard NODE_OPTIONS)
  6. 넘긴 integration 파일 spawn(guard 없음)
  - 실행할 파일이 없는 tier는 spawn하지 않는다. 모든 spawn env에서 `NODE_TEST_CONTEXT`를 지운다.
- 단계 요약(2–6단계마다 out에 정확히 한 줄, 이 순서): `names: ok|fail`, `tiers: ok|fail`, `fixed checks: ok|fail`, `unit: ok|fail|skip`, `integration: ok|fail|skip`. `skip`은 그 tier에 실행할 파일이 없을 때다.
- 보존: `scripts/test-tier.js`, `scripts/check-test-names.js`, `test/helpers/no-spawn.js`의 동작과 export는 바뀌지 않는다.

#### Interface

- 제공:
  - CLI `node scripts/check-task.js <path>...` (cwd = 저장소 루트, 경로는 cwd 상대이고 `./`·백슬래시를 정규화)
  - export `main(argv: string[], io: { out: Writable, err: Writable, cwd: string }, deps?: { spawnSync: (cmd: string, args: string[], opts: { cwd: string, env: object, stdio: 'inherit' }) => { status: number | null, error?: Error } }) → number`
  - `deps.spawnSync`의 기본값은 `child_process.spawnSync`이고, 테스트가 호출 인자·env·횟수를 관찰하는 seam이다. guard NODE_OPTIONS는 `require('./test-tier').unitNodeOptions()`를 재사용한다.
- 거부(exit 2): 인자 0개.
- 거부(exit 1): 형식 밖 경로, 없는 파일·디렉터리, 읽을 수 없는 `test/tiers.json`, 미등록·이중 등록 파일, 이름 위반, spawn status ≠ 0·null 또는 `error`.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/check-task.js` | `main` | Create | 없음 | 위 단계를 실행하는 래퍼와 CLI 진입점 | `scripts/check-test-names.js:177`, `scripts/test-tier.js:21-24` 재사용 |
| `test/check-task.test.js` | 신규 테스트 | Create | 없음 | 주입한 `deps.spawnSync`와 mkdtemp cwd fixture로 `main`을 같은 프로세스에서 검증 | `test/check-test-names.test.js:11-19`, `:60-86` in-process 패턴 |
| `test/tiers.json` | `unit` 목록 | Modify | 테스트 파일별 tier 배정 | `check-task.test.js`를 `unit`에 등록(실제 프로세스를 띄우지 않음) | `test/test-tiers.test.js:30` 미배정 실패 |

#### Constraints

- 새 테스트는 실제 프로세스를 띄우지 않는다. unit tier에 두고 no-spawn guard 아래에서 통과해야 한다.
- 고정 검사 두 파일의 경로는 `io.cwd` 기준 `test/test-tiers.test.js`·`test/plugin-doc-cites.test.js`로 넘긴다. fixture 테스트에서는 주입한 spawn만 호출 인자를 기록한다.
- 이름 lint는 같은 프로세스에서 호출하고, 결과 출력은 io로만 쓴다.
- ts·js 줄은 120자 이내로 쓴다. 테스트 이름은 `<조건> → <결과>` 형식을 따른다.

### gates-review/test-tiers-plan-gate/003 · `08d63e26`

#### Goal & intent

계획 작성자가 commit task의 `bouncer.verify`를 정할 때, task가 건드리는 파일에 대해 종단 CI가 돌리는 저비용 정적 검사도 포함하게 한다. 예로는 테스트 이름 lint, 테스트 목록·tier 등록 검사, 문서 인용 검사가 있다. 명령이 여러 개면 프로젝트 스크립트 하나로 감싸 단일 argv를 지키게 한다. 제품 문서라서 이 저장소의 구체 명령 이름은 쓰지 않는다. 수용 기준은 epic Success criteria 28이고, 완료 명령은 frontmatter `verify`다.

#### Current behavior

- `skills/bouncer-plan/SKILL.md:262-272`(step 3 "Verify command" 단락)는 commit task verify를 "just that task's tests — the tests its Checklist adds or changes"로만 정의한다. `:287-290`은 ACQ 흐름 안에서만 "wrap container-up + test in one project script"를 말한다.
- `references/spec-authoring/index.md:219-226`의 Checklist (focused vs verify) 항목은 task 전용 verify의 존재와 G20 거절만 서술하고, 무엇을 포함할지는 말하지 않는다.
- 같은 동작을 서술하는 다른 문서는 구성 내용을 규정하지 않는다. 그래서 바꿀 대상이 아니다.
  - `rules/planning.md:96-102`
  - `agents/bouncer-implementer.md:117-121`
  - `references/coordinator-cards/implement.md:25-28`
  - `skills/bouncer-run/SKILL.md:82-87`
  - `agents/bouncer-coordinator.md:112-116`
  - `rules/cli.md:411`
  - `rules/document-schema.md:94-95`
- 형식 계약:
  - `scripts/lib/doc-shape-contracts.js:149-166`이 SKILL.md의 step 1–8 순서와 ACQ 표식, step 링크를 고정한다.
  - spec-authoring은 subskill 계약(H2 When this applies / Steps / Guardrails / Return)을 따른다(`scripts/check-doc-shape.js:685-687`).
  - 줄 수 예산은 없다.
  - `test/skill-bouncer-surface.test.js:221-263`과 `test/skill-spec-authoring.test.js:14-38`은 두 단락의 문구를 고정하지 않는다.
  - `test/plugin-doc-cites.test.js:12`는 plugin 문서 경로를 `${BOUNCER_ROOT}/` 접두 없이 쓰면 거절한다.

#### Target behavior

- `SKILL.md` step 3 "Verify command" 단락에 "commit task verify는 Checklist 테스트에 더해, task가 건드리는 파일에 대해 프로젝트 종단 CI가 돌리는 저비용 정적 검사를 함께 돌린다"는 문장을 넣는다. 예시는 test-name lint, test manifest·tier registration, doc cite check다. 그 문장 뒤에는 "여러 명령이 필요하면 프로젝트 스크립트 하나로 감싼다(verify는 단일 argv)"를 이어 쓴다. 영어로 쓰고 기존 단락 문체를 따른다.
- `spec-authoring` (focused vs verify) 항목에 같은 원칙 한 문장을 넣는다.
- 넣을 문장(정확히 이 문자열; 두 문서 모두 핵심 구절 `cheap static checks the project's terminal CI applies`를 한 번씩 포함한다):
  - `SKILL.md`: `Beyond those tests, the task-only command also runs the cheap static checks the project's terminal CI applies to the files the task touches (for example a test-name lint, a test manifest or tier registration check, a doc cite check); when that takes several commands, wrap them in one project script, because \`bouncer.verify\` is a single argv.`
  - `spec-authoring`: `The task-only \`bouncer.verify\` also runs the cheap static checks the project's terminal CI applies to the files the task touches, wrapped in one project script when several commands are needed.`
  - 줄바꿈 위치는 주변 단락에 맞춰도 되지만, 핵심 구절은 한 줄 안에 둔다.
- 보존:
  - step 번호·ACQ 표식·step 링크·H2 구조는 바뀌지 않는다.
  - `:287-290` ACQ 문장은 그대로 둔다.
  - 전체 실행 명령을 commit task에 넣지 말라는 기존 규칙(G20)은 그대로다.
  - 판단 근거: 핵심 구절의 `rg -c` 결과가 두 파일 각각 `1`이고, `node scripts/check-doc-shape.js skills/bouncer-plan/SKILL.md references/spec-authoring/index.md`가 exit 0이며, frontmatter `verify`가 통과한다.

#### Interface

- 제공: 두 제품 문서의 지침 문장. 공개 CLI·스키마는 바뀌지 않는다.
- 거부: 이 저장소 전용 이름(`check-task.js`, `check-test-names.js`, `tiers.json`, `no-spawn.js`)을 제품 문서에 쓰지 않는다. 새 step·ACQ·H2를 만들지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-plan/SKILL.md` | step 3 Verify command 단락 | Modify | commit task 전용 verify와 terminal 위상 서술 | 정적 검사 포함과 프로젝트 스크립트로 감싸기 문장 추가 | `skills/bouncer-plan/SKILL.md:262-272`, 형식 계약 `scripts/lib/doc-shape-contracts.js:149-166` |
| `references/spec-authoring/index.md` | Checklist (focused vs verify) | Modify | task 전용 verify 존재와 G20 거절 서술 | 같은 원칙 한 문장 추가 | `references/spec-authoring/index.md:219-226`, 형식 계약 `scripts/check-doc-shape.js:685-687` |

#### Constraints

- plugin 문서 경로를 쓰면 `${BOUNCER_ROOT}/` 접두를 붙인다. 새 문장에 경로가 필요하지 않으면 쓰지 않는다.
- 문장은 판정 가능하게 쓴다. "적절히"나 "가능하면" 같은 표현은 쓰지 않는다.
- 기존 테스트 단언은 바꾸지 않는다.

### gates-review/test-tiers-plan-gate/004

#### Goal & intent

TASKS-001·002·003이 통합된 checkout에서 저장소 머지 전 명령 `npm run ci`가 통과한다. 통과하면 epic Success criteria 26–28의 종단 조건이 증명된다. tier 배정, 테스트 이름, 문서 형식, typecheck, lint, coverage가 모두 포함된다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.