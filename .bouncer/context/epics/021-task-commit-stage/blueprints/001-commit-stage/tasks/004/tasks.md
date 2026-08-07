---
type: bouncer.tasks
title: finalize를 blueprint 마감으로 좁히고 G16을 신설함
description: Tasks for 004
resource: .bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/tasks/004/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-07T14:13:08.438+09:00'
bouncer:
  id: TASKS-004
  epic_id: '021'
  blueprint_id: '001'
  status: ready
  commit_intent:
    - finalize가 task 커밋까지 맡고 있어 열린 task가 남아도 blueprint를 닫을 수 있음
    - finalize를 마감 판정과 승격분 커밋으로 좁히고 열린 task를 게이트로 막음
  affected_paths:
    - scripts/src/lib/finalize.ts
    - scripts/src/lib/validate.ts
    - scripts/lib/finalize.js
    - scripts/lib/validate.js
    - test/finalize-pure.test.js
    - test/finalize.test.js
    - test/validate-gates.test.js
    - test/seed-worktree.test.js
  graph:
    generated_at: '2026-08-07T14:35:00+09:00'
    command: graphify query (source + context)
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - skills
      - docs
    basis:
      - graph: source
        status: updated
        query: buildCommitMessage finalize.ts validate.ts comprehension.ts scaffold explain cli.ts
        result: 12 hits — 전부 폐기된 `.superpowers/` · `commands/sdd-*.md` 노드라 현재 트리와 대응되지 않음. 인덱스가 낡아 경로를 수동 확정
      - graph: context
        status: updated
        query: task 단위 커밋 finalize explain 이해 기록 게이트
        result: source 쿼리와 동일한 폐기 노드 12개. 사용 불가로 판단하고 수동 확정
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`bouncer finalize`가 blueprint 하나를 닫는 명령이 된다. task 커밋은 003의
`bouncer commit`이 이미 끝냈으므로, 여기서 남는 변경은 Distill 승격분 정도다.
게이트 `finalize`는 G15 대신 새 코드 G16으로 blueprint 마감 조건을 본다.

worktree는 blueprint당 하나를 재사용한다. 두 번째 task로 execute에 다시
들어와도 `seed-worktree`가 옮길 것이 없으면 아무 일도 하지 않고 성공한다.

## Interface
- 제공
  - `finalize(...)`의 커밋 메시지가 blueprint 단위다. subject는
    `<commit_type>: <blueprint title>`, 배경·의도는 blueprint
    `bouncer.commit_intent` 2줄. task `title` bullet은 넣지 않는다.
  - G16 (게이트 `finalize`):
    - 모든 task 문서 `bouncer.status`가 `verified`. 아니면 열린 task의 id를
      실패 메시지에 담는다.
    - `explain.md`의 `comprehension`에 task 번호마다 엔트리가 하나씩 있다.
    - `explain.md` 본문 5섹션이 있고 `bouncer.status`가 `published`다.
  - `seedWorktree`가 옮길 대상이 없을 때 `{ ok: true, moved: [] }`로 성공한다.
- 거부
  - 열린 task가 하나라도 남으면 G16 실패다. 사용자가 넘길 수 있는 경고가
    아니다.
  - `explain.md`가 없으면 지금처럼 실패다. 게이트 코드는 G16으로 바뀐다.
  - G15는 `finalize` 게이트에서 사라진다. `commit` 게이트에만 남는다.
  - 범위 밖 변경이 남아 있으면 지금처럼 hard abort다.

## Touch
- Modify `scripts/src/lib/finalize.ts` — 마감 커밋 메시지 빌더와 게이트 호출
- Modify `scripts/src/lib/validate.ts` — `finalize` 게이트를 G16으로 교체
- Modify `scripts/lib/finalize.js` `scripts/lib/validate.js` — CJS 산출물
- Modify `test/finalize-pure.test.js` — 마감 메시지 형태
- Modify `test/finalize.test.js` — 마감 경로와 hard abort
- Modify `test/validate-gates.test.js` — G16의 통과·실패 조건
- Modify `test/seed-worktree.test.js` — 재진입 시 no-op 성공

## Do not touch
- `scripts/src/lib/commit.ts` — 003에서 확정
- `scripts/src/lib/comprehension.ts` — 002
- `scripts/src/lib/current.ts` — 포인터 API와 `nextBlueprint`는 그대로
- `scripts/src/lib/runtime-state.ts` — worktree 경로 규칙은 바꾸지 않는다
- `skills` `docs` — 005

## Constraints
- G15 번호를 재사용하지 않는다. 마감 조건은 새 코드 G16이고, G15는 `commit`
  게이트 전용으로 남는다.
- worktree 디렉터리 경로(`.worktrees/<bp-id>`)와 브랜치 이름 규칙을 바꾸지
  않는다. 이 task가 정하는 것은 "재사용한다"는 동작 계약뿐이다.
- `nextBlueprint` 계산과 포인터 clear 동작은 지금 그대로 둔다. `next` 페이로드
  형태를 바꾸면 스킬의 `next.next` 읽기가 깨진다.
- `makeAllowed`가 `.bouncer/Distill.md`를 허용하는 현행 규칙을 유지한다.
  승격분이 out-of-scope로 잡히면 finalize가 자기 산출물에 막힌다.
- 마감 커밋에 스테이징할 변경이 없으면 빈 커밋을 만들지 않는다.
- **도구 스큐 주의.** 이 커밋부터 `finalize`는 task를 커밋하지 않고 `finalize`
  게이트가 G16(모든 task `verified`)을 요구한다. 설치된 플러그인 캐시(0.6.0)의
  `/bouncer-finalize` 스킬은 아직 `finalize --yes`로 커밋하려 하므로, 이
  blueprint의 남은 task는 `bouncer commit --yes`로 닫고 마지막에만 `finalize`를
  돌린다. CLI는 `BOUNCER_HOME`이 가리키는 이 저장소에서 오지만 스킬과
  commit-safety 훅은 캐시에서 오는 비대칭을 전제로 작업한다.

## Checklist
- [ ] `test/validate-gates.test.js`에 G16 실패 테스트를 먼저 추가한다.
      `tasks/001`이 `verified`, `tasks/002`가 `ready`인 fixture에서:
      ```js
      const res = validateBlueprint({ repoRoot, blueprintDir, gate: 'finalize' });
      assert.equal(res.ok, false);
      assert.ok(res.failures.some((f) => f.code === 'G16' && /TASKS-002/.test(f.message)));
      ```
- [ ] explain 엔트리가 task 하나에만 있을 때 G16이 실패하고, 모든 task에
      있을 때 통과하는지 확인한다.
- [ ] `finalize` 게이트 결과에 G15가 더 이상 나오지 않는지 확인한다.
- [ ] `test/finalize-pure.test.js`에서 마감 커밋 subject가
      `<type>: <blueprint title>`이고 body가 blueprint `commit_intent` 2줄뿐인지
      확인한다.
- [ ] `test/seed-worktree.test.js`에서 base에 옮길 문서가 없을 때
      `{ ok: true, moved: [] }`이고 worktree 파일이 그대로인지 확인한다.
- [ ] 위 테스트가 실패하는 것을 확인한 뒤 `validate.ts` → `finalize.ts` 순으로
      구현한다.
- [ ] `npm run build` 후 `npm test`가 통과한다.
