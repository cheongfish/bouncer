---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/source-test-hygiene/blueprints/behavior-tests/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-11T16:48:27.172+09:00'
bouncer:
  id: EXPLAIN-behavior-tests
  epic_id: source-test-hygiene
  blueprint_id: behavior-tests
  status: published
  comprehension:
    - range_from: d2e34aa7f64c1849878b9394ecb142a221808735
      range_to: 74ef1cc17d6c799cd3da5a4551a66e1048b6562b
      diff_sha: e6ac01041a089f09922e06da60aa9a334bbc6a80e24c6b78ab323cef5aa5a560
      recorded_at: '2026-10-11T16:55:00+09:00'
  task_commits:
    - task: source-test-hygiene/behavior-tests/001
      sha: f321adf4
      intent_anchor: task-001
    - task: source-test-hygiene/behavior-tests/002
      sha: 2a5b0b0f
      intent_anchor: task-002
    - task: source-test-hygiene/behavior-tests/003
      sha: d412e931
      intent_anchor: task-003
    - task: source-test-hygiene/behavior-tests/004
      sha: c0f46e3c
      intent_anchor: task-004
    - task: source-test-hygiene/behavior-tests/005
      sha: 11d577f8
      intent_anchor: task-005
    - task: source-test-hygiene/behavior-tests/006
      sha: 74ef1cc1
      intent_anchor: task-006
---
# Explain

## Background

문서 문구를 정규식으로 검사하는 테스트와, 테스트마다 git 저장소를 새로 만드는 테스트가 `verify`와 CI를 느리게 했다. 소비 프로젝트의 워커에게는 어떤 테스트를 써야 하는지 기준도 없었다.
이 변경은 워커 지침에 동작 중심 테스트 규칙을 넣고, 테스트를 프로세스를 띄우지 않는 unit과 띄우는 integration으로 나눈다. 느린 저장소 준비는 템플릿 복사로 줄이고, 문구만 고정하던 테스트는 지우거나 문서 구조 린트로 옮긴다.

## Intuition

테스트를 "빠른 줄"과 "느린 줄"로 나눠 세우고, 빠른 줄에서는 프로세스 생성을 막는 문지기를 둔다. 문서 문구 확인은 테스트 대신 문서 린트가 맡는다.

## Code

- `agents/bouncer-implementer.md`, `agents/bouncer-reviewer.md`, `references/spec-authoring/index.md`, `references/review/assets/reviewer-prompt.md`: 동작 중심 테스트 규칙. `.codex/agents/*.toml`은 미러.
- `test/tiers.json`, `scripts/test-tier.js`: 계층 배정의 정본과 실행기. `npm run test:unit`, `npm run test:integration`이 이를 호출한다.
- `test/helpers/no-spawn.js`: unit 계층에서 `child_process`의 생성 함수를 막는 guard.
- `test/helpers/git-fixture.js`: git 템플릿을 한 번 만들고 복사해 주는 `createGitTemplate`.
- `scripts/check-doc-shape.js`: `PATH_CONTRACTS`와 `mergeContracts`로 경로별 문서 구조 계약을 검사한다. 인자 없이 실행하면 기본 대상과 계약 경로를 모두 훑는다.
- 삭제·축소된 문구 테스트: `test/skill-*.test.js`, `test/agents.test.js`, `test/master-rules.test.js` 등.

## Quiz

1. unit 계층에서 실행되는 테스트가 `spawnSync`를 호출하면 어떻게 되는가?
2. `test/tiers.json`이 존재하지 않는 테스트 파일을 나열한 채 `node scripts/test-tier.js unit`을 실행하면 어떻게 되는가?
3. 안에 `.git/worktrees`가 있는 템플릿에서 `copy()`를 호출하면 어떻게 되는가?
4. `PATH_CONTRACTS`에 등록된 문서가 없는 상태에서 `check-doc-shape`를 인자 없이 실행하면 어떻게 되는가?

## Tasks

### source-test-hygiene/behavior-tests/001 · `f321adf4`

#### Goal & intent

소비 프로젝트에서 Bouncer 워커가 테스트를 쓰거나 계획하거나 리뷰할 때 같은 동작 중심 테스트 규칙을 따르게 한다. 규칙은 implementer, spec-authoring, reviewer 에이전트, reviewer prompt 네 문서에 아래 영어 문장 그대로 넣는다. 수용 기준은 에픽 Success criteria 9이고 검증 명령은 `npm run ci`다.

규칙 원문(네 문서 공통, 문장 그대로 쓴다):

```markdown
Assert observable behavior: return values, exit codes, error codes, emitted data, and file or state changes. Do not assert document wording, source text, or internal implementation details with regexes or substring checks; assert a format only when that format is itself the contract (for example a commit message or a machine-read field). Use real git, child processes, or network only in integration tests and substitute injected seams in unit tests. Name each test as "<condition> → <result>".
```

#### Current behavior

- `agents/bouncer-implementer.md:115-120`의 5단계 **Tests first**는 실패 테스트 먼저 쓰기, 실패 확인, 단언 약화 금지만 적는다. 무엇을 단언할지는 없다.
- `agents/bouncer-reviewer.md:74-75`의 `correctness_tests` 정의와 `references/review/assets/reviewer-prompt.md:102-103`의 같은 항목은 "missing tests for changed behavior"까지만 본다.
- `.codex/agents/bouncer-implementer.toml`, `.codex/agents/bouncer-reviewer.toml`은 `scripts/src/lib/codex-agents.ts:37`의 `mdToCodexToml`이 md에서 만드는 생성물이다(첫 줄 `# bouncer-generated`). `test/agents.test.js:706-716`·`:981-982`는 implementer toml을, `:192-193`·`:233-234`·`:738`은 reviewer toml을 `mdToCodexToml` 결과와 바이트 단위로 비교한다. 저장소 사본을 다시 만드는 전용 스크립트는 없다.
- `test/agents.test.js:199`·`:214`는 `agents/bouncer-reviewer.md`에서 `correctness_tests`와 `minimality_maintainability` 사이를 200자 이내로 검사한다. `reviewer-prompt.md`는 `test/agents.test.js:154-160`(`Previous findings` 등 delta 입력 이름)·`:170-172`(`{{MODE}}` 등 placeholder)와 `test/skill-bouncer-execute.test.js:265-285`·`:691-703`이 문구를 검사한다. 규칙 문단을 관점 목록 뒤에 추가해도 이 단언들의 대상 문구는 바뀌지 않는다.
- `references/spec-authoring/index.md:156-175`의 Checklist 규칙은 실패 테스트 순서·expected red·생성 산출물·verify 범위를 다루고 단언 대상 규칙은 없다. `test/skill-spec-authoring.test.js:180-197`이 이 구간의 기존 문구를 검사한다.
- `references/implementation/index.md:34`와 `skills/bouncer-execute/references/agent-dispatch.md:81`은 tests-first를 이름으로만 가리킨다.

#### Target behavior

- 성공: 규칙 원문이 다음 위치에 있다.
  - `agents/bouncer-implementer.md` 5단계 **Tests first** 문단 끝(6단계 **Report** 앞)
  - `references/spec-authoring/index.md`의 `- **tasks**` 항목 안, `**Checklist** (verify vs paths)` bullet 바로 뒤에 `**Checklist** (behavior assertions):`로 시작하는 새 bullet
  - `agents/bouncer-reviewer.md`의 관점 목록(`` - `security` `` bullet) 바로 뒤, 기존 "Legacy perspective names remain valid …" 문단 앞에 별도 문단. 앞에 "Under `correctness_tests`, report a new or changed test that violates this rule:" 한 문장을 둔다.
  - `references/review/assets/reviewer-prompt.md` `### Discovery rules`의 관점 목록 뒤 별도 문단. 앞 문장은 reviewer 에이전트와 같다.
- 성공: 두 `.codex/agents/*.toml`은 수정한 md를 `mdToCodexToml`로 변환한 결과와 바이트 단위로 같다.
- 보존: 기존 tests-first 절차, spec-authoring 기존 Checklist 문구, reviewer 관점 이름과 관점 목록 bullet 문장은 그대로 둔다.
- 판정 근거: 런타임 동작이 바뀌지 않으므로 `npm run lint:docs`, md↔toml 일치 테스트, 기존 스위트 통과를 기준으로 한다. 지침 문구를 검사하는 새 테스트는 추가하지 않는다.

#### Interface

- 제공: 네 문서(와 생성 미러 두 개)의 규칙 문단.
- 거부: 지침 문구를 정규식으로 고정하는 새 테스트는 만들지 않는다. reviewer 관점 이름과 관점 목록 bullet은 바꾸지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `agents/bouncer-implementer.md` | `Tests first` 단계 | Modify | 실패 테스트 순서만 규정 | 규칙 원문 추가 | 구현 워커 진입점 |
| `.codex/agents/bouncer-implementer.toml` | 생성 미러 | Modify | md 변환 결과 | `mdToCodexToml`로 재생성 | 바이트 일치 단언 대상 |
| `agents/bouncer-reviewer.md` | 관점 목록 뒤 문단 | Modify | `correctness_tests` 정의 | 규칙 문단 추가 | reviewer 에이전트 기준 |
| `.codex/agents/bouncer-reviewer.toml` | 생성 미러 | Modify | md 변환 결과 | `mdToCodexToml`로 재생성 | 바이트 일치 단언 대상 |
| `references/spec-authoring/index.md` | `Checklist` 규칙 목록 | Modify | 순서·red·산출물·verify 규칙 | `Checklist (behavior assertions)` bullet 추가 | 계획 단계 진입점 |
| `references/review/assets/reviewer-prompt.md` | `Discovery rules` | Modify | `correctness_tests` 기준 | 관점 목록 뒤 규칙 문단 추가 | 리뷰 dispatch 진입점 |

#### Constraints

- reviewer 쪽 규칙은 관점 목록 bullet 안에 넣지 않는다(`agents/bouncer-reviewer.md`에 걸린 `test/agents.test.js:214` 거리 제약).
- toml 미러는 손으로 고치지 않고 `mdToCodexToml` 결과로 쓴다.
- 규칙 원문은 위 코드 블록 문장 그대로 쓴다.

### source-test-hygiene/behavior-tests/002 · `2a5b0b0f`

#### Goal & intent

테스트 파일을 unit·integration 계층에 배정하는 단일 목록을 두고, `npm run test:unit`·`npm run test:integration`으로 각 계층을 실행하며, unit 계층은 자식 프로세스 생성을 막는 guard를 로드한 채 돌리고, coverage를 병렬로 돌린다. 수용 기준은 에픽 Success criteria 4·5·6이고 검증 명령은 `npm run ci`다.

#### Current behavior

- `package.json:42` `"test": "node --test"`, `:44` `test:coverage`는 `--test-concurrency=1`과 임계값 94/82/96, `:45` `ci`는 `check:emit` → `test:coverage` → `lint` → `lint:docs` → `lint:context-comments` → `typecheck` → `audit` 순서다.
- `node --test`는 인자가 없으면 기본 glob으로 `test/helpers/read-skill.js`까지 집는다. 작업 트리의 `test/*.test.js`는 101개이고, BP 001이 두 개를 더해 이 task 시점에는 103개다.
- 직접 `child_process`를 참조하지 않는 파일은 55개다. 그중 일부는 `scripts/lib`를 거쳐 프로세스를 띄운다(예: `test/scaffold.test.js:9`, `test/review-record.test.js:9`가 `scripts/lib/cli`의 `runCli`를 import하고, `execute-prepare`·`current`·`import-git`이 `execFileSync`를 부른다). 직접 참조 여부만으로는 unit을 판정할 수 없다.
- BP 001이 추가하는 `test/canonical-json.test.js`, `test/guards.test.js`는 순수 함수만 부른다.
- `test/ci-contract.test.js:80`이 `--test-concurrency=1` 존재를 단언하고, `:81-84`가 include와 임계값을, `:86-98`이 `ci` 단계 순서를, `:102-107`이 GitHub·GitLab CI 단계가 정확히 `npm ci`, `npm run ci`임을 단언한다.
- `--test-concurrency=1`은 commit `0c611712`("공통 CI와 coverage 차단선")에서 들어왔고 직렬 실행 이유는 기록돼 있지 않다.
- 파일 안에서만 영향을 주는 전역 상태: `process.chdir`(`native-profile-e2e.test.js:129`, `cli-coordinate.test.js:120`, `coordinate-next.test.js:212`, `finalize-release-main.test.js:406`), `process.env` 저장·복원(`seed-worktree.test.js:258-277`, `subagents.test.js:77-110`). `node --test`는 파일마다 별도 프로세스라 파일 사이에는 공유되지 않는다.

#### Target behavior

- 성공: `test/tiers.json`이 `{ "unit": [...], "integration": [...] }`로 모든 `test/*.test.js`를 정확히 한 계층에 배정한다.
- 성공: `scripts/test-tier.js unit`은 `NODE_OPTIONS`에 `--require <절대 경로>/test/helpers/no-spawn.js`를 더해 unit 파일만 `node --test`로 실행한다. guard가 로드된 프로세스에서 `child_process`의 `spawn`·`spawnSync`·`exec`·`execSync`·`execFile`·`execFileSync`·`fork`를 부르면 `Error('unit tier must not spawn processes: <함수 이름>')`이 난다.
- 성공: `scripts/test-tier.js integration`은 guard 없이 integration 파일만 실행한다. 두 경우 모두 `node --test`의 종료 코드를 그대로 반환한다.
- 성공: 계층 배정은 guard를 켠 unit 실행이 통과하는 파일만 unit에 두는 방식으로 정한다.
- 성공: `test/test-tiers.test.js`는 (1) 목록에 없는 `test/*.test.js`, (2) 두 계층에 모두 있는 파일, (3) 존재하지 않는 파일 이름이 있으면 실패하고, (4) `require('../scripts/test-tier').unitNodeOptions()` 값을 `NODE_OPTIONS`로 주고 env에서 `NODE_TEST_CONTEXT`를 지운 채 `node --test <fixture>`를 실행하면(지우지 않으면 중첩 러너가 "called recursively"로 파일 실행을 건너뛰고 0으로 끝난다) 프로세스를 띄우는 fixture는 non-zero와 guard 오류 문구를, 순수 fixture는 0을 내는지, (5) 실행기의 거부 두 가지를 단언한다: 알 수 없는 계층 이름이면 종료 코드 2, 그리고 임시 디렉터리를 cwd로 두고 그 아래 `test/tiers.json`에 없는 파일 이름을 넣어 실행하면 `node --test` 전에 종료 코드 1과 그 파일 이름을 stderr에 낸다. 실행기는 목록을 `process.cwd()` 기준 `test/tiers.json`에서 읽는다.
- 성공: `test:coverage`는 `--test-concurrency=1` 없이 전체 스위트를 돌리고 임계값 94/82/96을 통과한다.
- 성공: `ci` 스크립트는 `check:emit` → `test:coverage` → `test:unit` → `lint` → … 순서로 `test:unit`을 포함한다. 이후 task의 verify(`npm run ci`)가 unit 계층과 guard를 매번 확인한다.
- 보존: `npm test`는 계속 전체를 실행한다. CI workflow 단계(`npm ci`, `npm run ci`)는 같고, `ci` 스크립트는 `test:unit` 한 단계만 늘어난다. 계층 검사는 테스트 파일이므로 `npm run ci` 안에서 돈다.
- 실패 처리: 병렬 coverage에서 실패하거나 흔들리는 파일이 나오면 그 파일은 이 task의 `affected_paths` 밖이므로 고치지 않고 파일 이름과 실패 내용을 deviation으로 보고한다. 임계값은 낮추지 않는다.

#### Interface

- 제공: `test/tiers.json`(키 `unit`·`integration`, 값은 `test/` 기준 파일 이름 배열), `test/helpers/no-spawn.js`(require 시 `process.env.NODE_TEST_CONTEXT`가 있을 때, 즉 `node --test`가 띄운 테스트 파일 프로세스 안에서만 `child_process`의 위 일곱 함수를 오류를 던지는 함수로 바꾼다. 러너 프로세스에서는 아무것도 바꾸지 않아 러너의 파일 실행을 막지 않는다), `scripts/test-tier.js <unit|integration>`(모듈로 require하면 `unitNodeOptions(): string`을 export하고, 직접 실행할 때만 테스트를 돌린다), npm 스크립트 `test:unit`(`node scripts/test-tier.js unit`)·`test:integration`(`node scripts/test-tier.js integration`).
- 거부 (실행 전): `scripts/test-tier.js`는 `unit`·`integration` 외 인자에 종료 코드 2와 사용법을 stderr에 낸다. 목록의 파일이 없으면 `node --test`를 부르기 전에 종료 코드 1과 없는 파일 이름을 stderr에 낸다.
- 거부 (실행 중): guard가 로드된 unit 실행에서 프로세스 생성 호출은 예외가 되어 그 테스트가 실패한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `test/tiers.json` | 계층 목록 | Create | 없음 | 단일 정본 | 계층 배정 |
| `test/helpers/no-spawn.js` | 신규 추출 지점: spawn guard | Create | 없음 | 프로세스 생성 함수 차단 | unit 판정 근거 |
| `scripts/test-tier.js` | 신규 추출 지점: 계층 실행기 | Create | 없음 | 목록을 읽어 `node --test` 실행, unit에 guard 주입 | npm 스크립트 진입점 |
| `test/test-tiers.test.js` | 분할·guard·실행기 검사 | Create | 없음 | 위 (1)–(5) 단언 | 검증 지점 |
| `package.json` | `scripts.test:unit`, `scripts.test:integration`, `scripts.test:coverage`, `scripts.ci` | Modify | 계층 스크립트 없음, coverage 직렬 | 스크립트 추가, `--test-concurrency=1` 제거, `ci`에 `test:unit` 추가 | 실행 진입점 |
| `test/ci-contract.test.js` | coverage·계층·`ci` 순서 단언 | Modify | `--test-concurrency=1` 존재 단언, `ci` 단계 순서 단언 | 부재 단언으로 교체, 계층 스크립트 값과 `ci`의 `test:unit` 위치 단언 | 계약 변경 |

#### Constraints

- 계층 배정은 `test/tiers.json` 한 곳에만 둔다. npm 스크립트에 파일 목록을 직접 쓰지 않는다.
- `test/helpers/`와 `test/fixtures/`는 테스트 파일이 아니므로 목록에 넣지 않는다. 인자 없는 `node --test`의 기본 glob이 `test/` 아래 모든 `.js`를 집으므로, guard 검사용 fixture 테스트 파일은 저장소에 두지 않고 `test/test-tiers.test.js`가 `mkdtemp` 디렉터리에 만들어 쓴다.
- `test/test-tiers.test.js`는 프로세스를 띄우므로 integration에 둔다.
- 새 테스트는 결과값과 종료 코드를 단언한다.

### source-test-hygiene/behavior-tests/003 · `d412e931`

#### Goal & intent

가장 느린 테스트 파일 다섯 개가 기본 git 저장소를 파일당 한 번 만들고, 각 테스트는 그 복사본에서 시작하게 한다. 테스트가 검증하는 동작과 단언은 바꾸지 않는다. 수용 기준은 에픽 Success criteria 7이고 검증 명령은 `npm run ci`다.

#### Current behavior

- 측정(6개 파일 동시 실행): `coordinator.test.js` 29.6s, `commit-task.test.js` 21.0s, `coordinate-next.test.js` 13.2s, `finalize.test.js` 9.2s, `cli-coordinate.test.js` 8.1s. 재현은 `time node --test test/<file>`.
- 공용 helper 없음(`test/helpers/`에는 `read-skill.js`뿐).
- `coordinator.test.js`: helper 없이 테스트 본문마다 `git init` → README 커밋을 반복한다. `git init` 위치는 `:169`, `:220`, `:271`, `:419`, `:465`, `:483`, `:511`, `:536`, `:564`, `:585`, `:615`, `:638`, `:663`, `:1248`, `:1270`, `:1295`, `:1321`, `:1343`, `:1369`, `:1675`, `:2788`, `:2917`, `:2948`, `:2983`이다. 이어서 테스트별 plan 문서 커밋. `:418-424`는 `git config user.*`를 쓴다. 기본 브랜치는 호스트 `init.defaultBranch`를 따른다.
- `commit-task.test.js`: `initGitWithChange`(`:43`, `init -b work` → base 커밋 → `develop` 브랜치 → 변경 커밋), `fullBlueprint`(`:130`, 24회), `coordinatorFixture`(`:578`, bootstrap·prepare로 실제 worktree 생성).
- `finalize.test.js`: `initGitWithChange`(`:70`, commit-task와 같음), `fullBlueprint`(`:86`, 약 56회), `:535-538` realpath 저장소와 `git worktree add --detach`.
- `coordinate-next.test.js`: `uncommittedPlanRepo`(`:95`, init `:97`), `preparedCommitDrive`(`:114`, init `:116`), `supplementReviewDrive`(`:414`, 앞의 helper에 위임), 약 50회. `:1358`은 테스트 본문의 별도 `git init`이다.
- `cli-coordinate.test.js`: `planCommittedRepo`(`:58`, init `:61`, 내용 고정), `preparedDrive`(`:91`)·`recordedDrive`(`:170`)는 `planCommittedRepo`에 위임, 37회. `:772`는 빈 저장소가 필요한 테스트의 별도 `git init -b work`다.
- 테스트는 이후 저장소를 바꾼다(bootstrap·prepare worktree, 브랜치, 커밋). worktree가 생긴 뒤의 `.git/worktrees/*/gitdir`와 worktree의 `.git` 파일은 절대 경로를 담는다. worktree가 생기기 전의 `.git`에는 절대 경로가 없다.

#### Target behavior

- 성공: `test/helpers/git-fixture.js`가 "준비 함수를 한 번 실행한 템플릿 디렉터리를 만들고, 요청마다 새 `mkdtemp` 디렉터리로 복사해 돌려주는" helper를 제공한다. 각 테스트 파일은 `after()`에서 자기가 만든 템플릿의 `dispose()`를 부른다. helper는 hook을 스스로 등록하지 않는다.
- 성공: 다섯 파일의 저장소 준비 helper는 worktree를 만들기 전 단계(init, config, base·변경·plan 커밋 중 테스트 사이에 같은 부분)를 템플릿에서 복사한다. 테스트별로 다른 문서 쓰기와 커밋, bootstrap·prepare는 복사 뒤에 실행한다.
- 성공: 다섯 파일에서 `git init`은 템플릿을 만드는 `setup` 함수 안에서만 실행한다. 예외는 커밋 없는 빈 저장소 자체가 검증 조건인 두 테스트(`cli-coordinate.test.js:772`, `coordinate-next.test.js:1358`)뿐이며 그대로 둔다. Current behavior에 적은 나머지 `git init` 위치는 모두 템플릿 복사로 바꾼다. 한 테스트가 저장소를 여러 개 쓰는 경우(예: `coordinator.test.js:1270`의 `directory`)는 `copy()`를 그만큼 부른다.
- 보존: 각 파일의 테스트 수와 단언은 같다. 템플릿 복사본끼리 상태를 공유하지 않는다.
- 판정 근거: 다섯 파일이 통과하고, 바꾸기 전후의 `time node --test test/<file>` 결과를 보고에 적는다.

#### Interface

- 제공: `createGitTemplate(setup: (dir: string) => void): { dir: string, copy(): string, dispose(): void }`. `dir`은 템플릿 디렉터리 절대 경로, `copy()`는 새 임시 디렉터리 절대 경로를 반환하고, `dispose()`는 템플릿과 그때까지 만든 복사본을 지운다.
- 거부: `setup` 안에서 worktree를 만들면 복사본이 깨지므로, `copy()`는 템플릿에 `.git/worktrees`가 있으면 Error를 던진다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `test/helpers/git-fixture.js` | `createGitTemplate` | Create | 없음 | 템플릿 생성·복사·정리 | 공용 준비 지점 |
| `test/coordinator.test.js` | 인라인 init 블록 | Modify | 테스트마다 init·README 커밋 | 템플릿 복사로 교체 | 가장 느린 파일 |
| `test/commit-task.test.js` | `initGitWithChange`, `fullBlueprint` | Modify | 호출마다 git 7회 | 템플릿 복사로 교체 | 준비 반복 |
| `test/finalize.test.js` | `initGitWithChange`, `fullBlueprint` | Modify | 호출마다 git 준비 | 템플릿 복사로 교체 | 준비 반복 |
| `test/coordinate-next.test.js` | `uncommittedPlanRepo`, `preparedCommitDrive` | Modify | 호출마다 init·커밋 | 템플릿 복사로 교체 | 준비 반복 |
| `test/cli-coordinate.test.js` | `planCommittedRepo` | Modify | 호출마다 고정 내용 init·커밋 | 템플릿 복사로 교체 | 준비 반복 |
| `test/git-fixture.test.js` | helper 동작 단언 | Create | 없음 | 복사본 독립성·worktree 거부·정리 단언 | 검증 지점 |
| `test/tiers.json` | `integration` 목록 | Modify | TASKS-002가 만든 계층 목록 | `git-fixture.test.js`를 integration에 추가 | 계층 누락 검사 통과 |

#### Constraints

- 테스트가 검증하는 제품 동작(bootstrap·prepare·commit·finalize 경로)은 복사 뒤에 그대로 실행한다. 제품 코드 호출을 건너뛰는 fixture는 만들지 않는다.
- 커밋 작성자 설정은 템플릿에 저장소 로컬 config로 넣어 호스트 전역 설정에 기대지 않는다.
- `test/git-fixture.test.js`는 실제 git을 쓰므로 `test/tiers.json`의 integration 목록에 넣는다.

### source-test-hygiene/behavior-tests/004 · `c0f46e3c`

#### Goal & intent

에이전트·공통 규칙·일부 스킬 문서의 문구를 정규식으로 검사하는 테스트를 아래 분류 규칙대로 정리하고, 문서 구조 규칙은 `npm run lint:docs`가 경로별로 검사하게 한다. 수용 기준은 에픽 Success criteria 8이고 검증 명령은 `npm run ci`다.

대상 파일: `test/agents.test.js`, `test/master-rules.test.js`, `test/workflow-safety-canon.test.js`, `test/lightweight-cycle.test.js`, `test/skill-debugging.test.js`, `test/skill-explain-diff.test.js`, `test/skill-context-review.test.js`, `test/skill-bouncer-commit.test.js`.

분류 규칙(위에서부터 처음 맞는 것을 적용):
1. **유지**: 기계가 읽는 계약 — md↔toml 바이트 일치, 에이전트 frontmatter(`name`, `description`, `model`), 파일 존재·부재, 링크 대상 존재, `checkDocShape` 자체의 단위 테스트, 줄 수 같은 구조 측정.
2. **동작 테스트로 교체**: 단언한 문장의 계약을 `bouncer` CLI 명령이나 `scripts/lib` 함수가 강제하면, 그 명령·함수를 호출해 결과(반환값, 종료 코드, 오류 코드, 파일·상태 변화)를 단언한다. 같은 동작을 이미 단언하는 테스트가 있으면 새로 쓰지 않고 삭제한다.
3. **문서 lint로 이동**: 필수 제목, 필수 링크, 번호 단계, ACQ index처럼 `checkDocShape`가 표현하는 구조이면 경로별 계약 표로 옮긴다.
4. **삭제**: 나머지(문장 표현만 지키는 단언).

#### Current behavior

- 단언 수(테스트 / `assert.match`·`doesNotMatch` / `.includes`): agents 54/320/8, master-rules 41/163/0, workflow-safety-canon 11/24/0, lightweight-cycle 10/71/0, skill-debugging 9/28/0, skill-explain-diff 5/51/2, skill-context-review 10/65/0, skill-bouncer-commit 9/44/0.
- 예시 분류(조사 근거):
  - 유지: `agents.test.js:25`(frontmatter), `:605`·`:706`·`:738`(toml 일치), `:668`·`:688`·`:751`(`mdToCodexToml` 동작), `:918`(Worker dispatch 20줄), `master-rules.test.js:12-404`(`checkDocShape` 단위 테스트), `:446`·`:450`(파일 부재·init 동작).
  - 문서 lint: `agents.test.js:621`·`:634`·`:650`(공통 골격 제목 순서), `master-rules.test.js:515`·`:549`·`:567`(필수 링크).
  - 동작 교체 후보: `agents.test.js:781`·`:830`(오래된 brief revision 거절), `:394`·`:468`(lease 기반 task 식별), `:563`(ledger 경로·hash fence). 각 계약을 강제하는 코드가 있는지는 구현 중 `scripts/src/lib`에서 확인한다.
  - 삭제: `agents.test.js:142`, `:943`, `master-rules.test.js:741`·`:848` 같은 표현 단언.
- `scripts/check-doc-shape.js`(886줄)는 `classifyDocPath`로 workflow·agent·subskill 종류별 고정 계약만 검사한다. 문서별 필수 링크·단계는 테스트가 인라인 계약으로 넘길 때만 검사한다(execute `:15`·`:64`, plan `:15`·`:28`·`:75`·`:580`, commit `:13`). 경로별 계약을 저장소에 두는 구조는 없다. `npm run lint:docs`는 `ci`에 포함된다.
- 대상 파일은 `scripts/lib/frontmatter`, `checkDocShape`, `scripts/lib/codex-agents` 외의 lib를 거의 쓰지 않아, 삭제가 coverage에 주는 영향은 작다.

#### Target behavior

- 성공: 대상 파일에 남은 `assert.match`·`doesNotMatch`·`includes` 중 문서 본문을 대상으로 한 단언은 모두 분류 1(유지)에 속한다.
- 성공: `scripts/check-doc-shape.js`에 경로별 계약 표 `PATH_CONTRACTS`가 있다. 분류 3으로 옮긴 규칙은 이 표에 있다.
- 성공: 인자 없는 `runCli`(= `npm run lint:docs`)의 검사 대상은 기존 기본 스캔 파일과 `PATH_CONTRACTS`의 모든 키의 합집합이다. 그래서 `rules/*.md`, `skills/*/references/*.md`, 루트 문서처럼 `classifyDocPath`가 `null`인 경로도 표에 넣으면 검사된다. 표의 키에 해당하는 파일이 `cwd`에 없으면 기존 인자 경로와 같이 `missing file` 위반으로 종료 코드 1이다.
- 성공: 파일 하나를 검사할 때 종류별 계약(`classifyDocPath`가 `null`이 아니면)과 경로 계약을 모두 적용한다. 종류가 `null`이고 표에 있는 경로는 경로 계약만 적용하며 `no skill-shape contract` 오류를 내지 않는다. 마지막 H2 규칙(`requireLastH2`)은 종류가 있는 문서에만 적용한다.
- 성공: `test/skill-bouncer-commit.test.js:13`의 인라인 `checkDocShape` 계약도 `PATH_CONTRACTS`로 옮기고, 대상 파일에 인라인 계약 사본을 남기지 않는다.
- 성공: `test/doc-shape-cli.test.js`에 다음 테스트가 있다.
  - 임시 디렉터리에 표의 키 하나와 같은 상대 경로로 실제 문서를 복사하고 `runCli([rel], { cwd: tmp })`를 부르면 0이다. 같은 사본에서 그 키의 경로 계약만 요구하는 필수 제목(종류별 계약이 요구하지 않는 제목) 하나를 지우면 1이고, stderr에 `rel`과 빠진 제목 이름이 나온다.
  - `classifyDocPath`가 `null`인 표의 키(예: `rules/` 아래 문서)를 같은 방식으로 검사하면 원본 사본은 0, 경로 계약 제목을 지운 사본은 1이다.
  - 임시 디렉터리를 `cwd`로 인자 없이 `runCli([], { cwd: tmp })`를 부르면 표의 키 파일이 없으므로 1이고 stderr에 `missing file`이 나온다.
- 성공: 분류 2로 바꾼 테스트는 CLI·lib 결과를 단언한다.
- 보존: 현재 저장소 문서는 `npm run lint:docs`를 통과한다. coverage 임계값 94/82/96을 지킨다.
- 보고: 파일별로 정리 전후의 테스트 수와 단언 수, 분류별 건수를 보고에 적는다.

#### Interface

- 제공: `PATH_CONTRACTS`(`check-doc-shape.js` 내부 상수). 형태는 `{ [repoRelativePath: string]: Contract }`이고 `Contract`는 `checkDocShape(markdown, contract)`의 두 번째 인자와 같은 객체다(예: `{ headings: { required: [...], order: [...] }, links: [{ href: '...' }], steps: { required: [...], acq: [...] } }`). 테스트에 있던 인라인 계약 객체를 그대로 옮길 수 있다.
- 거부: `checkDocShape`가 이미 표현하는 계약 종류 외의 새 검사 종류(문장 정규식 등)는 표에 넣지 않는다.
- 거부: 표의 키에 해당하는 파일이 `cwd`에 없으면 `missing file` 위반이다. 테스트는 검사할 파일을 인자로 넘겨(`runCli([rel], { cwd: tmp })`) 다른 키의 영향을 받지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/check-doc-shape.js` | `PATH_CONTRACTS`, 기본 스캔 | Modify | 종류별 고정 계약만 검사 | 경로별 계약 표 추가·적용 | 분류 3 이동처 |
| `test/doc-shape-cli.test.js` | 경로별 계약 단언 | Modify | CLI 기본 동작 단언 | 위반 fixture 단언 추가 | 검증 지점 |
| `test/agents.test.js` | 문구 단언 | Modify | 문구 정규식 320건 | 분류 규칙 적용 | 대상 |
| `test/master-rules.test.js` | 문구 단언 | Modify | 문구 정규식 163건 | 분류 규칙 적용 | 대상 |
| `test/workflow-safety-canon.test.js` | 문구 단언 | Modify | 문구 정규식 | 분류 규칙 적용 | 대상 |
| `test/lightweight-cycle.test.js` | 문구 단언 | Modify | 문구 정규식 | 분류 규칙 적용 | 대상 |
| `test/skill-debugging.test.js` | 문구 단언 | Modify | 문구 정규식 | 분류 규칙 적용 | 대상 |
| `test/skill-explain-diff.test.js` | 문구 단언 | Modify | 문구 정규식 | 분류 규칙 적용 | 대상 |
| `test/skill-context-review.test.js` | 문구 단언 | Modify | 문구 정규식 | 분류 규칙 적용 | 대상 |
| `test/skill-bouncer-commit.test.js` | 문구 단언 | Modify | 문구 정규식 | 분류 규칙 적용 | 대상 |
| `test/tiers.json` | 계층 목록 | Modify | 파일 목록 | 지운 파일 제거, 프로세스를 띄우게 된 파일을 integration으로 이동 | 계층 검사 |

#### Constraints

- 분류 2에서 강제 코드를 찾지 못하면 분류 4(삭제)로 처리하고 보고에 그 테스트 이름을 남긴다. 제품 코드에 새 검사를 추가하지 않는다.
- 삭제로 coverage가 임계값 아래로 내려가면 임계값을 낮추지 않는다. 보강할 테스트 파일이 이 task의 `affected_paths` 안에 있으면 동작 테스트를 추가하고, 밖에 있으면 deviation으로 보고한다.
- 분류 2로 새로 쓴 테스트가 자식 프로세스를 띄우면 그 파일을 `test/tiers.json`의 integration으로 옮긴다.
- 새로 쓰는 테스트는 BP 002 TASKS-001의 규칙(결과 단언, 문구 단언 금지)을 따른다.

### source-test-hygiene/behavior-tests/005 · `11d577f8`

#### Goal & intent

워크플로 스킬 테스트 여섯 파일에 TASKS-004의 분류 규칙(유지 → 동작 교체 → 문서 lint 이동 → 삭제)을 똑같이 적용한다. 수용 기준은 에픽 Success criteria 8이고 검증 명령은 `npm run ci`다.

대상 파일: `test/skill-bouncer-execute.test.js`, `test/skill-bouncer-plan.test.js`, `test/skill-bouncer-finalize.test.js`, `test/skill-bouncer-run.test.js`, `test/skill-bouncer-surface.test.js`, `test/skill-spec-authoring.test.js`.

#### Current behavior

- 단언 수(테스트 / `assert.match`·`doesNotMatch` / `.includes`): execute 41/258/0, plan 37/220/0, finalize 12/118/0, run 18/109/0, surface 23/58/6, spec-authoring 17/84/0.
- 이미 `checkDocShape`를 인라인 계약으로 쓰는 테스트: execute `:15`·`:64`, plan `:15`·`:28`·`:75`·`:580`, commit `:13`(commit은 TASKS-004 범위). TASKS-004 뒤에는 이 계약을 `PATH_CONTRACTS`로 옮길 수 있다.
- 예시 분류(조사 근거):
  - 동작 교체 후보: execute `:136`(`bouncer execute prepare --blueprint`가 `worktreePath`를 반환), `:210`(tasks → verified 전환은 execute gate만 함), plan `:98`·`:104`(G10–G12, G18 게이트), plan `:179`(task 제목이 커밋 제목이 됨), finalize `:103`·`:251`(release-main 뒤 worktree 제거), run `:169`(repair wave 상한 2).
  - 문서 lint: plan `:38`(ACQ 단계 배치), run `:8`(DAG를 start ACQ 전에 표시하는 단계).
  - 삭제: execute `:173`·`:197`, plan `:131`·`:199`·`:210`, run `:69`·`:196`, finalize `:153`·`:191` 같은 표현 단언.
- `test/skill-spec-authoring.test.js:180-197`은 spec-authoring `- **tasks**` 항목의 기존 Checklist 문구를 검사한다. BP 002 TASKS-001이 같은 구간에 bullet 하나를 추가한다.

#### Target behavior

- 성공: 대상 파일에 남은 문서 본문 대상 정규식·`includes` 단언은 모두 TASKS-004 분류 1(유지)에 속한다.
- 성공: 인라인 `checkDocShape` 계약은 `PATH_CONTRACTS`로 옮겨지고 테스트의 인라인 사본은 없다.
- 성공: 분류 2로 바꾼 테스트는 CLI·lib 결과를 단언한다.
- 보존: 현재 문서는 `npm run lint:docs`를 통과하고 coverage 임계값을 지킨다.
- 보고: 파일별 정리 전후 테스트 수·단언 수·분류별 건수를 적는다.

#### Interface

- 제공: `PATH_CONTRACTS`에 워크플로 스킬 경로 항목 추가.
- 거부: 새 검사 종류를 lint에 추가하지 않는다. 강제 코드를 찾지 못한 계약은 삭제하고 보고에 남긴다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/check-doc-shape.js` | `PATH_CONTRACTS` | Modify | TASKS-004가 만든 표 | 스킬 경로 항목 추가 | 분류 3 이동처 |
| `test/skill-bouncer-execute.test.js` | 문구 단언 | Modify | 문구 정규식 258건 | 분류 규칙 적용 | 대상 |
| `test/skill-bouncer-plan.test.js` | 문구 단언 | Modify | 문구 정규식 220건 | 분류 규칙 적용 | 대상 |
| `test/skill-bouncer-finalize.test.js` | 문구 단언 | Modify | 문구 정규식 118건 | 분류 규칙 적용 | 대상 |
| `test/skill-bouncer-run.test.js` | 문구 단언 | Modify | 문구 정규식 109건 | 분류 규칙 적용 | 대상 |
| `test/skill-bouncer-surface.test.js` | 문구 단언 | Modify | 문구 정규식 | 분류 규칙 적용 | 대상 |
| `test/skill-spec-authoring.test.js` | 문구 단언 | Modify | 문구 정규식 | 분류 규칙 적용 | 대상 |
| `test/tiers.json` | 계층 목록 | Modify | 파일 목록 | 지운 파일 제거, 프로세스를 띄우게 된 파일을 integration으로 이동 | 계층 검사 |

#### Constraints

- 분류 규칙과 coverage 처리 방식은 TASKS-004와 같다.
- 새로 쓰는 테스트는 BP 002 TASKS-001의 규칙을 따른다.

### source-test-hygiene/behavior-tests/006 · `74ef1cc1`

#### Goal & intent

TASKS-004·005가 다루지 않은 문서 전용 테스트 12개 파일에 TASKS-004의 분류 규칙(유지 → 동작 교체 → 문서 lint 이동 → 삭제)을 똑같이 적용하고, BP 002 변경을 CHANGELOG에 기록한다. 수용 기준은 에픽 Success criteria 8·10이고 검증 명령은 `npm run ci`다.

대상 파일: `test/skill-graphify-runner.test.js`, `test/skill-implementation.test.js`, `test/skill-minimality.test.js`, `test/skill-discovery.test.js`, `test/skill-bouncer-init.test.js`, `test/skill-output-contract.test.js`, `test/skill-stop-slop.test.js`, `test/open-source-readiness.test.js`, `test/trust-boundary.test.js`, `test/rule-ownership.test.js`, `test/template-guidance.test.js`, `test/acq-gate-ids.test.js`.

#### Current behavior

- 단언 수(테스트 / `assert.match`·`doesNotMatch` / `.includes`): graphify-runner 20/98/0, implementation 6/29/0, minimality 8/22/1, discovery 6/21/0, bouncer-init 8/21/0, output-contract 3/21/0, stop-slop 3/8/0, open-source-readiness 6/22/0, trust-boundary 6/16/1, rule-ownership 7/14/5, template-guidance 1/12/0, acq-gate-ids 4/8/1.
- 다섯 파일(graphify-runner, implementation, minimality, discovery, stop-slop)은 `test/helpers/read-skill.js`로 `references/<name>/index.md`를 읽는다. 나머지는 `rules/`, `skills/`, 저장소 루트 문서를 `fs.readFileSync`로 읽는다.
- 대상 파일 중 `scripts/lib`를 부르는 것은 `read-skill`·`frontmatter` 경유뿐이라 삭제가 coverage에 주는 영향은 작다.
- `CHANGELOG.md` `[Unreleased]`에는 BP 002 항목이 없다.

#### Target behavior

- 성공: 대상 파일에 남은 문서 본문 대상 정규식·`includes` 단언은 모두 TASKS-004 분류 1(유지)에 속한다.
- 성공: 분류 3으로 옮긴 구조 규칙은 `PATH_CONTRACTS`에 있다. 분류 2로 바꾼 테스트는 CLI·lib 결과를 단언한다.
- 성공: `CHANGELOG.md` `[Unreleased]`에 BP 002 항목(동작 중심 테스트 지침, 계층 스크립트·spawn guard·병렬 coverage, fixture 저장소 재사용, 문서 문구 테스트 정리)이 있고, `.bouncer/config.json`의 `verify`를 `npm run test:unit`으로 바꿀 수 있다는 안내가 있다.
- 보존: 현재 문서는 `npm run lint:docs`를 통과하고 coverage 임계값 94/82/96을 지킨다.
- 보고: 파일별 정리 전후 테스트 수·단언 수·분류별 건수, `time npm test`, `time npm run test:unit` 결과를 적는다.

#### Interface

- 제공: 분류 3으로 옮기는 규칙이 있으면 `PATH_CONTRACTS`에 그 문서 경로 항목을 추가한다. `rules/`·루트 문서처럼 `classifyDocPath`가 `null`인 경로도 TASKS-004 이후에는 표의 키로 검사된다.
- 거부: 새 검사 종류를 lint에 추가하지 않는다. 강제 코드를 찾지 못한 계약은 삭제하고 보고에 남긴다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/check-doc-shape.js` | `PATH_CONTRACTS` | Modify | TASKS-004·005가 채운 표 | 대상 문서 항목 추가 | 분류 3 이동처 |
| `test/skill-graphify-runner.test.js` | 문구 단언 | Modify | 문구 정규식 98건 | 분류 규칙 적용 | 대상 |
| `test/skill-implementation.test.js` | 문구 단언 | Modify | 문구 정규식 | 분류 규칙 적용 | 대상 |
| `test/skill-minimality.test.js` | 문구 단언 | Modify | 문구 정규식 | 분류 규칙 적용 | 대상 |
| `test/skill-discovery.test.js` | 문구 단언 | Modify | 문구 정규식 | 분류 규칙 적용 | 대상 |
| `test/skill-bouncer-init.test.js` | 문구 단언 | Modify | 문구 정규식 | 분류 규칙 적용 | 대상 |
| `test/skill-output-contract.test.js` | 문구 단언 | Modify | 문구 정규식 | 분류 규칙 적용 | 대상 |
| `test/skill-stop-slop.test.js` | 문구 단언 | Modify | 문구 정규식 | 분류 규칙 적용 | 대상 |
| `test/open-source-readiness.test.js` | 문구 단언 | Modify | 문구 정규식 | 분류 규칙 적용 | 대상 |
| `test/trust-boundary.test.js` | 문구 단언 | Modify | 문구 정규식 | 분류 규칙 적용 | 대상 |
| `test/rule-ownership.test.js` | 문구 단언 | Modify | 문구 정규식 | 분류 규칙 적용 | 대상 |
| `test/template-guidance.test.js` | 문구 단언 | Modify | 문구 정규식 | 분류 규칙 적용 | 대상 |
| `test/acq-gate-ids.test.js` | 문구 단언 | Modify | 문구 정규식 | 분류 규칙 적용 | 대상 |
| `test/tiers.json` | 계층 목록 | Modify | 파일 목록 | 지운 파일 제거, 프로세스를 띄우게 된 파일을 integration으로 이동 | 계층 검사 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | BP 002 항목 없음 | BP 002 항목 추가 | 프로젝트 규칙 |

#### Constraints

- 분류 규칙과 coverage 처리 방식은 TASKS-004와 같다.
- 새로 쓰는 테스트는 BP 002 TASKS-001의 규칙을 따른다.
