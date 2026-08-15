---
type: bouncer.tasks
title: Git 생명주기 모듈 strict 타입
description: Tasks for 005
resource: .bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/005/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-15T15:42:17.409+09:00'
bouncer:
  id: TASKS-005
  epic_id: '039'
  blueprint_id: '001'
  status: ready
  verify: npm run verify:strict
  commit_intent:
    - 포인터·커밋·finalize·마이그레이션의 Git 경계가 any라 실패 결과와 주입 의존성의 형태를 보장하지 못함
    - Git 부수효과와 순수 판정 사이 타입을 고정하고 스테이징·worktree·포인터 동작을 유지함
  affected_paths:
    - tsconfig.strict.json
    - eslint.config.js
    - scripts/src/lib/runtime-state.ts
    - scripts/src/lib/current.ts
    - scripts/src/lib/commit-hook.ts
    - scripts/src/lib/commit-guard.ts
    - scripts/src/lib/commit.ts
    - scripts/src/lib/finalize.ts
    - scripts/src/lib/seed-worktree.ts
    - scripts/src/lib/comprehension.ts
    - scripts/src/lib/migrate-ids.ts
    - scripts/src/lib/migrate-task-layout.ts
    - scripts/lib/runtime-state.js
    - scripts/lib/current.js
    - scripts/lib/commit-hook.js
    - scripts/lib/commit-guard.js
    - scripts/lib/commit.js
    - scripts/lib/finalize.js
    - scripts/lib/seed-worktree.js
    - scripts/lib/comprehension.js
    - scripts/lib/migrate-ids.js
    - scripts/lib/migrate-task-layout.js
  graph:
    generated_at: '2026-08-15T15:55:18+09:00'
    command: 'graphify query "TypeScript strict git lifecycle current commit hook guard finalize worktree comprehension migration" --graph graphify-out/{source,context}/graph.json'
    suggested_paths:
      - test
      - .bouncer/distill
      - .bouncer/context/epics/012-finalize-handoff
      - .bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard
    basis:
      - graph: source
        status: reused
        query: TypeScript strict git lifecycle current commit hook guard finalize worktree comprehension migration
        result: '71 nodes; top paths: test/session-graph.test.js, test/legacy-ids-warn.test.js, test/githooks.test.js'
      - graph: context
        status: reused
        query: TypeScript strict git lifecycle current commit hook guard finalize worktree comprehension migration
        result: '8 nodes; top paths: epic 012, epic 033, and .bouncer/distill/git-worktree.md'
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
포인터, commit hook, task commit, finalize, worktree seed, comprehension,
마이그레이션 모듈을 strict 검사 범위에 추가한다. 실제 Git 호출과 테스트용 주입
객체가 같은 명시적 계약을 따르며, 명령 순서와 stdout/stderr는 바뀌지 않는다.

## Interface
- 제공: current pointer, Git adapter, staged result, commit/finalize result,
  migration plan, worktree seed 결과에 명시적 타입을 부여하고 strict include를 넓힌다.
- 거부: Git 명령 순서, dry-run/`--yes` 의미, 스테이징 허용 경로, 포인터 위치,
  마이그레이션 all-or-nothing 계약 변경을 허용하지 않는다.

## Touch
- Modify `tsconfig.strict.json` — Git 생명주기 모듈을 누적 include한다.
- Modify `eslint.config.js` — 같은 모듈군을 TypeScript lint 대상에 누적한다.
- Modify `scripts/src/lib/runtime-state.ts` — git-common-dir 포인터 IO와 deps 타입을 고정한다.
- Modify `scripts/src/lib/current.ts` — pointer·candidate·task selection 타입을 고정한다.
- Modify `scripts/src/lib/commit-hook.ts` — shell token·alias·commit 판정 타입을 고정한다.
- Modify `scripts/src/lib/commit-guard.ts` — 스코프 판정 입력·출력 타입을 고정한다.
- Modify `scripts/src/lib/commit.ts` — task commit 입력·Git adapter·결과 타입을 고정한다.
- Modify `scripts/src/lib/finalize.ts` — remainder staging·lock·next 결과 타입을 고정한다.
- Modify `scripts/src/lib/seed-worktree.ts` — worktree Git adapter와 seed 결과 타입을 고정한다.
- Modify `scripts/src/lib/comprehension.ts` — diff hash·comprehension entry 타입을 고정한다.
- Modify `scripts/src/lib/migrate-ids.ts` — migration 발견·계획·적용 타입을 고정한다.
- Modify `scripts/src/lib/migrate-task-layout.ts` — task layout migration 타입을 고정한다.
- Modify `scripts/lib/runtime-state.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/current.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/commit-hook.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/commit-guard.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/commit.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/finalize.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/seed-worktree.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/comprehension.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/migrate-ids.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/migrate-task-layout.js` — TypeScript 변경의 CJS emit을 동기화한다.

## Do not touch
- `hooks` — 설치 호스트 adapter는 공개 CJS 표면을 그대로 소비한다.
- `test` — Git 호출 순서와 결과 단언을 약화하지 않는다.
- `tsconfig.json` — 전체 strict 전환은 TASKS-007이 맡는다.

## Constraints
- `execFileSync`·파일시스템 주입점은 기존 테스트가 넣는 fake를 그대로 받는다.
- destructive Git·파일 작업의 기존 guard와 실행 순서를 바꾸지 않는다.
- catch 값은 `unknown`에서 `Error`/NodeJS 오류로 좁힌다.
- 타입 전용 변경으로 새로운 Git 명령이나 플래그를 추가하지 않는다.

## Checklist
- [ ] strict include와 ESLint 대상 목록을 넓혀 새 오류를 확인한다.
- [ ] Git adapter와 주입 deps의 최소 구조 타입을 정의하고 외부 오류를 좁힌다.
- [ ] 공개 result object의 필드와 명령 호출 순서가 테스트 fixture와 같은지 확인한다.
- [ ] `npm run build`로 열 CJS emit을 동기화한다.
- [ ] `npm run verify:strict`를 실행한다.
