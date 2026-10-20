---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/source-test-hygiene/blueprints/shared-helpers/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-11T15:28:36.276+09:00'
bouncer:
  id: EXPLAIN-shared-helpers
  epic_id: source-test-hygiene
  blueprint_id: shared-helpers
  status: published
  comprehension:
    - range_from: 0aee20e66531b36cdf944a1a9b9a9f2a3f4b976d
      range_to: 99e529a18ed9b2cffe7bc5c365e2ae902ec1bacc
      diff_sha: 34dcfa4e931c22b2e26545f8cd64269bb58f9bd2c559cb8f131275fdf4e2c8bd
      recorded_at: '2026-10-11T15:40:00+09:00'
  task_commits:
    - task: source-test-hygiene/shared-helpers/001
      sha: 7d306f7c
      intent_anchor: task-001
    - task: source-test-hygiene/shared-helpers/002
      sha: 99e529a1
      intent_anchor: task-002
---
# Explain

## Background

승인·검증 digest를 만드는 `canonicalJson`/`sha256Canonical`과 `isRecord`, `catchMessage`, `isEnoentError` 같은 작은 판별 helper가 여러 모듈에 복사돼 있었다.
한 복사본만 고치면 digest 값이 어긋나 게이트 판정이 달라질 수 있었다.
정의를 공용 모듈 하나로 모으고, `paths`와 `tasks-docs`가 서로를 import하던 순환도 없앴다. CLI 출력, 게이트 코드, 오류 메시지, digest 값은 그대로다.

## Intuition

서랍마다 따로 있던 같은 열쇠 복사본을 열쇠함 한 곳에 모았다. 열쇠 모양은 바꾸지 않았다.

## Code

- `scripts/src/lib/canonical-json.ts`: `canonicalJson`, `sha256Canonical` 단일 정의
- `scripts/src/lib/guards.ts`: `isRecord`, `catchMessage`, `catchMessageOrString`, `isFsCode`, `isEnoentError`, `isSkippableFsError`. import가 없는 모듈이다.
- `scripts/src/lib/posix-path.ts`: `toPosix` 단일 정의. `paths`가 호환용으로 re-export한다.
- `scripts/src/lib/tasks-docs.ts`: `paths` import와 지연 `require`를 제거했다.
- 테스트: `test/canonical-json.test.js`, `test/guards.test.js`, `test/paths.test.js`, `test/tasks-docs.test.js`

## Quiz

1. `catchMessage(null)`을 호출하면 어떻게 되는가?
   - A) 빈 문자열을 반환한다
   - B) TypeError가 난다
   - C) 문자열 `'null'`을 반환한다
2. Linux에서 `symbol-index`가 백슬래시가 든 파일 이름을 받으면 결과 경로는 어떻게 되는가?
   - A) 백슬래시가 그대로 남는다
   - B) 오류로 처리하고 건너뛴다
   - C) 백슬래시가 `/`로 바뀐다
3. `isSkippableFsError`가 true를 돌려주는 오류 코드는 무엇인가?
   - A) ENOENT, EACCES, EPERM, ELOOP, ENOTDIR
   - B) ENOENT만
   - C) 모든 errno 코드

## Tasks

### source-test-hygiene/shared-helpers/001 · `7d306f7c`

#### Goal & intent

복사된 digest helper(`canonicalJson`, `sha256Canonical`)와 본문이 같은 판별 helper(`isRecord`, `catchMessage`, `catchMessageOrString`, `isEnoentError`, `isFsCode`, `isSkippableFsError`)를 공용 모듈 두 개로 옮겨 정의를 하나로 만든다. 같은 입력에 대한 digest 문자열과 모든 CLI 출력은 바뀌지 않는다. 수용 기준은 에픽 Success criteria 1·2(`toPosix` 제외)이고 검증 명령은 `npm run ci`다.

#### Current behavior

- digest helper 복사본: `approval-snapshot.ts:37`·`:59`, `verification.ts:522`·`:544`, `validate-gates.ts:564`·`:586`. 세 본문은 같다(키 정렬 재귀 → `JSON.stringify` → sha256 hex). `approval-snapshot.ts:158`은 `sha256Canonical`을 export하고 `task-brief-hash.ts:5`가 그것을 import한다.
- `isRecord` 복사본 13개: `codex-agents.ts:22`, `approval-snapshot.ts:26`, `task-brief-hash.ts:10`, `config.ts:51`, `epic-index.ts:29`, `verification.ts:112`, `run-preflight.ts:84`, `subagents.ts:12`, `review-record.ts:41`, `print-dispatch.ts:47`, `validate-gates.ts:845`, `validate-sections.ts:192`, `runtime-state.ts:833`. 표기는 세 가지(`!Array.isArray`, `Array.isArray(v) === false`, 피연산자 순서만 다름)이고 결과는 같다.
- `catchMessage` 6개: `cli-doc-commands.ts:29`, `cli-git-commands.ts:33`, `cli-project-commands.ts:312`, `cli-intent-command.ts:332`는 `string`을, `validate.ts:128`, `runtime-state.ts:458`은 `unknown`을 반환 타입으로 적는다. 런타임은 모두 `(error).message`이며 `throw null`이면 TypeError가 난다(주석이 의도로 명시).
- `catchMessageOrString` 2개: `graphify.ts:199`, `session-graph.ts:80`. 본문이 같다.
- `isEnoentError` 3개(`config.ts:78`, `runtime-state.ts:784`, `print-dispatch.ts:51`), `isFsCode`·`isSkippableFsError` 3쌍(`symbol-index.ts:1420`·`:1424`, `intent-bundle.ts:929`·`:933`, `intent-provenance.ts:978`·`:982`). 런타임 결과가 같다.
- 모듈 형식: `import x = require('./y')` + `export = { ... }`. 위 helper 주변에 모듈 상태나 I/O는 없다(`node:crypto` require만 있음).
- 출력 고정 지점: `test/validate-gates.test.js:23-39`가 같은 해시를 독립 구현해 `:888`, `:1921`에서 evidence_id와 비교한다. `test/approval-snapshot.test.js:53`, `test/verification-runner.test.js:172-183`·`:318`, `test/task-brief-hash.test.js`가 digest를 쓴다.
- lazy-load 경계: `test/cli-project-commands.test.js:15`·`:34`·`:390`은 cli 모듈 로드 때 `symbol-index`·`intent-*`가 미리 올라오지 않는지 본다.

#### Target behavior

- 성공: `canonicalJson`·`sha256Canonical`의 정의는 `scripts/src/lib/canonical-json.ts` 하나뿐이다. 판별 helper의 정의는 `scripts/src/lib/guards.ts` 하나뿐이다. 두 모듈은 Node 내장 모듈 외에는 아무것도 import하지 않는다.
- 성공: 고정 입력(키 순서가 다른 중첩 객체, 배열, `null`, 문자열을 섞은 값)의 `sha256Canonical` 결과가 통합 전 값과 같다는 테스트가 있다.
- 보존: `approval-snapshot`의 `sha256Canonical` export는 그대로 남아 기존 import가 동작한다. 모든 CLI JSON 출력, 게이트 코드, 오류 메시지는 같다. `catchMessage`는 `throw null`에서 계속 TypeError를 낸다.
- 보존: `stringList`(세 구현의 의미가 다름)와 `finalize.ts:190`의 `asRecord`(캐스트만 함)는 옮기지 않는다.

#### Interface

- 제공: `canonical-json.ts` — `canonicalJson(value: unknown): string`, `sha256Canonical(value: unknown): string`.
- 제공: `guards.ts` — `isRecord(value: unknown): value is Record<string, unknown>`, `catchMessage(error: unknown): string`, `catchMessageOrString(error: unknown): string`, `isEnoentError(error: unknown): boolean`, `isFsCode(error: unknown, code: string): boolean`, `isSkippableFsError(error: unknown): boolean`. `catchMessage`는 `string`을 반환 타입으로 정한다. 지금 `unknown`을 반환하던 `validate.ts`·`runtime-state.ts`의 호출부(`validate.ts:221`, `runtime-state.ts:486`·`:646`·`:712`)에 있는 `as string` 캐스트는 지운다. 런타임 결과는 같다.
- 거부: 두 모듈은 `./` 상대 import를 갖지 않는다. 런타임 결과가 다른 변형을 같은 이름으로 합치지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/canonical-json.ts` | `canonicalJson`, `sha256Canonical` | Create | 없음 | digest helper 단일 정의 | 정본 위치 |
| `scripts/src/lib/guards.ts` | `isRecord`, `catchMessage` 외 | Create | 없음 | 판별 helper 단일 정의 | 정본 위치 |
| `scripts/src/lib/approval-snapshot.ts` | `canonicalJson`, `sha256Canonical`, `isRecord` | Modify | 복사본 정의, `sha256Canonical` export | 정의 삭제 후 import, export 유지 | 복사본 |
| `scripts/src/lib/verification.ts` | `canonicalJson`, `sha256Canonical`, `isRecord` | Modify | 복사본 정의 | import로 교체 | 복사본 |
| `scripts/src/lib/validate-gates.ts` | `canonicalJson`, `sha256Canonical`, `isRecord` | Modify | 복사본 정의 | import로 교체 | 복사본 |
| `scripts/src/lib/task-brief-hash.ts` | `isRecord` | Modify | 복사본 정의 | import로 교체 | 복사본 |
| `scripts/src/lib/codex-agents.ts` | `isRecord` | Modify | 복사본 정의 | import로 교체 | 복사본 |
| `scripts/src/lib/config.ts` | `isRecord`, `isEnoentError` | Modify | 복사본 정의 | import로 교체 | 복사본 |
| `scripts/src/lib/epic-index.ts` | `isRecord` | Modify | 복사본 정의 | import로 교체 | 복사본 |
| `scripts/src/lib/run-preflight.ts` | `isRecord` | Modify | 복사본 정의 | import로 교체 | 복사본 |
| `scripts/src/lib/subagents.ts` | `isRecord` | Modify | 복사본 정의 | import로 교체 | 복사본 |
| `scripts/src/lib/review-record.ts` | `isRecord` | Modify | 복사본 정의 | import로 교체 | 복사본 |
| `scripts/src/lib/print-dispatch.ts` | `isRecord`, `isEnoentError` | Modify | 복사본 정의 | import로 교체 | 복사본 |
| `scripts/src/lib/validate-sections.ts` | `isRecord` | Modify | 복사본 정의 | import로 교체 | 복사본 |
| `scripts/src/lib/runtime-state.ts` | `isRecord`, `catchMessage`, `isEnoentError` | Modify | 복사본 정의 | import로 교체 | 복사본 |
| `scripts/src/lib/validate.ts` | `catchMessage` | Modify | 복사본 정의 | import로 교체 | 복사본 |
| `scripts/src/lib/cli-doc-commands.ts` | `catchMessage` | Modify | 복사본 정의 | import로 교체 | 복사본 |
| `scripts/src/lib/cli-git-commands.ts` | `catchMessage` | Modify | 복사본 정의 | import로 교체 | 복사본 |
| `scripts/src/lib/cli-project-commands.ts` | `catchMessage` | Modify | 복사본 정의 | import로 교체 | 복사본 |
| `scripts/src/lib/cli-intent-command.ts` | `catchMessage` | Modify | 복사본 정의 | import로 교체 | 복사본 |
| `scripts/src/lib/graphify.ts` | `catchMessageOrString` | Modify | 복사본 정의 | import로 교체 | 복사본 |
| `scripts/src/lib/session-graph.ts` | `catchMessageOrString` | Modify | 복사본 정의 | import로 교체 | 복사본 |
| `scripts/src/lib/symbol-index.ts` | `isFsCode`, `isSkippableFsError` | Modify | 복사본 정의 | import로 교체 | 복사본 |
| `scripts/src/lib/intent-bundle.ts` | `isFsCode`, `isSkippableFsError` | Modify | 복사본 정의 | import로 교체 | 복사본 |
| `scripts/src/lib/intent-provenance.ts` | `isFsCode`, `isSkippableFsError` | Modify | 복사본 정의 | import로 교체 | 복사본 |
| `scripts/lib/` | 위 모듈의 생성 JS | Modify | `npm run build` 산출물 | 재생성, 신규 두 파일 포함 | `check:emit` 대상 |
| `test/canonical-json.test.js` | 고정 digest 단언 | Create | 없음 | 통합 전 값 고정 | 검증 지점 |
| `test/guards.test.js` | 판별 helper 단언 | Create | 없음 | 경계 입력 결과 고정 | 검증 지점 |

#### Constraints

- 동작 변경 금지: 모든 CLI 출력, 게이트 코드, 오류 메시지, digest 값이 그대로다.
- 공용 모듈은 Node 내장 모듈만 import한다. `test/cli-project-commands.test.js`의 lazy-load 단언이 계속 통과해야 한다.
- 기존 주석이 설명하던 의도(예: `catchMessage`가 `null` 가드를 두지 않는 이유)는 공용 정의의 주석으로 옮긴다.
- 테스트는 결과값만 단언한다. 소스 문자열이나 정의 위치를 정규식으로 검사하지 않는다.

### source-test-hygiene/shared-helpers/002 · `99e529a1`

#### Goal & intent

`toPosix`를 `scripts/src/lib/posix-path.ts` 하나에 정의하고, `tasks-docs.ts`가 `paths.ts`를 import하지 않게 해 순환을 없앤다. 수용 기준은 에픽 Success criteria 2(`toPosix`)·3·10이고 검증 명령은 `npm run ci`다.

#### Current behavior

- 정의 다섯 개:
  - `paths.ts:18` `toPosix(p: unknown)` → `String(p).split('\\').join('/')`, `:57` export
  - `graph-scope.ts:49`, `graph-search.ts:184` `toPosix(p: string)`, 같은 본문
  - `graph-exec.ts:130` `toPosixPath(p: string)`, 같은 본문, 호출 `:144`·`:146`
  - `symbol-index.ts:1416` `toPosix(p: string)` → `p.split(path.sep).join('/')`, 호출 `:277`
- `unknown` 입력에 기대는 호출부: `finalize-release-main.ts:481`, `runtime-state.ts:548`·`:644`, `current.ts:766`, `validate-gates.ts:337`, `paths.ts:33`·`:53`. 31개 모듈이 `paths`에서 `toPosix`·`parsePathIds`를 import한다.
- 순환:
  - `paths.ts:3-4`가 load 시점에 `tasks-docs`의 `unitDocKind`를 구조분해한다. 쓰는 곳은 `parsePathIds`(`:45`)뿐이다.
  - `tasks-docs.ts:150`은 함수 안에서 `require('./paths')`를 해 `toPosix`(`:151`)와 `parsePathIds`를 가져온다. `:162`의 `void parsePathIds(bp)`는 결과를 버리는 죽은 호출이다(`:159-161` 주석).
  - `tasks-docs.ts`의 다른 import(`node:fs`, `node:path`, `./schema`, `./frontmatter`)는 `paths`에 닿지 않는다.
- 모듈 상태: 두 모듈 모두 상수만 있다(`paths.ts:6`·`:15-16`, `tasks-docs.ts:8-15`).
- 테스트: `test/paths.test.js:5-50`(`parsePathIds`), `test/tasks-docs.test.js:42-107`(`listTasksDocs`), `test/symbol-index.test.js:37-493`. `toPosix`를 직접 단언하는 테스트와 Windows 경로 케이스는 없다. `test/cli-project-commands.test.js:34`는 cli 로드 때 `symbol-index`·`intent-*`가 미리 올라오지 않는지 본다.

#### Target behavior

- 성공: `toPosix(p: unknown): string`의 정의는 `posix-path.ts` 하나뿐이고 모든 `\`를 `/`로 바꾼다. `paths.ts`는 그것을 re-export해 기존 import 31곳이 그대로 동작한다. graph-*·`symbol-index`는 `posix-path`에서 import한다.
- 성공: `tasks-docs.ts`는 `posix-path`를 최상단에서 import하고 `paths`를 import하지 않는다. 함수 안 `require('./paths')`와 죽은 `void parsePathIds(bp)`는 없다.
- 변경(수용): Linux에서 `symbol-index`가 백슬래시가 든 파일 이름을 받으면 결과가 `/`로 바뀐다. 일반 경로 결과는 같다.
- 보존: `listTasksDocs`, `parsePathIds`의 결과와 오류는 같다. `graph-exec.ts:64`의 `path.relative(...).split(path.sep)` 인라인 변환은 정의가 아니므로 그대로 둔다.

#### Interface

- 제공: `posix-path.ts` — `toPosix(p: unknown): string`. `paths.ts`는 같은 함수를 계속 export한다.
- 거부: `posix-path.ts`는 `./` 상대 import를 갖지 않는다. `tasks-docs.ts`는 `./paths`를 import하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/posix-path.ts` | `toPosix` | Create | 없음 | 단일 정의 | 정본 위치 |
| `scripts/src/lib/paths.ts` | `toPosix` | Modify | 정의·export | 정의 삭제, re-export | 기존 import 호환 |
| `scripts/src/lib/tasks-docs.ts` | `listTasksDocs` | Modify | 지연 `require('./paths')` | 최상단 `posix-path` import, 죽은 호출 삭제 | 순환 제거 지점 |
| `scripts/src/lib/graph-scope.ts` | `toPosix` | Modify | 복사본 | import로 교체 | 복사본 |
| `scripts/src/lib/graph-search.ts` | `toPosix` | Modify | 복사본 | import로 교체 | 복사본 |
| `scripts/src/lib/graph-exec.ts` | `toPosixPath` | Modify | 복사본 | `toPosix` import로 교체 | 복사본 |
| `scripts/src/lib/symbol-index.ts` | `toPosix` | Modify | `path.sep` 분할 | `posix-path` import로 교체 | 유일한 다른 구현 |
| `scripts/lib/` | 위 모듈의 생성 JS | Modify | 빌드 산출물 | 재생성, 신규 파일 포함 | `check:emit` 대상 |
| `test/paths.test.js` | `toPosix` 단언 | Modify | `parsePathIds`만 단언 | 백슬래시·비문자열 입력 단언 추가 | 검증 지점 |
| `test/tasks-docs.test.js` | 순환 단언 | Modify | 순환 단언 없음 | 모듈 캐시를 비운 뒤 `tasks-docs`만 로드하면 `paths`가 캐시에 없음을 단언 | 검증 지점 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | BP 001 항목 없음 | BP 001 helper 통합·순환 제거 항목 추가 | 프로젝트 규칙 |

#### Constraints

- `toPosix`는 `unknown`을 받아 `String(p)`로 변환한다. 기존 `string` 시그니처 호출부도 그대로 동작한다.
- `posix-path.ts`는 Node 내장 모듈만 import한다. `test/cli-project-commands.test.js`의 lazy-load 단언이 계속 통과한다.
- 테스트는 함수 결과와 모듈 로드 결과만 단언한다. 소스 문자열을 정규식으로 검사하지 않는다.