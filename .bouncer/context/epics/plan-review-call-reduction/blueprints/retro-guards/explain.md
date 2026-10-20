---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/plan-review-call-reduction/blueprints/retro-guards/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-15T15:52:05.326+09:00'
bouncer:
  id: EXPLAIN-retro-guards
  epic_id: plan-review-call-reduction
  blueprint_id: retro-guards
  status: published
  comprehension:
    - range_from: c00aacbb0639c9fd56a27105b16010fd127c4735
      range_to: c71889a53bc9618b8c0f57e2ab59647013607833
      diff_sha: c610cdad50e91cb16ebe20fb8ec9f51ff8fe5148d066c0d39b7fa3e17922a613
      recorded_at: '2026-10-15T16:10:00+09:00'
  task_commits:
    - task: plan-review-call-reduction/retro-guards/001
      sha: 7f7e4e43
      intent_anchor: task-001
    - task: plan-review-call-reduction/retro-guards/002
      sha: fcac549b
      intent_anchor: task-002
    - task: plan-review-call-reduction/retro-guards/003
      sha: 6b5c3b31
      intent_anchor: task-003
    - task: plan-review-call-reduction/retro-guards/004
      sha: 65ede4b2
      intent_anchor: task-004
    - task: plan-review-call-reduction/retro-guards/005
      sha: c71889a5
      intent_anchor: task-005
---
# Explain

## Background

101/001 drive를 돌려 보니 사람이 기억해야만 막히지 않는 구멍이 네 곳 있었다. 메트릭 토큰을 언제 기록해야 하는지 문서가 모호했고, 테스트 파일을 tier에 등록하지 않았을 때의 실패 메시지가 원인을 알려 주지 않았다. 관점이 다른 리뷰어가 같은 파일·심볼을 각자 보고하면 중복 finding이 그대로 쌓였고, gitignore 대상인 빌드 산출물이 새 worktree에 없어 verify가 깨졌다.

이 변경은 네 구멍을 문서, 실패 메시지, record 응답, worktree 준비 단계가 대신 알리거나 처리하게 만든다.

## Intuition

문 앞 경비원이 "이 서류 빠졌어요"를 말해 주고, 준비물(빌드)은 방에 들어가기 전에 미리 챙겨 두는 그림이다. 막지는 않고 알리거나 준비한다.

## Code

- `rules/subagent-model.md`, `skills/bouncer-run/references/drive-metrics.md`: 메트릭 `end`는 같은 에이전트의 task-notification 사용량을 받은 뒤 기록한다고 두 문서가 같은 말로 쓴다. 이미 닫은 세션은 나중에 고치지 않는다.
- `test/test-tiers.test.js`: tier 등록 누락·중복·존재하지 않는 파일을 각각 파일 이름과 `test/tiers.json` 수정 방법과 함께 알린다. 중복 메시지는 접두어로 경로를 대신한다는 선택이 있다.
- `scripts/src/lib/validate-sections.ts`의 `findingMergeCandidates`: 한 round 안에서 정규화한 file과 trim한 symbol이 같고 category가 둘 이상인 묶음을 찾는다. `findingFingerprint`와 같은 `normalizeFindingFile`을 쓰고 대소문자는 접지 않는다. `review-record.ts`·`context-review-state.ts`가 기록 뒤 성공 응답에 `warnings`를 붙인다. 후보가 없으면 키가 없고, 기록을 막거나 바이트를 바꾸지 않는다. 비교 대상은 이번 호출의 입력 findings뿐이고 기존 원장은 보지 않는다. id가 없는 항목은 `ids`에서 빠진다.
- `scripts/src/lib/seed-worktree.ts`의 `runWorktreeSetup`: 의존성 설치(또는 건너뜀) 뒤 마지막에 `worktree.setup`을 셸 없이 argv로 한 번 실행한다. config는 새 worktree가 아니라 main checkout에서 읽는다. 허용 목록(`verify_allowlist`)과 단일 명령 규칙을 `command-argv.ts`로 옮겨 verify와 공유한다. 거절이나 실행 실패는 `dependency-install-failed`이고 메시지가 `worktree.setup`으로 시작한다. 읽을 수 없는 main config는 설정 없음으로 본다.
- `scripts/src/lib/init.ts`의 `hasBuildScript`: 새 config를 만들 때 `package.json`에 문자열 `scripts.build`가 있으면 `worktree.setup`을 `npm run build`로 넣는다. 읽기·파싱 실패는 build 없음이다. 기존 config는 다시 쓰지 않는다. 사용법은 `docs/configuration.md`, `config.example.json`, `rules/cli.md`에 있다.

## Quiz

1. 한 round에 같은 file·symbol을 가리키지만 category가 다른 finding 두 개를 `record`하면 어떻게 되는가?
   - A) 중복이라 record가 거절된다.
   - B) 자동으로 하나로 병합되어 기록된다.
   - C) 그대로 기록되고 성공 응답에 `finding-merge-candidate` 경고가 붙는다.
2. `worktree.setup` 명령은 어느 config에서 읽는가?
   - A) main checkout의 config
   - B) 새로 만든 worktree 안의 config
   - C) 사용자 홈 디렉터리의 전역 config
3. `worktree.setup`에 `npm ci && npm run build`처럼 셸 연산자가 든 값을 넣으면 어떻게 되는가?
   - A) 셸을 통해 두 명령이 순서대로 실행된다.
   - B) 실행하지 않고 `dependency-install-failed`로 실패하며 메시지가 `worktree.setup`으로 시작한다.
   - C) 첫 명령만 실행하고 나머지는 무시한다.
4. 이미 `.bouncer/config.json`이 있는 저장소에서 `bouncer init`을 다시 실행하고 `package.json`에 `scripts.build`가 있으면?
   - A) 에러로 중단한다.
   - B) `worktree.setup`을 `npm run build`로 덮어쓴다.
   - C) 기존 config를 다시 쓰지 않는다.

## Tasks

### plan-review-call-reduction/retro-guards/001 · `7f7e4e43`

#### Goal & intent

root가 coordinator 세션을 닫을 때 hand-back 메시지가 아니라 같은 에이전트의 `<task-notification>` usage를 받은 뒤 `bouncer metrics end`에 토큰과 시간을 넘기게 한다. 수용 기준은 epic 성공 기준 11이다.

#### Current behavior

- `skills/bouncer-run/references/drive-metrics.md:26`의 3단계는 "hand-back 보고가 도착한 뒤 host의 최종 task notification 값을 넘긴다"고만 적는다. hand-back 메시지에 `subagent_tokens`가 없다는 사실과, 그 값이 뒤따르는 notification의 usage에만 있다는 사실은 없다.
- `rules/subagent-model.md:59-63`(6번 항목)도 "final notification의 usage 값으로 닫는다"고만 적는다.
- 101/001 drive에서 root가 hand-back을 받자마자 `metrics end`를 토큰 없이 호출해 coordinator 세션 3개가 모두 `tokens: null`로 남았다.
- `test/subagents.test.js:637-646`이 6번 항목에 `completed`와 `metrics end` 문자열이 있는지 확인한다. drive-metrics.md를 읽는 테스트는 없다.

#### Target behavior

- 성공: 두 문서가 다음 세 가지를 함께 말한다. hand-back 메시지에는 토큰 사용량이 없다. root는 같은 에이전트의 `<task-notification>`이 도착해 그 `usage`(`subagent_tokens`, `duration_ms`)를 읽은 뒤 `metrics end`를 호출한다. 이미 닫은 세션은 보정하지 않는다.
- 보존: notification이 끝내 오지 않으면 토큰 플래그 없이 닫는다는 기존 규칙과 `completed` 본문 없는 알림은 결과가 아니라는 규칙은 그대로다.

#### Interface

- 제공: 문서 문구만 바뀐다. CLI 플래그와 출력은 바뀌지 않는다.
- 거부: 없음.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-run/references/drive-metrics.md` | `3단계` | Modify | coordinator 세션 metrics end 시점 | hand-back에 토큰이 없고 같은 에이전트 notification usage 뒤에 호출한다고 명시 | 101/001 drive에서 토큰 3건 누락 |
| `rules/subagent-model.md` | `6번 항목` | Modify | 대기·metrics end 공통 규칙 원본 | 같은 문구로 맞춤, `completed`·`metrics end` 문자열 유지 | drive-metrics.md가 이 항목을 참조하므로 어긋나지 않게 함 |

#### Constraints

- 두 문서의 문구가 서로 모순되지 않는다. drive-metrics.md는 6번 항목을 계속 참조한다.
- `test/subagents.test.js:637-646`이 찾는 `completed`와 `metrics end` 문자열을 6번 항목에 남긴다.

### plan-review-call-reduction/retro-guards/002 · `fcac549b`

#### Goal & intent

`test/tiers.json` 등록 누락·중복·유령 항목이 생기면 실패 메시지가 파일 이름과 고칠 방법을 말하게 한다. 수용 기준은 epic 성공 기준 12이다.

#### Current behavior

- `test/test-tiers.test.js:30-35` `every test file → is assigned to a tier`는 `assert.deepStrictEqual(missing, [])`만 호출해 실패 시 배열 diff만 나온다.
- `test/test-tiers.test.js:37-41`(`no test file → is in both tiers`)과 `:43-48`(`tier → lists name only existing files`)도 메시지가 없다.
- 계층 기준: `test/helpers/no-spawn.js:13,18`이 unit 계층에서 프로세스 생성을 막는다. 프로세스를 띄우는 테스트는 integration이다.
- `scripts/test-tier.js:43`이 같은 파일의 영어 stderr 메시지(`tier "<tier>" lists missing test files: ...`)를 낸다.
- 재현: `test/tiers.json`에서 한 항목을 지우고 `node --test test/test-tiers.test.js`를 실행한다.

#### Target behavior

- 성공(검사 통과): 세 테스트의 판정은 바뀌지 않는다.
- 실패:
  - 누락: 메시지에 각 파일 이름과 "add it to the `unit` or `integration` list in test/tiers.json (integration when it spawns processes)"가 들어간다.
  - 중복: 파일 이름과 두 목록 중 하나에서 지우라는 안내가 들어간다.
  - 유령: 파일 이름과 test/tiers.json에서 지우거나 파일을 복원하라는 안내가 들어간다.
- 보존: 테스트 이름, 계층 배정, 나머지 테스트(:50 이후)는 그대로다.

#### Interface

- 제공: 세 assertion의 실패 메시지(영어).
- 거부: 없음.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `test/test-tiers.test.js` | `every test file → is assigned to a tier` 외 2개 | Modify | tiers.json 등록 검사 | 세 assertion에 안내 메시지 추가 | 101/001 TASK-003 실패가 배열 diff만 보여 줌 |

#### Constraints

- 메시지 문구는 영어로, `scripts/test-tier.js:43`과 같은 어조로 쓴다.
- 테스트 이름은 바꾸지 않는다(`npm run lint:test-names`).
- 메시지 회귀 테스트는 두지 않는다. 헬퍼가 저장소 루트에 묶여 있어 고정 fixture가 필요하고, 범위 대비 비용이 크다.

### plan-review-call-reduction/retro-guards/003 · `6b5c3b31`

#### Goal & intent

한 round에 기록하는 finding 중 `file`과 `symbol`이 같고 `category`가 다른 것들을 record 성공 응답의 `warnings`로 알려, controller가 병합 여부를 판단하게 한다. 기록은 막지 않는다. 수용 기준은 epic 성공 기준 13이다.

#### Current behavior

- fingerprint는 `category:brief_clause:file#symbol`이다(`scripts/src/lib/validate-sections.ts:254-266`). category·brief_clause는 trim·소문자, file은 `toPosix`·trim·앞 `./` 제거, symbol은 trim만 한다.
- 같은 fingerprint 중복은 `collectFindingFailures`가 거절한다(`validate-sections.ts:367`).
- execute 경로: `recordReview`(`scripts/src/lib/review-record.ts:269`)가 `readRoundInput`(211-255)으로 round를 읽고 `mergeFindings`(191-209)로 병합한 뒤 345-353에서 검증한다. 성공 형태는 `RecordReviewOk` `{ ok, path, round, status, findings }`(28-34, 383-389). CLI는 `cli-review-command.ts:214-222`에서 JSON을 출력한다.
- plan 경로: `recordReport`(`scripts/src/lib/context-review-state.ts:876`)가 `readReportInput`(797-823)으로 읽는다. 성공 형태는 `{ ok, noop:false, cycle, status, closed, projection?, written? }`(1011-1015)이고, 이미 적용된 전이는 928-932에서 `noop:true`로 일찍 반환한다. CLI는 `cli-context-review-command.ts:268-286`.
- 두 record 출력 모두 `warnings` 키가 없다. 저장소 관례는 빈 목록이면 키를 생략하는 것이다(`validate.ts:438`, `coordinator.ts:3010`).
- I/O: execute는 tmp 파일에 쓴 뒤 rename한다(`review-record.ts:369-372`). plan은 report JSON(`writeImmutable` 178-186)과 state.json(`writeAtomic` 143-156)을 쓴다. 경고 계산은 추가 I/O가 필요 없다.
- 병합 지침: `references/coordinator-cards/review.md:84-86`, `references/review/index.md:124-126`, `skills/bouncer-plan/references/context-review.md:54-60`이 "같은 fingerprint를 병합한다"고만 적는다.
- 기록 성공 객체 전체를 `deepStrictEqual`하는 테스트는 없다(review-record.test.js:172-175 등은 필드별 확인).

#### Target behavior

- 성공 + 후보 있음: 기록 중인 round의 finding 중 정규화한 `file`과 trim한 `symbol`이 같고(빈 symbol 제외) `category`가 둘 이상인 묶음마다 `warnings`에 `{ code: 'finding-merge-candidate', file, symbol, ids }` 항목 하나가 생긴다. `ids`는 입력 순서다.
- 성공 + 후보 없음: `warnings` 키를 생략한다. 나머지 응답 필드와 기록 바이트는 지금과 같다.
- 실패: 새 거절은 없다. 기존 거절(같은 fingerprint 중복 포함)은 그대로이고 실패 응답에는 `warnings`를 넣지 않는다.
- 보존: `noop:true` 반복 실행은 경고를 다시 계산하지 않는다. 기존 원장의 finding은 검사 대상이 아니다.
- 도움말과 `rules/cli.md`가 `warnings`를 설명하고, 병합 지침 네 문서(`references/coordinator-cards/review.md`, `references/coordinator-cards/final_review.md`, `references/review/index.md`, `skills/bouncer-plan/references/context-review.md`)가 이 경고를 보고 병합을 판단하라고 적는다.

#### Interface

- 제공:
  ```ts
  // validate-sections.ts
  function findingMergeCandidates(findings: unknown[]): Array<{
    code: 'finding-merge-candidate'; file: string; symbol: string; ids: string[];
  }>
  ```
  - `RecordReviewOk`에 `warnings?: ...[]`를 더한다. context record 성공 객체에도 같은 키를 더한다.
  - 용어 "병합 후보": 같은 round 안에서 정규화 file·symbol이 같고 category가 다른 finding 묶음. 예: `spec_scope`의 SS-1과 `correctness_tests`의 CT-5가 모두 `scripts/src/lib/cli-doc-commands.ts#cmdPlanApprove`를 가리킨다.
- 거부: 이 함수는 던지지 않는다. 배열이 아니거나 객체가 아닌 항목, `file` 또는 `symbol`이 문자열이 아니거나 비어 있으면 그 항목을 건너뛴다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/validate-sections.ts` | `findingMergeCandidates` | Modify | fingerprint 정규화·중복 검사 | 병합 후보 계산 함수 추가·export | 정규화 규칙을 fingerprint와 공유 |
| `scripts/src/lib/review-record.ts` | `recordReview`, `RecordReviewOk` | Modify | execute review 기록 | 성공 응답에 `warnings` 추가 | 최종 리뷰 중복 finding 2건 |
| `scripts/src/lib/context-review-state.ts` | `recordReport` | Modify | plan context review 기록 | noop 아닌 성공 응답에 `warnings` 추가 | plan 리뷰도 같은 병합 단계 |
| `scripts/src/lib/cli-review-command.ts` | `HELP` | Modify | review record 도움말 | 성공 출력과 `warnings` 설명 | 공개 출력 계약 문서화 |
| `scripts/src/lib/cli-context-review-command.ts` | `HELP` | Modify | context-review 도움말 | `warnings` 설명 | 공개 출력 계약 문서화 |
| `rules/cli.md` | review record·context-review 절 | Modify | CLI 출력 계약 | :264, :292에 `warnings` 추가 | 규칙 문서 동기화 |
| `references/coordinator-cards/review.md` | Aggregate | Modify | execute 리뷰 병합 지침 | `warnings` 확인 후 병합 판단 | 병합 단계에서 경고 사용 |
| `references/coordinator-cards/final_review.md` | record 절 | Modify | 최종 리뷰 기록 지침 | `warnings` 확인 문장 추가 | 중복이 실제로 발생한 단계 |
| `references/review/index.md` | controller 병합 문단 | Modify | 리뷰 병합 지침 | 같은 문장 추가 | 지침 동기화 |
| `skills/bouncer-plan/references/context-review.md` | Merge 단계 | Modify | plan 리뷰 병합 지침 | 같은 문장 추가 | 지침 동기화 |
| `test/review-record.test.js` | 신규 테스트 | Modify | execute record 테스트 | 경고 있음·없음·빈 symbol 케이스 | 수용 기준 |
| `test/context-review-state.test.js` | 신규 테스트 | Modify | context record 테스트 | 경고 있음·없음·noop 케이스 | 수용 기준 |
| `test/cli-help.test.js` | 도움말 테스트 | Modify | 도움말 형식 검사 | 두 도움말에 `warnings` 문구 확인 | 도움말 변경 고정 |

#### Constraints

- 기존 거절 조건과 기록 바이트를 바꾸지 않는다. 경고 계산은 쓰기 전에 하되 결과에만 붙인다.
- file 비교는 `findingFingerprint`와 같은 정규화를 쓰고 대소문자는 접지 않는다.
- 새 테스트 이름은 `<조건> → <결과>` 형식이다. 코드 주석과 docstring은 한국어로 쓴다(`references/coding-standards/index.md`).
- `scripts/lib`는 빌드 산출물이므로 소스는 `scripts/src/lib`만 고친다.

### plan-review-call-reduction/retro-guards/004 · `65ede4b2`

#### Goal & intent

`.bouncer/config.json`의 선택 키 `worktree.setup`에 적은 명령을 worker·integration worktree 의존성 준비 끝에서 실행해, gitignore 대상 빌드 산출물이 있는 상태로 검증과 리뷰를 하게 한다. 수용 기준은 epic 성공 기준 14이다.

#### Current behavior

- `prepareDependencies(worktreePath, deps)`(`scripts/src/lib/seed-worktree.ts:120-159`):
  1. `.venv`·`.env`를 연결한다(:124).
  2. `package-lock.json`이 없으면 `{ok:true}`로 일찍 반환한다(:125-126).
  3. stamp가 lockfile 해시와 같으면 일찍 반환한다(:129-139).
  4. 그 밖에는 `npm ci --include=dev --ignore-scripts ...`를 `deps.execFileSync`로 실행한다(:144-147).
  5. 실패하면 `{ok:false, reason:'dependency-install-failed', message}`를 반환한다(:148-149).
- 호출자:
  - `seedWorktree`(:294)와 `seedCoordinatorWorker`(:399)는 의존성 준비 뒤 `seedConfig`(:301, :402)를 부른다. 그래서 준비 시점에 새 worktree의 config는 아직 없다.
  - coordinator 통합 검증(`coordinator.ts:1046-1047`, `:2275-2278`)과 finalize(`finalize.ts:946-966`, `:1178-1190`)도 이 함수를 부른다.
  - coordinator는 `withInstallStdioToStderr`(:191-193)로 exec stdio를 stderr로 돌린다.
- main checkout 경로는 `mainCheckoutOf(worktreePath)`(:49)가 `git worktree list`로 찾는다.
- config 읽기는 `readConfig(repoRoot)`(`config.ts:132`)를 쓰고, 허용 목록은 `getVerifyAllowlist(config)`(`config.ts:82`)에서 온다.
- verify 단일 argv 규칙은 `parseVerifyArgv`, `verifyExecutableName`, `isValidVerifyCommand`(`verification.ts:132-215`)에 있다. `verification.ts`는 의존 모듈이 많아 seed-worktree가 가져오면 import 순환 위험이 있다. seed-worktree는 지금 paths·layout·scope만 가져온다(:7-12, finalize.ts:35가 이에 기댄다).
- 테스트:
  - `test/seed-worktree.test.js:252-279`는 exec 호출 배열을 정확히 비교한다. `:816-825`는 실패 형태를 본다.
  - `test/coordinator.test.js:971-996`의 가짜 exec는 `command === 'npm'`이면 던진다.
  - 두 테스트 모두 config에 `worktree.setup`이 없으면 영향이 없다.

#### Target behavior

- 성공 경로:
  - main checkout config에 `worktree.setup`이 있으면, 설치를 했든 건너뛰었든 lockfile이 없든 준비 마지막에 그 명령을 `deps.execFileSync(argv[0], argv.slice(1), { cwd: worktreePath, stdio: 'inherit' })`로 한 번 실행하고 `{ok:true}`를 반환한다.
- 실패 경로(모두 `{ ok:false, reason:'dependency-install-failed', message }`, message는 `worktree.setup`으로 시작):
  - 값이 문자열이 아님.
  - `parseVerifyArgv`가 null.
  - argv0이 허용 목록 밖.
  - 명령 실행이 던짐.
- 보존:
  - `worktree.setup`이 없거나 config가 없거나 main checkout을 못 찾으면 지금 동작과 같다. exec 호출 배열도 같다.
  - npm 설치 실패는 setup보다 먼저 반환한다.
  - `verification.ts`의 기존 export 이름과 동작은 그대로다.

#### Interface

- 제공:
  - config 키 `worktree.setup: string`(선택). 예: `"npm run build"`.
  - 새 leaf 모듈 `scripts/src/lib/command-argv.ts`가 `parseVerifyArgv`, `verifyExecutableName`, `isValidVerifyCommand`를 소유한다. `verification.ts`는 같은 이름으로 다시 내보낸다.
  - `config.ts`에 `readWorktreeSetup(config: unknown): { ok: true; command: string | null } | { ok: false; reason: 'invalid' }`. 이 함수는 형태만 본다. `worktree` 키가 없으면 `command: null`, `worktree`가 객체가 아니거나 `setup`이 있는데 문자열이 아니면 invalid다.
  - argv·허용 목록 검사는 `prepareDependencies`가 `command-argv.ts`의 `isValidVerifyCommand(command, getVerifyAllowlist(config))`로 한다. `config.ts`는 `command-argv.ts`를 가져오지 않는다.
  - 테스트 seam:
    - `deps.execFileSync(command: string, args: string[], options: { cwd: string; stdio: 'inherit' })` — 기존 seam을 그대로 쓴다.
    - `deps.mainCheckout?: string` — 주어지면 `mainCheckoutOf(worktreePath)` 대신 이 경로의 `.bouncer/config.json`을 읽는다. 테스트는 이 seam으로 임시 디렉터리를 main checkout으로 지정하고 실제 git worktree를 만들지 않는다.
- 거부(`prepareDependencies`가 `dependency-install-failed`로 반환): `readWorktreeSetup`이 invalid, 빈 문자열, 셸 메타문자(`& | ; \` < >`), 개행, `$(`, 닫히지 않은 따옴표, argv0 `cd`, 허용 목록 밖 실행 파일.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/command-argv.ts` | `parseVerifyArgv`, `verifyExecutableName`, `isValidVerifyCommand` | Create | 없음 | verification.ts에서 옮긴 argv 검사 leaf 모듈 | seed-worktree의 import 순환 회피 |
| `scripts/src/lib/verification.ts` | 위 세 함수 | Modify | argv 검사 정의 | command-argv에서 가져와 같은 이름으로 재export | 기존 호출자(scaffold, validate-structural) 보존 |
| `scripts/src/lib/config.ts` | `readWorktreeSetup` | Modify | config 키 읽기 | 새 읽기 함수 추가 | `readCoordinatorPolicy` 패턴 재사용 |
| `scripts/src/lib/seed-worktree.ts` | `prepareDependencies` | Modify | 의존성 설치·stamp | 설치 뒤 setup 실행, 조기 반환 경로에서도 실행 | 빌드 산출물 부재 |
| `test/seed-worktree.test.js` | 신규 테스트 | Modify | prepareDependencies 테스트 | setup 성공·미설정·invalid·허용 목록 밖·실행 실패·lockfile 없음·stamp 일치 케이스 | 수용 기준 |

#### Constraints

- setup 명령은 셸 없이 argv로 실행한다. 허용 목록은 `getVerifyAllowlist`와 같은 값이다.
- config는 worktree가 아니라 main checkout에서 읽는다. 새 worktree에는 아직 config가 없기 때문이다.
- `command-argv.ts`는 node 내장 모듈과 `config`의 기본 허용 목록 외에는 가져오지 않는다.
- 코드 주석과 docstring은 한국어로 쓰고 테스트 이름은 `<조건> → <결과>` 형식이다.
- `scripts/lib`는 빌드 산출물이므로 소스만 고친다.

### plan-review-call-reduction/retro-guards/005 · `c71889a5`

#### Goal & intent

`bouncer init`이 새 config를 만들 때 `package.json#scripts.build`가 있으면 `worktree: { setup: 'npm run build' }`를 넣고, 설정 문서·예시·CLI 규칙이 `worktree.setup`을 설명하게 한다. 수용 기준은 epic 성공 기준 15이다.

#### Current behavior

- `defaultConfig(repoRoot)`(`scripts/src/lib/init.ts:88-155`)는 새 bootstrap에서만 쓰인다(:481-526). `verify: 'npm test'`는 고정값이고, package.json은 읽지 않는다.
- 준비된 저장소(`inspectBootstrap`이 `ready`, :255-277)에서는 config를 다시 쓰지 않는다. 사용법도 "Never overwrites."다(`cli-project-commands.ts:352-354`).
- package.json `scripts` 읽기 예시는 `plan-inspect.ts:197-218` `collectVerifySignals`다. JSON.parse와 `Object.hasOwn`을 쓰고, 깨진 JSON은 삼킨다.
- `test/init.test.js:113-164`는 package.json이 없는 빈 저장소의 기본 config를 정확히 비교한다. 키를 조건부로 넣으면 영향이 없다.
- 문서:
  - `docs/configuration.md:9-28`이 필드 표이고, verify 절은 :92-99다.
  - `config.example.json:44-68`에는 worktree 키가 없다.
  - `rules/cli.md:61-70`이 finalize `npm ci`와 `DEPENDENCY_INSTALL_FAILED`를 설명한다.
- `bouncer config --help`(`cli-config-command.ts:25-38`)는 `subagents.*`와 `metrics.pricing`만 다룬다. 여기에는 추가하지 않는다.

#### Target behavior

- 성공: 새 bootstrap에서 package.json에 `scripts.build`가 문자열로 있으면 config에 `worktree: { setup: 'npm run build' }`가 들어간다.
- 보존:
  - package.json이 없거나 깨졌거나 `build`가 없으면 `worktree` 키가 없다.
  - 준비된 저장소의 config 바이트는 바뀌지 않는다.
- 문서:
  - `docs/configuration.md` 표에 `worktree.setup` 행이 생긴다(선택, 단일 argv, 허용 목록 적용, main checkout config에서 읽음, 실패 시 `dependency-install-failed`).
  - `config.example.json`에 예시 키가 생긴다.
  - `rules/cli.md`의 의존성 준비 설명에 setup 실행과 실패 reason이 들어간다.
  - 기존 config에는 자동으로 들어가지 않으니 직접 추가하라는 한 줄이 문서에 있다.

#### Interface

- 제공: 새 config의 선택 키 `worktree.setup`과 그 문서.
- 거부: init은 준비된 저장소의 config에 이 키를 쓰지 않는다. `build` 이외의 스크립트 이름으로 추측하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/init.ts` | `defaultConfig` | Modify | 새 config 기본값 | `scripts.build`가 있으면 `worktree.setup` 추가 | 사용자 결정(init 기본값) |
| `test/init.test.js` | 신규 테스트 | Modify | init 기본값 테스트 | build 있음·없음·깨진 package.json·ready 보존 케이스 | 수용 기준 |
| `docs/configuration.md` | 필드 표 | Modify | config 키 문서 | `worktree.setup` 행과 기존 config 안내 | 공개 설정 문서화 |
| `config.example.json` | 예시 | Modify | config 예시 | `worktree.setup` 예시 | 공개 설정 예시 |
| `rules/cli.md` | 의존성 준비 절 | Modify | finalize·worktree 준비 설명 | setup 실행과 실패 reason 추가 | 규칙 문서 동기화 |

#### Constraints

- 기존 "Never overwrites" 계약을 지킨다.
- package.json 읽기 실패는 init을 실패시키지 않는다.
- 코드 주석은 한국어로 쓰고 테스트 이름은 `<조건> → <결과>` 형식이다.