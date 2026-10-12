---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/095-coding-standards-pr-retro/blueprints/002-test-name-lint/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-12T15:10:58.931+09:00'
bouncer:
  id: EXPLAIN-002
  epic_id: '095'
  blueprint_id: '002'
  status: published
  comprehension:
    - range_from: eead78910b7dea2f58bc4c0323d85b36966f4048
      range_to: 2dee56a43432a7fa782c5b32498ebcb6c25014d4
      diff_sha: c993be01b3b04e8c360cbf498d9d10360efaa833b76ca007136aa3835e2d5d7d
      recorded_at: '2026-10-12T15:20:00+09:00'
  task_commits:
    - task: EPIC-095/BP-002/TASK-001
      sha: e8215024
      intent_anchor: task-001
    - task: EPIC-095/BP-002/TASK-002
      sha: 3789b468
      intent_anchor: task-002
    - task: EPIC-095/BP-002/TASK-003
      sha: 55b390f8
      intent_anchor: task-003
    - task: EPIC-095/BP-002/TASK-004
      sha: 656dfdb6
      intent_anchor: task-004
    - task: EPIC-095/BP-002/TASK-005
      sha: 13630b0f
      intent_anchor: task-005
    - task: EPIC-095/BP-002/TASK-006
      sha: 2dee56a4
      intent_anchor: task-006
---
# Explain

## Background

테스트 1,676개 가운데 33개만 `<조건> → <결과>` 이름 규칙을 지켰다.
나머지는 이름만 봐서는 어떤 조건에서 무엇이 깨졌는지 알 수 없어서, 실패 목록을 읽는 사람이 테스트 본문까지 열어야 했다.
이번 변경은 모든 테스트 이름을 이 형식으로 맞추고, 어긋난 이름이 생기면 `npm run ci`가 거절하게 한다.

## Intuition

실패 목록 한 줄이 곧 버그 리포트가 되게 하는 것이다.
`빈 brief → G10 실패`처럼 조건과 결과가 한 줄에 있으면, 목록만 보고도 무엇이 깨졌는지 읽힌다.
검사기는 문 앞의 경비처럼 이름에 ` → `가 없으면 CI를 통과시키지 않는다.

## Code

- `scripts/check-test-names.js` — `test/*.test.js`에서 `test(`·`it(` 호출의 첫 인자를 읽어 규칙을 검사한다. 문자열·template literal·정규식·주석을 건너뛰는 작은 토크나이저를 쓴다.
- `test/check-test-names.test.js` — 검사기 자체의 단위 테스트.
- `package.json` — `lint:test-names` 스크립트와, `ci` 체인에서 `typecheck` 뒤·`npm audit` 앞 위치.
- `test/ci-contract.test.js` — 위 순서를 고정하는 단언.
- `test/*.test.js` 93개 파일 — 이름 문자열만 바뀌었고 본문과 단언은 그대로다.
- `references/coding-standards/index.md`, `CHANGELOG.md` — 규칙 안내와 변경 기록.

## Quiz

1. 규칙에 맞는 테스트 이름은? (a) `'brief가 비면 G10 실패'` (b) `'빈 brief -> G10 실패'` (c) `` `${skill} 카탈로그 → ACQ 절과 일치` ``
2. `npm run ci`에서 `lint:test-names`는 어디서 도는가? (a) `typecheck` 뒤, `npm audit` 앞 (b) 체인 맨 앞 (c) `test:unit` 바로 뒤
3. 이름이 `' → 실패'`처럼 화살표 앞이 비어 있으면 검사기는? (a) 통과시킨다 (b) 위반으로 보고하고 CI를 실패시킨다 (c) 경고만 남기고 통과시킨다

## Tasks

### EPIC-095/BP-002/TASK-001 · `e8215024`

#### Goal & intent

묶음 1(`acq-gate-ids` … `coordinator-e2e`, 파일 26개, 테스트 420개)의 모든 `test(`·`it(` 이름을 BP Contract의 규칙 정의(`<조건> → <결과>`, U+2192 양옆 공백)에 맞춘다. 테스트 본문은 바꾸지 않는다. 수용 기준은 TASKS-005가 만든 `scripts/check-test-names.js`가 이 묶음 파일에 대해 종료 코드 0을 내는 것이며, 검증 명령은 `npm run ci`이다.

#### Current behavior

- 묶음 1의 테스트는 420개이고, 그중 14개가 이미 `→`를 쓴다(아래 Touch 표의 파일별 수). 수는 `^\s*(test|it)\(` 줄 기준이다.
- 대부분 작은따옴표 문자열 리터럴이다. 반복문 안에서 template literal을 쓰는 곳도 있다(예: `test/acq-gate-ids.test.js:23-24`, `test/agents.test.js:23`, `test/context-comments.test.js:155`, `test/review-record.test.js:359,374`, `test/subagents.test.js:517`).
- `describe(`·`t.test(`는 없다. 테스트 이름에 의존하는 코드도 없다. `test/tiers.json`은 파일 이름만 쓰고, `scripts/test-tier.js`와 CI에는 `--test-name-pattern`이 없다.
- 기존 적합 이름 예: `test/acq-gate-ids.test.js:41` `'카탈로그 workflows 키 → ACQ 절을 가진 skills/*/SKILL.md의 skill 이름 집합과 같고 …'`.
- 재현: TASKS-005 integrated 뒤 `node scripts/check-test-names.js <이 묶음 파일>`이 부적합 이름마다 한 줄을 출력하고 종료 코드 1을 낸다.

#### Target behavior

- 성공: 묶음 1의 모든 `test(`·`it(` 첫 인자가 규칙에 맞는다. 조건은 테스트가 만드는 입력·상태이고, 결과는 테스트가 단언하는 관찰 결과다.
- 실패: 조건이나 결과 한쪽이 비거나, ASCII `->`를 쓰거나, 첫 인자가 식별자이면 부적합이다. 이런 이름은 검사기가 거절한다.
- 보존: 테스트 본문, 단언, 테스트 수, 파일 계층, 기존 이름의 언어(영어 이름은 영어, 한국어 이름은 한국어)를 그대로 둔다. 이미 적합한 이름은 바꾸지 않는다.

#### Interface

- 제공: 바뀐 테스트 이름 문자열만
- 거부: 테스트 추가·삭제·병합, 단언 변경, helper 추출, 첫 인자를 변수로 바꾸는 것

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `test/acq-gate-ids.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 9개, 형식 적합 6개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 1 대상 |
| `test/agents.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 10개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 1 대상 |
| `test/approval-snapshot.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 1개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 1 대상 |
| `test/build-release.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 6개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 1 대상 |
| `test/canonical-json.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 2개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 1 대상 |
| `test/ci-contract.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 8개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 1 대상 |
| `test/cli-commit-guard.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 5개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 1 대상 |
| `test/cli-commit.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 15개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 1 대상 |
| `test/cli-coordinate.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 33개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 1 대상 |
| `test/cli-current.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 32개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 1 대상 |
| `test/cli-help.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 46개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 1 대상 |
| `test/cli-init.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 8개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 1 대상 |
| `test/cli-project-commands.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 38개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 1 대상 |
| `test/cli-project-root.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 2개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 1 대상 |
| `test/cli-validate.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 13개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 1 대상 |
| `test/cli-verify.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 5개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 1 대상 |
| `test/commit-guard.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 12개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 1 대상 |
| `test/commit-hook.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 34개, 형식 적합 4개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 1 대상 |
| `test/commit-task.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 43개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 1 대상 |
| `test/comprehension.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 7개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 1 대상 |
| `test/config-help.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 1개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 1 대상 |
| `test/context-comments.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 10개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 1 대상 |
| `test/coordinate-advance.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 9개, 형식 적합 2개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 1 대상 |
| `test/coordinate-next.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 54개, 형식 적합 2개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 1 대상 |
| `test/coordinate-output.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 1개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 1 대상 |
| `test/coordinator-e2e.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 16개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 1 대상 |

#### Constraints

- 이 task는 동작을 바꾸지 않으므로 red 단계가 없다. implementer 보고의 `Red run`은 `해당 없음: 이름만 바꾸는 변경`이다.
- 첫 인자가 식별자이면 같은 값을 리터럴로 옮긴다. 반복문의 동적 이름은 template literal 안에 ` → `를 넣는다.
- 다른 묶음의 파일은 열어도 수정하지 않는다(병렬 실행).

### EPIC-095/BP-002/TASK-002 · `3789b468`

#### Goal & intent

묶음 2(`coordinator` … `graph-search`, 파일 16개, 테스트 416개)의 모든 `test(`·`it(` 이름을 BP Contract의 규칙 정의(`<조건> → <결과>`, U+2192 양옆 공백)에 맞춘다. 테스트 본문은 바꾸지 않는다. 수용 기준은 TASKS-005가 만든 `scripts/check-test-names.js`가 이 묶음 파일에 대해 종료 코드 0을 내는 것이며, 검증 명령은 `npm run ci`이다.

#### Current behavior

- 묶음 2의 테스트는 416개이고, 그중 8개가 이미 `→`를 쓴다(아래 Touch 표의 파일별 수). 수는 `^\s*(test|it)\(` 줄 기준이다.
- 대부분 작은따옴표 문자열 리터럴이다. 반복문 안에서 template literal을 쓰는 곳도 있다(예: `test/acq-gate-ids.test.js:23-24`, `test/agents.test.js:23`, `test/context-comments.test.js:155`, `test/review-record.test.js:359,374`, `test/subagents.test.js:517`).
- `describe(`·`t.test(`는 없다. 테스트 이름에 의존하는 코드도 없다. `test/tiers.json`은 파일 이름만 쓰고, `scripts/test-tier.js`와 CI에는 `--test-name-pattern`이 없다.
- 기존 적합 이름 예: `test/acq-gate-ids.test.js:41` `'카탈로그 workflows 키 → ACQ 절을 가진 skills/*/SKILL.md의 skill 이름 집합과 같고 …'`.
- 재현: TASKS-005 integrated 뒤 `node scripts/check-test-names.js <이 묶음 파일>`이 부적합 이름마다 한 줄을 출력하고 종료 코드 1을 낸다.

#### Target behavior

- 성공: 묶음 2의 모든 `test(`·`it(` 첫 인자가 규칙에 맞는다. 조건은 테스트가 만드는 입력·상태이고, 결과는 테스트가 단언하는 관찰 결과다.
- 실패: 조건이나 결과 한쪽이 비거나, ASCII `->`를 쓰거나, 첫 인자가 식별자이면 부적합이다. 이런 이름은 검사기가 거절한다.
- 보존: 테스트 본문, 단언, 테스트 수, 파일 계층, 기존 이름의 언어(영어 이름은 영어, 한국어 이름은 한국어)를 그대로 둔다. 이미 적합한 이름은 바꾸지 않는다.

#### Interface

- 제공: 바뀐 테스트 이름 문자열만
- 거부: 테스트 추가·삭제·병합, 단언 변경, helper 추출, 첫 인자를 변수로 바꾸는 것

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `test/coordinator.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 105개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 2 대상 |
| `test/current.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 44개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 2 대상 |
| `test/cursor-plugin.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 13개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 2 대상 |
| `test/distill-decommission-audit.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 5개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 2 대상 |
| `test/distribution.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 12개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 2 대상 |
| `test/doc-shape-cli.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 9개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 2 대상 |
| `test/execute-prepare.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 16개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 2 대상 |
| `test/finalize-digest.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 25개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 2 대상 |
| `test/finalize-pr.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 20개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 2 대상 |
| `test/finalize-pure.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 43개, 형식 적합 8개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 2 대상 |
| `test/finalize-release-main.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 23개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 2 대상 |
| `test/finalize.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 60개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 2 대상 |
| `test/frontmatter.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 2개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 2 대상 |
| `test/git-fixture.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 3개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 2 대상 |
| `test/githooks.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 2개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 2 대상 |
| `test/graph-search.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 34개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 2 대상 |

#### Constraints

- 이 task는 동작을 바꾸지 않으므로 red 단계가 없다. implementer 보고의 `Red run`은 `해당 없음: 이름만 바꾸는 변경`이다.
- 첫 인자가 식별자이면 같은 값을 리터럴로 옮긴다. 반복문의 동적 이름은 template literal 안에 ` → `를 넣는다.
- 다른 묶음의 파일은 열어도 수정하지 않는다(병렬 실행).

### EPIC-095/BP-002/TASK-003 · `55b390f8`

#### Goal & intent

묶음 3(`graphify` … `scaffold`, 파일 26개, 테스트 410개)의 모든 `test(`·`it(` 이름을 BP Contract의 규칙 정의(`<조건> → <결과>`, U+2192 양옆 공백)에 맞춘다. 테스트 본문은 바꾸지 않는다. 수용 기준은 TASKS-005가 만든 `scripts/check-test-names.js`가 이 묶음 파일에 대해 종료 코드 0을 내는 것이며, 검증 명령은 `npm run ci`이다.

#### Current behavior

- 묶음 3의 테스트는 410개이고, 그중 7개가 이미 `→`를 쓴다(아래 Touch 표의 파일별 수). 수는 `^\s*(test|it)\(` 줄 기준이다.
- 대부분 작은따옴표 문자열 리터럴이다. 반복문 안에서 template literal을 쓰는 곳도 있다(예: `test/acq-gate-ids.test.js:23-24`, `test/agents.test.js:23`, `test/context-comments.test.js:155`, `test/review-record.test.js:359,374`, `test/subagents.test.js:517`).
- `describe(`·`t.test(`는 없다. 테스트 이름에 의존하는 코드도 없다. `test/tiers.json`은 파일 이름만 쓰고, `scripts/test-tier.js`와 CI에는 `--test-name-pattern`이 없다.
- 기존 적합 이름 예: `test/acq-gate-ids.test.js:41` `'카탈로그 workflows 키 → ACQ 절을 가진 skills/*/SKILL.md의 skill 이름 집합과 같고 …'`.
- 재현: TASKS-005 integrated 뒤 `node scripts/check-test-names.js <이 묶음 파일>`이 부적합 이름마다 한 줄을 출력하고 종료 코드 1을 낸다.

#### Target behavior

- 성공: 묶음 3의 모든 `test(`·`it(` 첫 인자가 규칙에 맞는다. 조건은 테스트가 만드는 입력·상태이고, 결과는 테스트가 단언하는 관찰 결과다.
- 실패: 조건이나 결과 한쪽이 비거나, ASCII `->`를 쓰거나, 첫 인자가 식별자이면 부적합이다. 이런 이름은 검사기가 거절한다.
- 보존: 테스트 본문, 단언, 테스트 수, 파일 계층, 기존 이름의 언어(영어 이름은 영어, 한국어 이름은 한국어)를 그대로 둔다. 이미 적합한 이름은 바꾸지 않는다.

#### Interface

- 제공: 바뀐 테스트 이름 문자열만
- 거부: 테스트 추가·삭제·병합, 단언 변경, helper 추출, 첫 인자를 변수로 바꾸는 것

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `test/graphify.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 39개, 형식 적합 1개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 3 대상 |
| `test/guards.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 4개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 3 대상 |
| `test/import-history.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 15개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 3 대상 |
| `test/init.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 57개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 3 대상 |
| `test/intent-bundle.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 11개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 3 대상 |
| `test/intent-provenance.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 13개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 3 대상 |
| `test/legacy-comments.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 5개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 3 대상 |
| `test/master-rules.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 18개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 3 대상 |
| `test/migrate-task-layout.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 6개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 3 대상 |
| `test/native-profile-e2e.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 2개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 3 대상 |
| `test/open-source-readiness.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 4개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 3 대상 |
| `test/paths.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 8개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 3 대상 |
| `test/plan-inspect.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 15개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 3 대상 |
| `test/plugin-doc-cites.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 1개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 3 대상 |
| `test/plugin-root.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 11개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 3 대상 |
| `test/plugin-wiring.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 4개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 3 대상 |
| `test/pre-commit-hook.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 8개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 3 대상 |
| `test/print-dispatch.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 16개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 3 대상 |
| `test/public-name-regression.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 4개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 3 대상 |
| `test/retention-migration.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 8개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 3 대상 |
| `test/review-dispatch.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 42개, 형식 적합 4개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 3 대상 |
| `test/review-record.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 18개, 형식 적합 2개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 3 대상 |
| `test/rule-ownership.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 7개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 3 대상 |
| `test/run-preflight.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 11개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 3 대상 |
| `test/runtime-state.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 37개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 3 대상 |
| `test/scaffold.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 46개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 3 대상 |

#### Constraints

- 이 task는 동작을 바꾸지 않으므로 red 단계가 없다. implementer 보고의 `Red run`은 `해당 없음: 이름만 바꾸는 변경`이다.
- 첫 인자가 식별자이면 같은 값을 리터럴로 옮긴다. 반복문의 동적 이름은 template literal 안에 ` → `를 넣는다.
- 다른 묶음의 파일은 열어도 수정하지 않는다(병렬 실행).

### EPIC-095/BP-002/TASK-004 · `656dfdb6`

#### Goal & intent

묶음 4(`schema` … `verification-runner`, 파일 24개, 테스트 430개)의 모든 `test(`·`it(` 이름을 BP Contract의 규칙 정의(`<조건> → <결과>`, U+2192 양옆 공백)에 맞춘다. 테스트 본문은 바꾸지 않는다. 수용 기준은 TASKS-005가 만든 `scripts/check-test-names.js`가 이 묶음 파일에 대해 종료 코드 0을 내는 것이며, 검증 명령은 `npm run ci`이다.

#### Current behavior

- 묶음 4의 테스트는 430개이고, 그중 4개가 이미 `→`를 쓴다(아래 Touch 표의 파일별 수). 수는 `^\s*(test|it)\(` 줄 기준이다.
- 대부분 작은따옴표 문자열 리터럴이다. 반복문 안에서 template literal을 쓰는 곳도 있다(예: `test/acq-gate-ids.test.js:23-24`, `test/agents.test.js:23`, `test/context-comments.test.js:155`, `test/review-record.test.js:359,374`, `test/subagents.test.js:517`).
- `describe(`·`t.test(`는 없다. 테스트 이름에 의존하는 코드도 없다. `test/tiers.json`은 파일 이름만 쓰고, `scripts/test-tier.js`와 CI에는 `--test-name-pattern`이 없다.
- 기존 적합 이름 예: `test/acq-gate-ids.test.js:41` `'카탈로그 workflows 키 → ACQ 절을 가진 skills/*/SKILL.md의 skill 이름 집합과 같고 …'`.
- 재현: TASKS-005 integrated 뒤 `node scripts/check-test-names.js <이 묶음 파일>`이 부적합 이름마다 한 줄을 출력하고 종료 코드 1을 낸다.

#### Target behavior

- 성공: 묶음 4의 모든 `test(`·`it(` 첫 인자가 규칙에 맞는다. 조건은 테스트가 만드는 입력·상태이고, 결과는 테스트가 단언하는 관찰 결과다.
- 실패: 조건이나 결과 한쪽이 비거나, ASCII `->`를 쓰거나, 첫 인자가 식별자이면 부적합이다. 이런 이름은 검사기가 거절한다.
- 보존: 테스트 본문, 단언, 테스트 수, 파일 계층, 기존 이름의 언어(영어 이름은 영어, 한국어 이름은 한국어)를 그대로 둔다. 이미 적합한 이름은 바꾸지 않는다.

#### Interface

- 제공: 바뀐 테스트 이름 문자열만
- 거부: 테스트 추가·삭제·병합, 단언 변경, helper 추출, 첫 인자를 변수로 바꾸는 것

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `test/schema.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 8개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 4 대상 |
| `test/seed-worktree.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 41개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 4 대상 |
| `test/session-graph.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 52개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 4 대상 |
| `test/skill-bouncer-finalize.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 2개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 4 대상 |
| `test/skill-bouncer-plan.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 1개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 4 대상 |
| `test/skill-bouncer-run.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 1개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 4 대상 |
| `test/skill-bouncer-surface.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 14개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 4 대상 |
| `test/skill-context-review.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 1개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 4 대상 |
| `test/skill-minimality.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 1개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 4 대상 |
| `test/skill-spec-authoring.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 4개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 4 대상 |
| `test/skill-stop-slop.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 1개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 4 대상 |
| `test/smoke.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 1개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 4 대상 |
| `test/subagents.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 18개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 4 대상 |
| `test/symbol-index.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 17개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 4 대상 |
| `test/task-brief-hash.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 1개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 4 대상 |
| `test/tasks-docs.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 11개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 4 대상 |
| `test/terminal-intent-provenance.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 1개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 4 대상 |
| `test/test-tiers.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 6개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 4 대상 |
| `test/time.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 2개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 4 대상 |
| `test/typescript-module-contract.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 2개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 4 대상 |
| `test/validate-gates.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 138개, 형식 적합 4개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 4 대상 |
| `test/validate-hints.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 2개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 4 대상 |
| `test/validate-structural.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 51개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 4 대상 |
| `test/verification-runner.test.js` | `test(`·`it(` 첫 인자 | Modify | 테스트 54개, 형식 적합 0개 | 모든 이름을 `<조건> → <결과>`로 변경 | 묶음 4 대상 |

#### Constraints

- 이 task는 동작을 바꾸지 않으므로 red 단계가 없다. implementer 보고의 `Red run`은 `해당 없음: 이름만 바꾸는 변경`이다.
- 첫 인자가 식별자이면 같은 값을 리터럴로 옮긴다. 반복문의 동적 이름은 template literal 안에 ` → `를 넣는다.
- 다른 묶음의 파일은 열어도 수정하지 않는다(병렬 실행).

### EPIC-095/BP-002/TASK-005 · `13630b0f`

#### Goal & intent

`scripts/check-test-names.js`와 npm script `lint:test-names`를 추가한다. 이 task는 `ci` 체인을 바꾸지 않는다. 이름 변경 task(TASKS-001~004)가 이 검사기로 자기 묶음을 검증하고, TASKS-006이 ci에 연결한다. 수용 기준은 아래 Checklist 단위 테스트 통과이며, 검증 명령은 `npm run ci`이다.

#### Current behavior

- 테스트 이름 검사기는 없다. eslint custom rule 선례도 없다(`eslint.config.js`는 plugin을 불러오지 않는다).
- 선례 `scripts/check-context-comments.js`(218줄)는 `parseArgs(argv)`(:49)를 두고, `if (require.main === module) process.exitCode = main();` 뒤 `module.exports = {…}`(:214-218)로 CLI와 순수 export를 함께 둔다.
- 테스트 계층: 모든 테스트 파일은 `test/tiers.json`의 unit 또는 integration 중 정확히 한 곳에 있어야 한다(`test/test-tiers.test.js:40-48`). unit tier는 프로세스 생성을 막는다(:50-80).
- 지금 저장소 전체에서 검사기를 돌리면 부적합 이름 약 1,640개가 나온다. 저장소 전체가 종료 코드 0이 되는 것은 TASKS-001~004 이후다.

#### Target behavior

- 성공: `node scripts/check-test-names.js [file ...]`는 대상 파일의 모든 이름이 적합하면 종료 코드 0이고, stdout에 검사한 파일 수와 이름 수를 쓴다. 인자가 없으면 `test/*.test.js` 전체를 검사한다.
- 실패: 부적합 이름마다 stderr에 `<path>:<line> <reason> <name>` 한 줄을 쓰고 종료 코드 1을 낸다. `line`은 `test(`·`it(` 호출이 시작한 줄이다. reason은 아래 셋 중 하나다.
  - `missing-arrow`: ` → ` 없음. ASCII `->`도 여기에 해당한다.
  - `empty-side`: 화살표 앞이나 뒤가 공백뿐이다.
  - `dynamic-name`: 첫 인자가 리터럴이 아니다.
- 보존: `ci` 체인과 기존 lint 단계. `test/helpers/`는 검사하지 않는다.

#### Interface

- 제공:
  - export `findTestNames(source: string) → Array<{ line: number, name: string | null, kind: 'literal' | 'template' | 'dynamic' }>`
    - `line`은 호출 시작 줄(1부터)이다.
    - `name`은 따옴표를 뺀 원문이다. template literal은 `${…}`를 원문 그대로 남긴다. `dynamic`이면 `null`이다.
  - export `classifyName(entry) → null | 'missing-arrow' | 'empty-side' | 'dynamic-name'`
  - export `main(argv: string[], io: { out(s: string): void, err(s: string): void, cwd: string }) → number`. CLI 진입점은 `process.exitCode = main(process.argv.slice(2), { out: …, err: …, cwd: process.cwd() })`이다. 테스트는 `main`을 in-process로 호출한다.
  - CLI `node scripts/check-test-names.js [file ...]`. 상대 경로는 `io.cwd` 기준이다. 인자가 없으면 `<cwd>/test/*.test.js`이다(하위 디렉터리 제외).
  - 출력 형식
    - 부적합 이름마다 `io.err`를 한 번 호출한다. 인자는 `<path>:<line> <reason> <name>\n`이다. `<path>`는 `io.cwd` 기준 상대 경로이고 구분자는 `/`다. `dynamic-name`의 `<name>`은 `-`다.
    - 끝에 `io.out`을 한 번 호출한다. 인자는 `checked <F> files, <N> names\n`이다. 실패해도 쓴다.
    - 반환값은 부적합 이름이 하나라도 있으면 1, 없으면 0이다.
  - npm script `"lint:test-names": "node scripts/check-test-names.js"`
- 대상 호출: 앞 글자가 `.`·식별자 문자가 아닌 `test(`·`it(`이다. 첫 인자 앞의 공백·줄바꿈은 건너뛴다.
- 거부(대상이 아님):
  - `.test(`(예: `/x/.test(s)`), `submit(` 같은 다른 호출
  - `//` 줄 주석과 `/* */` 블록 주석 안의 `test(`
  - 작은따옴표·큰따옴표·template literal 문자열 안의 `test(`. 이 규칙이 있어야 검사기 자신의 테스트 파일이 fixture 문자열 때문에 실패하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/check-test-names.js` | `findTestNames`, `classifyName`, `main` | Create | 없음 | 이름 추출·판정 CLI | Success criteria 4 |
| `package.json` | `scripts.lint:test-names` | Modify | 이름 검사 script 없음 | script만 추가, `ci`는 그대로 | TASKS-001~004의 검증 도구 |
| `test/check-test-names.test.js` | 판정 단위 테스트 | Create | 없음 | 순수 export로 적합·부적합 사례 단언 | 검증 지점 |
| `test/tiers.json` | `unit` | Modify | 기존 파일 목록 | `check-test-names.test.js` 추가 | `test/test-tiers.test.js:40-48` |

#### Constraints

- 검사기는 fs 읽기만 쓰고 프로세스를 생성하지 않는다. 테스트는 unit tier로 둔다.
- 판정은 정규식 한 줄 매칭이 아니라 첫 인자 토큰 추출 기준이다. 여러 줄 호출, 주석, 문자열, template literal을 처리한다.
- 새 테스트 이름은 `<조건> → <결과>` 형식이다.

### EPIC-095/BP-002/TASK-006 · `2dee56a4`

#### Goal & intent

`npm run ci` 체인에 `npm run lint:test-names`를 넣는다. 그러면 `test/*.test.js`에 부적합 이름이 하나라도 있을 때 ci가 실패한다. 수용 기준은 epic Success criteria 4이며, 검증 명령은 `npm run ci`이다.

#### Current behavior

- `package.json:47` `ci`는 `check:emit && test:coverage && test:unit && lint && lint:docs && lint:context-comments && typecheck && npm audit --audit-level=high`이다.
- `test/ci-contract.test.js:73-103`이 체인 순서를 단언한다. :101 정규식은 `… npm run lint:context-comments && npm run typecheck`가 연속이어야 한다.
- TASKS-005 이후 `lint:test-names` script가 있다. TASKS-001~004 이후 `node scripts/check-test-names.js`가 저장소 전체에서 종료 코드 0이다.
- `references/coding-standards/index.md`는 BP 001 TASKS-001이 만들고, `Tests` 절에 이름 규칙 문장이 있다. BP 실행 순서(001 → 002)가 이 파일의 존재를 보장한다.
- `CHANGELOG.md` `[Unreleased]`에는 BP 001 항목이 있다.

#### Target behavior

- 성공: `ci`가 `… && npm run typecheck && npm run lint:test-names && npm audit --audit-level=high`가 된다. 이름이 모두 적합하면 `npm run ci`가 통과한다.
- 실패: 부적합 이름이 하나라도 생기면 `npm run lint:test-names`가 종료 코드 1을 내고 `npm run ci`가 실패한다.
- 보존: 기존 단계와 순서, :101 정규식이 보는 연속 구간

#### Interface

- 제공: ci 체인 단계 `npm run lint:test-names`(typecheck 뒤, `npm audit` 앞)
- 거부: 기존 단계 사이에 끼워 넣는 배치. :101 연속 구간을 깨기 때문이다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `package.json` | `scripts.ci` | Modify | 이름 검사 없음 | `typecheck` 뒤에 `lint:test-names` 연결 | :47 |
| `test/ci-contract.test.js` | ci 체인 단언 | Modify | 이름 검사 단언 없음 | `lint:test-names`가 `typecheck` 뒤·`npm audit` 앞이라는 단언 | :73-103 |
| `references/coding-standards/index.md` | `Tests` 절 이름 규칙 | Modify | 규칙 문장만 있음 | `npm run lint:test-names`가 검사한다는 한 줄 | CS-05 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | BP 001 항목까지 | "테스트 이름 형식 검사 (EPIC 095 BP 002)" 항목 | 프로젝트 관례 |

#### Constraints

- 새 테스트 이름은 `<조건> → <결과>` 형식이다.
- 다른 ci 단계의 순서를 바꾸지 않는다.