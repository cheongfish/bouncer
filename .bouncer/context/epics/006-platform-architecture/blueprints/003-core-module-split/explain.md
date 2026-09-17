---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/006-platform-architecture/blueprints/003-core-module-split/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-14T11:45:43.570+09:00'
bouncer:
  id: EXPLAIN-003
  epic_id: '006'
  blueprint_id: '003'
  status: published
  comprehension:
    - range_from: develop
      range_to: 1d486d348ce3b90ab8e3a6b543c04396dda5ebb7
      diff_sha: 34d478518c16815b33cc5bfb19df49adb2cc3d2f74db0d38d7a2a1f9dc1202a4
      quiz_score: 1/5
      disposition: Q4만 정답. missing은 ENOENT만이고, CLI 프로토타입 키는 unknown-command이며, validateBlueprint는 allowlist 파일명 때문에 남기고, graph-scope는 프로세스·graphify require가 금지다
      recorded_at: '2026-08-14T11:48:25+09:00'
---
# Explain

## Background

`validate.ts`·`cli.ts`·`session-graph.ts`·`import-history.ts`가 저장소 코어의
절반을 한 파일에 쥐고 있었다. 게이트 하나, 명령 하나, 그래프 신선도 판정
하나를 고치려면 성격이 다른 코드를 같이 읽어야 했고, 리뷰는 이동인지
동작 변경인지 구분하기 어려웠다. 같은 저장소에 `.bouncer/config.json`을
`JSON.parse`하는 자리가 일곱 곳이었고, 실패 처리가 `{}` / `null` / 타입 있는
예외로 갈라져 한쪽만 고치면 나머지가 조용히 어긋났다.

이 변경은 파싱을 `config.ts` 하나로 모으고, 네 파일을 평평한 형제 모듈로
나눈다. 공개 `require` 경로, CLI help 바이트, 게이트 코드·메시지, 테스트
단언은 그대로다.

## Intuition

한 파일에 섞여 있던 책임을 층으로 갈라, 실패를 어떻게 받을지는 호출자가
정하고 파싱·판정·실행은 각자 한 자리만 갖게 한다.

## Code

- `scripts/src/lib/config.ts` — `readConfigResult` / `readConfig`. ENOENT만
  `missing`, 그 밖의 읽기·JSON 오류는 `invalid`. 값 모양은 보지 않는다.
  `cli.ts`·`subagents.ts`는 `?? {}`, `session-graph.ts`·`graphify.ts`는
  `null` 그대로, `verification.ts`는 `VERIFY_CONFIG_MISSING` /
  `VERIFY_CONFIG_INVALID`로 매핑한다.
- `scripts/src/lib/cli.ts` — `COMMANDS` 레지스트리에서 USAGE를 조립하고
  키로 디스패치한다. 조회는 `Object.hasOwn`이다. 핸들러는
  `cli-flags.ts`, `cli-doc-commands.ts`, `cli-git-commands.ts`,
  `cli-project-commands.ts`, `cli-current-command.ts`.
- `scripts/src/lib/validate.ts` — `validateBlueprint`와 배럴만 남긴다.
  레거시 `.sdd` 문자열이 `test/public-name-regression.test.js` allowlist에
  이 파일명으로 묶여 있다. 본문 파싱 `validate-sections.ts`, 로딩
  `validate-docs.ts`, S 코드 `validate-structural.ts`(`isValidGraphBasis`),
  G 코드 `validate-gates.ts`.
- `scripts/src/lib/session-graph.ts` / `graph-scope.ts` / `graph-exec.ts` —
  신선도 판정(읽기만)과 graphify 프로세스 실행을 가른다.
- `scripts/src/lib/import-history.ts` / `import-types.ts` / `import-git.ts` /
  `import-render.ts` — 계획·거부·적용과 git 파싱·본문 렌더를 가른다.
  `hooks/session-graph.js`는 공개 이름만 부른다.

## Quiz

1. `readConfigResult`에서 `missing`이 되는 경우는?
   - A) 파일이 없거나 JSON이 깨졌을 때
   - B) 읽기 오류 `code`가 `ENOENT`일 때만
   - C) 파싱된 값이 객체가 아닐 때

2. CLI 레지스트리에서 `toString` 같은 이름을 치면?
   - A) `Object.prototype` 메서드를 실행한다
   - B) 예외를 던진다
   - C) 다른 미등록 명령과 같이 stderr `unknown command`와 종료 코드 2

3. `validateBlueprint`를 `validate.ts`에 남긴 이유는?
   - A) allowlist가 레거시 `.sdd` 문자열을 이 파일명에 묶어 두어서
   - B) 게이트 메시지가 이 파일 경로를 하드코딩해서
   - C) `scope.ts` 순환을 끊으려고

4. S9와 G4의 `graph.basis` 판정은?
   - A) `validate-gates.ts`와 `validate-structural.ts`에 각각 구현한다
   - B) `validate.ts` 배럴에만 둔다
   - C) `validate-structural.ts`의 `isValidGraphBasis` 하나를 게이트가 가져다 쓴다

5. `graph-scope.ts`가 하면 안 되는 일은?
   - A) `fs.stat` / `existsSync`로 mtime을 읽는 일
   - B) `graphify.ts`를 require하거나 외부 프로세스를 띄우는 일
   - C) `graphify-out`·`node_modules`·`.git`·`.worktrees`를 mtime 순회에서 건너뛰는 일

## 이해 상태

- 점수: 1/5
- 정답: 1B, 2C, 3A, 4C, 5B
- 응답: 1A, 2A, 3C, 4C, 5C
- 채점: 1 오답, 2 오답, 3 오답, 4 정답, 5 오답
- disposition: Q4만 정답. missing은 ENOENT만이고, CLI 프로토타입 키는 unknown-command이며, validateBlueprint는 allowlist 파일명 때문에 남기고, graph-scope는 프로세스·graphify require가 금지다

## Tasks

### Task 001

#### Goal & intent

`.bouncer/config.json`을 읽어 `JSON.parse`하는 구현이 저장소에 하나만 남는다.
지금은 일곱 자리가 같은 파일을 연다 — `cli.ts`의 `readConfig`, `subagents.ts`의
`readConfig`, `session-graph.ts`의 `readBouncerConfig`, `graphify.ts`의
`readConfigSafe`, `init.ts`의 `readConfigObject`와 `inspectBootstrap` 안의 인라인
파싱, 그리고 `verification.ts`의 인라인 파싱이다. 실패했을 때 무엇을 하는지는
자리마다 다르다: `{}`를 주는 곳, `null`을 주는 곳, 그리고 파일 없음과 깨진
JSON을 구분해 타입 있는 예외를 던지는 곳(`verification.ts`). 파싱은 한 곳으로
모으고, 그 차이는 호출 지점에 남긴다.

동작은 관측 가능한 범위에서 바뀌지 않는다. 특히 잘못된 `config.json`(배열,
원시값, 깨진 JSON, 권한 오류)에서 지금 나오는 결과가 그대로 나와야 한다.

#### Interface

- 제공: `scripts/src/lib/config.ts`가 두 함수를 export한다.
  - `readConfigResult(repoRoot)` → `{ ok: true, value }` 또는
    `{ ok: false, reason: 'missing' | 'invalid' }`. `missing`은 읽기 오류
    `code`가 `ENOENT`일 때만이고, 그 밖의 읽기 오류와 JSON 파싱 실패는 모두
    `invalid`다(현재 `verification.ts`의 분기와 같은 경계).
  - `readConfig(repoRoot)` → `readConfigResult`의 `value`, 실패면 `null`.
- 거부: 두 함수 모두 값의 **모양**을 검사하지 않는다. 파싱된 것이 배열이든
  숫자든 그대로 통과시킨다 — 지금 `cli`·`subagents`·`session-graph`가 그렇게
  동작하고 있고, 여기서 객체 검사를 넣으면 그 세 곳의 동작이 조용히 바뀐다.
  객체 여부 판정은 지금 그것을 하는 `init.ts` 호출 지점에 남긴다.
- 거부: `{}` 기본값, 기본 설정 주입, 스키마 검증, 캐싱은 이 모듈이 하지 않는다.
  「없음」과 「빈 설정」을 같게 보려는 호출자는 `readConfig(root) ?? {}`로 받는다.

#### Touch

- Create `scripts/src/lib/config.ts` — `readConfigResult`·`readConfig` 단일
  구현과, 왜 `missing`이 ENOENT만인지·왜 모양 검사를 하지 않는지를 적은 주석.
- Modify `scripts/src/lib/cli.ts` — 로컬 `readConfig` 삭제, `config`에서 가져와
  `?? {}`로 받는다. `cmdCurrent --set`의 `base_branch` 읽기 동작 유지.
- Modify `scripts/src/lib/subagents.ts` — 로컬 `readConfig` 삭제, 같은 방식으로
  교체. `resolveSubagentModel`이 여전히 throw하지 않는 것이 핵심.
- Modify `scripts/src/lib/session-graph.ts` — `readBouncerConfig`를 삭제하고
  `readConfig`로 교체. 이쪽은 `null`을 그대로 쓰므로 `?? {}`를 붙이지 않는다.
- Modify `scripts/src/lib/graphify.ts` — `readConfigSafe`를 삭제하고 `readConfig`로
  교체한다. 반환 계약(`null`)이 이미 같으므로 호출부는 그대로다.
- Modify `scripts/src/lib/init.ts` — `readConfigObject`를 삭제하고 `readConfig`로
  교체하되, 객체 여부 판정(`typeof === 'object'`, 배열 아님)은 호출 지점에
  남긴다. `inspectBootstrap`의 인라인 파싱도 `readConfig`를 거치게 하고,
  유효성 판정(`source_dirs` 배열, `verify`·`base_branch` 문자열)은 그대로 둔다.
- Modify `scripts/src/lib/verification.ts` — 인라인 `JSON.parse`를
  `readConfigResult`로 바꾸고, `reason`을 기존 오류로 매핑한다:
  `missing` → `VERIFY_CONFIG_MISSING`, `invalid` → `VERIFY_CONFIG_INVALID`.
  메시지 문자열과 `config.verify` 검사는 그대로 둔다.
- Create `scripts/lib/config.js` — 위 소스의 `tsc` emit.
- Modify `scripts/lib/cli.js` — emit.
- Modify `scripts/lib/subagents.js` — emit.
- Modify `scripts/lib/session-graph.js` — emit.
- Modify `scripts/lib/graphify.js` — emit.
- Modify `scripts/lib/init.js` — emit.
- Modify `scripts/lib/verification.js` — emit.

#### Constraints

- 옮기거나 새로 만드는 함수는 내부의 의미 있는 로직 블록(가드, 분기, 루프,
  누적, 조기 반환)마다 한국어 주석을 단다. 주석은 다음 줄이 이미 말하는
  *무엇*이 아니라 *왜*를 적는다 — 이 순서여야 하는 이유, 이 값을 거르는 이유,
  이 분기를 만들게 한 실패 사례, 의도적으로 하지 않은 선택. 특히 이 task에서는
  각 호출 지점이 `null`을 어떻게 받는지(`?? {}` 여부)와 그 이유를 호출 지점에
  적는다. 자명한 한 줄은 주석이 필요 없다.
- 실패 처리 의미를 뭉개지 않는다. `session-graph`의 `graphify.enabled` 판정과
  `init`의 승격 no-op 경로는 `null`을 구분해서 쓰고 있고, `verification`은 파일
  없음과 깨진 JSON을 서로 다른 오류로 던진다.
- `verification.ts`의 `readVerifyCommand` 경로는 이 task에서 계약이 바뀌지
  않는다. 바꾸는 것은 config를 읽는 방법뿐이고, `bouncer.verify` 해석 순서와
  `isValidVerifyCommand` 재사용은 그대로다.
- `config.ts`는 `node:fs`·`node:path`만 쓴다. 다른 `scripts/lib` 모듈을
  require하지 않는다(모두가 이 모듈을 부르므로 순환의 시작점이 되면 안 된다).
- 하위 호환 별칭(`readBouncerConfig`, `readConfigObject`)을 남기지 않는다.
- 공개 `module.exports` 키 집합은 각 모듈에서 그대로다. `config`는 새 모듈이다.
- 커밋 전에 `npm run build`로 emit을 갱신해 `scripts/lib`가 소스와 일치하게 한다.

### Task 002

#### Goal & intent

`cli.ts` 495줄이 명령군별 모듈로 나뉘고, `USAGE` 문자열이 명령 목록에서
파생된다. 지금은 `USAGE` 상수와 `switch` 분기가 서로를 모른 채 나열되어 있어,
명령을 추가하거나 지울 때 한쪽만 고쳐도 아무것도 막지 않는다. 각 명령이
「실행 함수 + 자기 사용법 블록」을 한 자리에 갖게 하면 그 어긋남이 구조적으로
불가능해진다.

출력은 바이트 단위로 동일해야 한다. `bouncer`, `bouncer help`, `bouncer --help`,
`bouncer -h`가 내는 문자열과 알 수 없는 명령의 stderr 동작이 전과 같다.

#### Interface

- 제공: `cli.ts`가 명령 레지스트리를 갖는다. 항목 하나는
  `{ run(rest, io): number, usage: string }` 형태이고, 키가 명령 이름이다.
  `USAGE`는 헤더 + 각 항목의 `usage` 블록 + 꼬리말을 이어 붙여 만든다.
  디스패치는 `switch`가 아니라 레지스트리 조회다.
- 거부: 레지스트리에 없는 명령은 지금과 같은 stderr 메시지와 종료 코드로
  거부한다. 명령 이름·플래그·별칭을 추가하거나 바꾸지 않는다.
- 제공: `module.exports = { runCli, parseFlags }` — 키 집합 그대로.

#### Touch

- Create `scripts/src/lib/cli-flags.ts` — `parseFlags`를 옮긴다.
- Create `scripts/src/lib/cli-doc-commands.ts` — `cmdValidate`, `cmdVerify`,
  `cmdScaffold`.
- Create `scripts/src/lib/cli-git-commands.ts` — `cmdCommit`, `cmdFinalize`,
  `cmdSeedWorktree`, `cmdImport`.
- Create `scripts/src/lib/cli-project-commands.ts` — `cmdInit`, `cmdGraphSync`,
  `cmdGraphifyBin`, `cmdProjectRoot`, `cmdMigrate`.
- Create `scripts/src/lib/cli-current-command.ts` — `cmdCurrent`(99줄)를 옮긴다.
- Modify `scripts/src/lib/cli.ts` — 레지스트리, `USAGE` 조립, `runCli`,
  `module.exports`만 남긴다.
- Create `scripts/lib/cli-flags.js` — emit.
- Create `scripts/lib/cli-doc-commands.js` — emit.
- Create `scripts/lib/cli-git-commands.js` — emit.
- Create `scripts/lib/cli-project-commands.js` — emit.
- Create `scripts/lib/cli-current-command.js` — emit.
- Modify `scripts/lib/cli.js` — emit.

#### Constraints

- 옮기거나 새로 만드는 함수는 내부의 의미 있는 로직 블록(가드, 분기, 루프,
  누적, 조기 반환)마다 한국어 주석을 단다. 주석은 다음 줄이 이미 말하는
  *무엇*이 아니라 *왜*를 적는다 — 이 순서여야 하는 이유, 이 값을 거르는 이유,
  이 분기를 만들게 한 실패 사례, 의도적으로 하지 않은 선택. 명령 핸들러는
  플래그 검증 순서와 종료 코드 선택 근거를 특히 남긴다. 파일이 나뉘면서 원래
  문맥에서 떨어지는 코드일수록 이 주석이 그 문맥을 대신한다.
- `USAGE` 출력이 문자 단위로 같아야 한다. 레지스트리 선언 순서가 현재 USAGE
  나열 순서이고, 디스패치는 키 조회라 순서에 의존하지 않는다.
- 명령 모듈은 `cli.ts`를 require하지 않는다(순환 금지). 공통 유틸이 필요하면
  `cli-flags.ts`에 둔다.
- 새 모듈은 상대 경로와 `node:` 내장만 require한다
  (`test/distribution.test.js`).
- 명령 핸들러 시그니처 `(rest, io) => number`를 유지한다.
- 커밋 전에 `npm run build`로 emit을 갱신한다.

### Task 003

#### Goal & intent

`validate.ts` 936줄이 네 개의 형제 모듈로 나뉜다. 지금 이 파일은 성격이 다른
네 가지를 함께 쥐고 있다 — 디스크에서 문서를 읽어 오는 일, 문서 하나의 구조를
보는 일(S 코드), 게이트별 조건을 판정하는 일(G 코드, `checkGate` 혼자 300줄이 넘음),
그리고 마크다운 본문에서 섹션과 경로를 뽑는 일. 게이트 판정을 고치는 사람과
프론트매터 스키마를 고치는 사람이 같은 파일을 놓고 다투지 않게 한다.

게이트 코드와 메시지 문자열은 하나도 바뀌지 않는다. `validateBlueprint`의
반환 형태(`failures[]`의 `code` / `message` / `file`)도 그대로다.

#### Interface

- 제공: `scripts/lib/validate.js`의 `module.exports` 키 집합이 지금과 동일하게
  유지된다 — `loadBlueprintDocs`, `resolveTaskUnit`, `checkStructural`,
  `checkGate`, `validateBlueprint`, `parseTasksSections`, `parseSections`,
  `extractPathCandidates`. 구현이 다른 파일로 가더라도 `validate.js`가 배럴로
  재수출한다.
- 거부: 게이트 코드(G1~G18)와 구조 코드(S1~S20)의 추가·삭제·의미 변경,
  실패 메시지 문자열 변경, `failures` 엔트리 형태 변경.

#### Touch

- Create `scripts/src/lib/validate-docs.ts` — `defaultStagedFiles`,
  `readOptionalLeaf`, `loadBlueprintDocs`, `resolveTaskUnit`, `unitLeafRel`,
  `blueprintDocsExist`, `statusOf`. 디스크에서 문서를 모아 오는 층.
- Create `scripts/src/lib/validate-sections.ts` — `SECTION_DEFS`,
  `VERIFY_SECTION_DEFS`, `REVIEW_SECTION_DEFS`, `REVIEW_SEVERITY`,
  `REVIEW_STATUS`, `EXPLAIN_SECTION_HEADINGS`, `TODO_RE`, `stripComments`,
  `parseSections`, `parseTasksSections`, `extractPathCandidates`,
  `pathsOverlap`, `pathJustifiedByTouch`, `collectFindingFailures`. 본문 파싱 층.
- Create `scripts/src/lib/validate-structural.ts` — `expectedTypeForPath`,
  `checkStructural`, `GRAPH_BASIS_STATUS`, `GRAPH_BASIS_GRAPH`,
  `isValidGraphBasis`. 문서 하나를 보는 S 코드 층.
- Create `scripts/src/lib/validate-gates.ts` — `checkGate`. 게이트별 G 코드 층.
- Modify `scripts/src/lib/validate.ts` — `validateBlueprint` 오케스트레이션과
  배럴 재수출만 남긴다.
- Create `scripts/lib/validate-docs.js` — emit.
- Create `scripts/lib/validate-sections.js` — emit.
- Create `scripts/lib/validate-structural.js` — emit.
- Create `scripts/lib/validate-gates.js` — emit.
- Modify `scripts/lib/validate.js` — emit.

#### Constraints

- 옮기거나 새로 만드는 함수는 내부의 의미 있는 로직 블록(가드, 분기, 루프,
  누적, 조기 반환)마다 한국어 주석을 단다. 주석은 다음 줄이 이미 말하는
  *무엇*이 아니라 *왜*를 적는다 — 이 순서여야 하는 이유, 이 값을 거르는 이유,
  이 분기를 만들게 한 실패 사례, 의도적으로 하지 않은 선택. 게이트 분기는
  「이 코드가 왜 이 게이트에서만 걸리는가」와 폐기된 번호(G9·G15)를 왜 비워
  두는지를 남긴다. 파일이 나뉘면서 원래 문맥에서 떨어지는 코드일수록 이 주석이
  그 문맥을 대신한다.
- `validateBlueprint`는 `validate.ts`에 남긴다. 이 함수 안의 레거시 `.sdd`
  문자열이 `test/public-name-regression.test.js` allowlist에 파일명으로
  고정되어 있어, 다른 파일로 옮기면 그 테스트가 깨진다.
- 순환 금지. 의존 방향은 한쪽으로만 흐른다:
  `validate` → `validate-gates` → `validate-structural` → `validate-sections`,
  그리고 `validate-gates` / `validate-structural` → `validate-docs`.
  하위 모듈이 `validate.ts`를 require하면 안 된다.
- `isValidGraphBasis`는 계속 단일 구현이다. S9(구조)와 G4(plan)가 같은 헬퍼를
  봐야 두 경로가 다른 답을 내지 않는다. 이 헬퍼는 `validate-structural.ts`에
  두고 `validate-gates.ts`가 가져다 쓴다 — 위 의존 방향의
  `validate-gates → validate-structural` 간선이 바로 이것이다. 게이트 층에서
  같은 판정을 다시 구현하지 않는다.
- 하위 디렉터리를 만들지 않는다. 평평한 형제 파일로만 나눈다
  (emit 기준 상대 경로 불변식).
- 새 모듈은 상대 경로와 `node:` 내장만 require한다.
- 커밋 전에 `npm run build`로 emit을 갱신한다.

### Task 004

#### Goal & intent

`session-graph.ts`(481줄)와 `import-history.ts`(522줄)가 각각 세 모듈로 나뉜다.
두 파일 모두 같은 모양의 문제를 갖는다 — 「무엇을 할지 정하는」 순수 계산과
「실제로 `graphify`/`git`을 부르고 파일을 쓰는」 부수효과가 한 파일에 섞여
있다. 경계를 파일로 그으면 어느 함수가 주입 가능한 `deps` 없이도 안전한지가
읽는 것만으로 드러난다.

계획 결과 객체의 필드, 그래프 상태 어휘(`updated` / `reused` / `fail-skip` /
`skip-disabled` / `missing`), 임포트 거부 사유는 그대로다.

#### Interface

- 제공: `scripts/lib/session-graph.js`와 `scripts/lib/import-history.js`의
  `module.exports` 키 집합이 지금과 동일하다. 구현이 옮겨 가더라도 두 파일이
  배럴로 재수출한다. `hooks/session-graph.js`가 이 이름으로만 접근한다.
- 제공: 두 파일이 공유하는 TypeScript 타입은 `scripts/src/lib/import-types.ts`에
  모은다(`ImportPlan`, `ImportEntry`, `RawCommit`, `ImportError` 등 현재
  `import-history.ts` 상단에 선언된 것들).
- 거부: 그래프 상태 어휘·경로 정규화 결과·`graphSyncWarnings` 문구 변경,
  임포트 커밋 메시지 조립 방식 변경, 새 CLI 표면.

#### Touch

- Create `scripts/src/lib/graph-scope.ts` — `SCAN_EXCLUDED_DIRS`,
  `DEFAULT_SOURCE_OUT`, `DEFAULT_CONTEXT_OUT`, `DEFAULT_CONTEXT_DIRS`,
  `realGraphifyEnabled`, `realSourceDirs`, `realContextDirs`,
  `realExistingDirs`, `newestMtimeUnder`, `realNewestMtime`, `realGraphMtime`,
  `resolveGraphScopes`. 어떤 범위가 최신인지 판정하는 층 — 파일시스템 읽기만
  한다.
- Create `scripts/src/lib/graph-exec.ts` — `realHasGraphify`, `graphifyOutEnv`,
  `partOutDir`, `runGraphifyUpdate`, `normalizeGraphPaths`, `defaultExecGraphify`.
  실제로 graphify를 부르고 결과 경로를 되돌리는 층. `realHasGraphify`가 여기
  있는 이유는 `resolveGraphifyBin`의 PATH 탐색이 `execFileSync('graphify',
  ['--version'])`를 돌리기 때문이다 — 이름은 판정처럼 보이지만 프로세스를
  띄운다.
- Modify `scripts/src/lib/session-graph.ts` — `planOneGraph`, `planSessionGraph`,
  `NO_GRAPH_WORK`, `syncSessionGraphs`, `graphSyncWarnings`와 배럴 재수출.
- Create `scripts/src/lib/import-types.ts` — 세 임포트 모듈이 공유하는 타입 선언.
  `tsconfig`가 `moduleDetection: force`라 모든 `.ts`가 모듈이므로, 소비자는
  `import type { … } from './import-types';`로 가져온다. 런타임 값 참조는 지금처럼
  `require`로 남긴다. 타입만 있는 파일이므로 emit은 빈 exports 스텁이다 —
  그래도 커밋되는 산출이라 `affected_paths`에 넣는다.
- Create `scripts/src/lib/import-git.ts` — `LOG_FORMAT`, `EPIC_ID_PREFIX_RE`,
  `slugFromSubject`, `parseLogOutput`, `gitLogArgs`, `listChangedFiles`.
  git 로그를 읽고 파싱하는 층.
- Create `scripts/src/lib/import-render.ts` — `renderEpicBody`,
  `renderBlueprintBody`, `writeImportDoc`. 문서 본문을 만드는 층.
- Modify `scripts/src/lib/import-history.ts` — `emptyPlan`, `nextEpicId`,
  `collectRefusals`, `planImport`, `failResult`, `applyImport`와 배럴 재수출.
- Create `scripts/lib/graph-scope.js` — emit.
- Create `scripts/lib/graph-exec.js` — emit.
- Modify `scripts/lib/session-graph.js` — emit.
- Create `scripts/lib/import-types.js` — emit.
- Create `scripts/lib/import-git.js` — emit.
- Create `scripts/lib/import-render.js` — emit.
- Modify `scripts/lib/import-history.js` — emit.

#### Constraints

- 옮기거나 새로 만드는 함수는 내부의 의미 있는 로직 블록(가드, 분기, 루프,
  누적, 조기 반환)마다 한국어 주석을 단다. 주석은 다음 줄이 이미 말하는
  *무엇*이 아니라 *왜*를 적는다 — 이 순서여야 하는 이유, 이 값을 거르는 이유,
  이 분기를 만들게 한 실패 사례, 의도적으로 하지 않은 선택. 특히 그래프 신선도
  판정에서 파생 트리(`graphify-out`)를 왜 걷지 않는지, 임포트 거부 검사가 왜
  첫 쓰기 앞에 전부 모여 있어야 하는지를 남긴다.
- 부수효과 경계를 흐리지 않는다. `graph-scope.ts`는 읽기(`fs.stat`,
  `existsSync`)만 하고 외부 프로세스를 부르지 않는다 — `graphify.ts`도
  require하지 않는다(그 모듈의 PATH 탐색이 프로세스를 띄운다). 프로세스 실행은
  `graph-exec.ts`에만 둔다.
- `import-git.ts`의 git 호출은 지금처럼 주입된 `deps.execFileSync`를 통해서만
  한다. 모듈 안에서 직접 `child_process`를 부르지 않는다.
- 그래프 부재는 오류가 아니라 상태다. `syncSessionGraphs`가 `NO_GRAPH_WORK`
  경로에서 `ok`를 뒤집지 않는 동작을 유지한다.
- 순환 금지: `graph-exec` / `graph-scope`는 `session-graph`를 require하지 않고,
  `import-git` / `import-render`는 `import-history`를 require하지 않는다.
- 하위 디렉터리를 만들지 않는다. 평평한 형제 파일로만 나눈다.
- 커밋 전에 `npm run build`로 emit을 갱신한다.
