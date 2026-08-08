---
type: bouncer.tasks
title: 잠긴 blueprint의 task 스캐폴드 거절
description: Tasks for 002
resource: .bouncer/context/epics/022-blueprint-closure/blueprints/001-closed-status/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-08T13:17:10.191+09:00'
bouncer:
  id: TASKS-002
  epic_id: '022'
  blueprint_id: '001'
  status: ready
  commit_intent:
    - 잠금 status가 생겨도 scaffold task는 그대로 문서를 만들어 마감된 단위가 다시 열림
    - task 문서가 생기기 전에 거절하고 새 blueprint 경로를 알려 줌
  affected_paths:
    - scripts/src/lib/scaffold.ts
    - scripts/lib/scaffold.js
    - test/scaffold.test.js
    - docs/cli.md
  graph:
    generated_at: '2026-08-08T13:30:24.658+09:00'
    command: graphify query (source + context)
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - docs
    basis:
      - graph: source
        status: reused
        query: blueprint closed status lock finalize scaffold task validate G2 schema
          status enum
        result: 57 nodes; scripts/src/lib/scaffold.ts와 cli.ts가 상위 히트.
          source_dirs가 scripts/hooks/test라 docs/는 반환되지 않아 손으로 추가
      - graph: context
        status: updated
        query: 마감된 blueprint 잠금 status closed finalize 전이
        result: 19 nodes; 022 epic/blueprint 본문만 히트 — 코드 경로 히트 없음
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`bouncer scaffold task --blueprint <closed blueprint>`가 문서를 만들지 않고 exit 2로
거절하며, 새 blueprint를 만들라는 안내를 stderr로 낸다. 001이 세운 `closed` status를
읽어 판정하는 쪽이라 001 다음에 온다.

## Interface
- 제공
  - `scaffoldTask({ repoRoot, blueprintDir, taskId, timestamp })`가 대상 blueprint
    `index.md`의 `bouncer.status`가 `closed`면 throw한다. 에러 메시지는 blueprint가
    마감됐다는 사실과 새 blueprint를 만들라는 안내를 담는다.
  - `bouncer scaffold task`가 그 에러를 기존 catch 경로로 받아 `scaffold: <메시지>`를
    stderr에 쓰고 exit 2를 낸다.
- 거부
  - throw 이전에 어떤 파일도 만들지 않는다. `tasks/<NNN>/` 디렉터리도 남기지 않는다.
  - `draft` / `approved` / `superseded` blueprint에는 거절하지 않는다.
  - `index.md`가 없거나 프론트매터 파싱에 실패하면 판정하지 않고 기존대로 진행한다.
  - `scaffoldBlueprint`가 새 blueprint를 만들며 부르는 `scaffoldTask('001')`은
    그 blueprint가 `draft`이므로 영향을 받지 않는다.

## Touch
- Modify `scripts/src/lib/scaffold.ts` — `scaffoldTask` 진입부에 잠금 판정 추가
- Modify `scripts/lib/scaffold.js` — 위 변경의 CJS emit
- Modify `test/scaffold.test.js` — 잠긴 blueprint 거절과 비잠금 blueprint 통과 회귀
- Modify `docs/cli.md` — `scaffold task` 행에 잠긴 blueprint 거절 동작 기술

## Do not touch
- `scripts/src/lib/finalize.ts` — 잠금 기록은 001에서 끝났다
- `scripts/lib/finalize.js` — 같은 이유
- `scripts/src/lib/validate.ts` — G2 문구는 001에서 끝났다
- `scripts/lib/validate.js` — 같은 이유
- `scripts/src/lib/schema.ts` — 어휘 추가는 001에서 끝났다
- `scripts/lib/schema.js` — 같은 이유
- `skills/` — 차단은 CLI에서 하고 스킬 프로즈는 바꾸지 않는다
- `.bouncer/Distill.md` — Distill 승격은 `/bouncer-finalize` 몫이다

## Constraints
- `scripts/lib/*.js`는 손으로 고치지 않는다. `scripts/src/**` 를 고치고
  `npm run build`(또는 `pretest`)로 emit을 재생성한 결과를 커밋한다.
- 거절은 `scaffoldTask`가 throw하는 방식으로 한다. `cli.ts`에 새 분기를 넣지 않는다
  — 기존 catch가 이미 `scaffold: <메시지>` + exit 2를 낸다.
- 에러 메시지는 기존 `scaffold.ts` 문구와 같이 영어로 쓴다.
- 프론트매터 읽기는 `parseFrontmatter`를 쓰고 별도 파서를 만들지 않는다.
- `scaffoldBlueprint` → `scaffoldTask` 호출 순서와 반환 형태를 바꾸지 않는다.

## Checklist
- [ ] `test/scaffold.test.js`에 잠긴 blueprint 거절 테스트를 더하고 실패를 확인한다.
      blueprint `index.md`의 status를 `closed`로 둔 뒤 `scaffoldTask`가 throw하고
      `tasks/002/` 가 생기지 않는지 본다.
      ```js
      assert.throws(() => scaffoldTask({ repoRoot, blueprintDir, taskId: '002', timestamp }),
        /closed/);
      assert.strictEqual(fs.existsSync(path.join(repoRoot, blueprintDir, 'tasks', '002')), false);
      ```
- [ ] `approved` blueprint에서는 `scaffoldTask`가 그대로 성공한다는 회귀를 더한다.
- [ ] `scripts/src/lib/scaffold.ts`의 `scaffoldTask` 진입부에서 blueprint `index.md`를
      읽어 `bouncer.status`가 `closed`면 throw한다. 파일 없음·파싱 실패는 통과시킨다.
- [ ] `scaffoldBlueprint`가 만든 새 blueprint에서 첫 task 묶음이 여전히 생성되는지
      기존 테스트로 확인한다.
- [ ] `docs/cli.md`의 `bouncer scaffold task` 행에 잠긴 blueprint에서 거절된다는
      것과 그때 새 blueprint를 만들라는 안내가 나온다는 것을 적는다.
- [ ] `npm test`를 돌려 통과를 확인한다.
      ```bash
      npm test
      ```
