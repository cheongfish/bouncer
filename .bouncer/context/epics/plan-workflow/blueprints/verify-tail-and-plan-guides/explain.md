---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/plan-workflow/blueprints/verify-tail-and-plan-guides/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-16T13:25:29.948+09:00'
bouncer:
  id: EXPLAIN-verify-tail-and-plan-guides
  epic_id: plan-workflow
  blueprint_id: verify-tail-and-plan-guides
  status: published
  comprehension:
    - range_from: 7ce9ed2aee0af2dd742e4cb263c28cec450bfe34
      range_to: 375c7225c340ee35127f86b7cf618093abe8c56a
      diff_sha: 7a3216fb1e6baed7d7ceed47acb5f7415dc3bc5bbc0474c50ce736c360728693
      recorded_at: '2026-10-16T13:26:04+09:00'
  task_commits:
    - task: plan-workflow/verify-tail-and-plan-guides/001
      sha: 29c50162
      intent_anchor: task-001
    - task: plan-workflow/verify-tail-and-plan-guides/002
      sha: 97b452eb
      intent_anchor: task-002
    - task: plan-workflow/verify-tail-and-plan-guides/003
      sha: 375c7225
      intent_anchor: task-003
---
# Explain

## Background

`bouncer finalize --yes`는 마지막에 verify 명령(`npm test` 등)을 돌리고, 실패하면 `VERIFY_FAILED`를 돌려준다. 이 응답에는 종료 코드만 있어서, 일시적으로 깨진 것인지 실제 회귀인지 가릴 단서가 없었다. 같은 명령을 다시 돌려 통과한 뒤에도 첫 실패의 원인은 알 수 없었다.

계획 쪽에는 규칙이 있어도 쓰는 시점에 적용되지 않는 곳이 둘 있었다. 새 epic의 `description`은 영어 ASCII로 쓰라는 규칙이 작성 단계 문서에만 있어, 한국어로 scaffold한 뒤에야 고쳐야 했다. 또 그래프 질의는 호출자를 일부 놓칠 수 있는데도 그래프에 없으면 호출자가 없다고 읽기 쉬웠고, context review를 고치는 도중 구조 필드를 바꾸면 delta가 아니라 restart가 된다는 사실이 문서에 없었다. 이 변경은 첫 번째를 응답 필드로, 두 번째를 생성 시점의 거부로, 나머지를 소유 문서의 문단으로 옮긴다.

## Intuition

택배 반송장에 "반송"이라는 말만 적혀 있던 것을 사유 칸까지 채워 돌려보내는 일과 같다. 창구에서 규격에 맞지 않는 서류를 바로 돌려보내는 것(ASCII 검사)과, 길 안내 지도에 표시되지 않은 샛길도 있다는 주의 문구를 지도 가장자리에 적는 것(그래프 후보 확인)도 같은 종류의 개선이다.

## Code

- `scripts/src/lib/finalize.ts` — `finalize`의 `VERIFY_FAILED` 응답에 `output_tail`을 더한다. 값은 `executeVerify`가 이미 stdout+stderr의 마지막 100줄로 잘라 둔 출력을 그대로 쓰며 새 상수를 두지 않는다. verify 설정 오류와 의존성 설치 실패 응답에는 이 키가 없고, 허용 목록 밖 명령처럼 verify가 실행되지 못한 경우에도 `executeVerify`가 준 오류 문구가 `output_tail`이 된다. 출력이 비면 빈 문자열이다.
- `scripts/src/lib/scaffold.ts` — `scaffoldEpic`이 새 epic을 만들 때 description 원문(trim 전)에 0x20–0x7E 밖의 문자가 있으면 파일을 쓰기 전에 거부한다. 탭, 개행, NBSP, em dash, 한글이 모두 걸린다. 설계 선택: 검사는 새 epic일 때만 돌아서, 한국어 description을 가진 기존 epic을 다시 scaffold해도 넘긴 값을 무시하는 지금 동작이 그대로다. CLI는 exit 2와 `scaffold: epic description must be printable ASCII (0x20-0x7E) for <id>`를 낸다.
- `rules/cli.md`, `skills/bouncer-finalize/references/remainder.md`, `skills/bouncer-plan/SKILL.md` — 새 필드와 거부 규칙을 설명하고, plan 스킬 2단계 예시가 영어 ASCII 한 문장을 요구하게 바꾼다. 설계 선택: 문장을 추가하지 않고 기존 placeholder 문구를 바꿨다. entry skill의 단어 수 제한을 넘기지 않기 위해서다.
- `references/graphify-runner/index.md`, `skills/bouncer-plan/references/context-review.md` — 전자는 그래프 후보를 `rg`로 좁혀 필요한 줄만 읽고, 바꿀 함수의 호출자는 `rg <function>`으로 한 번 더 찾으라고 적는다. 그래프에 호출자가 안 보이는 것(`[INFERRED]` 간접 호출, export 객체 경유)은 호출자가 없다는 근거가 아니다. 후자는 task의 `affected_paths`·`depends_on` 등 구조 필드, blueprint의 `scale`·`review_scope`, 문서 추가·삭제는 다음 `review-dispatch plan --previous`가 `follow_up: full`(restart)을 내고, 본문·`review_risk`·epic frontmatter만 고치면 `partial`(delta)이라고 적는다.

## Quiz

1. `finalize --yes`의 verify가 실패해 `VERIFY_FAILED`가 돌아올 때, 새로 생긴 `output_tail`은 무엇인가?
   - A) verify 출력(stdout+stderr)의 마지막 100줄 이하 문자열이다.
   - B) 실패한 테스트 이름만 모은 배열이다.
   - C) 실패한 테스트 파일의 전체 로그 경로다.
2. 새 epic을 만드는 `scaffold epic --description "Auth — 로그인"`을 실행하면 어떻게 되나요?
   - A) 파일을 만들고 description만 ASCII로 바꾼다.
   - B) 파일을 하나도 쓰지 않고 exit 2로 거부한다.
   - C) 경고만 내고 그대로 만든다.
3. 한국어 description을 가진 기존 epic에 `scaffold epic --id 063 ... --description "한글 설명"`을 다시 실행하면 어떻게 되나요?
   - A) 새 ASCII 검사에 걸려 거부된다.
   - B) 넘긴 description으로 기존 값을 덮어쓴다.
   - C) 넘긴 description을 무시하고 지금처럼 동작한다.
4. context review를 고치는 중에 task의 `affected_paths`를 바꾸면 다음 `review-dispatch plan --previous`는 어떤 `follow_up`을 내나요?
   - A) `partial`이라 delta로 간다.
   - B) `full`이라 restart로 간다.
   - C) 변경이 없으면 `reuse`를 낸다.

## Tasks

### plan-workflow/verify-tail-and-plan-guides/001 · `29c50162`

#### Goal & intent

`finalize --yes`가 verify 실패로 `VERIFY_FAILED`를 반환할 때 payload에 `output_tail`(verify 출력 마지막 100줄 이하의 문자열)을 싣는다. 다른 실패 경로와 기존 필드, 문서·worktree 보존은 바꾸지 않는다.
수용 기준은 에픽 성공 기준 1·2와 6의 finalize 부분이고, 검증 명령은 `npm test`다.

#### Current behavior

- `finalize`(`scripts/src/lib/finalize.ts`)는 `:1189`에서 `executeVerify(command, { cwd, exec? })`를 부르고, `:1196-1205`에서 실패 시 `{ ok: false, reason: 'verify', code: 'VERIFY_FAILED', command, exitCode: execution.exitCode, integration, branch }`를 돌려준다. `execution.output`은 버린다.
- `executeVerify`(`scripts/src/lib/verification.ts:306`)는 `{ ok, exitCode, output }`을 돌려준다. `output`은 `outputTail`(`:247`, stdout+stderr 마지막 `OUTPUT_TAIL_LINES = 100`줄, trim)이다. 명령이 허용 목록 밖이면 `'verify command must be a single executable command'`, 설정이 깨졌으면 설정 오류 문구가 `output`이다.
- 주입된 `verifyExec`의 `{ ok: false, exitCode, output }`은 `adaptInjectedVerifyExec`(`finalize.ts:140-160`)가 `stdout = output`인 Error로 바꾸고, `executeVerify`의 catch(`verification.ts:397-411`)가 `outputTail(stdout, stderr)`로 되돌린다. 주입 `output: 'boom'`은 `output: 'boom'`이 된다.
- verify 설정 오류는 `:1163-1171`에서 `{ ..., command: null, exitCode: null }`, 의존성 설치 실패는 `:1179-1190`에서 `DEPENDENCY_INSTALL_FAILED`로 따로 반환한다.
- CLI(`scripts/src/lib/cli-git-commands.ts:134-145`)는 결과 객체를 `JSON.stringify(result, null, 2)`로 통째로 출력하므로 새 필드는 CLI 변경 없이 나온다.
- 문서: `rules/cli.md:70` "`VERIFY_FAILED` still means only that verify failed after dependencies were ready." `skills/bouncer-finalize/references/remainder.md:20-22`는 verify 실패는 원인을 고치고 재실행하라고만 적는다. `finalize` JSDoc(`finalize.ts:982-987`)이 반환 모양을 설명한다.
- 테스트: `test/finalize.test.js` `:305-330`(주입 `{ ok: false, exitCode: 1, output: 'boom' }`, `reason`·`code`·`exitCode` 단언), `:875-895`, `:2013-2033`(설치 성공 뒤 verify 실패), `:690-705`(설정 오류 `command: null`). payload 전체를 `deepStrictEqual`로 비교하는 테스트는 없다. 테스트는 임시 저장소와 주입 seam(`verifyExec`, `dependencyExec`)을 쓴다.

#### Target behavior

- 성공 경로(실패 응답 생성): `VERIFY_FAILED` 응답에 `output_tail: execution.output`이 들어간다. 주입 `output: 'boom'`이면 `output_tail === 'boom'`이다. 150줄 출력이면 마지막 100줄만 남는다. 출력이 없으면 빈 문자열이다.
- 보존: `reason`, `code`, `command`, `exitCode`, `integration`, `branch` 값과 문서·worktree 보존, 포인터 미해제는 그대로다. verify 설정 오류(`command: null`) 응답과 `DEPENDENCY_INSTALL_FAILED` 응답에는 `output_tail` 키가 없다. verify 성공 경로는 바뀌지 않는다.

#### Interface

- 제공: `finalize()`의 `VERIFY_FAILED` 반환 타입에 `output_tail: string`을 더한다. 예: `{ ok: false, reason: 'verify', code: 'VERIFY_FAILED', command: 'npm test', exitCode: 1, output_tail: 'not ok 12 - ...', integration, branch }`.
- 거부: 새 거부는 없다. `output_tail`은 실패 응답에만 있고 다른 응답에는 넣지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/finalize.ts` | `finalize` | Modify | verify 실행과 실패 응답 반환 | `VERIFY_FAILED` 응답에 `output_tail` 추가, JSDoc 반환 모양 갱신 | explain(executeVerify): 호출자 `finalize`·`runVerification`, `:1189-1205` 직접 확인 |
| `test/finalize.test.js` | verify 실패 테스트 | Modify | 실패 응답 단언 | `output_tail` 내용·100줄 절단·다른 경로의 키 부재 단언 추가 | `:305-330`, `:690-705`, `:2013-2033` |
| `rules/cli.md` | finalize 설치·verify 문단, `scaffold epic` 명령 줄 | Modify | `VERIFY_FAILED` 의미와 scaffold 명령 설명 | `output_tail`(최대 100줄) 설명 한 문장 추가, `scaffold epic` 줄 아래에 새 epic의 description은 출력 가능한 ASCII(0x20-0x7E)만 받고 그 밖이면 exit 2로 거부한다는 문장 추가 | `:70`, `:83` 직접 확인. TASKS-002의 CLI 변경을 문서화하는 유일한 `rules/cli.md` 소유 task |
| `skills/bouncer-finalize/references/remainder.md` | verify 실패 문단 | Modify | 실패 시 원인 수정·재실행 안내 | 원인을 `output_tail`에서 먼저 확인하라는 문장 추가 | `:20-22` |

#### Constraints

- 새 필드 이름은 검증 증적의 기존 필드와 같은 `output_tail`이다.
- 출력 줄 수 상한은 `executeVerify`의 기존 값(100줄)을 그대로 쓰고 새 상수를 만들지 않는다.
- 다른 실패 응답의 모양을 바꾸지 않는다.
- 변경 후 `npm run lint`, `npm run lint:test-names`, `npm run lint:docs`, `npm run typecheck`가 통과해야 한다. CLI 확인 전 `npm run build`를 실행한다.

### plan-workflow/verify-tail-and-plan-guides/002 · `97b452eb`

#### Goal & intent

새 epic을 만드는 `scaffold epic`이 description에 출력 가능한 ASCII(0x20–0x7E) 밖의 문자가 있으면 파일을 하나도 쓰지 않고 거부한다. 이미 있는 epic의 재실행은 지금처럼 넘긴 description을 무시한다. plan 스킬 2단계 예시가 이 규칙을 적는다.
수용 기준은 에픽 성공 기준 3·4와 5·6의 해당 부분이고, 검증 명령은 `npm test`다.

#### Current behavior

- `scaffoldEpic`(`scripts/src/lib/scaffold.ts:160`)은 `:167`에서 canonical `index.md` 경로를 구하고, `:168-171`에서 그 파일이 없을 때 description이 문자열이 아니거나 비었거나 `Epic <id>`이면 `epic description must be a non-placeholder string for <id>`를 throw한다. 그 뒤 slug 충돌 검사(`:173-180`), `writeRel`(`:189`), `ensureEpicIndexEntry`(`:193`) 순으로 쓴다. 검사 전에는 아무것도 쓰지 않는다. `:184`에서 `description.trim()`을 쓴다.
- CLI(`scripts/src/lib/cli-doc-commands.ts:109-112`)는 문자열 description만 넘기고, `:199-203`의 catch가 `scaffold: <message>`를 stderr에 쓰고 exit 2를 반환한다.
- 이미 있는 epic이면 검사 블록을 건너뛰고 기존 frontmatter를 쓴다. 저장소에는 한국어 description을 가진 epic이 14개 있다.
- 규칙 출처: `references/spec-authoring/index.md:239` "`description` and `tags` in English ASCII." plan 스킬 2단계 예시(`skills/bouncer-plan/SKILL.md:113-118`)는 `--description "<one sentence confirmed in discovery>"`만 적는다.
- 테스트: `test/scaffold.test.js:49-58`(라이브러리 수준, `undefined`·`''`·`'   '`·`'Epic 061'` → throw `/description/i`, 디렉터리 없음), `:357-373`(CLI, exit 2, stderr `/description/i`, stdout 빈 값, 두 파일 없음), `:60-75`·`:390`(재실행이 description을 무시). 새 epic을 비-ASCII description으로 만드는 기존 테스트·fixture는 없다(`review-record.test.js:77`, `context-review-state.test.js:55`, `cli-validate.test.js:939`는 영어 ASCII).

#### Target behavior

- 실패 경로: 새 epic에서 trim 전 원문 description에 0x20–0x7E 밖의 문자가 하나라도 있으면 `epic description must be printable ASCII (0x20-0x7E) for <id>`를 throw한다. CLI는 exit 2, stderr `scaffold: ...`, stdout 빈 값이며 epic `index.md`와 `.bouncer/context/index.md`를 쓰지 않는다. 예: `'인증 epic'`, `'Auth\tepic'`, `'Auth — epic'`, NBSP가 섞인 값.
- 성공 경로: 영어 ASCII description은 지금처럼 만들어진다.
- 보존: 이미 있는 epic의 재실행은 비-ASCII description을 넘겨도 지금처럼 성공하고 기존 frontmatter를 쓴다. 기존 placeholder 거부 문구와 순서는 그대로다(빈 값·`Epic <id>`는 기존 문구로 거부).
- plan 스킬 2단계 예시가 description을 영어 ASCII 한 문장으로 쓰라고 적는다.

#### Interface

- 제공: `scaffoldEpic`의 새 거부. CLI 계약은 기존 description 거부와 같다(exit 2, `scaffold: <message>`).
- 거부(즉시 오류): 새 epic + description 원문에 `/[^\x20-\x7E]/`에 맞는 문자가 있는 입력. 용어: 출력 가능한 ASCII는 코드 0x20(공백)부터 0x7E(`~`)까지다. 예: `'Auth epic description'`은 통과, `'Auth epic — v2'`는 거부.
- 거부하지 않음: 이미 있는 epic의 재실행(넘긴 description 무시), blueprint·task scaffold.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/scaffold.ts` | `scaffoldEpic` | Modify | 새 epic 생성과 description placeholder 거부 | 같은 블록에 비-ASCII 거부 추가 | `:160-193` 직접 확인 |
| `test/scaffold.test.js` | description 거부·재실행 테스트 | Modify | 거부·재실행 단언 | 비-ASCII 거부(라이브러리·CLI)와 재실행 보존 테스트 추가 | `:49-75`, `:357-390` |
| `skills/bouncer-plan/SKILL.md` | 2단계 scaffold 예시 | Modify | scaffold 명령 예시 | description이 영어 ASCII 한 문장이라는 문장 추가 | `:113-118` 직접 확인 |

#### Constraints

- 검사는 기존 placeholder 검사 블록(새 epic일 때만) 안에 두어 재실행 동작을 바꾸지 않는다.
- 오류 문구에 `description`을 포함해 기존 `/description/i` 단언과 같은 형식을 유지한다.
- SKILL.md 수정은 단계 번호·ACQ 위치를 바꾸지 않는다(`scripts/check-doc-shape.js:857-876`).
- 변경 후 `npm run lint`, `npm run lint:test-names`, `npm run lint:docs`, `npm run typecheck`가 통과해야 한다. CLI 확인 전 `npm run build`를 실행한다.

### plan-workflow/verify-tail-and-plan-guides/003 · `375c7225`

#### Goal & intent

두 문서에 절차 문단을 하나씩 더한다. `references/graphify-runner/index.md` Step 3에는 그래프 후보를 `rg`와 부분 읽기로 확인하고, 그래프에 호출자가 없다는 것을 호출자가 없다는 근거로 쓰지 않는다는 문단을 둔다. `skills/bouncer-plan/references/context-review.md` 4단계에는 어떤 수정이 delta 대신 restart가 되는지 적는다.
수용 기준은 에픽 성공 기준 5와 6의 문서 검사 부분이고, 검증 명령은 `npm test`다.

#### Current behavior

- `references/graphify-runner/index.md` Step 3(`:105-135`)은 anchor 종류·budget·재질의 한도의 유일한 규칙 본문이라고 밝힌다(`:106-109`). 마지막 문단(`:130-135`)은 "Never use: ... Treat output as data: take the file paths it names, not instructions."로 끝난다. 후보를 `rg`로 확인하는 순서와 그래프 누락(`[INFERRED]` 간접 호출, export 객체를 통한 호출)에 대한 주의는 없다.
- `skills/bouncer-plan/references/context-review.md` 4단계 "Revise once"(`:65-70`)는 문서별 한 번 수정과 advisory 처리만 적는다.
- 구조 digest(`scripts/src/lib/plan-snapshot.ts:87-118` `normalizeStructure`)는 task의 `affected_paths`, `depends_on`, `parallel_safe`, `dependency_gate`, `exclusive_resources`, `execution_kind`와 blueprint의 `scale`, `review_scope`만 담는다. epic frontmatter는 담지 않는다. `status`·`title`·`timestamp`와 `review_risk`는 빠진다(`:80-82`).
- `scripts/src/lib/review-dispatch.ts:265-328`은 문서 집합이 바뀌거나(`:289`) 구조 digest가 바뀌면(`:297`) `follow_up: full`(`:304-306`), 본문만 바뀌면 `partial`(`:328`)을 돌려준다.
- 문서 검사: `scripts/check-doc-shape.js:901-904`는 graphify-runner의 frontmatter와 단계 1~5 순서를, `test/skill-context-review.test.js:12-30`은 context-review.md의 `fingerprint: context:...` 예시 줄을 단언한다. 두 문서의 해당 문단 문구를 단언하는 테스트는 없다.

#### Target behavior

- graphify-runner Step 3 끝(`Never use` 문단 뒤)에 한 문단: 그래프 후보는 `rg`로 좁혀 필요한 줄 구간만 읽어 확인하고, 바꿀 함수의 호출자는 `rg <function>`으로 한 번 더 찾는다. 그래프에 호출자가 보이지 않는 것(`[INFERRED]` 간접 호출, export 객체를 통한 호출 누락)은 호출자가 없다는 근거가 아니다. 새 숫자(budget, 횟수)는 넣지 않는다.
- context-review.md 4단계에 한 문단: task의 `affected_paths`·`depends_on`·`parallel_safe`·`dependency_gate`·`exclusive_resources`·`execution_kind`, blueprint의 `scale`·`review_scope`, 문서 추가·삭제는 구조 변경이라 다음 `review-dispatch plan --previous`가 `follow_up: full`을 내고 delta 대신 restart가 된다. 본문·`review_risk`·epic frontmatter만 고치면 `partial`(delta)이다. 구조 변경이 필요하면 한 번의 수정에 모은다.
- 보존: 두 문서의 단계 번호, 기존 문장, fingerprint 예시 줄은 그대로다. 런타임 동작 변화는 없다.

#### Interface

- 제공: 문서 문단 두 개. 코드·CLI 인터페이스 변화는 없다.
- 거부: 해당 없음. 판단 근거는 `npm run lint:docs`와 문서 테스트 통과, 그리고 위 Target behavior 문장이 두 문서에 있는지다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `references/graphify-runner/index.md` | Step 3 | Modify | anchor 질의 규칙 | 그래프 후보 확인 문단 추가 | `:105-135` 직접 확인 |
| `skills/bouncer-plan/references/context-review.md` | 4단계 Revise once | Modify | 수정 한 번의 절차 | 구조 변경과 restart 관계 문단 추가 | `:65-70`, `plan-snapshot.ts:87-118`, `review-dispatch.ts:265-328` |

#### Constraints

- graphify-runner Step 3의 단계 번호·제목과 "sole rule body" 문장을 바꾸지 않는다(`check-doc-shape.js:901-904`).
- context-review.md의 `fingerprint: context:...` 예시 줄을 바꾸지 않는다.
- 문서는 기존 문서와 같이 영어로 쓴다.
- 변경 후 `npm run lint:docs`와 `npm test`가 통과해야 한다.