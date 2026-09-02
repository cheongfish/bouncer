---
type: bouncer.tasks
title: 임포트 적용 경로와 bouncer import 명령
description: Tasks for blueprint 005.
resource: .bouncer/context/epics/014-numeric-context-ids/blueprints/005-history-import-cli/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-11T16:09:15.787+09:00'
bouncer:
  id: TASKS-003
  epic_id: '014'
  blueprint_id: '005'
  status: verified
  commit_intent:
    - 문서 200건 생성은 되돌리기 어려워 차단 사유를 전부 쓰기 이전 단계에 모음
    - epic 디렉터리만 생기고 목록 등록이 빠지면 저장소 전체 validate가 S13으로 깨짐
  affected_paths:
    - scripts/src/lib/import-history.ts
    - scripts/src/lib/cli.ts
    - scripts/lib/import-history.js
    - scripts/lib/cli.js
    - test/import-history.test.js
    - test/cli-help.test.js
    - docs/cli.md
  graph:
    generated_at: '2026-08-11T16:18:24.029+09:00'
    command: graphify query (source + context)
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - docs
    basis:
      - graph: source
        status: reused
        query: cli runCli subcommand usage dispatch / ensureEpicIndexEntry epic index consistency
        result: 100+58 hits; scripts/src/lib/cli.ts, scripts/lib/cli.js, scripts/src/lib/epic-index.ts, scripts/src/lib/scaffold.ts
      - graph: context
        status: updated
        query: import git history into imported status documents outside gates
        result: 3 hits; 027-history-import/index.md, 022-blueprint-closure BP explain.md
---
# Tasks

Blueprint: [005](../../index.md)

## Goal & intent
`applyImport`가 task 002의 계획을 받아 `imported` 문서 트리를 쓰고 커밋 하나로 남긴다. `bouncer import`가 그 두 단계를 CLI로 노출한다. 기본은 dry-run이고 `--yes --message <msg>`일 때만 쓴다.

쓰기 전에 차단 사유를 전부 확인한다. 200건을 쓰다 중간에 멈추면 epic 디렉터리는 있는데 목록 등록이 없는 상태가 남고, 그 순간 저장소의 **모든** blueprint에 대한 `bouncer validate`가 S13으로 깨진다. 그래서 차단 판정은 전부 첫 파일을 쓰기 전이다.

## Interface
- 제공
  - `scripts/src/lib/import-history.ts`가 `applyImport`를 추가로 노출한다.
    ```ts
    applyImport({ repoRoot, plan, message, deps }): ImportResult
    type ImportResult = {
      ok: boolean;
      created: string[];
      committed: boolean;
      message?: string;
      error?: { code: string; message: string };
    };
    ```
  - 생성물은 임포트 epic `index.md` 하나와 `entries` 하나당 blueprint `index.md` 하나, 그리고 `.bouncer/context/index.md`의 epic 한 줄.
  - 임포트 epic 본문 헤딩은 `## Intent`와 `## Blueprints`뿐이다.
  - blueprint 본문 헤딩은 `## Source`(sha·날짜·작성자), `## Message`(커밋 메시지 원문), `## Changes`(변경 파일 목록)다.
  - 두 문서 모두 `bouncer.status: imported`.
  - CLI: `bouncer import [--repo <dir>] [--source merges|commits] [--since <ref>] [--limit <n>] [--epic-id <ddd>] [--epic-name <slug>] [--yes --message <msg>]`
  - dry-run은 계획 JSON을 stdout에 내고 exit 0, 파일을 쓰지 않는다.
- 거부
  - `plan.ok`가 거짓이거나 `plan.refusals`가 비어 있지 않으면 아무 파일도 쓰지 않고 `ok: false`로 끝난다.
  - `message`가 없거나 공백뿐이면 `IMPORT_MESSAGE_REQUIRED`로 거절한다.
  - `plan.entries`가 비어 있으면 파일도 커밋도 만들지 않고 `ok: true`, `committed: false`로 끝난다.
  - CLI에서 `--yes` 없이 `--message`만 주면 dry-run으로 취급하고 메시지를 무시한다.
  - CLI 종료 코드: 성공 `0`, 계획 오류·차단 사유·`--message` 누락 `2`.

## Touch
- Modify `scripts/src/lib/import-history.ts` — `applyImport`와 문서 본문 렌더링 추가
- Modify `scripts/lib/import-history.js` — 위 변경의 CJS emit 갱신
- Modify `scripts/src/lib/cli.ts` — `cmdImport` 추가, `switch`에 `import` 분기, `USAGE`에 명령 한 줄
- Modify `scripts/lib/cli.js` — 위 변경의 CJS emit 갱신
- Modify `test/import-history.test.js` — `applyImport`의 생성물·차단·원자성 검증 추가
- Modify `test/cli-help.test.js` — `SUBCOMMANDS` 배열에 `import` 추가
- Modify `docs/cli.md` — 명령 표에 `bouncer import` 행 추가

## Do not touch
- `scripts/src/lib/scaffold.ts` — 임포트 문서는 scaffold 템플릿을 쓰지 않는다. `renderDoc`을 직접 부른다
- `scripts/src/lib/templates.ts` — 임포트 본문은 템플릿 파일이 아니라 전사 결과다
- `scripts/src/lib/validate.ts` — `imported` 분기는 task 001에서 끝났다
- `scripts/src/lib/schema.ts`
- `scripts/src/lib/current.ts` — 포인터는 읽기만 한다. 읽기 경로는 task 002에서 이미 들어갔다
- `scripts/src/lib/commit.ts`

## Constraints
- `.bouncer/context/index.md` 등록은 `epic-index.ts`의 `ensureEpicIndexEntry`를 쓴다. 목록 줄 형식을 직접 조립하지 않는다.
- epic 본문에 `## Success criteria` 헤딩을 쓰지 않는다. 그 헤딩은 context 다이제스트 화이트리스트라 임포트분 전체가 그래프에 실린다.
- 임포트 문서에 `tasks/`·`verification.md`·`review.md`·`explain.md`를 만들지 않는다.
- 커밋 메시지는 `--message` 인자를 그대로 쓴다. `.gitmessage` 형식을 조립하거나 문서 필드에서 만들지 않는다.
- git 호출은 task 002가 정한 `deps.execFileSync` 한 경로로만 나간다.
- 스테이징은 생성한 경로만 대상으로 한다. `git add -A`를 쓰지 않는다.
- `bouncer import`는 대화형 확인을 하지 않는다. 확인 절차는 dry-run과 `--yes` 2단이다.

## Checklist
- [ ] `test/import-history.test.js`에 실패 테스트를 추가하고 실패를 확인한다. 임시 저장소에서 `entries` 두 건짜리 계획을 적용했을 때:
```js
const r = applyImport({ repoRoot: repo, plan, message: 'chore: import', deps });
assert.strictEqual(r.ok, true);
assert.ok(r.created.includes('.bouncer/context/index.md'));
assert.strictEqual(r.created.filter((p) => /blueprints\/\d{3}-.*\/index\.md$/.test(p)).length, 2);
assert.strictEqual(r.committed, true);
```
- [ ] `applyImport`를 구현한다. 순서는 차단 판정 → 문서 렌더링 → 파일 쓰기 → `ensureEpicIndexEntry` → 스테이징 → 커밋이다.
- [ ] 생성된 epic `index.md`에 `## Success criteria`가 없고 `bouncer.status`가 `imported`임을 assert한다.
```js
const epic = readDoc(path.join(repo, r.created[0]));
assert.strictEqual(epic.data.bouncer.status, 'imported');
assert.ok(!epic.body.includes('## Success criteria'));
```
- [ ] 생성된 blueprint 디렉터리에 `tasks`·`verification.md`·`review.md`·`explain.md`가 없음을 assert한다.
- [ ] 차단 테스트를 추가한다. `plan.refusals`에 항목이 하나라도 있으면 `ok: false`이고 `fs.existsSync(epicDirAbs)`가 거짓이다. `plan.ok`가 거짓인 계획도 같다.
- [ ] `message` 누락·공백 테스트를 추가한다. `error.code === 'IMPORT_MESSAGE_REQUIRED'`이고 파일이 생기지 않는다.
- [ ] `entries`가 빈 계획은 `ok: true`, `committed: false`, `created: []`임을 assert한다.
- [ ] 적용 후 임포트 blueprint에 `validateBlueprint({ gate: 'plan' })`을 돌려 실패 코드가 `['S18']` 하나임을 assert한다. epic 027 성공 기준 4·7을 이 한 줄이 같이 증명한다.
- [ ] `test/cli-help.test.js`의 `SUBCOMMANDS`에 `'import'`를 넣고 실패를 확인한다.
- [ ] `scripts/src/lib/cli.ts`에 `cmdImport`를 추가하고 `switch`와 `USAGE`를 배선해 통과시킨다. USAGE 줄은 기존 항목과 같은 두 줄 형식이다.
```
  import     [--source merges|commits] [--since <ref>] [--limit <n>]
             [--epic-id <ddd>] [--epic-name <slug>] [--yes --message <msg>]
             Transcribe git history into imported epic/blueprint documents.
```
- [ ] CLI 종료 코드를 assert한다. dry-run `0`, 상한 초과 `2`, `--yes` + `--message` 누락 `2`.
- [ ] `docs/cli.md` 명령 표에 `bouncer import` 행을 추가한다. 기본이 dry-run이고 `--yes --message`가 적용이라는 점을 적는다.
- [ ] `npm test`가 통과한다.
