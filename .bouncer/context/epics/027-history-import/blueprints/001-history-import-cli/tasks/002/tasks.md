---
type: bouncer.tasks
title: git 히스토리 수집과 임포트 계획 코어
description: 머지 커밋 우선으로 히스토리를 모아 생성 예정 트리를 계산하는 planImport
resource: .bouncer/context/epics/027-history-import/blueprints/001-history-import-cli/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-11T16:09:15.787+09:00'
bouncer:
  id: TASKS-002
  epic_id: '027'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - 생성 예정 트리를 파일 쓰기 없이 먼저 보여줘야 대량 생성을 되돌릴 일이 없음
    - 수집 소스 판별과 상한 판정을 계산 단계에 몰아 적용 단계가 판단을 반복하지 않게 함
  affected_paths:
    - scripts/src/lib/import-history.ts
    - scripts/lib/import-history.js
    - test/import-history.test.js
  graph:
    generated_at: '2026-08-11T16:18:24.029+09:00'
    command: graphify query (source + context)
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
    basis:
      - graph: source
        status: reused
        query: cli runCli subcommand usage dispatch / ensureEpicIndexEntry epic index consistency
        result: 100+58 hits; scripts/src/lib/{cli,scaffold,epic-index}.ts and their scripts/lib emits. 신설 모듈이라 직접 히트는 없음
      - graph: context
        status: updated
        query: import git history into imported status documents outside gates
        result: 3 hits; 027-history-import/index.md, 022-blueprint-closure BP explain.md
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`planImport`가 git 히스토리를 읽어 생성 예정 트리를 계산해 돌려준다. 파일은 쓰지 않는다. 머지 커밋을 우선 수집하고 하나도 없으면 일반 커밋으로 폴백하되, `--source`가 명시되면 폴백하지 않는다. 상한 초과는 여기서 하드 스톱이고, 워크트리·포인터·디렉터리 선점 같은 적용 단계 차단 사유는 계산해서 `refusals`에 담아만 둔다.

이 task가 끝나면 계획 결과만으로 dry-run 출력에 필요한 모든 값이 나온다. 적용도 CLI 배선도 아직 없다.

## Interface
- 제공
  - 신설 모듈 `scripts/src/lib/import-history.ts`가 `planImport`를 노출한다.
    ```ts
    planImport({
      repoRoot, source, since, limit, epicId, epicName, deps,
    }): ImportPlan
    ```
  - 기본값: `source` 미지정 = 자동(머지 우선), `limit` = `200`, `epicName` = `imported-history`, `epicId` = `.bouncer/context/epics` 스캔 후 다음 빈 세 자리.
  - 반환 형태
    ```ts
    type ImportPlan = {
      ok: boolean;
      source: 'merges' | 'commits';
      fellBack: boolean;
      epicId: string; epicName: string; epicDir: string;
      total: number; limit: number;
      entries: ImportEntry[];
      refusals: { code: string; message: string }[];
      error?: { code: string; message: string };
    };
    type ImportEntry = {
      sha: string; subject: string; date: string; author: string;
      files: string[];
      blueprintId: string; slug: string; blueprintDir: string;
    };
    ```
  - `entries`는 오래된 커밋이 앞이고 `blueprintId`는 `001`부터 1씩 는다.
  - `deps.execFileSync`로 git 호출을 주입할 수 있다. 미주입 시 `node:child_process`를 쓴다.
- 거부
  - 후보 수가 `limit`을 넘으면 `ok: false`, `error.code = 'IMPORT_LIMIT_EXCEEDED'`, 메시지에 전체 개수와 상한을 담고 `entries`는 비운다. 앞에서 잘라 일부만 돌려주지 않는다.
  - `source`가 `merges`/`commits` 밖의 값이면 `ok: false`, `error.code = 'IMPORT_SOURCE_INVALID'`.
  - `epicId`가 `\d{3}`이 아니면 `ok: false`, `error.code = 'IMPORT_EPIC_ID_INVALID'`.
  - 수집 결과가 0건이면 `ok: true`, `entries: []`, `total: 0`. 오류가 아니다.
  - `refusals`에 담기는 적용 차단 사유(계산만 하고 여기서 실패로 만들지 않는다): 더티 워크트리 `IMPORT_WORKTREE_DIRTY`, 활성 포인터 존재 `IMPORT_POINTER_ACTIVE`, 대상 epic 디렉터리 선점 `IMPORT_EPIC_DIR_EXISTS`, `.bouncer/context/index.md` 부재 `IMPORT_CONTEXT_INDEX_MISSING`.

## Touch
- Create `scripts/src/lib/import-history.ts` — 히스토리 수집, 슬러그·번호 배치, 상한 판정, 적용 차단 사유 계산
- Create `scripts/lib/import-history.js` — 위 모듈의 CJS emit
- Create `test/import-history.test.js` — `execFileSync` 주입으로 수집·폴백·상한·슬러그·차단 사유 검증

## Do not touch
- `scripts/src/lib/cli.ts` — CLI 배선은 task 003
- `scripts/src/lib/scaffold.ts` — 임포트는 scaffold 경로를 타지 않는다
- `scripts/src/lib/epic-index.ts` — 목록 등록은 적용 단계인 task 003에서 재사용만 한다
- `scripts/src/lib/validate.ts`
- `scripts/src/lib/schema.ts`
- `.bouncer/context/epics` 하위의 기존 문서

## Constraints
- 이 task의 어떤 경로도 파일을 쓰지 않는다. 쓰기는 전부 task 003이다.
- git 호출은 `deps.execFileSync` 하나로만 나간다. 테스트가 실제 저장소 히스토리에 의존하면 안 된다.
- 네트워크와 `gh`를 쓰지 않는다.
- `--since <ref>`는 `<ref>..HEAD` 범위를 뜻한다. 날짜 문자열 해석을 추가하지 않는다.
- 슬러그는 결정론적이다. 같은 입력에 같은 출력이 나와야 하고 시간·난수를 쓰지 않는다.
- 기존 모듈의 공개 시그니처를 바꾸지 않는다.

## Checklist
- [ ] `test/import-history.test.js`를 만들고, 주입한 `execFileSync`가 머지 커밋 두 건을 돌려줄 때 `source === 'merges'`, `fellBack === false`, `entries.length === 2`임을 assert한다. 모듈이 없으므로 실패한다.
- [ ] `scripts/src/lib/import-history.ts`를 만들어 통과시킨다. 수집 명령은 다음 형태다.
```
git log --merges --reverse --format=%H%x1f%s%x1f%aI%x1f%an [<since>..HEAD]
git log --reverse --format=%H%x1f%s%x1f%aI%x1f%an [<since>..HEAD]
```
- [ ] 각 항목의 변경 파일 목록을 채운다. 머지 커밋은 첫 부모와의 diff, 일반 커밋은 `show`다.
```
git diff --name-only <sha>^1 <sha>      # source === 'merges'
git show --name-only --format= <sha>    # source === 'commits'
```
- [ ] 폴백 테스트를 추가한다. 머지 커밋 0건이면 `source === 'commits'`, `fellBack === true`. `source: 'merges'`를 명시했을 때는 폴백하지 않고 `entries: []`, `fellBack === false`.
- [ ] 상한 테스트를 추가한다. `limit: 2`에 후보 3건이면:
```js
assert.strictEqual(plan.ok, false);
assert.strictEqual(plan.error.code, 'IMPORT_LIMIT_EXCEEDED');
assert.deepStrictEqual(plan.entries, []);
assert.match(plan.error.message, /3/);
assert.match(plan.error.message, /2/);
```
- [ ] 슬러그 테스트를 추가한다. 한글·기호만 있는 제목과 빈 제목은 축약 sha 기반 슬러그로 떨어지고, 같은 제목 두 건이 서로 다른 `blueprintDir`를 갖는다(번호가 다르므로).
- [ ] 번호 배치 테스트를 추가한다. `entries[0].blueprintId === '001'`이고 가장 오래된 커밋이 `entries[0]`이다.
- [ ] 적용 차단 사유 테스트를 추가한다. 더티 워크트리·활성 포인터·epic 디렉터리 선점·context index 부재 각각에서 해당 코드가 `refusals`에 들어가고 `ok`는 여전히 `true`다.
- [ ] `epicId`가 `\d{3}`이 아니거나 `source`가 잘못된 값일 때의 `error.code`를 assert한다.
- [ ] `npm test`가 통과하고 `scripts/lib/import-history.js` emit이 커밋에 포함된다.
