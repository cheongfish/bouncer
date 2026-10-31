---
type: bouncer.explain
title: intent-revision-lookup explain
description: Explain for intent-revision-lookup
resource: .bouncer/context/epics/context-search/blueprints/intent-revision-lookup/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-11-01T00:58:56.005+09:00'
bouncer:
  id: EXPLAIN-intent-revision-lookup
  epic_id: context-search
  blueprint_id: intent-revision-lookup
  status: published
  comprehension:
    - range_from: 25352b5901b0bc5b66a21223a991209dae87828f
      range_to: 5f0c9f495def74dc25053a78730bd91a858634a6
      diff_sha: a1c2680da638b1437bc44a3648ff8a3a21e984a9e541a6822cbbe70e28bbb2f2
      recorded_at: '2026-11-01T00:59:37.960+09:00'
  task_commits:
    - task: context-search/intent-revision-lookup/001
      sha: 5b48ecd2
      intent_anchor: task-001
    - task: context-search/intent-revision-lookup/002
      sha: c0f20a9a
      intent_anchor: task-002
    - task: context-search/intent-revision-lookup/003
      sha: c37ce7b3
      intent_anchor: task-003
    - task: context-search/intent-revision-lookup/004
      sha: c72d5e70
      intent_anchor: task-004
    - task: context-search/intent-revision-lookup/006
      sha: 5f0c9f49
      intent_anchor: task-006
---
# Explain

## Background

기존 `intent` 조회는 작업 트리의 함수 정의와 Explain 문서를 읽고, revision 없이 blame/log를 실행했다. 그래서 리뷰 대상 변경이 자기 Explain을 근거로 삼는 경로를 막을 수 없었다. 이번 변경은 `history_ref`로 받은 SHA 하나의 트리만 읽는 내부 API를 더한다. 같은 SHA면 작업 트리·HEAD·디스크 문서를 바꿔도 결과가 같고, SHA를 바꾸면 그 SHA의 내용대로 바뀐다. 공개 CLI와 기존 작업 트리 조회(`resolveSymbol`, `resolveIntentProvenance`)는 그대로다. 소비자인 `intent` 하위 명령은 다음 blueprint 몫이다.

## Code

- `packages/cli/src/symbol-index.ts`: `listDefinitionsInText({ path, bytes })`가 이름 필터 없이 한 파일의 모든 지원 함수 정의를 열거한다. 파일 시스템과 Git을 읽지 않는 순수 함수이고, 결과는 문자열 비교(`<`)로 정렬한다. 익명 함수는 `qualified_name`을 만들 수 없어 정의로 올리지 않는다. 본문 BOM은 지우지 않는다. 문자열 키 멤버(`'a.b'() {}`)는 중첩 경로와 구분되지 않는데, 기존 `resolveSymbol`과 같은 표현을 따른 한계다.
- `packages/cli/src/intent-revision.ts`: 고정 SHA 트리에서 blob·Explain·registry를 읽는 경계다. 파일 상태는 `parsed | unsupported | parse_failed | absent` 중 하나다. 빈 파일은 정의 0개의 `parsed`이고 구문 실패는 `parse_failed`라 서로 섞이지 않는다. Git 호출은 `spawnSync` 래퍼 하나를 거치며 환경 변수를 고정한다. 출력이 `maxBuffer`를 넘으면 잘린 값 대신 오류를 던진다. `readRegistryAt`는 `parseEpicRegistry` 결과 전체를 돌려주므로 소비자는 `.registry.registry`를 읽는다.
- `packages/cli/src/intent-provenance.ts`: `resolveIntentAtRevision`은 고정 SHA의 정의, blame/log, Explain, registry로 후보 근거를 만든다. 결과는 `canonicalJson` 기준으로 같은 바이트를 내고 `digest`는 `digest`를 뺀 객체의 `sha256Canonical`이다. `git log -G`에는 `qualified_name`의 마지막 세그먼트(bare 이름)를 넘긴다. `expandShaAmong`은 짧은 SHA를 도달 가능한 커밋 집합에서 확장한다.
- 알려진 한계(위험 수용): 고정 SHA 조회가 작업 트리 `.gitattributes`를 막으려고 쓰는 `GIT_ATTR_SOURCE`는 Git 2.40 이상에서만 적용된다. 더 오래된 Git은 조용히 무시하고 버전 검사가 없다.
- `package.json`: `verify:files`(빌드 뒤 지정 테스트 실행)와 `verify:bp`(전체 검증)를 더했다.

## Quiz

1. 같은 `history_ref`로 `resolveIntentAtRevision`을 부른 뒤 작업 트리의 Explain 문서를 고쳐 다시 부르면 결과는?
   - A) 고친 내용이 반영된다
   - B) 같은 바이트가 나온다
   - C) `unlinked`로 바뀐다
2. 대상 SHA에 파일이 없을 때 `listDefinitionsAtRevision`의 상태는?
   - A) `absent`
   - B) `parse_failed`
   - C) 같은 이름의 다른 파일 정의로 대체
3. 내용이 비어 있는 지원 파일을 열거하면?
   - A) `parse_failed`
   - B) `unsupported`
   - C) 정의 0개의 `parsed`
4. `ref`에 `HEAD`나 브랜치 이름을 주면?
   - A) 현재 커밋으로 풀어서 조회한다
   - B) 호출 오류로 던진다
   - C) `unlinked`를 돌려준다
5. 이름 없는 함수 표현식은 `listDefinitionsInText`에서?
   - A) 정의로 올리지 않는다
   - B) `anonymous`라는 이름으로 올린다
   - C) `parse_failed`로 처리한다

## Tasks

### context-search/intent-revision-lookup/001 · `5b48ecd2`

#### Goal & intent

`bouncer.verify`는 셸 연산자를 받지 못하는 단일 실행 명령이다(`bouncer scaffold task --verify "a && b"`가 `verification verify must be a single executable command`로 거절됨). `package.json`에 스크립트 둘을 더해 task 전용 검증(`npm run verify:files -- <테스트 파일>...`)과 blueprint 종단 검증(`npm run verify:bp`)을 단일 argv로 쓸 수 있게 한다. 수용 기준은 Target behavior의 성공·실패·보존 항목이고, 검증 명령은 frontmatter `verify`다.

#### Current behavior

- 입력/상태/출력: `package.json`의 `scripts`에는 `build`, `test`(= `node --test test/*.test.js`), `pretest`(= `npm run build`), `typecheck`, `lint`, `lint:docs`, `check:emit`이 있고, 이를 한 명령으로 묶은 스크립트는 `verify:strict`(test + typecheck + lint)와 `verify:security`뿐이다. `lint:docs`와 `check:emit`을 포함하는 묶음은 `ci`뿐인데 `ci`는 coverage, versions, audit까지 돈다.
- 재현: `npm run verify:files`를 실행하면 `Missing script: "verify:files"`로 실패한다. 확인한 명령: `npm run verify:strict`가 존재한다(`package.json:52`).
- I/O 관찰 지점: 스크립트 선언은 `package.json:37-54`의 문자열이다. npm은 `--` 뒤 인자를 스크립트 문자열 끝에 붙인다(`npm run a -- x y`는 `<a의 본문> x y`).

#### Target behavior

- 성공: `npm run verify:files -- <test/x.test.js>...`는 `npm run build`를 실행한 뒤 `node --test <넘긴 파일>`을 실행하고, 테스트가 통과하면 exit 0이다. `npm run verify:bp`는 `npm test`(pretest가 build를 먼저 실행), `npm run typecheck`, `npm run lint`, `npm run lint:docs`, `npm run check:emit`을 이 순서로 실행하고 하나라도 실패하면 거기서 멈추며 non-zero다.
- 실패: 빌드가 실패하면 테스트를 실행하지 않는다. 존재하지 않는 테스트 파일을 넘기면 non-zero다.
- 보존: 기존 스크립트(`test`, `pretest`, `ci`, `verify:strict`, `verify:security`, `check:emit` 등)의 본문은 바뀌지 않는다. `test/ci-contract.test.js`가 읽는 키(`check:emit`, `check:versions`, `sync:versions`, `lint:docs`, `lint:context-comments`, `test`, `test:coverage`, `test:unit`, `test:integration`, `ci`)도 그대로다.

#### Interface

- 제공: `package.json` `scripts`에 두 키를 추가한다.
  ```json
  "verify:files": "npm run build && node --test",
  "verify:bp": "npm test && npm run typecheck && npm run lint && npm run lint:docs && npm run check:emit"
  ```
  `verify:files`는 테스트 파일을 `--` 뒤 인자로 받는다(예: `npm run verify:files -- test/a.test.js test/b.test.js`). `verify:bp`는 인자를 받지 않는다.
- 거부 (throw): 인자 없이 `npm run verify:files`를 실행하면 `node --test`가 `test/` 전체를 찾는 기본 동작을 하므로, task 문서는 항상 파일을 넘긴다. 이 스크립트가 인자를 검사하지는 않는다.
- fallback: 없다. 스크립트 실패는 그대로 non-zero로 올라온다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `package.json` | `scripts.verify:files`, `scripts.verify:bp` | Modify | 빌드 뒤 지정 테스트를 돌리는 단일 argv 스크립트와 BP 종단 검증 묶음이 없음 | 위 두 스크립트 추가 | 진입점은 `package.json:37-54`. 소비자 조사: `rg "verify:strict" --glob '!node_modules'`가 `package.json`과 `packages/cli/vendor/README.md:22`(verify:security)만 가리키며 `test/ci-contract.test.js:114-157`은 위에 적은 키만 읽는다 |

#### Constraints

- 추가하는 키는 `verify:files`, `verify:bp` 둘뿐이다. `bin`, `engines`, `workspaces`, `devDependencies`는 바꾸지 않는다.
- `verify:bp`는 build를 따로 적지 않는다. `npm test`의 `pretest`가 build를 실행하므로 한 번만 빌드한다.
- 문서(`README.md`, `rules/`)에 두 스크립트를 소개하는 변경은 이 task에 넣지 않는다.

### context-search/intent-revision-lookup/002 · `c0f20a9a`

#### Goal & intent

`symbol-index`에 파일 하나의 본문만 받아 모든 지원 함수 정의를 열거하는 순수 함수 `listDefinitionsInText`를 더한다. 구문 실패와 지원 불가를 정의 없음과 구분해 돌려준다. 수용 기준은 아래 Target behavior의 세 상태와 보존 항목이며, 검증 명령은 frontmatter `verify`다.

#### Current behavior

- 입력/상태/출력: `resolveSymbol({repoRoot, symbol})`만 정의를 낸다. `Collector`는 이름이 `symbol`과 같은 정의만 `hits`에 넣는다(`packages/cli/src/symbol-index.ts:980`, `:1050`, `:1189`, `:1214`의 `name === this.symbol`). 파일 전체 목록을 얻는 경로가 없다.
- 구문 실패(`StructError`)는 `collectFromFile`이 삼켜 빈 후보로 접고(`:293-307`), 이름이 본문에 나오는 source 파일만 `unparsed_files`로 알린다(`:336`). 지원 불가 확장자는 `walkDir`가 목록에서 조용히 뺀다(`:252-256`).
- 중첩 정의는 이미 수집된다. 재현: 임시 저장소에 `function outer() { function inner() { return 1; } const arrow = () => 2; return inner() + arrow(); }`를 쓰고 `resolveSymbol`로 `inner`를 조회하면 `qualified_name: 'outer.inner'`, `arrow`는 `outer.arrow`(arrow-function)다.
- I/O 관찰 지점: `collectFromFile`의 `fs.readFileSync`(`:283`)만 파일을 읽는다. `tokenize`, `collectDefinitions`, `classifyRole`, `gitBlobSha`는 순수하다.
- 확인한 기준선: `node --test test/symbol-index.test.js` 통과. 구문 회귀 사례는 12건이다: `PARSEABLE_CONSTRUCTS` 표 10건(`test/symbol-index.test.js:74-85`)을 도는 테스트와 표 밖 단독 테스트 2건(`:95` 비교식의 꺾쇠, `:100` 구조 문자를 담은 문자열 값).

#### Target behavior

- 성공: `listDefinitionsInText({ path, bytes })`는 확장자가 지원 스크립트(`.ts .tsx .js .jsx .mjs .cjs .mts .cts`)이고 UTF-8이며 NUL을 담지 않은 본문을 파싱해 `{ status: 'parsed', path, role, blob_sha, definitions }`를 돌려준다. `definitions`는 `SymbolRef[]`이고 `(start_line, end_line, qualified_name, kind)` 오름차순이다. 중첩 정의와 같은 이름의 서로 다른 정의를 모두 포함한다. 빈 파일은 `definitions: []`인 `parsed`다.
- 실패 구분: 구문 오류(`StructError`)는 `{ status: 'parse_failed', path, role, blob_sha }`이고 `definitions` 키가 없다. 지원 불가는 `{ status: 'unsupported', path, reason }`이며 `reason`은 `extension`(스크립트가 아닌 확장자), `declaration-file`(`.d.ts .d.mts .d.cts`), `binary`(NUL 포함 또는 UTF-8이 아닌 바이트) 중 하나다.
- 보존: `resolveSymbol`의 `status`, `symbol_ref`, `candidates`, `diagnostics`, `unparsed_files`는 변경 전과 같다. 이름 필터는 열거에서만 꺼지고 `resolveSymbol` 경로에서는 그대로 켜진다.
- 이 task의 한계: Git ref 읽기와 SHA별 조회는 다음 task 소관이다. `bytes`는 호출자가 준다.

#### Interface

- 제공: `symbol-index`의 `export =`에 `listDefinitionsInText`를 추가한다.
  ```ts
  type FileDefinitions =
    | { status: 'parsed'; path: string; role: SymbolRole; blob_sha: string; definitions: SymbolRef[] }
    | { status: 'unsupported'; path: string; reason: 'extension' | 'declaration-file' | 'binary' }
    | { status: 'parse_failed'; path: string; role: SymbolRole; blob_sha: string };
  listDefinitionsInText(input: { path: string; bytes: Buffer }): FileDefinitions;
  ```
  `path`는 저장소 상대 posix 경로이고 `role`은 기존 `classifyRole(path)`, `blob_sha`는 기존 `gitBlobSha(bytes)`다. `SymbolRef.blob_sha`도 같은 값이다.
- 거부 (throw): `path`가 비었거나 문자열이 아닐 때, `bytes`가 `Buffer`가 아닐 때. 구문 오류는 throw하지 않고 `parse_failed`다.
- fallback / 상태: 파싱 실패·지원 불가는 throw하지 않는 위 두 상태다. `Collector`가 알 수 없는 `StructError` 외 예외를 내면 삼키지 않고 그대로 던진다(기존 `collectFromFile` 규칙).
- 도메인 용어: `definition`은 `Collector`가 내는 `SymbolRef`(예: `{ path: 'src/a.ts', qualified_name: 'outer.inner', kind: 'function-declaration', start_line: 2, end_line: 2, blob_sha }`)다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/symbol-index.ts` | `Collector`, `collectDefinitions`, `collectFromFile`, `export =` | Modify | 이름이 일치하는 정의만 수집하고 `resolveSymbol`만 내보냄 | `symbol`이 null이면 모든 이름을 받는 일치 판정을 두고, 파일 하나를 열거하는 `listDefinitionsInText`를 추가해 내보냄 | 이름 비교 네 곳(`:980 :1050 :1189 :1214`)과 `resolveSymbol` 경로가 변경 지점. 소비자: `rg "symbol-index"`로 `intent-provenance.ts`, `intent-bundle.ts`가 `resolveSymbol`만 쓰는 것을 확인 |
| `test/symbol-index.test.js` | 열거 테스트, `PARSEABLE_CONSTRUCTS` | Modify | `resolveSymbol` 동작만 검증 | `listDefinitionsInText` 테스트 추가, 기존 구문 사례 표를 열거에도 재사용 | 같은 파서를 쓰는 새 경로의 회귀 지점. `test/tiers.json`에 unit tier로 이미 등록됨(`:11`) |

#### Constraints

- 기존 `symbol-index.test.js`의 어떤 단언도 바꾸지 않는다. 기존 `resolveSymbol` 사례가 모두 그대로 통과해야 한다.
- 이 파일은 unit tier라 `test/helpers/no-spawn.js` 아래에서 돈다. 새 테스트는 프로세스·Git을 띄우지 않는다.
- `export =` 모듈 계약(`typescript-module-contract.test.js`)을 지킨다. 새 export 이름은 `listDefinitionsInText` 하나다.
- 정렬은 문자열 비교(`<`)로 고정한다. 로케일 비교를 쓰지 않는다.

### context-search/intent-revision-lookup/003 · `c37ce7b3`

#### Goal & intent

`packages/cli/src/intent-revision.ts`를 새로 만들어, 하나의 `history_ref` SHA에 대해 blob, Explain 원문, epic registry, 파일별 함수 정의를 그 커밋 트리에서만 읽는다. 작업 트리·HEAD·인덱스는 읽지 않는다. 수용 기준은 Target behavior의 성공·실패·보존이고, 검증 명령은 frontmatter `verify`다.

#### Current behavior

- 입력/상태/출력: 기존 조회는 `walkExplain`·`parseExplainDoc`가 작업 트리에서 Explain을 읽고(`packages/cli/src/intent-provenance.ts:616-703`), `readEpicRegistry`가 디스크의 `.bouncer/epics.json`을 읽으며(`packages/cli/src/epic-registry.ts:249`), `resolveSymbol`이 작업 트리의 스크립트 파일을 훑는다(`packages/cli/src/symbol-index.ts:213`). 특정 SHA의 blob을 읽는 경로가 없다.
- Git 호출은 `intent-provenance.ts`의 `runGit`(`:312`, `spawnSync('git', …)`, 비-0 종료는 호출자가 `gitFailure`로 던짐)뿐이다. `rev-parse --verify`는 `expandShortSha`(`:581`)가 Explain의 task_commits SHA 확장에만 쓴다.
- 재현할 수 있는 기준선: `node --test test/terminal-intent-provenance.test.js`가 통과한다. 이 task의 새 동작에는 기존 테스트가 없다.
- I/O 관찰 지점: 이 모듈의 Git 호출은 모두 `spawnSync('git', …)` 한 곳으로 모으고, 모듈 상태는 두지 않는다.

#### Target behavior

- 성공: 7~40자 소문자 hex `ref`를 `git rev-parse --verify --quiet <ref>^{commit}`로 40자 SHA로 확정한다. `readBlobAt`은 그 SHA 트리의 파일을 `{ status: 'present', mode, blob_sha, bytes }`로, 없으면 `{ status: 'absent' }`로 돌려준다. 경로가 디렉터리면 `absent`다. `listExplainSourcesAt`은 `.bouncer/context` 아래 `explain.md` 일반 blob(모드 `100644`·`100755`)만 `rel` 오름차순 `{ rel, blob_sha, text }`로 돌려준다. `readRegistryAt`은 `.bouncer/epics.json`을 `parseEpicRegistry`로 판정해 `ok | missing | invalid`와 `blob_sha`(없으면 `null`)를 돌려준다. `listDefinitionsAtRevision`은 blob에 `symbol-index.listDefinitionsInText`를 적용한다. 결과에는 `history_ref`(40자)가 붙고, 트리의 symlink(모드 `120000`)는 `unsupported` + `reason: 'symlink'`, gitlink(모드 `160000`)는 `reason: 'submodule'`이다.
- 실패 (throw): 아래 Interface의 거부 목록.
- 부재 상태 (throw 아님): 파일 없음은 `absent`, Explain 없음은 빈 배열, registry 없음은 `missing`이다.
- 보존: 어떤 호출도 작업 트리·인덱스·HEAD·ref를 바꾸지 않는다. 기존 모듈의 export와 동작은 바뀌지 않는다.

#### Interface

- 제공: `intent-revision`의 `export =`에 다섯 함수를 둔다.
  ```ts
  resolveHistoryRef(i: { repoRoot: string; ref: string; maxBuffer?: number }): string;
  readBlobAt(i: { repoRoot: string; ref: string; path: string; maxBuffer?: number }):
    { status: 'absent' } | { status: 'present'; mode: string; blob_sha: string; bytes: Buffer };
  listExplainSourcesAt(i: { repoRoot: string; ref: string; maxBuffer?: number }): { rel: string; blob_sha: string; text: string }[];
  readRegistryAt(i: { repoRoot: string; ref: string; maxBuffer?: number }):
    { status: 'missing'; blob_sha: null } | { status: 'invalid'; blob_sha: string; message: string }
    | { status: 'ok'; blob_sha: string; registry: ReturnType<typeof parseEpicRegistry> };
  listDefinitionsAtRevision(i: { repoRoot: string; ref: string; path: string; maxBuffer?: number }):
    { history_ref: string } & (FileDefinitions | { status: 'unsupported'; path: string; reason: 'symlink' | 'submodule' }
    | { status: 'absent'; path: string });
  ```
  `ref` 자리에 이미 확정된 40자 SHA를 넘겨도 된다. `maxBuffer`는 Git 한 호출의 출력 상한(바이트, 양의 정수)이고 생략하면 `GIT_MAX_BUFFER = 268435456`(256 MiB)이다. 테스트가 작은 값을 넘겨 초과 동작을 확인하는 주입 지점이다.
- 거부 (throw): `ref`가 `/^[0-9a-f]{7,40}$/`가 아닐 때(`HEAD`, 브랜치명, `abc`, 대문자 hex, `-`로 시작하는 값, `main~1` 포함), 형식은 맞으나 커밋으로 풀리지 않거나 모호할 때, 같은 문자열이 ref 이름으로도 존재할 때(`refs/<ref>`, `refs/tags/<ref>`, `refs/heads/<ref>`, `refs/remotes/<ref>`, `refs/remotes/<ref>/HEAD` 중 하나라도 있으면 거절하고, 40자 `ref`도 같다. Git이 ref 이름을 SHA보다 먼저 풀 수 있어 같은 문자열이 다른 커밋을 가리킬 수 있기 때문이다), `repoRoot`가 Git 저장소가 아닐 때, Git 실행 파일이 없을 때, `git`이 비-0으로 끝날 때, Git 출력이 `maxBuffer`를 넘을 때(잘린 결과를 돌려주지 않고 `git output exceeds <maxBuffer> bytes`를 포함한 메시지로 던진다). `path`가 비었거나 절대 경로이거나 `\`를 담았거나 세그먼트가 `''`·`.`·`..`일 때. 메시지는 비어 있지 않은 Error다(CLI가 stderr로 보여주는 기존 규칙).
- 상태로 돌려주는 부재(throw와 별도 목록): `absent`(그 SHA에 파일 없음), `listExplainSourcesAt`의 빈 배열, `readRegistryAt`의 `missing`, `invalid`(깨진 JSON·스키마 위반은 `message`를 싣고 던지지 않는다).
- 도메인 용어: `history_ref`는 40자 소문자 hex 커밋 SHA다(예: `3f2a…` 40자). `Explain source`는 `.bouncer/context/epics/<epic>/blueprints/<bp>/explain.md`의 원문 문자열이다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/intent-revision.ts` | `resolveHistoryRef`, `readBlobAt`, `listExplainSourcesAt`, `readRegistryAt`, `listDefinitionsAtRevision` | Create | 없음 | 위 다섯 함수. 모든 Git 호출은 이 파일의 `spawnSync` 한 곳을 거친다 | 신규 추출 지점: 고정 SHA의 Git 트리 읽기 경계. `symbol-index`(`listDefinitionsInText`)와 `epic-registry`(`parseEpicRegistry`)에만 의존해 순환이 없다 |
| `test/intent-revision.test.js` | 고정 SHA 읽기 테스트 | Create | 없음 | 실제 임시 Git 저장소로 아래 Checklist의 셀을 검증 | 새 동작의 검증 지점. Git을 띄우므로 integration tier |
| `test/tiers.json` | `integration` 배열 | Modify | 테스트 파일의 tier 정본 | `intent-revision.test.js`를 `integration`에 추가 | `scripts/check-task.js`가 미등록 파일을 거절하고 plan gate G33이 `affected_paths`에 이 파일을 요구함 (`test/tiers.json:23-40`) |
| `test/helpers/feature-areas.js` | `FEATURE_AREAS.intent` | Modify | intent 기능 영역의 모듈 목록 | `'intent-revision'` 추가 | 지연 적재 검사가 영역 표로 적재 여부를 판정함 (`test/helpers/feature-areas.js:8`) |

#### Constraints

- 모듈은 `export =` 형식이고 `import x = require('./y')` 경계를 쓴다(`typescript-module-contract.test.js`가 자동으로 검사한다).
- `symbol-index`·`intent-provenance`·`cli-*`는 이 모듈을 import하지 않는다. 이 task에서 이 모듈은 아무 모듈에도 연결되지 않는다.
- Git 호출은 `git --no-optional-locks --literal-pathspecs …`로 하고 `cwd`는 `repoRoot`다. 작업 트리 파일은 읽지 않는다.
- Git 호출은 이 파일의 `spawnSync` 래퍼 하나를 거친다. 출력은 `encoding`을 지정하지 않아 `Buffer`로 받고(blob 바이트가 UTF-8 디코딩으로 바뀌지 않는다), `bytes`는 그 `Buffer`다. `text`만 Explain blob `Buffer`를 UTF-8로 디코딩한 문자열이며 잘못된 바이트는 U+FFFD가 된다(`blob_sha`가 원본 신원이다). `maxBuffer`는 위 Interface의 값을 모든 호출에 넘긴다. 래퍼는 `result.error`가 `ENOBUFS`면 `git output exceeds <maxBuffer> bytes`로 던지고, 그 외 `result.error`는 `git command is not executable`로 던진다. 출력이 잘리거나 빈 값으로 접히지 않는다.
- Git 환경을 고정한다. 자식 프로세스 env는 `process.env`에서 `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`, `GIT_OBJECT_DIRECTORY`, `GIT_ALTERNATE_OBJECT_DIRECTORIES`, `GIT_COMMON_DIR`, `GIT_NAMESPACE`를 지우고 `GIT_NO_REPLACE_OBJECTS=1`, `GIT_TERMINAL_PROMPT=0`, `GIT_OPTIONAL_LOCKS=0`, `LC_ALL=C`를 더한 값이다. 이 모듈이 쓰는 `rev-parse`·`ls-tree`·`cat-file`은 `.gitattributes`·`.mailmap`·`core.autocrlf` 필터를 적용하지 않는 plumbing이라 작업 트리의 그 파일들은 결과에 영향이 없고(아래 셀 13이 확인한다), 사용자·시스템 config 값은 위협 모델에 넣지 않는다.
- Explain 원문은 문서마다 프로세스를 띄우지 않고 `git cat-file --batch` 한 번으로 읽는다. 입력은 `ls-tree -r -z`에서 얻은 blob SHA 줄이고 응답은 `<sha> blob <size>\n<bytes>\n` 형식으로 `Buffer` 위치 계산으로 분리한다(크기는 헤더의 값만 믿고 개행으로 자르지 않는다).
- 테스트는 임시 디렉터리에만 저장소를 만든다. 고정 identity와 `GIT_CONFIG_NOSYSTEM=1`을 쓰고 gpg 서명은 끈다(`test/terminal-intent-provenance.test.js:35-50`의 `git` helper와 같은 방식).
- 테스트 이름은 `<조건> → <결과>` 형식이다(`npm run lint:test-names`).

### context-search/intent-revision-lookup/004 · `c72d5e70`

#### Goal & intent

`intent-provenance`에 `resolveIntentAtRevision({ repoRoot, historyRef, symbolRef, limit? })`를 더한다. 입력 `symbolRef`가 `historyRef` 트리의 정의와 정확히 일치할 때만, 그 SHA의 blame/log와 그 SHA의 Explain·registry로 근거를 만든다. 기존 `resolveIntentProvenance`는 같은 연결 로직을 쓰되 동작이 바뀌지 않는다. 수용 기준은 Target behavior이고, 검증 명령은 frontmatter `verify`다.

#### Current behavior

- 입력/상태/출력: `resolveIntentProvenance`(`packages/cli/src/intent-provenance.ts:176`)는 `resolveSymbol`로 작업 트리의 정의를 고르고, `collectCommitMetas`(`:356`)가 `git blame --line-porcelain -L s,e -- path`, `git log --follow -- path`, `git log --follow -G <name> -- path`를 revision 없이 실행한다. Explain은 `loadExplainDocs`(`:616`)가 작업 트리에서 읽고 registry는 `readRegistryOrNull`(`:46`)이 디스크에서 읽는다.
- I/O 관찰 지점: `runGit` `spawnSync`(`:313`), `fs.readFileSync`(`parseExplainDoc` `:663`), `readEpicRegistry`(`:47`).
- 재현: `node --test test/terminal-intent-provenance.test.js`가 통과한다(Explain을 커밋하지 않아도 작업 트리 파일로 연결됨: `:267-330`). 이 동작은 보존 대상이다.
- 기존 조회의 결과 형태는 `status`, `symbol`, `symbol_ref`, `candidates[{relation, commit, task, explain, freshness, sections: string[], body}]`, `truncated`다.

#### Target behavior

- 성공: 입력이 유효하면 아래 Interface의 결과를 돌려준다. 후보를 만드는 규칙(blame·follow·-G 합집합, trailer와 Explain `task_commits` 연결, freshness 분류, 정렬)은 `resolveIntentProvenance`와 같은 함수를 공유하고 다음만 다르다. (a) 모든 `git blame`·`git log`에 확정된 `historyRef` SHA를 revision 인자로 넘긴다. (b) Explain은 `listExplainSourcesAt(historyRef)`, registry는 `readRegistryAt(historyRef)`(`ok`일 때만 쓰고 아니면 `null`)에서 읽는다. (c) 후보 본문은 `body` 문자열 대신 `sections: { name, body }[]`이고 `historical` 후보는 `[]`다. (d) 바이트 예산으로 자르지 않는다. (e) 후보마다 `explain_blob_sha`가 붙는다. (f) Explain `task_commits`의 짧은 SHA(8자)는 `git rev-list <historyRef>`(한 번 호출, 출력 상한은 `intent-revision`과 같은 256 MiB)가 돌려준 도달 가능 커밋 집합 안에서만 40자로 펼친다. 집합에서 접두사가 일치하는 커밋이 정확히 하나면 `unique`, 둘 이상이면 `ambiguous`, 없으면 `missing`이다. `ambiguous`·`missing` 행은 던지지 않고 어느 task에도 연결하지 않는다. `historyRef` 밖의 객체(이후 커밋, 다른 브랜치 커밋, blob·tree)가 같은 접두사를 가져도 결과가 달라지지 않는다. 기존 `resolveIntentProvenance`는 계속 `expandShortSha`(`rev-parse --verify`)를 쓴다.
- `status`는 연결된 커밋이 하나라도 있으면 `resolved`, 없으면 `unlinked`(후보 `[]`)다. `explain_docs`는 `listExplainSourcesAt(historyRef)`가 읽은 문서 중 `parseExplainDoc` 규칙으로 파싱에 성공한 문서의 수다(깨진 frontmatter 등으로 파싱에 실패해 버려진 문서는 세지 않는다). 그래서 Explain 부재(0)와 연결 부재(1 이상)가 구분된다. 그 SHA 이후에 쓰인 Explain·task_commits는 어떤 경로로도 읽히지 않는다.
- 결정성: 같은 `(repoRoot 내용 중 historyRef 트리, symbolRef, limit)`는 `canonicalJson` 직렬화 기준 같은 바이트와 같은 `digest`를 낸다. 작업 트리·HEAD·인덱스가 달라도 같다.
- 보존: `resolveIntentProvenance`의 입력·출력·throw 조건은 바뀌지 않는다. 공유하도록 뽑는 내부 함수는 export하지 않는다.

#### Interface

- 제공: `intent-provenance`의 `export =`에 `resolveIntentAtRevision`을 추가한다.
  ```ts
  resolveIntentAtRevision(i: { repoRoot: string; historyRef: string; symbolRef: SymbolRef; limit?: number }): {
    schema_version: 1; projection_version: 'intent-at-revision/1';
    history_ref: string; symbol_ref: SymbolRef; status: 'resolved' | 'unlinked';
    explain_docs: number; registry_blob_sha: string | null; total_linked: number;
    candidates: { relation: 'blame' | 'follow'; commit: string; task: string; explain: string;
      explain_blob_sha: string; freshness: Freshness; sections: { name: string; body: string }[] }[];
    digest: string;
  };
  ```
  같은 파일은 순수 보조 함수 `expandShaAmong(commits: string[], sha8: string): { status: 'unique'; full: string } | { status: 'ambiguous' } | { status: 'missing' }`도 `export =`에 추가한다(`commits`는 40자 소문자 hex 목록, `sha8`은 8자 소문자 hex 접두사. 목록에 접두사가 일치하는 항목이 하나면 `unique`, 둘 이상이면 `ambiguous`, 없으면 `missing`. 파일 시스템과 Git을 읽지 않고, 입력이 위 형식이 아니면 `missing`이다). 테스트가 접두사 충돌을 직접 만들 수 없어 이 함수로 충돌 규칙을 검증한다.
  `limit`은 1..5 정수이고 생략하면 3이다(기존 규칙). `total_linked`는 `limit` 적용 전 연결된 후보 수다. `digest`는 `digest`를 뺀 객체의 `sha256Canonical` 값이다. 후보 순서는 기존과 같다(freshness 순위, 커밋 시각 내림차순, 커밋 SHA, Explain 경로).
- 거부 (throw): `historyRef`가 `intent-revision.resolveHistoryRef`의 규칙으로 거절될 때. `symbolRef`가 객체가 아니거나 `path`·`qualified_name`·`kind`·`blob_sha`(40자 hex)·`start_line`·`end_line`(`1 <= start <= end` 정수) 형태가 틀릴 때(형태 오류가 먼저 평가되고 메시지는 `invalid symbolRef:`로 시작한다). 형태가 맞은 뒤 신원 오류: 그 SHA에서 `symbolRef.path`가 `parsed`가 아닐 때(`absent`·`unsupported`·`parse_failed`), 그 SHA의 `blob_sha`가 `symbolRef.blob_sha`와 다를 때, 그 SHA의 정의 중 `(qualified_name, kind, start_line, end_line)`이 모두 같은 항목이 없을 때. 신원 오류 메시지는 `symbolRef does not match`로 시작한다. `limit`이 1..5 정수가 아닐 때. Git이 실패하거나 출력이 상한을 넘을 때. 메시지는 비어 있지 않은 Error이고 이름이 같은 다른 파일의 정의로 대체하지 않는다.
- 상태로 돌려주는 부재 (throw와 별도 목록): `status: 'unlinked'`(연결된 커밋 없음, 그 SHA에 Explain 없음 포함), `registry_blob_sha: null`(그 SHA에 registry blob이 없음, `readRegistryAt`이 `missing`). 깨진 registry(`readRegistryAt`이 `invalid`)는 던지지 않고 alias 연결에는 registry가 없는 것처럼 쓰지만 `registry_blob_sha`는 그 깨진 blob의 SHA다. 그래서 `null`(없음)과 SHA(있으나 깨졌거나 정상)가 구분되고, 깨진 registry를 고친 커밋은 `digest`가 달라진다.
- 도메인 용어: `history_ref`는 40자 소문자 hex 커밋 SHA, `symbolRef`는 `symbol-index`가 내는 `{ path, qualified_name, kind, start_line, end_line, blob_sha }`(예: `{ path: 'src/one.ts', qualified_name: 'shared', kind: 'exported-function', start_line: 1, end_line: 1, blob_sha: '<40 hex>' }`).

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/intent-provenance.ts` | `resolveIntentAtRevision`, `expandShaAmong`, `runGit`, `collectCommitMetas`, `parseExplainDoc`, `export =` | Modify | 작업 트리 기준 조회만 제공하고 blame/log에 revision이 없음 | `collectCommitMetas`에 선택적 revision 인자, `runGit`에 선택적 환경 고정·`maxBuffer` 옵션, Explain 원문 문자열을 받는 순수 파서 분리, `rev-list` 도달 집합 기반 SHA 펼침, 위 조회와 `expandShaAmong` 추가 | 호출 경로: `resolveIntentProvenance :176`, `collectCommitMetas :356`, `parseExplainDoc :660`. 소비자 조사: `rg "intent-provenance" packages/cli/src`는 `intent-bundle.ts`와 `cli-intent-command.ts`만 가리키며 둘 다 기존 export만 쓴다 |
| `test/intent-revision.test.js` | provenance 셀 | Modify | 이전 task의 읽기 경계 셀 | 아래 Checklist의 조회 셀 추가 | 새 동작의 검증 지점. 이미 integration tier에 등록됨 |

#### Constraints

- `test/terminal-intent-provenance.test.js`의 어떤 단언도 바꾸지 않고, 그 파일이 수정 없이 통과해야 한다.
- 기존 조회의 JSON 필드·정렬·`truncated`·`body` 예산(2000 바이트)은 바뀌지 않는다.
- 새 조회는 파일 시스템의 작업 트리를 읽지 않는다. `fs` 호출이 새 경로에 없어야 한다는 점은 아래 "디스크 변경 불변" 셀의 동작으로만 확인하고 구현 구조를 단언하지 않는다.
- 테스트는 임시 저장소에서 실제 Git으로 돈다. Explain·trailer fixture는 `test/terminal-intent-provenance.test.js:126-165`의 형식을 따라 이 파일 안에 최소한으로 둔다(공용 helper 추출은 하지 않는다).
- 새 조회가 부르는 모든 Git(`blame`·`log`·`rev-list`)은 `runGit`의 환경 고정 옵션을 켠다: env에서 `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`, `GIT_OBJECT_DIRECTORY`, `GIT_ALTERNATE_OBJECT_DIRECTORIES`, `GIT_COMMON_DIR`, `GIT_NAMESPACE`를 지우고 `GIT_NO_REPLACE_OBJECTS=1`을 둔다. 옵션을 켜지 않은 기존 호출의 env와 인자는 바뀌지 않는다. 출력이 `maxBuffer`를 넘으면(`ENOBUFS`) `git output exceeds <maxBuffer> bytes`로 던진다.
- 인용한 줄 번호는 현재 파일 기준이며 구현 중 이동하면 심볼 이름이 기준이다.

### context-search/intent-revision-lookup/005

#### Goal & intent

앞선 네 task가 모두 통합된 뒤 `npm run verify:bp`(build 포함 `npm test`, `typecheck`, `lint`, `lint:docs`, `check:emit`)를 한 번 실행해, 이 blueprint의 변경이 전체 회귀·타입·정적 검사를 통과함을 증적으로 남긴다. 검증 명령은 frontmatter `verify`다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.

### context-search/intent-revision-lookup/006 · `5f0c9f49`

#### Goal & intent

최종 리뷰 finding을 수정한다.

- F-SS-1 (major, spec_scope, must_fix) — packages/cli/src/intent-provenance.ts#resolveIntentAtRevision — tasks/004 Target behavior
- CT-001 (major, correctness_tests, must_fix) — packages/cli/src/intent-provenance.ts#resolveIntentAtRevision — Contract
- CT-003 (minor, correctness_tests, must_fix) — test/intent-revision.test.js#resolveIntentAtRevision — tasks/004 Target behavior

#### Interface

- 제공: 기록된 리뷰 finding을 해소하는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `packages/cli/src/intent-provenance.ts` — 기록된 리뷰 finding을 수정한다.
- Modify `test/intent-revision.test.js` — 기록된 리뷰 finding을 수정한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.