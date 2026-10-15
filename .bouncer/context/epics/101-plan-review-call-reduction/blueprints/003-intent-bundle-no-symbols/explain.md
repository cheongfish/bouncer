---
type: bouncer.explain
title: 003 explain
description: Explain for 003
resource: .bouncer/context/epics/101-plan-review-call-reduction/blueprints/003-intent-bundle-no-symbols/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-15T17:06:44.089+09:00'
bouncer:
  id: EXPLAIN-003
  epic_id: '101'
  blueprint_id: '003'
  status: published
  comprehension:
    - range_from: 5fc5763a4e0bee6fe95a0c9ed2ab41df17e45cae
      range_to: f992354b1b783d52626b1a160292a584b9da6b08
      diff_sha: 03e8444da212e47e0ec1c851cec8f610a5460dca70ddc5068c2fad142558fcc5
      recorded_at: '2026-10-15T17:20:00+09:00'
  task_commits:
    - task: EPIC-101/BP-003/TASK-001
      sha: f64b774b
      intent_anchor: task-001
    - task: EPIC-101/BP-003/TASK-002
      sha: f992354b
      intent_anchor: task-002
    - task: EPIC-101/BP-003/TASK-003
      sha: 7bf51dfb
      intent_anchor: task-003
---
# Explain

## Background

문서나 테스트만 바꾸는 task에는 함수가 없다. 그런데 `bouncer intent bundle`은 `--symbol`이 하나도 없으면 거절해서, 호출자가 문서 제목이나 테스트 이름을 함수처럼 넣어야 했다. 가짜 심볼이 bundle에 기록되면 이후 리뷰어가 존재하지 않는 함수를 찾게 된다. 이번 변경은 "함수 없음"을 명시적으로 선언하는 길을 열고, 어떤 값을 `--symbol`에 넣을지 지침으로 정한다. 또 `/bouncer-run`이 `metrics end`를 너무 일찍 불러 토큰 사용량이 비는 문제를 SKILL.md에 직접 적어 막는다.

## Intuition

빈 칸을 아무 글자로 채우게 하지 말고, 체크박스 "해당 없음"을 따로 둔 셈이다. 다만 체크는 실수로 눌리지 않도록 `--symbol`과 같이 쓰면 거절한다.

## Code

- `scripts/src/lib/cli-intent-command.ts`: `parseBundleArgs`가 `--no-symbols`를 받는다. 조합 검사(`--symbol`/`--candidate`와 동시 사용, 중복)는 인자 루프 전에 한 번 훑어서 위치와 무관하게 일관된 오류를 낸다. 파싱 거절은 resolver 모듈을 불러오기 전에 끝난다. `cmdIntentBundle`은 `allowEmpty`를 core에 넘긴다.
- `scripts/src/lib/intent-bundle.ts`: `resolveTaskIntentBundle`과 `normalizeFunctionRequests`가 `allowEmpty`가 true일 때만 빈 함수 목록을 허용한다. 기본값은 거절이라 실수로 빈 요청이 "함수 없음" bundle로 기록되지 않는다. 같은 호출 방식은 이전처럼 호출 순서를 바꿔 중복을 숨기지 않는다.
- `references/coordinator-cards/dispatch.md`, `skills/bouncer-execute/SKILL.md`: 실제 함수가 있으면 그 이름을, 문서·테스트 전용이면 `--no-symbols`를 쓰라는 지침.
- `skills/bouncer-run/SKILL.md` 4단계: `metrics end`는 hand-back 직후가 아니라 task-notification의 `subagent_tokens`가 도착한 뒤에 부른다.
- 한계: 진입 스킬 단어 수 상한에 여유가 약 1단어뿐이라 execute SKILL.md의 중복 문장 일부를 줄였다. 이후 진입 스킬을 늘리는 변경은 상한 예산을 먼저 계획해야 한다. run 스킬의 새 문장은 어색한 표현이 남아 후속 정리 대상이다. "bundle 변경 시 빈 bundle이 stale이 되는지"와 "오용 시 캐시를 쓰지 않는지" 테스트도 후속이다.

## Quiz

1. `bouncer intent bundle --task t.md --no-symbols --candidate foo`를 실행하면?
   - A) `--candidate requires a preceding --symbol` 오류
   - B) `--no-symbols cannot be combined with --symbol or --candidate` 오류
   - C) 빈 bundle이 만들어지고 `--candidate`는 무시된다
2. `--no-symbols`도 `--symbol`도 없이 호출하면?
   - A) 빈 bundle이 기본으로 만들어진다
   - B) task 문서의 제목에서 심볼을 자동 추출한다
   - C) `--symbol <function-name> is required` 오류
3. `/bouncer-run` 루트는 `metrics end`를 언제 불러야 하는가?
   - A) 같은 agent의 task-notification usage(`subagent_tokens`)가 도착한 뒤
   - B) coordinator hand-back 메시지가 도착한 직후
   - C) 다음 coordinator를 dispatch하기 직전

## Tasks

### EPIC-101/BP-003/TASK-001 · `f64b774b`

#### Goal & intent

함수 심볼이 없는 task에서도 `bouncer intent bundle`이 정상 bundle(`functions: []`)을 만들거나 재사용한다. 호출자는 문서 제목·테스트 이름을 `--symbol`에 넣지 않고 `--no-symbols`로 의도를 밝힌다.

#### Current behavior

- `scripts/src/lib/cli-intent-command.ts:256-258` `parseBundleArgs`는 `functions.length === 0`이면 `--symbol <function-name> is required`로 exit 2를 낸다. `--symbol`은 L205-217에서 쌓이고 `--candidate`는 바로 앞 symbol에 붙으며(L218-), 모르는 옵션은 L249에서 거절한다.
- `cmdIntentBundle`(L403-)은 `resolveTaskIntentBundle({ repoRoot, taskFile, functions })`를 부르고(L408-412) 결과 JSON을 stdout에 쓴 뒤 0을 반환한다.
- `scripts/src/lib/intent-bundle.ts:302-304` `normalizeFunctionRequests`는 배열이 아니거나 비면 `functions must be a non-empty array`를 던진다. `resolveTaskIntentBundle`(L210-)이 task를 읽기 전에 가장 먼저 부른다(L215).
- 빈 배열이 이 검사를 지나면 나머지 경로는 이미 동작한다. `isCacheHit`(L606-631)는 길이 0끼리 비교 뒤 `bySymbol.size === 0`로 hit, `readValidBundleRecord`(L520-533)는 `functions: []`와 `contentBundleId([])`를 받아들이고, `contentBundleId`(L778-780)는 `[]`의 sha256으로 고정 id를 낸다. sections 투영(L1033-1094)은 `functions: []`를 그대로 낸다.
- 사용법: `scripts/src/lib/cli-project-commands.ts:365-366`, `rules/cli.md:201`.

#### Target behavior

- `bouncer intent bundle --task <tasks.md> --no-symbols`는 `allowEmpty: true`로 core를 불러 `functions: []` bundle을 만들고(`created`) 같은 호출을 반복하면 `reused`와 같은 revision을 낸다. 함수가 있던 record 뒤에 부르면 revision을 1 올려 다시 쓴다.
- argv에 `--no-symbols`가 있고 `--symbol`이나 `--candidate`도 있으면 위치와 상관없이 `intent: --no-symbols cannot be combined with --symbol or --candidate`가 먼저다(예: `--no-symbols --candidate x`도 `--candidate requires a preceding --symbol`이 아니라 이 오류). 두 번 쓰면 `intent: duplicate option: --no-symbols`로 exit 2, stdout 비움, cache 미기록이다.
- 둘 다 없으면 지금처럼 `--symbol <function-name> is required`(exit 2)다.
- core 기본값(`allowEmpty` 없음·`false`)은 지금처럼 빈 배열을 던진다.
- 보존: 기존 `--symbol` 경로의 출력·cache·revision 규칙, 오류 reason·`next` 문구.

#### Interface

- 제공: CLI `bouncer intent bundle --task <tasks.md> --no-symbols [--repo <dir>]`. core `resolveTaskIntentBundle({ repoRoot, taskFile, functions, allowEmpty?, deps? })`. 사용법 줄 `intent     bundle --task <tasks.md> --no-symbols` 추가.
- 거부: `--no-symbols` + `--symbol`/`--candidate`, 중복 `--no-symbols`(exit 2). `allowEmpty`가 아닌 빈 `functions`(core throw).

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/cli-intent-command.ts` | `parseBundleArgs` | Modify | bundle argv 파싱 | `--no-symbols` 불리언, 조합·중복 거절, BundleArgs에 `allowEmpty` | L167-259 |
| `scripts/src/lib/cli-intent-command.ts` | `cmdIntentBundle` | Modify | core 호출·JSON 출력 | `allowEmpty` 전달 | L403-413 |
| `scripts/src/lib/intent-bundle.ts` | `resolveTaskIntentBundle`, `normalizeFunctionRequests` | Modify | 요청 정규화·cache 재사용/기록 | `allowEmpty`일 때만 빈 배열 허용 | L210-304 |
| `scripts/src/lib/cli-project-commands.ts` | intent usage | Modify | 도움말 | `--no-symbols` 줄 추가 | L363-366 |
| `rules/cli.md` | intent 절 | Modify | CLI 계약 문서 | 사용법 줄과 설명 한 문장 | L200-201, L228 |
| `test/intent-bundle.test.js` | 빈 요청 테스트 | Modify | core 계약 | 기본 거절 유지, `allowEmpty` 생성·재사용·revision 증가 | L423 |
| `test/cli-project-commands.test.js` | bundle CLI 테스트 | Modify | argv·출력 계약 | `--no-symbols` 성공·재사용·sections, 조합·중복 거절 | L511, L555-595, L686 |

#### Constraints

- 코드 주석과 docstring은 한국어로 쓴다(`references/coding-standards/index.md`).
- `scripts/lib`는 빌드 산출물이므로 소스는 `scripts/src/lib`만 고친다.
- 새 테스트 이름은 `<조건> → <결과>` 형식이다(`npm run lint:test-names`).
- `--no-symbols` 거절은 resolver 모듈을 불러오기 전에 끝난다(L792 테스트의 지연 로드 계약 유지).

### EPIC-101/BP-003/TASK-002 · `f992354b`

#### Goal & intent

coordinator와 execute 컨트롤러가 `bouncer intent bundle`의 `--symbol`에 소스 파일의 함수·메서드만 넣고, 그런 함수가 없는 task(문서·테스트 전용)에서는 `--no-symbols`를 쓴다.

#### Current behavior

- `references/coordinator-cards/dispatch.md:6-17` "Intent bundle (resolve once)"는 `bouncer intent bundle --task <path> --symbol <name>...`(L10)과 "resolve related functions"만 말한다. L19-20은 `intent-symbols` judge를 `--symbol <name>...`으로 채운다고 한다.
- `skills/bouncer-execute/SKILL.md:65-79`도 같은 단락이고 명령은 L69다.
- 두 곳 모두 심볼을 어디서 고르는지(Touch 표 심볼 열 등), 무엇을 빼야 하는지 말하지 않는다. `--no-symbols`를 언급하는 문서는 없다.
- `references/coordinator-cards/revise.md:26`과 `rules/cli.md`의 복구 문장은 "related function set"을 말할 뿐이다.
- `test/coordinate-next.test.js:1429,1434`가 카드 묶음에서 `bouncer intent bundle`과 `coordinate revise[\s\S]{0,240}bouncer intent bundle`을 확인한다.

#### Target behavior

- 두 resolve-once 단락이 다음을 말한다: `--symbol`에는 Touch 표 등에서 고른 소스 파일의 함수·메서드 이름만 넣는다. 문서 제목·항목 번호·테스트 이름은 넣지 않는다. 넣을 함수가 없으면 `bouncer intent bundle --task <path> --no-symbols`를 쓴다.
- `dispatch.md`의 `intent-symbols` judge 문장(L19-20)은 넣을 함수가 없으면 `--symbol` 대신 `--no-symbols`로 채운다고 말한다.
- revise 재검증 문장(`dispatch.md` L21-26, `skills/bouncer-execute/SKILL.md:148`)은 수정된 brief 기준으로 함수 집합을 다시 고르고, 그 집합이 비면 `--no-symbols`로 다시 부른다고 말한다.
- 보존: resolve once, 같은 id·revision 전달, 실패 시 dispatch 중단, revise 재검증 문장.

#### Interface

- 제공: 지침 문장(문서). 새 CLI·필드는 TASKS-001이 제공한다.
- 거부: 없음.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `references/coordinator-cards/dispatch.md` | Intent bundle 단락 | Modify | coordinator bundle 절차 | 심볼 선택 규칙과 `--no-symbols` 명령 | L6-20 |
| `skills/bouncer-execute/SKILL.md` | Intent bundle 단락 | Modify | execute bundle 절차 | 같은 규칙과 명령 | L65-79 |
| `test/skill-bouncer-surface.test.js` | 새 테스트 | Modify | 스킬 표면 계약 | 두 문서가 `--no-symbols`와 제외 대상을 말하는지 확인 | 새 테스트 |

#### Constraints

- `test/coordinate-next.test.js:1429-1434` 정규식이 계속 통과해야 한다(`coordinate revise`와 `bouncer intent bundle` 거리 240자 이내).
- 새 테스트 이름은 `<조건> → <결과>` 형식이다. `npm run lint:docs`가 통과한다.

### EPIC-101/BP-003/TASK-003 · `7bf51dfb`

#### Goal & intent

`/bouncer-run` 루트가 SKILL.md 4단계만 읽어도 coordinator 세션의 `metrics end`를 hand-back 직후가 아니라 같은 에이전트의 `<task-notification>` usage(`subagent_tokens`, `duration_ms`)가 도착한 뒤 부른다.

#### Current behavior

- `skills/bouncer-run/SKILL.md:142`: "Wrap every coordinator session in `metrics start`/`end` per [drive-metrics.md](./references/drive-metrics.md)." 시점을 말하지 않는다.
- `skills/bouncer-run/references/drive-metrics.md:26`(3단계)와 `rules/subagent-model.md` 6번 항목은 hand-back에 `subagent_tokens`가 없고 같은 에이전트의 `<task-notification>` usage를 받은 뒤 `metrics end`를 부른다고 이미 적는다.
- `test/skill-bouncer-run.test.js:27-31`이 4단계를 `/4\. \*\*Coordinator dispatch\.\*\*[\s\S]*?(?=\n5\. \*\*Report\.\*\*)/`로 잘라 확인한다. 4단계의 metrics 문장을 확인하는 테스트는 없다.

#### Target behavior

- 4단계 L142 문장이 `metrics end`는 hand-back 직후가 아니라 같은 에이전트의 `<task-notification>` usage가 도착한 뒤 그 값으로 부른다고 직접 말하고, 자세한 절차는 drive-metrics.md 3단계를 가리킨다.
- 보존: 4단계의 나머지 문장과 표, `N. **Title**` 단계 형식.

#### Interface

- 제공: 지침 문장(문서)과 테스트.
- 거부: 없음.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-run/SKILL.md` | 4단계 metrics 문장 | Modify | coordinator 세션 metrics 안내 | 시점을 직접 적음 | L142 |
| `test/skill-bouncer-run.test.js` | 새 테스트 | Modify | run 스킬 계약 | 4단계가 `task-notification`·`subagent_tokens`·`metrics end`를 말하는지 확인 | L27-31 |

#### Constraints

- 새 테스트 이름은 `run step 4 → ...` 형식(`<조건> → <결과>`)을 따른다. `npm run lint:docs`가 통과한다.