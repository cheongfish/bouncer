---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/drive-observation-cleanup/blueprints/digest-pr-input/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-11T13:32:36.984+09:00'
bouncer:
  id: EXPLAIN-digest-pr-input
  epic_id: drive-observation-cleanup
  blueprint_id: digest-pr-input
  status: published
  comprehension:
    - range_from: d8bdd313f15286914369452791aa2b73b61f799e
      range_to: 2d89d1033a99151c8c75c05ae1b6dd9a6b2ae4ec
      diff_sha: aff3b0ea59b039840224c1b83d6ee7ae2afffe8a239515e3d19cacae31012c35
      recorded_at: '2026-10-11T13:33:30+09:00'
  task_commits:
    - task: drive-observation-cleanup/digest-pr-input/001
      sha: 2d89d103
      intent_anchor: task-001
---
# Explain

## Background

`/bouncer-finalize`의 digest·PR draft가 blueprint 본문의 뒤쪽 절, 중복 finding 메모, 같은 검증 줄 반복, 지역 변수 이름을 끌어오던 문제를 줄인다. digest `version`과 필드 이름은 그대로 두고, `unverified` 행도 지우지 않는다. PR `background`·`changes`·`flow` 채움과 `terminal-missing` 조건은 후속 BP에 남긴다.

## Intuition

절을 자를 때는 다음 `##`에서 끊고, 심볼·검증·finding은 "첫 등장만" 남긴다.

## Code

- `scripts/src/lib/finalize-digest.ts` — `parseOutOfScope`가 Out of scope 절을 다음 `##` 앞에서 끊는다. `extractSymbols`는 줄 머리 고정 `SYMBOL_FN_RE` / `SYMBOL_VAR_RE`로 최상위 선언만 모은다.
- `scripts/src/lib/finalize-pr.ts` — `buildVerificationLines`가 동일 `command — passed|failed` 문자열을 한 줄만 남긴다. `buildReviewPoints`는 finding 메모를 서로만 중복 제거하고, `finding-accepted` / `finding-deferred` unverified 행은 재게시하지 않는다.
- 회귀: `test/finalize-digest.test.js`, `test/finalize-pr.test.js`. 생성 JS는 `npm run build`로만 갱신한다.

## Quiz

1. `parseOutOfScope`가 Out of scope bullet만 남기려면 절 본문을 어디서 끊는가?
   - A) 공유 `parseSections`가 돌려준 전체 문자열을 그대로 쓴다
   - B) 첫 `## ` 제목 앞에서 끊는다
   - C) `## Documents` 제목만 특별 처리해 제거한다

2. `extractSymbols`가 심볼로 인정하는 선언은?
   - A) hunk/`+` 줄 어디에든 있는 `function`·`const` 식별자
   - B) 줄 머리(접두 `export`/`async` 허용)의 최상위 `function`·`class`·`const|let|var`
   - C) 테스트 파일의 `let i` 같은 들여쓴 지역 변수만

3. 같은 검증 명령이 task마다 `passed`로 반복될 때 PR 확인 방법 줄은?
   - A) task마다 한 줄씩 모두 남긴다
   - B) 동일 `command — passed|failed` 문자열은 첫 등장만 남긴다
   - C) 명령이 같으면 결과와 무관하게 한 줄로 합친다

## Tasks

### drive-observation-cleanup/digest-pr-input/001 · `2d89d103`

#### Goal & intent

finalize digest의 `out_of_scope`·`symbols`와 PR draft의 `review_points`·`verification`이 이 blueprint의 리뷰 입력에 필요한 값만 담게 한다. 에픽 수용 기준 1·2·3·4·13을 만족하면 끝이며, 최종 검증 명령은 `npm run ci`다.

#### Current behavior

- `OUT_OF_SCOPE_DEFS`(`scripts/src/lib/finalize-digest.ts:104-106`)는 `## Out of scope` 정의 하나뿐이다. `parseOutOfScope`(`:185-195`)가 `parseSections`(`scripts/src/lib/validate-sections.ts:133-150`)를 부르면 절이 다음 정의 제목이나 EOF까지 이어져 `## One-commit justification`, `## Documents`, 링크 줄이 각각 항목이 된다. `parseSections`는 `parseTasksSections`(`:152`), `parseExplainSections`(`:156`), `validate.ts`, `validate-gates.ts`, `cli-intent-command.ts`, `comprehension.ts`도 쓴다.
- `buildReviewPoints`(`scripts/src/lib/finalize-pr.ts:244-280`)는 `out_of_scope` → task·blueprint review의 `pushFindingPoints`(`:216-229`, 메모 또는 id) → `unverified` 행(`kind: detail`) 순으로 쌓는다. digest가 같은 finding을 `unverified`의 `finding-accepted`·`finding-deferred`(`finalize-digest.ts:762-777`, `:784-797`)로도 내므로 메모가 두 번 들어간다.
- `buildVerificationLines`(`finalize-pr.ts:193-205`)는 task마다 `${command} — passed|failed` 한 줄을 넣고 중복을 지우지 않는다. 문서 주석(`:186-188`)이 task당 한 줄을 명시한다.
- `SYMBOL_RE`(`finalize-digest.ts:108`)에 줄 머리 고정이 없다. `extractSymbols`(`:268-314`)는 hunk header 문맥(`@@…@@(.*)`)과 `+` 줄(앞 `+` 제거)을 모두 검사하므로 `let i = 0` 같은 들여쓰기된 지역 선언이 들어간다. 상한은 파일당 10, 전체 60이다.
- I/O 결합: `prepareFinalizeDigest`가 `git diff -U0`(`finalize-digest.ts:728`) stdout을 `extractSymbols`에 넘기고, `review.md`를 파일에서 읽는다(`~:783`). `parseOutOfScope`·`extractSymbols`는 export되지 않은 순수 함수이며 `export = { prepareFinalizeDigest }`(`:869`)만 공개된다. `buildPrDraft`(`finalize-pr.ts:495` export)는 순수 함수다.
- 재현: `node --test test/finalize-pr.test.js test/finalize-digest.test.js`가 현재 통과한다. Out of scope 뒤에 다른 절이 오는 입력을 검사하는 테스트는 없다.

#### Target behavior

- 성공: `## Out of scope` 아래 항목만 `out_of_scope`에 들어가고, 다음 `## ` 제목부터는 빠진다. task review와 blueprint review에서 온 같은 finding 메모 문자열은 `review_points`에 처음 나온 순서로 한 번만 나오고, `unverified`의 `finding-accepted`·`finding-deferred` 행은 `review_points`로 옮기지 않는다. `pr.sections.verification`은 같은 문자열을 첫 등장 순서로 한 번 담는다. `symbols`에는 `let i`, `const parts`처럼 들여쓰기된 선언 이름이 없다.
- 실패·경계: Out of scope 절이 없으면 `[]`, 마지막 절이면 EOF까지 읽는다. 명령이 같아도 `passed`/`failed`가 다르면 두 줄이 모두 남는다. `review_points`에서 `finding-*` 외의 `unverified` 행(`path-outside-scope`, `terminal-missing` 등)은 기존 형식대로 남는다.
- 보존: digest의 필드 이름·타입·`version`, `unverified` 행 집합, symbol 상한과 `.bouncer/context/` 제외, `parseSections`의 동작은 바뀌지 않는다.

#### Interface

- 제공: `out_of_scope: string[]`, `symbols: Array<{ path, names }>`, `pr.sections.review_points: string[]`, `pr.sections.verification: string[]`의 값 규칙(위 Target behavior).
- 제공: 최상위 선언 규칙 — 검사 대상 줄(`+` 줄은 `+`를 뗀 나머지, hunk header 문맥은 앞 공백 한 칸을 뗀 나머지)의 시작이 아래 두 패턴 중 하나와 맞을 때만 이름을 뽑는다. 접두는 조합할 수 있다.
  ```
  ^(?:export\s+(?:default\s+)?)?(?:async\s+)?(?:function(?:\s*\*\s*|\s+)|class\s+)([A-Za-z_$][\w$]*)
  ^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=
  ```
  예: `+export async function buildX(` → `buildX`, `+export const LIMIT = 3` → `LIMIT`, `+  const parts = ` → 없음, `+functions.push(x)` → 없음.
- 제공(테스트 경로): symbol 규칙은 기존 digest 테스트처럼 임시 git 저장소에 fixture 파일을 커밋해 `prepareFinalizeDigest`로 검증한다. `extractSymbols`·`parseOutOfScope`를 새로 export하지 않는다.
- 거부: 들여쓰기된 선언, 탭으로 시작하는 줄, `review_points`로 옮겨지는 `finding-accepted`·`finding-deferred` 행.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/finalize-digest.ts` | `parseOutOfScope`, `SYMBOL_RE`, `extractSymbols` | Modify | Out of scope 항목과 diff symbol 추출 | 절을 다음 `## ` 제목에서 끊고 symbol을 최상위 선언으로 제한 | 수용 기준 1·4의 생성 지점 |
| `scripts/src/lib/finalize-pr.ts` | `buildReviewPoints`, `buildVerificationLines` | Modify | PR draft의 review_points·verification 생성 | `finding-*` 행 재게시 제거, 검증 줄 중복 제거와 주석 갱신 | 수용 기준 2·3의 생성 지점 |
| `scripts/lib/finalize-digest.js` | 생성 산출물 | Modify | TS 빌드 결과 | `npm run build`로 갱신 | `check:emit` |
| `scripts/lib/finalize-pr.js` | 생성 산출물 | Modify | TS 빌드 결과 | `npm run build`로 갱신 | `check:emit` |
| `test/finalize-digest.test.js` | Out of scope·symbols 테스트 | Modify | digest 회귀 | 뒤 절이 있는 본문과 지역 선언 diff 케이스 추가 | 수용 기준 1·4 회귀 |
| `test/finalize-pr.test.js` | `:174-201` 테스트와 신규 케이스 | Modify | PR draft 회귀 | `:201` 단언을 부재 단언으로 바꾸고 중복 제거·검증 줄 케이스 추가 | `:201`이 재게시 형식을 고정함 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 변경 기록 | 한국어 항목 추가 | 프로젝트 규칙 |

#### Constraints

- digest `version`과 필드 이름을 바꾸지 않는다. `unverified` 행은 지우지 않는다.
- `parseOutOfScope`의 절 끝 판정은 그 함수 안에서 처리하고 공유 파서에 정의를 추가하지 않는다.
- 생성 JS는 손으로 고치지 않고 `npm run build`로만 갱신한다. `git add`는 허용하고 commit·push·branch는 하지 않는다.