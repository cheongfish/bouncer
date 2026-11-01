---
type: bouncer.explain
title: intent-diff-cli explain
description: Explain for intent-diff-cli
resource: .bouncer/context/epics/context-search/blueprints/intent-diff-cli/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-11-01T10:57:27.276+09:00'
bouncer:
  id: EXPLAIN-intent-diff-cli
  epic_id: context-search
  blueprint_id: intent-diff-cli
  status: published
  comprehension:
    - range_from: 1b7ac9ff80d77da42ac3981494a9f9e35ba01b9c
      range_to: 8a072c728846e05d9d0655922f7eefa0ba8aa760
      diff_sha: dd6360f6820d703ec83356167df22a32bf87d5f4c4eb80357ed2064ff3289afb
      recorded_at: '2026-11-01T10:58:04.558+09:00'
  task_commits:
    - task: context-search/intent-diff-cli/001
      sha: 2671dddb
      intent_anchor: task-001
    - task: context-search/intent-diff-cli/002
      sha: 14ac8324
      intent_anchor: task-002
    - task: context-search/intent-diff-cli/003
      sha: b3d61fbc
      intent_anchor: task-003
    - task: context-search/intent-diff-cli/005
      sha: 8a072c72
      intent_anchor: task-005
---
# Explain

## Background

리뷰어에게 diff를 주기 전에, diff에 들어 있는 함수가 과거에 어떤 결정과 제약을 받았는지 먼저 재현 가능하게 뽑을 수 있어야 한다. 기존 `bouncer intent`는 함수 이름을 입력으로 받아 조회한다. 리뷰 쪽에는 "이 diff에서 어떤 함수가 바뀌었는가"를 줄 단위로 가려내는 단계가 없었다.

`bouncer intent diff`는 동결된 review snapshot 하나와 기준 SHA를 받아 변경 함수 후보를 뽑고, 각 후보에 기준 SHA 시점의 intent 근거를 붙여 JSON 하나로 출력한다. 읽기 전용이며 reviewer 입력과 dispatch는 바꾸지 않는다. 추출에서 빠진 파일과 근거가 없는 함수는 coverage 상태로 구분해 드러내고, 빈 결과를 성공(exit 0)으로 다룬다.

## Code

- `packages/cli/src/review-diff-intent.ts`: 핵심 모듈.
  - `extractChangedFunctions`는 snapshot의 `diff`와 `files[].content`로 변경 함수 후보를 만든다. 기준 쪽 정의는 고정 SHA 트리에서 읽고 작업 트리는 다시 읽지 않는다. 후보의 `mapping`은 `paired`, `deleted`, `added`, `moved`, `ambiguous_mapping` 중 하나다.
  - 같은 본문의 함수가 파일을 가로질러 1:1로 나타나면 `moved`로 묶는다. 우연히 본문이 같은 함수가 이동으로 묶일 수 있다는 점은 알려진 한계다.
  - `collectDiffIntent`는 후보에 intent 근거를 붙이고 순위와 바이트 예산을 적용한다. 항목은 최대 8개, 항목 본문은 3072바이트, 전체 슬롯은 12288바이트(`intent-diff-budget/1`)다. 넘친 분량은 `omitted_by_count` 등으로 드러낸다.
  - 설계 선택: role은 `symbol-index` 결과에서만 얻는다. symlink·submodule·binary·미지원 확장자 파일은 role이 null이다. 중첩 정의 안쪽의 줄이 바뀌면 바깥 정의도 `touched_by_nested`가 true다.
  - 한계: diff의 `---`/`+++` 경로는 교차 검증하지 않고 `diff --git` 헤더만 쓴다. 대형 snapshot의 Git 호출 비용은 측정하지 않았다. 화살표 함수의 바깥 이름 같은 정의 파싱 한계는 `symbol-index`에서 물려받는다.
- `packages/cli/src/cli-intent-diff-command.ts`: `intent diff`의 인자 검증과 출력.
  - `--snapshot`은 `.bouncer/runtime/review-snapshots/<64자 소문자 hex>/snapshot.json` 형식만 받는다. `--history-ref`는 7~40자 소문자 hex만 받아 `HEAD`나 브랜치명은 거절한다.
  - 성공은 `{ ok: true, ... }` 하나로 exit 0이고, 조회 실패는 `{ ok: false, reason, cause, next }`로 exit 1이다(stderr 비어 있음). 사용법 오류는 exit 2와 stderr 한 줄이다. 후보가 0개이거나 근거가 없어도 exit 0이다.
- `packages/cli/src/cli-intent-command.ts`: `intent diff`를 query 파서보다 먼저 가로채 diff 모듈로 넘긴다. `rules/cli.md`와 `cli-usage.ts`에 사용법이 추가됐다.
- 테스트는 `test/review-diff-intent.test.js`와 `test/intent-diff-command.test.js`가 맡는다. 검증과 리뷰 증거는 finalize digest의 `evidence` 참조에 있다.

## Quiz

1. `bouncer intent diff`가 후보를 하나도 찾지 못했거나 근거가 없는 함수만 있을 때 어떻게 끝나는가?
   - A) exit 1과 `{ ok: false }` 문서
   - B) exit 0과 `{ ok: true, ... }` 문서
   - C) exit 2와 stderr 사용법 메시지
2. `--history-ref`에 `HEAD`를 넘기면 어떻게 되는가?
   - A) 현재 HEAD 커밋으로 풀어서 그대로 조회한다
   - B) `history-ref-mismatch`로 exit 1을 낸다
   - C) 형식 위반으로 보고 사용법 오류(exit 2)를 낸다
3. 후보가 많아 슬롯 예산을 넘으면 어떻게 되는가?
   - A) 항목은 최대 8개, 전체 슬롯은 12288바이트 안으로 줄이고 생략한 분량을 출력에 드러낸다
   - B) 예산을 넘은 후보를 조용히 버린다
   - C) 예산을 넘으면 `collect-failed`로 실패한다
4. 파일 A의 함수가 삭제되고 파일 B에 본문이 같은 함수가 정확히 하나 새로 생겼다. 후보의 `mapping`은?
   - A) `deleted`와 `added` 두 후보로 따로 나온다
   - B) `moved` 하나로 묶인다
   - C) `ambiguous_mapping`이다

## Tasks

### context-search/intent-diff-cli/001 · `2671dddb`

#### Goal & intent

`packages/cli/src/review-diff-intent.ts`에 `extractChangedFunctions`를 만든다. 동결된 review snapshot의 `diff`·`files`와 base 커밋의 blob을 입력으로, 변경된 함수 후보와 파일별 coverage를 돌려준다. 근거 조회·순위·예산·CLI는 다음 task 소관이다. 수용 기준은 Target behavior이고, 검증 명령은 frontmatter `verify`다.

#### Current behavior

- snapshot은 `base` 대비 최종 작업 트리를 동결한다: `target.{base,head}`, 텍스트 unified diff `diff`(`git diff --no-ext-diff --no-textconv --no-color --no-renames <base> -- <paths>`, 기본 문맥 3줄), `files[{path, mode, kind: text|binary|symlink|deleted, content}]`, `file_lines`(`packages/cli/src/review-snapshot.ts:481-612`). untracked 파일은 `files`에만 있고 `diff`에는 없다(`:549-552`).
- snapshot 소비자는 `loadReviewSnapshot`/`checkReviewSnapshotCurrent`로 id와 내용 해시를 검증한다(`:714`, `:766`). 변경 함수를 뽑는 코드는 없다. `diff` 문자열을 파싱하는 코드도 없다(`rg "@@" packages/cli/src`는 snapshot 수집기의 `--numstat` 파서 `parseNumstat`만 가리킨다).
- 이전 blueprint가 추가한 읽기 경계: `intent-revision.listDefinitionsAtRevision`, `readBlobAt`, `resolveHistoryRef`와 `symbol-index.listDefinitionsInText`.
- 재현할 수 있는 관찰: 임시 저장소에서 `captureReviewSnapshot({ repoRoot, blueprintDir: '.bouncer/context/epics/e/blueprints/b', taskId: null, base, head: 'HEAD' })`를 호출하면 `snapshot.diff`에 위 형식의 diff가 담긴다.

#### Target behavior

- 성공: `extractChangedFunctions({ repoRoot, snapshot, historyRef })`는 `{ snapshot_id, base, history_ref, files, candidates }`를 돌려준다.
  - 줄 좌표: `diff`의 hunk를 파싱해 실제 `-`(base 좌표)와 `+`(snapshot 좌표) 줄만 변경 줄로 센다. 문맥 줄은 세지 않는다. 헤더의 줄 수가 생략된 `@@ -1 +1 @@`, 새 파일 `@@ -0,0 +1,N @@`, 삭제 파일 `@@ -1,N +0,0 @@`, `\ No newline at end of file`, git이 인용한 경로(비ASCII·공백)를 처리한다. tracked 파일이 base에 없으면(추가) 모든 snapshot 줄이 추가다. `diff --git` 헤더만 있고 hunk가 없는 파일(mode만 바뀜, 바이너리, 줄 없는 빈 파일 추가)은 변경 줄 0이고 coverage 행은 만든다. diff 섹션이 없는 `files` 항목은 두 가지로 가른다. (1) base에 그 경로가 없으면 untracked 새 파일이다: `content` 전체 줄이 추가다(빈 내용은 0줄). (2) base에 그 경로가 있으면: `kind: 'text'`이고 base blob SHA가 `content`의 Git blob SHA와 같을 때만 변경 없음으로 보고 coverage에서 뺀다. 다르거나 `text`가 아니면 throw한다. 같은 경로가 `files`에 두 번 나오거나, 같은 경로의 diff 섹션이 아래 typechange 쌍이 아닌 방식으로 두 번 나오거나, `files[].path`가 절대 경로·`\`를 담은 경로·`''`/`.`/`..` 세그먼트를 담은 경로이거나, `kind: 'deleted'`인데 diff에 `+` 줄이 있거나, `kind: 'deleted'`가 아닌데 diff가 `deleted file mode`를 담고 같은 경로에 뒤따르는 `new file mode` 섹션이 없으면 throw한다.
  - typechange 쌍: symlink와 일반 파일 사이 형식 변경은 `--no-renames` diff에서 같은 경로의 섹션 둘로 나온다. 순서대로 `deleted file mode` 섹션 뒤에 `new file mode` 섹션이 정확히 이어질 때만 하나의 변경으로 본다(`files`에는 최종 `kind` 항목 하나가 있고 `deleted`가 아니다). 변경 줄은 두 섹션의 합이다(`-`는 deleted 섹션, `+`는 new 섹션). coverage는 위 판정 순서가 정한다(어느 쪽이든 symlink이면 `excluded` + `symlink`). 순서가 반대(`new` 뒤 `deleted`)이거나 같은 종류 섹션이 둘이거나 셋 이상이면 throw한다.
  - 정의: base 쪽은 `listDefinitionsAtRevision(base)`, snapshot 쪽은 `files[].content`를 `listDefinitionsInText`에 넣어 얻는다. 작업 트리는 다시 읽지 않는다.
  - 함수 대응: 변경 줄이 함수 범위에 들면 그 함수가 touched다(중첩은 모두). 같은 `(path, qualified_name, kind)`에 양쪽이 정확히 1개씩이면 `paired`로 연결하고 어느 쪽이든 touched일 때만 후보다. 양쪽 중 한쪽에만 키가 있으면 touched 정의가 `deleted`(base만) 또는 `added`(snapshot만)이다. 양쪽에 있지만 1:1이 아니면(같은 키 중복) touched인 정의 전부가 `ambiguous_mapping`이다.
  - 이동·이름 변경: `deleted` 후보와 `added` 후보를 함수 이름이 가린 본문(정의 줄 범위 텍스트에서 그 정의의 마지막 이름 토큰을 단어 경계 기준으로 `\0`으로 치환한 문자열)이 정확히 같은 것끼리 묶는다. 같은 본문의 `deleted`가 1개, `added`가 1개면 하나의 `moved` 후보(양쪽 ref)가 된다. 같은 본문 그룹의 한쪽 또는 양쪽이 2개 이상이고 양쪽에 모두 있으면 그 그룹 전원이 `ambiguous_mapping`이다. 한쪽에만 있으면 그대로 `deleted`/`added`다. 이전 함수는 어떤 경우에도 후보에서 사라지지 않는다.
  - 줄 수: 후보의 `added_lines`/`deleted_lines`는 그 정의가 가장 안쪽으로 포함하는 변경 줄만 센다. 안쪽 정의의 줄은 바깥 정의에 중복해 세지 않고, 안쪽만 바뀐 바깥 정의는 줄 수 0·`touched_by_nested: true`로 후보에 남는다. 모든 후보의 줄 수 합과 `non_function_lines` 합은 파일의 변경 줄 수와 같다.
  - 파일 coverage: 모든 변경 파일에 `{ path, role, status, reason?, added_lines, deleted_lines, non_function_lines }` 하나. `role`의 출처는 `listDefinitionsInText`/`listDefinitionsAtRevision`이 돌려준 `role`(`parsed`·`parse_failed` 결과)뿐이다. 그 두 결과가 아닌 파일(`unsupported`, `binary`, `symlink`, `submodule`)은 `role: null`이다. 이 모듈은 경로로 role을 다시 계산하지 않는다(`symbol-index`의 판정과 어긋나지 않게). 판정 순서는 다음과 같고 먼저 맞는 규칙이 이긴다. (1) 어느 쪽이든 symlink이면(`snapshot` 쪽 `kind: 'symlink'` 또는 base 쪽 `reason: 'symlink'`) `excluded` + `symlink`, base 쪽이 gitlink이면 `excluded` + `submodule`, `kind: 'binary'`이면 `excluded` + `binary`. (2) 어느 쪽이든 `unsupported`이면(이유는 snapshot 쪽이 unsupported이면 그 이유, 아니면 base 쪽 이유) `unsupported` + `extension | declaration-file | binary`. (3) 지원 스크립트이고 role이 `test | generated | vendor`이면 `excluded` + `role:test | role:generated | role:vendor`(구문이 깨진 파일도 여기서 `excluded`다). (4) 어느 쪽 파싱이 실패했으면 `parse_failed` + `base | snapshot`(둘 다면 `snapshot`). (5) 그 외 `covered`. `excluded`·`unsupported`·`parse_failed` 파일은 후보를 만들지 않고 그 파일의 변경 줄은 `non_function_lines`로 센다. 삭제된 파일은 snapshot 쪽이 없으므로 base 쪽 결과만으로 같은 순서를 적용한다.
  - 출력 순서: `files`는 `path`, `candidates`는 `(path, qualified_name, kind, base 시작 줄)` 오름차순이다.
- 실패 (throw): 아래 Interface의 거부 목록.
- 보존: 소스·index·branch·snapshot artifact를 쓰지 않는다. `review-snapshot.ts`와 기존 intent 명령은 바뀌지 않는다.

#### Interface

- 제공: `packages/cli/src/review-diff-intent.ts`가 `export =`로 `extractChangedFunctions`를 내보낸다.
  ```ts
  type DiffSnapshot = { target: { base: string; head: string }; diff: string;
    files: { path: string; kind: 'text' | 'binary' | 'symlink' | 'deleted'; content: string }[] };
  type FileCoverage = { path: string; role: 'source' | 'generated' | 'test' | 'vendor' | null;
    status: 'covered' | 'excluded' | 'unsupported' | 'parse_failed';
    reason?: 'role:test' | 'role:generated' | 'role:vendor' | 'binary' | 'symlink' | 'submodule'
      | 'extension' | 'declaration-file' | 'base' | 'snapshot';
    added_lines: number; deleted_lines: number; non_function_lines: number };
  type Candidate = { mapping: 'paired' | 'deleted' | 'added' | 'moved' | 'ambiguous_mapping';
    base_ref: SymbolRef | null; snapshot_ref: SymbolRef | null;
    added_lines: number; deleted_lines: number; touched_by_nested: boolean };
  extractChangedFunctions(i: { repoRoot: string; snapshot: DiffSnapshot; historyRef: string }):
    { snapshot_id: string; base: string; history_ref: string; files: FileCoverage[]; candidates: Candidate[] };
  ```
  `snapshot_id`는 `sha256Canonical(snapshot)`이다. `SymbolRef`는 `symbol-index`의 `{ path, qualified_name, kind, start_line, end_line, blob_sha }`이며 `blob_sha`는 base 쪽은 base blob, snapshot 쪽은 snapshot 내용의 Git blob SHA다.
- 거부 (throw): `historyRef`가 `resolveHistoryRef` 규칙으로 거절되거나 확정한 SHA가 `snapshot.target.base`와 다를 때. `snapshot` 형태가 틀릴 때(`target`·`diff`·`files` 누락, `kind` 밖 값). `diff`가 hunk 헤더의 줄 수와 맞지 않거나 `files`에 없는 경로를 담을 때(추측으로 보정하지 않는다). 위 Target의 `files`·diff 일관성 위반(중복·부적합 경로, deleted와 `+` 줄 충돌, diff 섹션 없이 base와 내용이 다른 항목). Git 실패. 메시지는 비어 있지 않은 Error다.
- 상태로 돌려주는 부재 (throw와 별도 목록): 변경 함수 없음(`candidates: []`), 위 파일 coverage의 `excluded | unsupported | parse_failed`와 `role: null`, base에 파일이 없음(추가 파일), 변경 줄 0인 파일(mode만 바뀜 등), diff 섹션이 없는 untracked 새 파일, `added`·`deleted`·`ambiguous_mapping`.
- 도메인 용어: `touched`는 변경 줄이 정의의 `[start_line, end_line]` 안에 들어 있는 상태다(예: `edit`가 4~8줄이고 6번 줄이 바뀜). `함수 이름이 가린 본문`은 위에 정의한 정규화 문자열이다(예: `function oldName() {\n  return compute(1);\n}`에서 `oldName`이 `\0`).

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/review-diff-intent.ts` | `extractChangedFunctions` | Create | 없음 | diff 파서, 정의 대응, coverage 판정 | 신규 추출 지점: snapshot에서 변경 함수를 뽑는 읽기 전용 로직. `intent-revision`·`symbol-index`·`canonical-json`에만 의존하고 `review-snapshot`은 import하지 않는다 |
| `test/review-diff-intent.test.js` | 추출 테스트 | Create | 없음 | 아래 Checklist 셀 | 새 동작의 검증 지점. 실제 Git과 `captureReviewSnapshot`을 쓰므로 integration tier |
| `test/tiers.json` | `integration` 배열 | Modify | 테스트 tier 정본 | `review-diff-intent.test.js` 추가 | G33과 `scripts/check-task.js`가 미등록 파일을 거절함 (`test/tiers.json:23-40`) |
| `test/helpers/feature-areas.js` | `FEATURE_AREAS.intent` | Modify | intent 영역 모듈 표 | `'review-diff-intent'` 추가 | 지연 적재 검사가 영역 표로 판정함 (`test/helpers/feature-areas.js:8`) |

#### Constraints

- `export =` 모듈 계약을 지킨다. 이 모듈은 어떤 기존 모듈에도 아직 연결되지 않는다.
- 테스트의 expected 값은 fixture 소스 문자열의 줄 번호와 `git` 명령(`git rev-parse <base>:<path>`, `git hash-object <path>`)으로 구성한다. 구현의 반환값에서 만들지 않는다.
- 테스트는 임시 저장소에서만 돌고, 고정 identity와 `GIT_CONFIG_NOSYSTEM=1`, gpg 서명 끔을 쓴다. 이름은 `<조건> → <결과>` 형식이다.
- 정렬과 비교는 문자열 `<`이다. 로케일을 쓰지 않는다.
- role은 `symbol-index` 결과에서만 얻는다. `symbol-index.classifyRole`이 export되지 않고 `symbol-index.ts`를 이 blueprint가 바꾸지 않으므로 이 모듈에 경로 규칙을 복제하지 않는다.

### context-search/intent-diff-cli/002 · `14ac8324`

#### Goal & intent

`review-diff-intent`에 `collectDiffIntent`를 더한다. `extractChangedFunctions`의 후보에 `resolveIntentAtRevision` 근거를 붙이고, 순위·개수·바이트 예산을 적용한 전달 슬롯과 모든 후보의 coverage manifest, 결과 `digest`를 만든다. CLI 출력 연결은 다음 task 소관이다. 수용 기준은 Target behavior이고, 검증 명령은 frontmatter `verify`다.

#### Current behavior

- 입력/상태/출력: 이전 task까지 `extractChangedFunctions`가 후보(`mapping`, `base_ref`, `snapshot_ref`, 줄 수, `touched_by_nested`)와 파일 coverage를 낸다. 근거 조회·순위·예산·manifest는 없다.
- 근거 조회는 `intent-provenance.resolveIntentAtRevision({ repoRoot, historyRef, symbolRef, limit? })`가 후보당 한 번 한다. 호출마다 그 SHA의 Explain 전체를 읽으므로 호출 수가 비용이다. 직렬화는 `canonical-json.canonicalJson`(키 정렬 compact JSON)과 `sha256Canonical`이다(`packages/cli/src/review-snapshot.ts:8`에서 쓰는 모듈).
- 재현: `node --test test/review-diff-intent.test.js`가 이전 task의 추출 셀을 통과한다. 이 task의 새 동작에는 기존 테스트가 없다.

#### Target behavior

- 입력: `collectDiffIntent({ repoRoot, snapshot, historyRef, deps? })`. 내부에서 `extractChangedFunctions`를 한 번 호출한다. 근거 조회는 `deps.resolveIntentAtRevision`(생략하면 `intent-provenance.resolveIntentAtRevision`)을 후보마다 한 번 부른다.
- 순위와 조회 대상: `base_ref`가 있는 후보(`paired`, `deleted`, `moved`, 그리고 `ambiguous_mapping` 중 base 쪽)를 queryable이라 한다. queryable 후보를 `added_lines + deleted_lines` 내림차순, 같으면 `(base_ref.path, qualified_name, kind)` 오름차순, 그래도 같으면 `base_ref.start_line` 오름차순으로 정렬하고 `rank` 1..N을 매긴다. 상위 8개(`MAX_ENTRIES`)만 근거를 조회한다(`limit` 생략 = 3). 9위부터는 조회하지 않고 `delivery: 'omitted_by_count'`, `evidence: 'not_queried'`다.
- 조회 불가 후보: `mapping: 'added'`는 `evidence: 'added_no_history'`, `delivery: 'manifest_only'`. `ambiguous_mapping`의 snapshot 쪽 후보는 `evidence: 'not_queried'`, `delivery: 'manifest_only'`다. 근거 부재는 `resolveIntentAtRevision.status`가 `unlinked`일 때 `evidence: 'unlinked'`, `resolved`면 `linked`다.
- 함수별 본문 상한: 한 함수의 근거 후보들의 `sections[].body`를 후보 순서·절 순서대로 UTF-8 바이트 합이 3072(`BODY_BYTES`) 이하인 동안만 유지하고, 나머지 절은 통째로 생략한다. 절은 중간에서 자르지 않는다. 생략한 절 수를 `sections_omitted`로 적는다. 첫 절 하나가 3072를 넘으면 그 후보의 절을 모두 생략하되 `commit`·`task`·`explain`·`explain_blob_sha`·`freshness`·`relation`은 남긴다.
- 슬롯과 총 상한: `slot = { summary, entries, manifest_digest, bundle_dedupe: 'not_applied' }`이고 `Buffer.byteLength(canonicalJson(slot), 'utf8') <= 12288`(`SLOT_BYTES`)을 만족한다. 상위 8개를 순위대로 하나씩 시험 추가한다. 시험 직렬화가 상한을 넘으면 그 항목의 절을 마지막 절부터 하나씩 더 생략해 보고, 절이 0개여도 넘으면 `delivery: 'omitted_by_bytes'`로 두고 다음 순위를 계속 시험한다(생략이 9위 이하를 끌어올리지는 않는다). 개수 상한 8보다 바이트 상한이 우선한다. `summary`가 상한 때문에 들어가지 못하는 경우는 없어야 하며 헤더만으로 상한을 넘으면 throw한다.
- `summary`: `changed_files`(= `manifest.files` 길이), `files_not_covered`(coverage가 `covered`가 아닌 파일 수), `candidates_total`, `queryable`, `selected`, `omitted_by_count`, `omitted_by_bytes`, `added_no_history`, `ambiguous_mapping`(그 mapping의 후보 수), `unlinked`(조회한 후보 중 `unlinked` 수).
- `manifest = { files, candidates }`: `files`는 추출 결과 그대로. `candidates`는 추출 순서의 모든 후보에 `rank`(queryable만, 아니면 null), `evidence`, `delivery`를 더한 것이다. `manifest_digest = sha256Canonical(manifest)`.
- 결과: `{ schema_version: 1, projection_version: 'intent-diff/1', budget_policy: 'intent-diff-budget/1', snapshot_id, base, history_ref, slot, manifest, digest }`. `digest`는 `digest`를 뺀 객체의 `sha256Canonical`이다. 같은 `snapshot`·`historyRef`는 같은 `canonicalJson` 바이트를 낸다.
- 보존: `extractChangedFunctions`의 입출력은 바뀌지 않는다. Git 이외의 쓰기는 없고 소스·index·branch를 바꾸지 않는다.

#### Interface

- 제공: `review-diff-intent`의 `export =`에 `collectDiffIntent`를 추가한다.
  ```ts
  type Entry = { rank: number; mapping: Candidate['mapping']; base_ref: SymbolRef | null; snapshot_ref: SymbolRef | null;
    added_lines: number; deleted_lines: number; touched_by_nested: boolean;
    evidence: 'linked' | 'unlinked'; explain_docs: number; total_linked: number;
    candidates: { relation: string; commit: string; task: string; explain: string; explain_blob_sha: string;
      freshness: string; sections: { name: string; body: string }[]; sections_omitted: number }[] };
  collectDiffIntent(i: { repoRoot: string; snapshot: DiffSnapshot; historyRef: string;
    deps?: { resolveIntentAtRevision?: (i: { repoRoot: string; historyRef: string; symbolRef: SymbolRef; limit?: number }) => ReturnType<typeof resolveIntentAtRevision> } }): {
    schema_version: 1; projection_version: 'intent-diff/1'; budget_policy: 'intent-diff-budget/1';
    snapshot_id: string; base: string; history_ref: string;
    slot: { summary: Summary; entries: Entry[]; manifest_digest: string; bundle_dedupe: 'not_applied' };
    manifest: { files: FileCoverage[]; candidates: ManifestCandidate[] }; digest: string };
  ```
  `deps.resolveIntentAtRevision`은 조회 실패(throw)와 호출 횟수를 테스트가 관찰하는 주입 지점이며 운영 호출자는 넘기지 않는다. `Entry`는 `delivery: 'selected'`인 후보만이다. `ManifestCandidate`는 `Candidate`에 `rank`·`evidence`(`linked | unlinked | added_no_history | not_queried`)·`delivery`(`selected | omitted_by_count | omitted_by_bytes | manifest_only`)를 더한 형태다. 상수는 `MAX_ENTRIES = 8`, `BODY_BYTES = 3072`, `SLOT_BYTES = 12288`이며 외부에 노출하지 않는다.
- 거부 (throw): `extractChangedFunctions`의 거부 조건 전부. `resolveIntentAtRevision`이 던지는 Git 실패 등은 삼키지 않고 그대로 올린다(조회 실패를 `unlinked`로 접지 않는다). 헤더만으로 `SLOT_BYTES`를 넘을 때.
- 상태로 돌려주는 정상 부재 (throw와 별도 목록): `unlinked`, `added_no_history`, `not_queried`, `omitted_by_count`, `omitted_by_bytes`, `manifest_only`, 후보 0개(`entries: []`).
- 도메인 용어: `queryable`은 `base_ref`가 있고 mapping이 `paired | deleted | moved | ambiguous_mapping`인 후보(예: 본문을 고친 기존 함수). `slot`은 이후 리뷰 입력으로 쓸 수 있는 전달 단위, `manifest`는 생략된 후보까지 모두 담은 전체 목록이다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/review-diff-intent.ts` | `collectDiffIntent`, 순위·예산 helper | Modify | 변경 함수 후보와 파일 coverage만 낸다 | 근거 조회, 순위, 예산 투영, manifest, digest | 이전 task가 만든 모듈이며 `resolveIntentAtRevision`과 `canonical-json`을 소비한다. `intent-provenance`는 `export =`의 `resolveIntentAtRevision`만 쓴다 |
| `test/review-diff-intent.test.js` | 근거·순위·예산 셀 | Modify | 추출 셀만 있다 | 아래 Checklist 셀 추가 | 새 동작의 검증 지점. 이미 integration tier에 등록됨 |

#### Constraints

- 근거 조회는 최대 8번이다(상위 8개만). 후보 수가 늘어도 호출 수는 늘지 않는다.
- 예산 계산은 항상 `Buffer.byteLength(…, 'utf8')`이다. 문자열 길이를 쓰지 않는다.
- 슬롯은 `manifest`를 포함하지 않는다. `manifest_digest`로만 가리킨다.
- 이전 task의 추출 테스트를 수정하지 않고 모두 통과해야 한다.
- 테스트 fixture의 Explain 문서 형식은 `test/terminal-intent-provenance.test.js:126-165`를 따르되 이 테스트 파일 안에 최소한으로 둔다. 테스트 이름은 `<조건> → <결과>`다.

### context-search/intent-diff-cli/003 · `b3d61fbc`

#### Goal & intent

`bouncer intent diff --snapshot <path> --history-ref <sha> [--repo <dir>]`를 추가한다. 입력을 검증하고 `collectDiffIntent` 결과를 stdout에 JSON 하나로 낸다. 소스·index·branch·리뷰 상태·snapshot artifact를 쓰지 않는다. 수용 기준은 Target behavior이고, 검증 명령은 frontmatter `verify`다.

#### Current behavior

- 입력/상태/출력: `bouncer intent`의 하위 명령은 `bundle`·`sections`뿐이고 그 외 첫 positional은 query 파서가 `unexpected argument`로 거절한다(`packages/cli/src/cli-intent-command.ts:78-86`, `:162`). `diff`는 지금 `intent: unexpected argument: diff`(exit 2)다.
- 지연 적재 계약: `cli-project-commands`가 첫 `intent` 실행에서만 `cli-intent-command`를 `require`하고(`cli-project-commands.ts:85-91`), query·bundle·sections 핸들러는 argv 검증 뒤에만 resolver 모듈을 `require`한다(`:397`, `:431`, `:484`). 기준 문서는 병합된 blueprint `lazy-intent-runtime-boundary`(argv 거절이 resolver를 적재하지 않는다)다.
- snapshot 로더: `loadReviewSnapshot({ repoRoot, snapshotId })`는 `{ ok, snapshot_id, snapshot_path, snapshot }` 또는 `{ ok:false, reason, cause, next }`를 돌려주며 reason은 `invalid-snapshot-id | snapshot-missing | snapshot-corrupt | read-failed | unsafe-path`다. 경로는 `.bouncer/runtime/review-snapshots/<id>/snapshot.json`이다(`review-snapshot.ts:281-283`, `:714`).
- 사용법 정본: `COMMAND_USAGE['intent']`(`cli-usage.ts:20`). `test/cli-help-static.test.js:36-45`는 그 문자열과 `intent --help` 출력의 일치만 검사한다.
- 재현: `runCli(['intent', 'diff'], …)`가 exit 2와 위 오류를 낸다(`test/terminal-intent-provenance.test.js:112-122`의 `capture`와 같은 방식). 이 시점 기준선 테스트 `node --test test/terminal-intent-provenance.test.js`는 통과한다.

#### Target behavior

- 성공 (exit 0): 인자가 유효하고 snapshot·기준이 일치하면 stdout에 `{ ok: true, ...collectDiffIntent 결과 }`를 `JSON.stringify(…, null, 2)` + `\n` 한 번으로 쓴다. stderr는 비어 있다. 같은 입력의 두 실행은 stdout 바이트가 같다.
- 사용법 오류 (exit 2, stdout 비어 있음, stderr `intent: …\n`): `--snapshot`·`--history-ref` 누락, 중복, 빈 값, `--`로 시작하는 값, 알 수 없는 option, 남는 positional, `--history-ref`가 `/^[0-9a-f]{7,40}$/`가 아닌 값(`HEAD`, 브랜치명, 대문자, 6자), `--repo` 중복·빈 값·`--`로 시작하는 값, `--repo` 값이 존재하지 않거나 디렉터리가 아닌 경로(`fs.statSync`만 쓰며 stderr는 `intent: --repo is not a directory: <값>`). 이 경로는 `review-snapshot`·`intent-revision`·`review-diff-intent`·`intent-provenance`·`symbol-index`를 `require`하지 않는다.
- 조회 실패 (exit 1, stdout에 `{ ok: false, reason, cause, next }` 하나, 부분 결과 없음, stderr 비어 있음): `snapshot-path-invalid`(경로가 `<repo>/.bouncer/runtime/review-snapshots/<64자 소문자 hex>/snapshot.json`이 아님. 상대 경로는 `--repo`(없으면 cwd) 기준), 로더의 다섯 reason(변조·부재·symlink 조상 포함), `history-unreadable`(SHA를 커밋으로 확정하지 못함·Git 실패), `history-ref-mismatch`(확정한 SHA ≠ `snapshot.target.base`), `collect-failed`(`collectDiffIntent`가 던진 모든 `Error`로서 `message`가 비어 있지 않은 것. `cause`는 그 메시지다. Git 실패, snapshot의 diff·files 일관성 위반, 예산 헤더 초과를 모두 포함한다). `message`가 비었거나 `Error`가 아닌 값이 던져지면 같은 `collect-failed`이며 `cause`는 고정 문자열 `unexpected exception without message`다. 예외를 다시 던지거나 프로세스를 비정상 종료시키지 않고 항상 exit 1과 JSON 하나로 끝낸다. 앞 단계(`loadReviewSnapshot`, `resolveHistoryRef`)에서 던져진 예외는 `history-unreadable`(`resolveHistoryRef`)과 로더 reason으로만 나가며 `collect-failed`로 섞이지 않는다.
- 저장소 루트와 경로 정규화: `repoRoot`는 `fs.realpathSync(--repo 또는 process.cwd())`다. 상위 디렉터리로 거슬러 올라가 Git 루트를 찾지 않으므로 저장소 하위 디렉터리를 `--repo`로 주면 그 디렉터리가 루트다. `--snapshot` 값이 상대 경로이면 `repoRoot`에 붙이고, 절대 경로이면 `repoRoot + '/'` 또는 `path.resolve(--repo 또는 cwd) + '/'`(심볼릭 링크를 풀기 전 경로) 중 하나로 시작해야 한다. 두 접두사를 뗀 나머지가 글자 그대로 `.bouncer/runtime/review-snapshots/<64자 소문자 hex>/snapshot.json`이어야 하며 `.`·`..`·빈 세그먼트·끝의 `/`·`\`를 담으면 `snapshot-path-invalid`다(`path.resolve`로 접어서 통과시키지 않는다). 경로 안의 symlink는 `path` 검사에서 풀지 않고 로더의 `unsafe-path`가 판정한다.
- 순서: 인자 검증 → 경로 형태 → `loadReviewSnapshot` → `resolveHistoryRef` → 일치 비교 → `collectDiffIntent`. 앞 단계가 실패하면 뒤 단계를 실행하지 않는다.
- 보존: `intent --symbol`, `intent bundle`, `intent sections`의 입력·출력·종료 코드와 `intent --help` 출력의 앞부분은 바뀌지 않는다. 명령은 어떤 파일도 쓰지 않는다.

#### Interface

- 제공: 공개 명령 `bouncer intent diff --snapshot <path> --history-ref <sha> [--repo <dir>]`. 내부 `cli-intent-diff-command`는 `export = { run }`(`run(rest: string[], io: CliIo, deps?: { collectDiffIntent?: typeof collectDiffIntent }): number`)이며 `cli-intent-command`가 `rest[0] === 'diff'`일 때만 `require('./cli-intent-diff-command')`로 적재해 `run(rest.slice(1), io)`를 호출한다.
  ```
  stdout (성공): { "ok": true, "schema_version": 1, "projection_version": "intent-diff/1",
    "budget_policy": "intent-diff-budget/1", "snapshot_id": "…", "base": "…", "history_ref": "…",
    "slot": {…}, "manifest": {…}, "digest": "…" }
  stdout (실패): { "ok": false, "reason": "…", "cause": "…", "next": "…" }
  ```
  `deps.collectDiffIntent`는 `collect-failed` 경로를 테스트가 만드는 주입 지점이며 `cli-intent-command`는 넘기지 않는다(생략하면 `review-diff-intent.collectDiffIntent`를 검증 통과 뒤에 `require`한다).
  `COMMAND_USAGE['intent']`에 `diff` 사용법 두 줄(명령, `Print changed-function intent evidence JSON for a review snapshot (read-only).`)을 기존 `sections` 항목 뒤에 더한다.
- 거부 (throw 대신 종료 코드): 위 사용법 오류는 exit 2, 위 조회 실패는 exit 1. 입력 오류를 성공으로 접지 않는다.
- fallback / 상태: 후보 0개·근거 부재·coverage 실패는 실패가 아니라 exit 0의 정상 출력이다.
- 도메인 용어: `snapshot 경로`는 저장소 상대 또는 절대 경로 문자열이다(예: `.bouncer/runtime/review-snapshots/0123…cdef/snapshot.json`, hex 64자). `history_ref`는 snapshot의 `target.base`와 같아야 하는 커밋 SHA다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/cli-intent-diff-command.ts` | `run`, argv 파서 | Create | 없음 | `diff` 인자 파서, 경로 검증, 로더·기준 검사, 출력 | 신규 추출 지점: intent 하위 명령 핸들러. 검증 통과 뒤에만 resolver 계열을 `require`하는 지연 적재 패턴을 따른다 |
| `packages/cli/src/cli-intent-command.ts` | `cmdIntent` | Modify | query·bundle·sections 분기 | `rest[0] === 'diff'` 분기에서 새 핸들러를 지연 `require` | 분기 진입점은 `:78`(`parseIntentArgs`), `:371`(`cmdIntent`). 소비자: `rg "cli-intent-command" packages/cli/src`는 `cli-project-commands.ts`만 가리키며 `run`만 쓴다 |
| `packages/cli/src/cli-usage.ts` | `COMMAND_USAGE['intent']` | Modify | intent 사용법 문자열 | `diff` 사용법 추가 | 정본(`:20`). `rg "COMMAND_USAGE" test`는 `test/cli-help-static.test.js:11,36,43`이며 문자열 일치만 검사해 영향 없음. `cli-project-commands.ts:604`가 같은 상수를 참조 |
| `rules/cli.md` | intent 명령 목록과 설명 | Modify | intent 하위 명령 3종을 문서화(`:559-562`, `:596-608`) | `intent diff` 한 줄과 짧은 설명 문단 추가 | 문서 조사: `rg "intent sections" rules skills references`가 `rules/cli.md`·`skills/bouncer-run/references/agent-dispatch.md`·`review-round.md` 등을 가리키나 워크플로 연결은 이 blueprint 밖이라 `rules/cli.md`만 갱신. 이 파일을 고정하는 테스트는 `test/build-release.test.js:202`(배포 목록)와 `test/doc-shape-cli.test.js:260-297`(거절 표 형식)뿐이고 `npm run lint:docs`가 형식을 검사한다 |
| `test/intent-diff-command.test.js` | CLI 테스트 | Create | 없음 | 아래 Checklist 셀 | 새 동작의 검증 지점. 실제 Git·자식 프로세스를 쓰므로 integration tier |
| `test/tiers.json` | `integration` 배열 | Modify | tier 정본 | `intent-diff-command.test.js` 추가 | G33과 `scripts/check-task.js` (`test/tiers.json:23-40`) |
| `test/helpers/feature-areas.js` | `FEATURE_AREAS.intent` | Modify | intent 영역 모듈 표 | `'cli-intent-diff-command'` 추가 | 지연 적재 검사가 영역 표로 판정함 |

#### Constraints

- 이 task에서 `CHANGELOG.md`와 버전 파일을 바꾸지 않는다.
- 명령은 `fs` 쓰기와 Git 쓰기 명령을 호출하지 않는다. 읽기 전용은 아래 "읽기 전용" 셀의 동작으로만 확인하고 구현 구조를 단언하지 않는다.
- 지연 적재는 병합된 `lazy-intent-runtime-boundary` blueprint의 계약이므로 아래 "지연 적재" 셀이 `require.cache`를 검사하는 것이 근거 있는 구조 검사다.
- 기존 `intent` 하위 명령의 오류 문구·종료 코드를 바꾸지 않는다.
- `rules/cli.md` 문구는 존재와 위치만 확인하고 문장을 단언하는 테스트를 만들지 않는다.

### context-search/intent-diff-cli/004

#### Goal & intent

앞선 세 task가 모두 통합된 뒤 `npm run verify:bp`(build 포함 `npm test`, `typecheck`, `lint`, `lint:docs`, `check:emit`)를 한 번 실행해, 이 blueprint의 변경이 전체 회귀·타입·정적 검사를 통과함을 증적으로 남긴다. 검증 명령은 frontmatter `verify`다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.

### context-search/intent-diff-cli/005 · `8a072c72`

#### Goal & intent

최종 리뷰 finding을 수정한다.

- SS-001 (minor, spec_scope, must_fix) — test/review-diff-intent.test.js#snapshot 일관성 위반 목록 → 각각 throw하고 원본 snapshot 호출은 성공한다 — tasks/001 checklist
- SS-002 (minor, spec_scope, must_fix) — test/intent-diff-command.test.js#성공과 조회 실패 호출 전후 → 저장소 상태와 runtime 파일 바이트가 같다 — tasks/003 checklist
- CT-001 (minor, correctness_tests, must_fix) — test/intent-diff-command.test.js#--repo가 중복·빈 값·옵션 자리이면 → exit 2, stdout 빈 값 — tasks/003 checklist

#### Interface

- 제공: 기록된 리뷰 finding을 해소하는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `test/review-diff-intent.test.js` — 기록된 리뷰 finding을 수정한다.
- Modify `test/intent-diff-command.test.js` — 기록된 리뷰 finding을 수정한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.