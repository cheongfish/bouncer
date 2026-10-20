---
type: bouncer.tasks
title: legacy epic 병합 이관 명령 적용 경로와 CLI 추가
description: Add bouncer migrate merge-legacy-epics with dry-run by default, guarded apply, and moved_to registry writes.
resource: .bouncer/context/epics/context-search/blueprints/legacy-epic-merge/tasks/004/tasks.md
tags:
  - bouncer
  - tasks
  - migration
  - cli
  - epic-registry
timestamp: '2026-10-20T21:02:17.953+09:00'
bouncer:
  id: TASKS-004
  epic_id: context-search
  blueprint_id: legacy-epic-merge
  status: ready
  execution_kind: commit
  depends_on:
    - TASKS-002
    - TASKS-003
  parallel_safe: false
  dependency_gate: integrated
  verify: node --test test/migrate-merge-legacy-epics.test.js test/cli-help.test.js test/migrate-context-slugs.test.js
  review_risk:
    - public_interface
  affected_paths:
    - scripts/src/lib/migrate-merge-legacy-epics.ts
    - scripts/src/lib/cli-project-commands.ts
    - scripts/src/lib/cli-usage.ts
    - rules/cli.md
    - test/migrate-merge-legacy-epics.test.js
    - test/cli-help.test.js
  commit_intent:
    - legacy epic blueprint를 사람이 손으로 옮기지 않고 한 명령으로 도메인 epic 아래로 옮기게 함.
    - 적용 전에는 dry-run으로 이동·충돌을 보이고 진행 중 실행이 있으면 거절함.
  commit_summary:
    - 이동·문서 재작성·등록부 moved_to 기록을 적용하고 옮긴 blueprint를 검증함.
    - migrate 하위 명령과 사용법·규칙 문서를 더함.
---
# Tasks

Blueprint: [legacy-epic-merge](../../index.md)

## Goal & intent
`bouncer migrate merge-legacy-epics [--yes] [--repo <dir>]`를 완성한다. `--yes`가 없으면 TASKS-003의 계획과 재작성 결과를 쓰기 없이 보고하고, `--yes`면 가드를 통과한 뒤 blueprint를 `git mv`로 옮기고 문서를 다시 쓰고 등록부 legacy 항목에 `moved_to`를 기록한 다음 옮긴 blueprint를 검증한다. 수용 기준: blueprint 수용 기준 3·4. 검증 명령은 `node --test test/migrate-merge-legacy-epics.test.js test/cli-help.test.js test/migrate-context-slugs.test.js`.

## Current behavior
- `migrate` 하위 명령은 `cmdMigrate`(`scripts/src/lib/cli-project-commands.ts:488-560`)가 kind별로 모듈을 지연 로드해 JSON을 출력한다. exit는 성공 0, 실패 1, 잘못된 인자 2다. `context-slugs`는 전용 엄격 파서 `parseContextSlugsMigrateArgs`(`:413-445`)로 알 수 없는·중복 option을 거절하고, 계산 단계 예외를 `migrate-failed` JSON으로 바꾼다(`:533-545`).
- 사용법 문구는 `scripts/src/lib/cli-usage.ts:27`의 `migrate` 항목, 규칙 문서는 `rules/cli.md:499-515` `## Controlled migrations`다. `test/cli-help.test.js:67-69`가 `migrate context-slugs [--yes]` 줄을 단언한다.
- 가드 선례(`scripts/src/lib/migrate-context-slugs.ts:627-709`) 순서: 등록부 S35 → 빈 계획이면 쓰기 없는 성공 → `migrate-registry-missing` → `migrate-dirty-tree`(`git status --porcelain`) → `migrate-in-progress`(`defaultListInProgress`: pointer·승인 파일·ledger·연결 worktree) → `migrate-slug-conflict`. `--yes`가 없으면 `{ ok: true, dryRun: true, moved, rewritten, … }`. 적용은 `git mv` → 문서 쓰기 → 등록부 원자 쓰기(tmp + rename)이고, 예외는 `migrate-failed` + `next: RESTORE_NEXT`(`:82`), 적용 뒤 `validateBlueprint` 실패는 `migrate-validate-failed`다.
- `readEpicRegistry`는 주입 fs가 아니라 실제 fs를 읽는다(`:634`).
- TASKS-003 이후 `migrate-merge-legacy-epics.ts`에는 계획 함수만 있고, 공용 재작성 모듈 `context-migration-rewrite.ts`가 있다.

## Target behavior
- 성공(dry-run): `{ ok: true, dryRun: true, moved: [{from,to,order}], rewritten: <문서 수>, movedTo: { <legacy-slug>: { <bp>: <domain> } }, unresolved_rows: [...], validate: [] }`. `from`·`to`는 TASKS-003 `MergeMove`와 같은 `.bouncer/context/epics/...` 저장소 상대 경로다. `unresolved_rows`가 있어도 dry-run은 계획을 낸다. 디스크·git 쓰기 0회.
- 성공(적용): 위 순서로 쓰고 `{ ok: true, dryRun: false, moved, rewritten, movedTo, validate: [{ blueprint, ok: true, failures: [] }…] }`.
  - 등록부 legacy 항목에 `moved_to`를 병합해 쓴다. `kind`·`legacy_id`·`blueprint_aliases`는 그대로다.
  - legacy epic 디렉터리에는 `index.md`가 남고, 그 안 blueprint 링크는 새 경로를 가리킨다.
  - 옮긴 blueprint 문서의 `epic_id`·`resource`·`order`·파생 해시는 공용 재작성 규칙으로 바뀐다(`orderMode: 'overwrite'`).
  - 적용 뒤 옛 번호 trailer로 `resolveTaskCommits({ …, registry })`가 새 위치 task를 찾는다.
- 성공(멱등): 이미 옮겨진 저장소에서 다시 실행하면 쓰기 없이 `moved: []`다.
- 실패: `--yes`인데 계획의 `unresolved_rows`가 비어 있지 않으면 `merge-mapping-invalid`(details에 그 행들)로 쓰기 전에 거절한다. 계획 실패(`merge-mapping-invalid`, `migrate-slug-conflict`), `migrate-registry-missing`, S35, `migrate-dirty-tree`, `migrate-in-progress`(blockers 포함), `migrate-failed`(+`next`), `migrate-validate-failed`. 계획·가드 실패는 쓰기 0회다.
- 보존: `migrate context-slugs`의 동작·출력이 바뀌지 않는다.

## Interface
- 제공: CLI `bouncer migrate merge-legacy-epics [--yes] [--repo <dir>]`. 사용법 한 줄과 `rules/cli.md` 코드 블록·설명 한 문단.
  ```ts
  migrateMergeLegacyEpics({ repoRoot, yes = false, deps }: { repoRoot: string; yes?: boolean;
    deps?: { runGit?: (args: string[]) => { stdout: string }; fs?: typeof import('node:fs');
      listInProgress?: (o: { repoRoot: string }) => { kind: string; path: string }[] } })
  ```
  `deps`는 테스트 seam이다(`migrate-context-slugs`와 같은 모양).
- 거부 (exit 2): 알 수 없는 option, 중복 `--yes`/`--repo`, 값 없는 `--repo`, 남는 인자.
- 거부 (exit 1, JSON): 위 실패 코드.

## Touch
| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/migrate-merge-legacy-epics.ts` | `migrateMergeLegacyEpics` | Modify | 계획 계산만(TASKS-003) | 가드·dry-run·적용·등록부 `moved_to` 쓰기·검증 추가 | 명령 진입점 |
| `scripts/src/lib/cli-project-commands.ts` | `cmdMigrate`, `신규 추출 지점: merge-legacy-epics 인자 파서` | Modify | kind별 분기(`:488-560`) | `merge-legacy-epics` 분기와 엄격 인자 파서 추가 | CLI 진입점 |
| `scripts/src/lib/cli-usage.ts` | `'migrate'` 항목 | Modify | 하위 명령 사용법(`:27`) | 새 줄 추가 | 공개 사용법 |
| `rules/cli.md` | `## Controlled migrations` | Modify | 이관 명령 목록·설명(`:499-515`) | 명령 줄과 설명 한 문단 추가 | 규칙 문서 정합 |
| `test/migrate-merge-legacy-epics.test.js` | 적용·가드·CLI 단언 | Modify | 계획 단언만(TASKS-003) | git fixture로 dry-run 쓰기 0회·적용·멱등·가드·trailer 해석·CLI exit 단언 | 검증 지점 |
| `test/cli-help.test.js` | 사용법 단언 | Modify | `context-slugs` 줄 단언(`:67-69`) | `migrate\s+merge-legacy-epics \[--yes\]` 단언 추가 | 사용법 소유 테스트 |

## Do not touch
- `scripts/src/lib/migrate-context-slugs.ts` — TASKS-003에서 추출이 끝났다. 이 task에서 동작을 바꾸지 않는다.
- `scripts/src/lib/epic-registry.ts` — `moved_to` 검사는 TASKS-002가 만든다. 여기서는 파서를 통과하는 값만 쓴다.
- `scripts/src/lib/context-ids.ts` — TASKS-002 소관.
- `skills/bouncer-plan/SKILL.md` — 워크플로 안내 변경 범위가 아니다.

## Constraints
- 이 저장소의 `.bouncer/`에 명령을 실행하지 않는다(blueprint Out of scope). 테스트는 임시 git fixture에서만 적용한다.
- 자동 롤백을 만들지 않는다. 실패 시 `RESTORE_NEXT`와 같은 복구 명령을 `next`로 낸다.
- 가드는 쓰기 전에 모두 판정한다. 가드 실패에서 git·fs 쓰기 호출 수는 0이다(`instrument` 방식으로 센다, `test/migrate-context-slugs.test.js:204-231` 참고).
- 승인 파일·ledger·과거 verification 증적을 새로 만들지 않는다. 해시는 원래 공식과 일치한 값만 다시 계산한다.

## Checklist
- [ ] `test/migrate-merge-legacy-epics.test.js`에 적용 단언을 추가한다(TASKS-003 fixture를 git 저장소로 확장). 기대 red: `migrateMergeLegacyEpics`가 없어 호출에서 실패한다.
  ```js
  const dry = migrateMergeLegacyEpics({ repoRoot, deps: counted });
  assert.strictEqual(dry.dryRun, true); assert.strictEqual(counted.writes, 0);
  const res = migrateMergeLegacyEpics({ repoRoot, yes: true });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(countBlueprints(repoRoot), before);            // 수 동일
  assert.ok(res.validate.every((v) => v.ok));
  assert.deepStrictEqual(registry.epics.find((e) => e.slug === 'a').moved_to, { x: 'd1', y: 'd2' });
  assert.ok(fs.existsSync(path.join(repoRoot, '.bouncer/context/epics/a/index.md')));
  assert.ok(resolveTaskCommits({ repoRoot, base, head, stableIds: ['d1/x/001'], registry }).has('d1/x/001'));
  ```
  추가: 두 번째 실행 `moved: []`, 더러운 트리·pointer 존재 → 쓰기 0회 거절, 자유 서술 예외 행이 있는 fixture → dry-run은 `ok: true`와 `unresolved_rows` 1건, `--yes`는 쓰기 0회 `merge-mapping-invalid`, CLI `merge-legacy-epics --yes --yes` → exit 2.
- [ ] `test/cli-help.test.js`에 사용법 단언을 추가한다. 기대 red: 정규식 불일치.
- [ ] `npm run build && node --test test/migrate-merge-legacy-epics.test.js test/cli-help.test.js`로 red 확인.
- [ ] 적용 경로·CLI 분기·사용법·`rules/cli.md`를 구현한다.
- [ ] `npm run build` 뒤 `node --test test/migrate-merge-legacy-epics.test.js test/cli-help.test.js test/migrate-context-slugs.test.js`가 통과한다.
