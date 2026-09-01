---
type: bouncer.tasks
title: worktree 경로를 epic 단위로 중첩하고 해석을 헬퍼로 모음
description: Tasks for 001
resource: .bouncer/context/epics/018-task-unit-commits/blueprints/013-nested-worktree-path/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-10T15:59:35.434+09:00'
bouncer:
  id: TASKS-001
  epic_id: '018'
  blueprint_id: '013'
  status: verified
  affected_paths:
    - scripts/src/lib/runtime-state.ts
    - scripts/lib/runtime-state.js
    - test/runtime-state.test.js
    - test/skill-bouncer-execute.test.js
    - test/skill-bouncer-finalize.test.js
    - skills/bouncer-execute/SKILL.md
    - skills/bouncer-finalize/SKILL.md
    - docs/ARCHITECTURE.md
    - docs/context-versioning.md
  graph:
    generated_at: '2026-08-10T16:12:35.220+09:00'
    command: graphify query (source + context)
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - skills/bouncer-execute
      - skills/bouncer-finalize
      - docs
    basis:
      - graph: source
        status: updated
        query: execute worktree path runtime-state ensureWorktreeRoot worktreeRoot
          parsePathIds epic blueprint id nested directory finalize remove
        result: 48 nodes; scripts/src/lib/{runtime-state,paths,current}.ts와 그 CJS emit,
          test/skill-bouncer-surface.test.js. source_dirs가 scripts/hooks/test라
          skills/·docs/는 반환되지 않아 suggested_paths에 손으로 추가
      - graph: context
        status: updated
        query: worktree 디렉터리 이름 규칙 epic 중첩 브랜치 execute finalize 정리
        result: 19 nodes; 023 epic/blueprint 본문과 EPIC-012 finalize-handoff — 코드 경로
          히트 없음
---
# Tasks

Blueprint: [013](../../index.md)

## Goal & intent
`runtime-state`에 `worktreePathFor`가 생겨 blueprint 디렉터리 경로 하나로
execute worktree 경로를 결정한다. 결과는 `.worktrees/<epic-id>/<bp-id>`이고,
중첩 경로가 없는데 평면 경로 `.worktrees/<bp-id>`가 이미 있으면 그 평면 경로를
그대로 돌려준다. `ensureWorktreeRoot`는 사라지고, `skills/bouncer-execute`의
worktree 생성·재사용과 `skills/bouncer-finalize`의 제거가 모두 이 함수가 준
경로를 쓴다. finalize는 제거 뒤 비어버린 epic 디렉터리도 정리한다.

브랜치 이름 규칙(`<commit_type>/<bp-id>-<slug>`)과 blueprint 하나가 worktree
하나를 재사용한다는 규칙은 바뀌지 않는다. 위치만 바뀐다.

## Interface
- 제공
  - `runtime-state.worktreePathFor({ repoRoot, blueprint, deps })` → 절대 경로
    문자열. `blueprint`는 repo 상대 blueprint 디렉터리 경로
    (예: `.bouncer/context/epics/018-task-unit-commits/blueprints/013-nested-worktree-path`).
    `paths.parsePathIds`로 뽑은 `epicId`/`blueprintId`를
    `runtimePaths().worktreeRoot` 아래에 그 순서로 잇는다.
  - 레거시 폴백: `<worktreeRoot>/<epicId>/<blueprintId>`가 디렉터리로 존재하지
    않고 `<worktreeRoot>/<blueprintId>`가 존재하면 후자를 돌려준다.
  - `skills/bouncer-execute` 2단계와 `skills/bouncer-finalize` 4단계가 같은
    node 한 줄로 `WORKTREE_PATH`를 얻는다.
- 거부
  - 디렉터리를 만들지 않는다. `.worktrees` 루트와 epic 디렉터리 생성은
    `git worktree add`에 맡긴다.
  - Git 공통 디렉터리를 못 읽으면
    `Bouncer requires a Git repository for an active blueprint`로 throw한다.
  - `blueprint`에서 `epicId` 또는 `blueprintId`를 못 뽑으면 throw한다. 구형
    `EPIC-`/`BP-` 접두 경로는 여기서 흡수하지 않는다 —
    `bouncer migrate ids`가 선행이다.
  - 중첩 경로와 평면 경로가 둘 다 있으면 평면을 무시하고 중첩을 돌려준다.
  - `ensureWorktreeRoot`를 별칭이나 deprecated export로 남기지 않는다.

## Touch
- Modify `scripts/src/lib/runtime-state.ts` — `worktreePathFor` 추가,
  `ensureWorktreeRoot` 제거, `paths.parsePathIds` import
- Modify `scripts/lib/runtime-state.js` — 위 변경의 CJS emit
- Modify `test/runtime-state.test.js` — `ensureWorktreeRoot` 테스트를
  `worktreePathFor` 테스트로 교체(중첩 경로·레거시 폴백·둘 다 존재·id 추출
  실패·비 Git·디렉터리 미생성)
- Modify `skills/bouncer-execute/SKILL.md` — 2단계 worktree 경로 산출을
  `worktreePathFor` 호출로 교체하고 위치 설명을 중첩 경로로 고침
- Modify `skills/bouncer-finalize/SKILL.md` — 4단계 제거 경로를 같은 호출로
  교체하고 빈 epic 디렉터리 정리를 추가
- Modify `test/skill-bouncer-execute.test.js` — `ensureWorktreeRoot` 단정을
  `worktreePathFor`로 바꾸고 중첩 경로 단정 추가
- Modify `test/skill-bouncer-finalize.test.js` — 제거가 `worktreePathFor` 결과를
  쓰고 빈 epic 디렉터리를 정리한다는 단정 추가
- Modify `docs/ARCHITECTURE.md` — 2항의 `<repo>/.worktrees/<id>` 표기를 중첩
  경로로 고침
- Modify `docs/context-versioning.md` — execute worktree 행의 경로 표기를 중첩
  경로로 고침

## Do not touch
- `scripts/src/lib/finalize.ts` — `RUNTIME_ARTIFACTS`의 `.worktrees/`는 접두
  매칭이라 중첩 경로도 이미 걸린다
- `scripts/lib/finalize.js` — 같은 이유
- `scripts/src/lib/init.ts` — `SUGGESTED_IGNORES`의 `.worktrees/`도 같은 이유
- `scripts/lib/init.js` — 같은 이유
- `scripts/src/lib/session-graph.ts` — 스캔 제외 목록은 디렉터리 이름 매칭이라
  중첩과 무관하다
- `scripts/src/lib/paths.ts` — `parsePathIds`를 그대로 재사용하고 확장하지
  않는다
- `scripts/src/lib/seed-worktree.ts` — 목적지를 `--to`로 받으므로 변경 없음
- `docs/troubleshooting.md` — `.worktrees/` 무시 안내는 그대로 유효하다
- `.bouncer/Distill.md` — Decision 갱신은 `/bouncer-finalize`가 `explain.md`에서
  승격한다

## Constraints
- `scripts/lib/*.js`는 손으로 고치지 않는다. `scripts/src/**`를 고치고
  `npm run build`(또는 `pretest`)로 emit을 재생성한 결과를 커밋한다.
- 코드·CLI 메시지는 기존과 같이 영어, 문서 본문은 한국어를 유지한다.
- 하위 호환 별칭을 남기지 않는다. `ensureWorktreeRoot`는 export와 정의를 함께
  지운다.
- `runtimePaths`의 반환 키(`commonGitDir` `currentFile` `worktreeRoot`)와
  `readRuntimeCurrent` / `writeRuntimeCurrent` / `clearRuntimeCurrent`의 시그니처는
  건드리지 않는다.
- `worktreePathFor`는 `platform === 'win32'`일 때 `path.win32`를 쓰는 기존
  `runtimePaths` 규약을 그대로 따른다.
- 브랜치 이름은 `<type>/<BP-id>-<slug>` 그대로다. 기존 스킬 테스트의 해당
  단정을 약화시키지 않는다.
- finalize의 빈 디렉터리 정리는 중첩 경로를 지웠을 때로 한정하고, `rmdir`
  실패는 무시한다. `-r`/`--force` 삭제를 쓰지 않는다.

## Checklist
- [ ] `test/runtime-state.test.js`에서 `ensureWorktreeRoot` 테스트를 지우고
      `worktreePathFor` 테스트를 더한 뒤 실패를 확인한다. 기본 경로부터.
      ```js
      const bp = '.bouncer/context/epics/018-task-unit-commits/blueprints/013-nested-worktree-path';
      assert.strictEqual(
        worktreePathFor({ repoRoot: primary, blueprint: bp, deps }),
        path.join(primary, '.worktrees', '023', '001'),
      );
      assert.strictEqual(fs.existsSync(path.join(primary, '.worktrees')), false);
      ```
- [ ] 레거시 폴백 테스트를 더한다. 평면 디렉터리를 만들어 두고 중첩이 없을 때
      평면이 나오는지 본다.
      ```js
      fs.mkdirSync(path.join(primary, '.worktrees', '001'), { recursive: true });
      assert.strictEqual(
        worktreePathFor({ repoRoot: primary, blueprint: bp, deps }),
        path.join(primary, '.worktrees', '001'),
      );
      ```
- [ ] 둘 다 존재할 때 중첩이 이긴다는 테스트를 더한다.
      ```js
      fs.mkdirSync(path.join(primary, '.worktrees', '023', '001'), { recursive: true });
      assert.strictEqual(
        worktreePathFor({ repoRoot: primary, blueprint: bp, deps }),
        path.join(primary, '.worktrees', '023', '001'),
      );
      ```
- [ ] id 추출 실패와 비 Git 저장소 테스트를 더한다.
      ```js
      assert.throws(() => worktreePathFor({
        repoRoot: primary,
        blueprint: '.bouncer/context/epics/EPIC-023/blueprints/BP-001',
        deps,
      }));
      assert.throws(
        () => worktreePathFor({ repoRoot: nonGit, blueprint: bp, deps }),
        /Bouncer requires a Git repository for an active blueprint/,
      );
      ```
- [ ] `scripts/src/lib/runtime-state.ts`에 `worktreePathFor`를 구현한다.
      `resolvedPaths`로 `worktreeRoot`를 얻고(불가면 `GIT_REQUIRED` throw),
      `parsePathIds(blueprint)`로 두 id를 뽑아 없으면 throw, 중첩 경로가 없고
      평면 경로가 디렉터리면 평면을, 아니면 중첩을 돌려준다. `mkdirSync`를
      쓰지 않는다.
- [ ] `ensureWorktreeRoot` 정의와 `module.exports` 항목을 지우고,
      `worktreePathFor`를 export에 넣는다.
- [ ] `npm run build`로 `scripts/lib/runtime-state.js` emit을 재생성한다.
      ```bash
      npm run build
      ```
- [ ] `test/skill-bouncer-execute.test.js`의 `ensureWorktreeRoot` 단정을 바꾸고
      실패를 확인한다.
      ```js
      assert.match(body, /worktreePathFor/);
      assert.doesNotMatch(body, /ensureWorktreeRoot/);
      assert.match(body, /\.worktrees\/<epic-id>\/<bp-id>/);
      ```
- [ ] `skills/bouncer-execute/SKILL.md` 2단계를 고친다. 위치 문장을
      `<repo>/.worktrees/<epic-id>/<bp-id>`로 바꾸고, 셸 블록을 다음으로
      교체한다. `seed-worktree`가 `git worktree add` 뒤에 오는 순서는 유지한다.
      ```bash
      BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
      WORKTREE_PATH="$(node -e "process.stdout.write(require('${BOUNCER_ROOT}/scripts/lib/runtime-state').worktreePathFor({repoRoot:process.cwd(),blueprint:'<pointer.blueprint>'}))")"
      if [ -d "${WORKTREE_PATH}" ]; then
        : # reuse existing blueprint worktree
      else
        git worktree add -b <type>/<BP-id>-<slug> "${WORKTREE_PATH}" <base>
      fi
      ```
- [ ] 그 산문에 평면 경로 재사용을 한 구절로 적는다 — 이미 열린
      `.worktrees/<bp-id>`가 있으면 헬퍼가 그 경로를 돌려주므로 재사용 분기가
      그대로 걸리고, 옮기지 않는다.
- [ ] `test/skill-bouncer-finalize.test.js`에 단정을 더하고 실패를 확인한다.
      ```js
      assert.match(body, /worktreePathFor/);
      assert.match(body, /rmdir/);
      ```
- [ ] `skills/bouncer-finalize/SKILL.md` 4단계의 제거 지시를 고친다. 하드코딩된
      `<repo>/.worktrees/<BP-id>` 대신 execute와 같은 한 줄로 경로를 얻고,
      제거 뒤 빈 epic 디렉터리를 정리한다. `--force`는 기존대로 dirty-tree ACQ
      뒤에만 붙인다.
      ```bash
      git worktree remove "${WORKTREE_PATH}"
      rmdir "$(dirname "${WORKTREE_PATH}")" 2>/dev/null || true
      ```
- [ ] `docs/ARCHITECTURE.md` 2항의 `execute 체크아웃은 <repo>/.worktrees/<id>에
      두며` 문장을 `<repo>/.worktrees/<epic-id>/<bp-id>`로 고친다.
- [ ] `docs/context-versioning.md`의 `execute worktree` 행 경로를
      `<repo>/.worktrees/<epic id>/<blueprint id>`로 고치고, 평면 경로는 기존
      worktree에 한해 재사용된다는 것을 같은 칸에 한 구절로 적는다.
- [ ] `npm test`를 돌려 통과를 확인한다.
      ```bash
      npm test
      ```
