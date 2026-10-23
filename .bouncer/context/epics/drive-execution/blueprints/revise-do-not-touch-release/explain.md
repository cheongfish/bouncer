---
type: bouncer.explain
title: revise-do-not-touch-release explain
description: Explain for revise-do-not-touch-release
resource: .bouncer/context/epics/drive-execution/blueprints/revise-do-not-touch-release/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-23T20:45:37.117+09:00'
bouncer:
  id: EXPLAIN-revise-do-not-touch-release
  epic_id: drive-execution
  blueprint_id: revise-do-not-touch-release
  status: published
  comprehension:
    - range_from: 1cf7b9a04858d2dba4738b76a6d70a48c822883a
      range_to: 708546db29f5380b00868355127a3fe65bbd9749
      diff_sha: 2c7ea6251e346fd5137623278235677c5bbff1724a0930fa02d2c7748effdc39
      recorded_at: '2026-10-23T20:46:52.088+09:00'
  task_commits:
    - task: drive-execution/revise-do-not-touch-release/001
      sha: 708546db
      intent_anchor: task-001
---
# Explain

## Background

`coordinate revise`는 task의 승인 범위(`affected_paths`)를 넓힐 때 쓴다. 그런데 범위를 넓혀도 같은 task brief의 `## Do not touch`에 그 경로가 남아 있으면, worker는 "수정해도 된다"와 "수정 금지"라는 모순된 지시를 함께 받는다. 실제로 runtime-packaging 작업에서 `packages/cli/bin/bouncer` 등을 revise로 추가한 뒤에도 Do not touch에 같은 경로가 남아 worker가 blocked를 보고했다.

이제 revise는 새로 추가된 경로와 겹치는 Do not touch 항목을 그대로 두고 통과시키지 않는다. 겹치는 항목은 `--release-do-not-touch <p>`로 하나씩 명시해야 하고, 명시한 항목은 범위 개정과 같은 쓰기에서 본문에서도 지워진다.

## Code

- `packages/cli/src/scope.ts`의 `reviseTaskScope`: 판정 순서는 기존 검사 뒤에 `release-do-not-touch-unknown`, `scope-do-not-touch-conflict`를 거쳐 문서를 쓴다. 거절 시 문서와 원장은 바이트가 그대로다.
- 같은 파일의 `doNotTouchLines` 일대: Do not touch 절의 줄을 찾아 해제 토큰을 지운다. 해제 후 경로가 하나도 남지 않은 줄은 줄째 지우고, 경로 없는 산문 금지 줄은 건드리지 않는다.
- `packages/cli/src/cli-git-commands.ts`: `--release-do-not-touch` 수집과 값 없는 플래그의 usage(2) 거절.
- `packages/cli/src/coordinator-commands.ts`, `cli-usage.ts`, `rules/cli.md`, `references/coordinator-cards/revise.md`: 두 거절 코드의 힌트와 사용법.
- 알려진 한계: 이 구현은 HTML 주석이 든 줄을 판정에서 제외한다. 그래서 인라인 주석이 붙은 Do not touch 항목은 충돌로 잡히지 않을 수 있고, 한 줄에서 주석이 닫혔다 다시 열리는 경우 주석 안쪽 줄을 편집할 수 있다. 사용자가 위험을 수용했고 후속 계획에서 다룬다.
- 코드 펜스 안의 줄도 Do not touch 절 줄이면 판정 대상이다.

## Quiz

1. 새 경로 `src/session/`을 추가하는 revise에서 Do not touch에 `src/session/`이 있고 해제 플래그가 없으면 어떻게 되는가?
   - 가. 경고만 내고 범위 개정을 통과시킨다.
   - 나. `scope-do-not-touch-conflict`로 거절하고 문서·원장은 그대로 둔다.
   - 다. Do not touch 항목을 자동으로 지우고 통과시킨다.
2. `--release-do-not-touch README`를 주었는데 `README`가 Do not touch에 없거나 새 경로와 겹치지 않으면?
   - 가. `release-do-not-touch-unknown`으로 거절한다.
   - 나. 아무 일도 하지 않고 통과시킨다.
   - 다. `scope-do-not-touch-conflict`로 거절한다.
3. 해제한 토큰이 `` - `docs/keep.md`, `src/session/` — 다른 task 소유 `` 줄에서 지워지면 그 줄은?
   - 가. `` - `docs/keep.md` — 다른 task 소유 ``로 남는다(`, `도 함께 정리).
   - 나. 줄 전체가 지워진다.
   - 다. 줄이 그대로 남고 해제 내역만 원장에 기록된다.
4. 어떤 줄이 `` - `src/session/` — 중복 표기 ``이고 해제하면 그 줄에 경로가 하나도 남지 않을 때?
   - 가. 빈 항목 `- — 중복 표기`로 남는다.
   - 나. 줄 전체가 지워진다.
   - 다. 거절된다.

## Tasks

### drive-execution/revise-do-not-touch-release/001 · `708546db`

#### Goal & intent

`coordinate revise`가 새 scope 경로와 겹치는 `## Do not touch` 항목을 그대로 두고 revision을 올리는 일을 막는다. 겹치는 항목은 `--release-do-not-touch <p>`로 하나씩 명시해야 하고, 명시한 항목은 frontmatter 갱신과 같은 파일 쓰기에서 본문에서 지운다. 수용 기준은 blueprint Contract 1–5이고 완료 명령은 `node --test test/commit-task.test.js test/cli-coordinate.test.js test/cli-help.test.js`다.

#### Current behavior

- `reviseTaskScope`(`packages/cli/src/scope.ts:781`)는 glob(`:797`) → 잠금 안 lease 검사(`:806`) → task 문서 읽기(`:816`) → out-of-bounds(`:831`) → integration HEAD 추적 검사(`:839-850`) → `owns()` 확인(`:858`) 뒤 `bouncer.affected_paths`·`scope_revision`만 고쳐 `fs.writeFileSync(docAbs, renderDoc(doc.data, doc.body))`(`:860-862`)로 쓴다. 본문 `doc.body`는 손대지 않는다.
- 원장 decision은 `{ task, kind: 'scope', reason, previous, next, revision }`(`:864-871`)이고 성공 결과는 `{ ok, revision, previous, paths, revoked?, warnings? }`(`:928-938`)다. `runtime-state.ts`의 원장 검증은 repair decision만 shape를 강제한다(`packages/cli/src/runtime-state.ts:267`).
- Do not touch 절은 런타임이 강제하지 않는다. 제목 규칙은 `validate-sections.ts:27`(`Do not touch`·`절대 수정 금지`), 경로 토큰 추출은 `extractPathCandidates`(`validate-sections.ts:217`), 겹침 판정은 `path-overlap.ts`의 `pathsOverlap`(scope.ts가 이미 `:17`에서 import)다.
- CLI `coordinateRevise`(`packages/cli/src/cli-git-commands.ts:714`)는 fence 확인 뒤 `collectPathValues`(`:354`)로 `--paths`·`--new-path`를 모아 넘기고, 거절은 `withCoordinateFailureHints` JSON을 stdout에, `coordinate revise: <reason>`을 stderr에 낸다(`:745-750`). 값 없는 `--new-path`는 `checkCommandFlags`가 usage(2)로 막는다(`:669-675`).
- 거절 힌트 표는 `packages/cli/src/coordinator-commands.ts:1657-1710`에 revise 전용 코드를 둔다.
- usage는 `packages/cli/src/cli-usage.ts:17`(coordinate 전체)와 `:56`(`revise`)에 있다. 문서는 `rules/cli.md:232`(명령 형식)·`:376-380`(거절 JSON), `references/coordinator-cards/revise.md`에 있다.
- 재현: runtime-packaging TASKS-003에서 `packages/cli/bin/bouncer`·`packages/cli/bin/bouncer-root`를 revise로 추가한 뒤에도 같은 brief의 Do not touch에 두 경로가 남아 worker가 blocked를 보고했다.
- 기존 테스트: `test/commit-task.test.js:594`(revise 단위, `coordinatorFixture` `:582`), `test/cli-coordinate.test.js:110`(`revise` 헬퍼, 실제 cwd 이동), `:441`(거절 코드별 JSON 형식), `:1585`(값 없는 `--new-path` exit 2와 문서 보존), `test/cli-help.test.js:330`(subcommand usage 접두).

#### Target behavior

- 성공:
  - 충돌 항목이 없고 해제 플래그도 없으면 지금과 같은 문서·원장·stdout을 낸다(`releasedDoNotTouch` 키 없음).
  - 해제 목록이 충돌 집합과 같으면 frontmatter와 본문을 한 번에 쓴다. 본문 편집은 Do not touch 절 안에서 해제 토큰이 나온 줄에만 적용한다.
    - 그 줄의 해제 토큰 출현을 모두 지운다. 백틱으로 감싼 출현(`` `p` ``)과 앞뒤가 공백·`,`·`;`·줄 경계인 민 단어 출현이 대상이다.
    - 지운 출현 바로 뒤에 `, `가 있으면 함께 지우고, 없고 바로 앞에 `, `가 있으면 그것을 지운다.
    - 편집한 줄에 `extractPathCandidates` 결과가 하나도 남지 않으면 그 줄을 지운다. 해제 토큰이 없던 줄(경로 없는 산문 금지 줄 포함)은 바이트 그대로 둔다.
    - Do not touch 절이 여러 개면(같은 제목 반복 또는 영문·한국어 제목 공존) 모든 절이 충돌 판정과 편집 대상이다. decision과 성공 결과에 `releasedDoNotTouch: [...]`(입력 순서, 중복 제거)를 둔다.
- 실패(문서·원장 바이트 불변, exit 1, stdout JSON에 `paths`·`cause`·`next`):
  - 해제되지 않은 충돌 항목이 남으면 `scope-do-not-touch-conflict`, `paths`는 남은 충돌 토큰이다.
  - 충돌 항목이 아닌 해제 값(Do not touch에 없거나, 있어도 새 경로와 겹치지 않음)이 있으면 `release-do-not-touch-unknown`, `paths`는 그 값이다. 두 조건이 함께면 `release-do-not-touch-unknown`을 먼저 낸다.
  - 값 없는 `--release-do-not-touch`는 usage(2)다.
- 보존: 기존 거절 코드와 판정 순서, 잠금 재확인(`owns()` 두 번), scope-conflict lease revoke, `scope-paths-dropped` 경고, `--paths` 전체 교체 의미, Touch 절 내용.

#### Interface

- 제공:
  - CLI: `bouncer coordinate revise ... [--release-do-not-touch <p>]...`
  - 함수: `reviseTaskScope({ repoRoot, blueprint, task, paths, newPaths?, reason, exec?, releaseDoNotTouch? })`. `releaseDoNotTouch`는 `unknown`으로 받아 비어 있지 않은 문자열만 쓴다.
  - 성공 결과 추가 키: `releasedDoNotTouch?: string[]`. 원장 scope decision 추가 키도 같은 이름이다.
  - 힌트 표 항목: `scope-do-not-touch-conflict`, `release-do-not-touch-unknown`.
- 용어:
  - 새 경로: 정규화(`./` 제거, 끝 `/` 제거)한 `next` 가운데 정규화한 `previous`에 정확히 같은 값이 없는 경로. 예: previous `['src/auth/']`, next `['src/auth/', 'src/session/']` → 새 경로 `src/session/`.
  - 충돌 토큰: Do not touch 절의 `extractPathCandidates` 결과 중 새 경로 하나 이상과 `pathsOverlap`이 참인 토큰. 예: 토큰 `src/session/`, 새 경로 `src/session/token.ts` → 충돌.
  - 해제 값 비교는 토큰과 같은 정규화(`toPosix`, 앞 `./` 제거) 뒤 문자열 일치다.
- 거부:
  - 즉시 usage(2): 값 없는 `--release-do-not-touch` 발생.
  - 판정 거절(exit 1, 바이트 불변): `release-do-not-touch-unknown`, `scope-do-not-touch-conflict`. 기존 거절은 그대로 앞선다.
  - 해제는 scope를 넓히지 않는다. `--paths`·`--new-path` 없이 해제만 주면 기존 `scope-paths-required`다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/scope.ts` | `reviseTaskScope`, `신규 추출 지점: Do not touch 절 토큰 해제 편집` | Modify | scope 판정 뒤 frontmatter·원장만 갱신(`:781-940`) | 충돌 판정과 해제 검증을 문서 쓰기 전에 넣고, 본문 편집을 같은 `writeFileSync`에 싣고, decision·결과에 `releasedDoNotTouch` 추가 | 쓰기 지점 `scope.ts:860-862`, decision `:864-871`, 결과 `:928-938` |
| `packages/cli/src/cli-git-commands.ts` | `coordinateRevise`, `checkCommandFlags` | Modify | `--paths`·`--new-path` 수집과 값 없는 `--new-path` usage 거절 | `--release-do-not-touch` 수집·전달과 값 없는 발생 usage(2) 거절 | `cli-git-commands.ts:669-675`, `:737-744` |
| `packages/cli/src/coordinator-commands.ts` | revise 거절 힌트 표 | Modify | revise 전용 거절 코드의 `cause`·`next` | 두 코드 항목 추가(각 `cause`에 `Do not touch`, `next`에 `--release-do-not-touch` 문자열 포함), 표 머리 주석의 개수 갱신 | `coordinator-commands.ts:1657-1710`; 힌트 없는 코드는 fallback이 된다(`:1657` 주석) |
| `packages/cli/src/cli-usage.ts` | `coordinate`, `revise` usage 문자열 | Modify | revise 형식과 의미 안내 | 플래그 형식과 한 줄 의미, 두 거절 코드(`scope-do-not-touch-conflict`, `release-do-not-touch-unknown`) 이름과 조건 추가 | `cli-usage.ts:17`, `:56` |
| `rules/cli.md` | revise 명령 형식·거절 문단 | Modify | revise 형식과 거절 JSON 설명 | 플래그 형식과 두 거절 코드 설명 추가 | `rules/cli.md:232`, `:376-380` |
| `references/coordinator-cards/revise.md` | revise 카드 | Modify | revise 호출 규칙 | Do not touch와 겹치면 해제 플래그로 명시해야 한다는 규칙과, 두 거절 코드 이름 및 각 거절 뒤 할 일을 담은 한 항목 추가(카드 전용, coordinator 역할 문서는 그대로) | coordinator가 revise 직전에 읽는 카드(`coordinate-next.ts:954`); 카드 링크 계약 테스트 대상 아님(`test/doc-shape-cli.test.js:194`, `:230-236`) |
| `test/commit-task.test.js` | revise 단위 테스트 | Modify | reviseTaskScope 성공·append-only·축소 경고 고정(`:594`) | 충돌 거절·unknown 거절·해제 성공·기존 무충돌 바이트 보존 사례 추가 | `coordinatorFixture` `:582`가 worker 문서를 다시 쓸 수 있음 |
| `test/cli-coordinate.test.js` | revise CLI 테스트 | Modify | revise 거절 JSON·usage 고정(`:441`, `:1585`) | 새 거절 코드 JSON(`paths`·`cause`·`next`)과 값 없는 플래그 exit 2 사례 추가 | `revise` 헬퍼 `:110`, 거절 형식 표 `:441-462` |
| `test/cli-help.test.js` | coordinate help 테스트 | Modify | subcommand usage 접두 고정(`:330`) | `coordinate revise --help`가 `--release-do-not-touch`를 포함한다는 단언 추가 | `cli-help.test.js:324-342` |

#### Constraints

- 판정 순서는 기존 glob → lease → 문서 읽기 → out-of-bounds → 추적 검사 → (신규) unknown → conflict → `owns()` → 문서 쓰기다. 거절은 어떤 파일도 쓰지 않는다.
- 본문 편집 범위는 Do not touch 절(제목 줄 다음부터 다음 `## ` 제목 앞까지)뿐이다. 다른 절과 HTML 주석, 제목 줄은 바이트 그대로 둔다.
- 해제가 없을 때 성공 결과와 decision에 새 키를 만들지 않는다(기존 테스트 `test/commit-task.test.js:612`의 키 부재 단언 방식과 같음).
- scope.ts가 `validate-sections`를 import해도 `test/dependency-boundaries.test.js`가 통과해야 한다. 실패하면 제목 정규식과 토큰 추출을 scope.ts 안에 두고 같은 규칙을 주석으로 연결한다.
- 기존 단언은 바꾸지 않는다. 새 사례만 추가한다.
- 사용자 대면 문자열(help·힌트·rules·카드)은 기존 문서처럼 영어로 쓰고, 테스트 이름과 주석은 각 파일 관례를 따른다.

### drive-execution/revise-do-not-touch-release/002

#### Goal & intent

TASKS-001이 통합된 integration worktree에서 `npm run ci`가 통과해 blueprint 수용 기준 1–5와 기존 계약(lint·typecheck·check:emit·coverage·테스트 이름 규칙)이 함께 성립함을 증명한다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.