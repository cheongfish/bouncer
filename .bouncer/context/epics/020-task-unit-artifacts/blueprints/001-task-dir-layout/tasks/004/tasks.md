---
type: bouncer.tasks
title: 구 레이아웃을 옮기는 마이그레이션을 넣고 옛 배치를 구조 실패로 거절함
description: Tasks for 001
resource: .bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/tasks/004/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-07T09:59:09.568+09:00'
bouncer:
  id: TASKS-004
  epic_id: '020'
  blueprint_id: '001'
  status: verified
  affected_paths:
    - scripts/src/lib/migrate-task-layout.ts
    - scripts/src/lib/migrate-ids.ts
    - scripts/src/lib/cli.ts
    - scripts/src/lib/tasks-docs.ts
    - scripts/src/lib/validate.ts
    - scripts/lib/migrate-task-layout.js
    - scripts/lib/migrate-ids.js
    - scripts/lib/cli.js
    - scripts/lib/tasks-docs.js
    - scripts/lib/validate.js
    - test/migrate-task-layout.test.js
    - test/validate-structural.test.js
    - test/tasks-docs.test.js
    - test/cli-help.test.js
    - test/cli-current.test.js
    - test/cli-validate.test.js
    - test/cli-verify.test.js
    - test/commit-guard.test.js
    - test/commit-hook.test.js
    - test/current.test.js
    - test/cursor-plugin.test.js
    - test/finalize-pure.test.js
    - test/finalize.test.js
    - test/init.test.js
    - test/migrate-ids.test.js
    - test/native-profile-e2e.test.js
    - test/paths.test.js
    - test/runtime-state.test.js
    - test/scaffold.test.js
    - test/seed-worktree.test.js
    - test/validate-gates.test.js
    - test/verification-runner.test.js
    - docs/cli.md
    - docs/troubleshooting.md
    - docs/gates.md
    - .bouncer/context/epics
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
`bouncer migrate task-layout`이 구 레이아웃 문서를 `tasks/<NNN>/`로 옮기고
frontmatter `resource`와 활성 포인터의 `task` 경로를 재작성한다. 같은 커밋에서
이 저장소의 001~019 트리에 apply를 돌리고, `bouncer validate`가 구 레이아웃을
구조 실패로 거절하도록 바꾼다.

거절 시점과 이동 시점을 갈라놓으면 그 사이 커밋에서 이 저장소가 자기 문서에
validate 실패한다. 그래서 도구·apply·하드컷이 한 커밋이다.

## Interface
- 제공
  - `migrateTaskLayout({ repoRoot, dryRun, deps })` → `{ ok, plan, moved, rewritten, pointer, warnings }`.
    `plan`은 `{ from, to }` 목록이다.
  - CLI `bouncer migrate task-layout [--dry-run]`. 기본은 apply.
  - 이동 규칙
    - `<bp>/tasks.md` → `<bp>/tasks/001/tasks.md` (id `TASKS-<bpId>` → `TASKS-001`)
    - `<bp>/tasks-<NNN>.md` → `<bp>/tasks/<NNN>/tasks.md`
    - `<bp>/verification.md`·`<bp>/review.md` → 번호가 가장 앞선 묶음으로
    - 짝이 없는 묶음에는 `pending` 상태의 `verification.md`·`review.md`를 새로 만든다
  - `validate`가 새 구조 코드를 낸다: `S15` 구 레이아웃 잔존, `S16` 비정본
    task 디렉터리 이름, `S17` 묶음에 세 문서 중 일부가 없음.
- 거부
  - 워킹트리가 dirty하면 아무것도 옮기지 않고 실패한다. `migrate ids`의
    all-or-nothing 규칙을 따른다.
  - 구·신 레이아웃이 한 blueprint에 섞여 있으면 옮기지 않고 실패한다. 자동
    병합을 시도하지 않는다.
  - 대상 경로가 이미 존재하면 덮어쓰지 않고 실패한다.
  - 활성 포인터가 없거나 다른 blueprint를 가리키면 파일만 옮기고 포인터는
    건드리지 않는다.
  - SessionStart 훅은 이 마이그레이션을 자동 실행하지 않는다.

## Touch
- Create `scripts/src/lib/migrate-task-layout.ts` — 계획·검증·적용과 포인터 재작성
- Modify `scripts/src/lib/migrate-ids.ts` — `isWorktreeDirty`·`walkMarkdownFiles` export만 추가
- Modify `scripts/src/lib/cli.ts` — `migrate task-layout` 서브커맨드와 usage
- Modify `scripts/src/lib/tasks-docs.ts` — 구 레이아웃 인식 제거와 잔존 보고
- Modify `scripts/src/lib/validate.ts` — `S15`·`S16`·`S17` 구조 검사 추가
- Create `test/migrate-task-layout.test.js` — dry-run·apply·거절 조건·포인터 재작성
- Modify `test/validate-structural.test.js` — 새 구조 코드
- Modify `test/tasks-docs.test.js` — 레거시 제거 후 동작
- Modify `test/cli-help.test.js` — usage 문구
- Modify 관련 fixture tests — 구형 task 파일 fixture를 `tasks/<NNN>/` 묶음으로 전환
- Modify `docs/cli.md` — `migrate task-layout` 사용법
- Modify `docs/troubleshooting.md` — `S15`~`S17`을 만났을 때의 조치
- Modify `docs/gates.md` — S 코드 범위와 구 레이아웃 하드컷 문구
- Rename `.bouncer/context/epics` 아래 기존 task·verification·review 문서 — 이 저장소 트리에 apply 적용
- Modify `scripts/lib/migrate-task-layout.js` `scripts/lib/cli.js` `scripts/lib/tasks-docs.js` `scripts/lib/validate.js` — `npm run build`가 다시 만드는 CJS 산출물
- Modify `scripts/lib/migrate-ids.js` — source export의 CJS 산출물

## Do not touch
- id 마이그레이션의 동작과 CLI 배선 — task-layout은 기존 유틸의 export만 추가한다
- `scripts/src/lib/scaffold.ts` — 001에서 확정
- `hooks` — SessionStart는 이 마이그레이션을 자동 실행하지 않는다
- `docs/PILOT.md` — 과거 기록은 소급 수정하지 않는다

## Constraints
- 파일 이동은 `git mv`로 한다. 히스토리 추적이 끊기면 리뷰가 어려워진다.
- `migrate-ids.ts`의 `isWorktreeDirty`·`walkMarkdownFiles`를 export해 재사용한다.
  id 마이그레이션의 동작·CLI 배선은 바꾸지 않고 같은 일을 하는 함수를 새로 쓰지 않는다.
- `bouncer.id`·`epic_id`·`blueprint_id` 값은 레거시 `tasks.md` → `TASKS-001`
  경우를 빼면 그대로 둔다. `resource`만 새 경로로 바꾼다.
- 새로 만드는 짝 문서의 status는 `pending`이다. 과거 task를 통과한 것처럼
  꾸미지 않는다 (하드룰 3).
- 이 저장소 apply는 `--dry-run` 결과를 먼저 확인한 뒤 실행한다.
- apply 이후 이 blueprint 자신의 task 문서도 `tasks/00N/tasks.md`로 옮겨진다.
  포인터 재작성이 그 경로를 따라가야 이어지는 finalize가 브리프를 찾는다.

## Checklist
- [ ] `test/migrate-task-layout.test.js`를 만들고 실패 테스트부터 쓴다. 루트
      `tasks-001.md`·`tasks-002.md`·`verification.md`·`review.md`를 둔 fixture에서:
      ```js
      const res = migrateTaskLayout({ repoRoot, dryRun: true });
      assert.equal(res.ok, true);
      assert.deepEqual(res.plan.map((p) => p.to).sort(), [
        `${bp}/tasks/001/review.md`,
        `${bp}/tasks/001/tasks.md`,
        `${bp}/tasks/001/verification.md`,
        `${bp}/tasks/002/tasks.md`,
      ]);
      ```
      dry-run 뒤 디스크가 변하지 않았음을 확인한다.
- [ ] apply가 위 이동을 수행하고 `tasks/002/`에 `pending` 상태
      `verification.md`·`review.md`를 새로 만드는지 확인한다.
- [ ] 옮겨진 문서의 frontmatter `resource`가 새 경로와 같은지 확인한다.
      레거시 `tasks.md`는 `bouncer.id`가 `TASKS-001`로 바뀌었는지도 확인한다.
- [ ] 포인터가 `<bp>/tasks-002.md`일 때 apply 후 포인터 `task`가
      `<bp>/tasks/002/tasks.md`인지 확인한다. 포인터가 다른 blueprint를 가리키면
      변하지 않는지도 확인한다.
- [ ] dirty 워킹트리·혼재 레이아웃·대상 경로 선점 세 경우에 `ok: false`이고
      파일이 하나도 변하지 않음을 확인한다.
- [ ] 위 테스트가 실패하는 것을 확인한 뒤 `migrate-task-layout.ts`를 구현하고
      `cli.ts`에 배선한다.
- [ ] `test/validate-structural.test.js`에 `S15`·`S16`·`S17` 기대를 추가하고
      `validate.ts`를 구현한다. `tasks-docs.ts`에서 레거시 인식을 걷어낸다.
- [ ] `node scripts/bouncer migrate task-layout --dry-run`으로 이 저장소의 이동
      계획을 확인한 뒤 apply 한다.
- [ ] `node scripts/bouncer validate --blueprint <각 blueprint> --gate finalize`가
      기존 blueprint들에 대해 그대로 통과하는지 확인한다.
- [ ] `docs/cli.md`·`docs/troubleshooting.md`·`docs/gates.md`를 갱신한다.
- [ ] `npm test`가 통과한다.
