---
type: bouncer.tasks
title: task 문서 묶음을 인식하고 생성하는 리졸버와 스캐폴드를 만듦
description: Tasks for 001
resource: .bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-07T09:59:09.568+09:00'
bouncer:
  id: TASKS-001
  epic_id: '020'
  blueprint_id: '001'
  status: verified
  affected_paths:
    - scripts/src/lib/tasks-docs.ts
    - scripts/src/lib/paths.ts
    - scripts/src/lib/scaffold.ts
    - scripts/src/lib/cli.ts
    - scripts/src/lib/templates.ts
    - scripts/lib/tasks-docs.js
    - scripts/lib/paths.js
    - scripts/lib/scaffold.js
    - scripts/lib/cli.js
    - scripts/lib/templates.js
    - test/tasks-docs.test.js
    - test/paths.test.js
    - test/scaffold.test.js
    - test/cli-help.test.js
    - test/init.test.js
  graph:
    generated_at: '2026-08-07T10:17:53.578+09:00'
    command: graphify query (source + context)
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - skills
      - agents
      - docs
      - .bouncer/context/epics
    basis:
      - graph: source
        status: reused
        query: listTasksDocs tasks-docs scaffold validate verification migrate cli lib
        result: 15 hits — scripts/src/lib의 tasks-docs·paths·scaffold·validate·verification· current과 대응 scripts/lib CJS 산출물, test/cli-verify.test.js
      - graph: context
        status: updated
        query: task 단위 커밋 verification review 게이트 문서 배치
        result: 5 hits — 과거 epic들의 verification.md뿐이라 affected_paths 후보가 아님. source_dirs가 scripts/hooks/test라 skills·agents·docs는 수동 추가
---
# Tasks

Blueprint: [001](index.md)

## Goal & intent
`listTasksDocs`가 `<bp>/tasks/<NNN>/` 디렉터리를 task 묶음으로 인식하고, 묶음마다
`tasks.md`·`verification.md`·`review.md` 세 경로와 세 id를 함께 돌려준다.
`bouncer scaffold blueprint`는 새 blueprint를 새 레이아웃으로 만들고,
`bouncer scaffold task`는 기존 blueprint에 묶음을 추가한다.

이 task까지는 구 레이아웃(루트 `tasks.md`·`tasks-<NNN>.md`)도 그대로 인식한다.
거절은 004가 한다. 그래야 002·003 커밋 시점에 이 저장소의 기존 문서가
`bouncer validate`를 통과한다.

## Interface
- 제공
  - `listTasksDocs({ repoRoot, blueprintDir })`의 각 엔트리가
    `{ dir, number, tasks: { rel, id }, verification: { rel, id }, review: { rel, id } }`
    를 갖는다. `dir`은 `<bp>/tasks/<NNN>`, 구 레이아웃 엔트리는 `dir`이 `null`이고
    `verification`·`review`가 blueprint 루트 경로를 가리킨다.
  - `expectedTaskDocIds(number)` → `{ tasks: 'TASKS-<NNN>', verification: 'VERIFY-<NNN>', review: 'REVIEW-<NNN>' }`.
    기존 `expectedTasksId(basename, blueprintId)`는 레거시 판정용으로 남긴다.
  - `TASK_DIR_RE = /^(\d{3})$/`와 `TASK_UNIT_BASENAMES = ['tasks.md', 'verification.md', 'review.md']`
    를 export 한다. 다른 모듈은 이 문자열을 직접 쓰지 않는다.
  - `scaffoldBlueprint`가 `<bp>/tasks/001/` 세 문서를 만든다.
  - `scaffoldTask({ repoRoot, blueprintDir, taskId, timestamp })`가 묶음 3종을 만들고
    생성한 경로 배열을 돌려준다.
  - CLI `bouncer scaffold task --blueprint <dir> --id <NNN>`.
- 거부
  - `scaffoldTask`의 `--id`가 `\d{3}`이 아니면 예외를 던지고 아무것도 쓰지 않는다.
  - 대상 `<bp>/tasks/<NNN>` 디렉터리가 이미 있으면 덮어쓰지 않고 예외를 던진다.
  - `blueprintDir`이 정본 blueprint 경로가 아니면 예외를 던진다.
  - `tasks/1`·`tasks/01`·`tasks/foo` 같은 디렉터리는 엔트리로 만들지 않고
    `listTasksDocs` 반환값의 `invalidDirs`에 이름만 담는다. 판정은 002가 한다.

## Touch
- Modify `scripts/src/lib/tasks-docs.ts` — 디렉터리 기반 묶음 리졸버로 확장하고 `expectedTaskDocIds`·`invalidDirs`를 추가
- Modify `scripts/src/lib/paths.ts` — `tasks/<NNN>/tasks.md`를 레거시 루트 `tasks.md`와 구분해 kind를 판정
- Modify `scripts/src/lib/scaffold.ts` — `scaffoldBlueprint`를 새 레이아웃으로 바꾸고 `scaffoldTask`를 추가
- Modify `scripts/src/lib/cli.ts` — `scaffold task` 서브커맨드와 usage 한 줄 추가
- Modify `scripts/src/lib/templates.ts` — blueprint `## Documents` 링크를 `tasks/001/…` 경로로 교체
- Modify `test/tasks-docs.test.js` — 묶음 인식·번호 정렬·비정본 디렉터리·레거시 병존 케이스
- Modify `test/paths.test.js` — 새 경로의 kind 판정
- Modify `test/scaffold.test.js` — `scaffoldBlueprint` 산출 경로와 `scaffoldTask` 중복 거절
- Modify `test/cli-help.test.js` — usage에 `scaffold task`가 나오는지
- Modify `test/init.test.js` — blueprint Documents 링크 assertion을 `tasks/001/…`로 맞춤
- Modify `scripts/lib/tasks-docs.js` `scripts/lib/paths.js` `scripts/lib/scaffold.js` `scripts/lib/cli.js` `scripts/lib/templates.js` — `npm run build`가 다시 만드는 CJS 산출물. 소비자가 Node만으로 돌리므로 함께 커밋한다

## Do not touch
- `scripts/src/lib/validate.ts` — 게이트 전환은 002
- `scripts/src/lib/verification.ts` — 증적 기록 경로는 002
- `scripts/src/lib/finalize.ts` — 002
- `scripts/src/lib/migrate-ids.ts` — id 마이그레이션과 무관
- `skills` — 스킬 문구는 003
- `docs` — 문서는 003
- `.bouncer/context/epics` — 기존 트리 이동은 004

## Constraints
- 구 레이아웃 인식을 이 task에서 제거하지 않는다. `npm test`와
  `bouncer validate`가 이 저장소의 001~019 문서에 대해 계속 통과해야 한다.
- `tasks.md`·`verification.md`·`review.md` 문자열과 `\d{3}` 디렉터리 판정은
  `tasks-docs.ts` 밖으로 새지 않는다. 다른 모듈은 export된 상수와 함수만 쓴다.
  Distill Invariant를 그대로 이어받는다.
- `scaffoldTask`는 파일을 만들기 전에 모든 거절 조건을 먼저 검사한다. 일부만
  생성된 상태를 남기지 않는다.
- 새로 만드는 세 문서의 기본 status는 scaffold 관례를 따른다 — tasks `draft`,
  verification `pending`, review `pending` (`review.required: true`).
- `graph.basis`는 빈 배열로 둔다. G4는 graphify-runner가 채운다.

## Checklist
- [ ] `test/tasks-docs.test.js`에 실패 테스트를 먼저 추가한다. `<bp>/tasks/001/`과
      `<bp>/tasks/002/`를 만든 fixture에서:
      ```js
      const { entries, invalidDirs } = listTasksDocs({ repoRoot, blueprintDir });
      assert.equal(entries.length, 2);
      assert.equal(entries[0].dir, `${blueprintDir}/tasks/001`);
      assert.equal(entries[0].tasks.rel, `${blueprintDir}/tasks/001/tasks.md`);
      assert.equal(entries[0].verification.id, 'VERIFY-001');
      assert.equal(entries[1].review.id, 'REVIEW-002');
      assert.deepEqual(invalidDirs, []);
      ```
- [ ] `tasks/01`·`tasks/foo`를 추가한 fixture에서
      `assert.deepEqual(invalidDirs, ['01', 'foo'])`이고 `entries.length`는 그대로임을 확인한다.
- [ ] 레거시 fixture(루트 `tasks-001.md` + 루트 `verification.md`)에서
      `entries[0].dir === null`, `entries[0].verification.rel === `${blueprintDir}/verification.md``
      임을 확인한다.
- [ ] 위 테스트가 실패하는 것을 확인한 뒤 `tasks-docs.ts`를 구현한다.
- [ ] `paths.test.js`에
      `assert.equal(parsePathIds('.bouncer/context/epics/020-x/blueprints/001-y/tasks/002/tasks.md').kind, 'tasks')`
      와 같은 경로로 `verification`·`review` kind 판정을 추가하고 구현한다.
- [ ] `scaffold.test.js`에서 `scaffoldBlueprint`의 반환 배열이
      `index.md`, `tasks/001/tasks.md`, `tasks/001/verification.md`,
      `tasks/001/review.md` 넷임을 확인하고 구현한다.
- [ ] `scaffoldTask`가 `--id 002`로 3종을 만들고, 같은 id로 다시 부르면
      `throws`하며 파일이 변하지 않음을 확인하고 구현한다.
- [ ] `cli.ts`에 `scaffold task --blueprint <dir> --id <NNN>`을 배선하고 usage에
      한 줄 추가한다. `--blueprint`나 `--id`가 없으면 stderr로 안내하고 비정상
      종료한다.
- [ ] `templates.ts`의 blueprint `## Documents` 링크를 `tasks/001/tasks.md` 등으로
      바꾼다.
- [ ] `npm test`가 통과한다.
