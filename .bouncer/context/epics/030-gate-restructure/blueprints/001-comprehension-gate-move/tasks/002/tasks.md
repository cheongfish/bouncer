---
type: bouncer.tasks
title: commit 게이트 재정의와 G17 스코프 검사
description: Tasks for 002
resource: .bouncer/context/epics/030-gate-restructure/blueprints/001-comprehension-gate-move/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-12T11:14:29.559+09:00'
bouncer:
  id: TASKS-002
  epic_id: '030'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - 커밋 직전 스테이징 범위를 게이트가 직접 보게 됨
    - 훅이 설치되지 않았거나 우회된 환경에서도 범위를 벗어난 커밋이 막힘
  affected_paths:
    - scripts/src/lib/scope.ts
    - scripts/lib/scope.js
    - scripts/src/lib/finalize.ts
    - scripts/lib/finalize.js
    - scripts/src/lib/commit.ts
    - scripts/lib/commit.js
    - scripts/src/lib/commit-guard.ts
    - scripts/lib/commit-guard.js
    - scripts/src/lib/seed-worktree.ts
    - scripts/lib/seed-worktree.js
    - scripts/src/lib/validate.ts
    - scripts/lib/validate.js
    - test/validate-gates.test.js
    - test/cli-commit.test.js
    - test/commit-task.test.js
    - test/finalize-pure.test.js
    - test/validate-structural.test.js
  graph:
    generated_at: '2026-08-12T12:45:49.000+09:00'
    command: graphify query (source + context)
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
    basis:
      - graph: source
        status: reused
        query: commit gate comprehension explain diff_sha staged affected_paths scope validate finalize
        result: 90 nodes — makeAllowed()/isUnder()가 finalize.ts에 있고 commit.ts·commit-guard.ts·seed-worktree.ts가 그것을 참조함을 확인
      - graph: context
        status: updated
        query: commit gate comprehension explain diff_sha staged affected_paths scope validate finalize
        result: 14 nodes — epic 013-comprehension-gate blueprints 001/002/003 explain.md 섹션
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`validate --gate commit`이 `explain.md`를 더 이상 보지 않는다. 대신 포인터
task의 `tasks`/`verification`/`review` 상태를 G6/G7/G8로 다시 판정하고,
스테이징된 경로가 그 task의 `affected_paths` 안인지 신규 코드 G17로 검사한다.
G15는 폐기하고 번호를 비워 둔다. 검사에 필요한 `makeAllowed`가 `finalize.ts`
에 있고 `finalize.ts`가 `validate.ts`를 require하므로, 그 헬퍼들을 새 모듈
`scripts/src/lib/scope.ts`로 옮겨 순환을 만들지 않는다.

## Interface
- 제공:
  - `scripts/src/lib/scope.ts` — `isUnder`, `RUNTIME_ARTIFACTS`,
    `isRuntimeArtifact`, `makeAllowed`. `finalize.ts`에 있던 구현을 그대로
    옮긴 것이며 동작은 바뀌지 않는다. 의존은 `./paths`와 `./layout`뿐이다.
  - `checkGate` commit 분기가 `deps.stagedFiles({ repoRoot })`로 스테이징
    목록을 얻는다. 기본 구현은 `git diff --cached --name-only`이고,
    `{ ok: true, files }` 또는 `{ ok: false, reason }`을 돌려준다. 절대
    throw하지 않는다.
  - 실패 코드는 G6/G7/G8(execute와 같은 문자열 계약)과 G17이다.
    G17 메시지는 위반 경로를 담는다.
- 거부:
  - 스테이징 목록을 읽지 못하면(저장소 아님, git 실패) G17 failure로 보고한다.
    조용히 통과시키지 않는다.
  - `affected_paths`가 비어 있으면 blueprint 디렉터리 밖 경로는 전부 위반이다
    (plan G5가 이미 비어 있는 값을 막으므로 새 예외를 두지 않는다).
  - `finalize.ts`는 옮긴 네 이름을 다시 export하지 않는다.

## Touch
- Create `scripts/src/lib/scope.ts` — `isUnder`·`RUNTIME_ARTIFACTS`·
  `isRuntimeArtifact`·`makeAllowed`를 담는 새 모듈.
- Create `scripts/lib/scope.js` — 위 모듈의 CJS 산출물.
- Modify `scripts/src/lib/finalize.ts` — 옮긴 네 이름을 지우고 `./scope`에서
  가져다 쓰며, 재수출하지 않는다.
- Modify `scripts/lib/finalize.js` — 산출물 동기화.
- Modify `scripts/src/lib/commit.ts` — `makeAllowed`·`isRuntimeArtifact`
  import 출처를 `./scope`로 옮긴다.
- Modify `scripts/lib/commit.js` — 산출물 동기화.
- Modify `scripts/src/lib/commit-guard.ts` — 같은 import 이동.
- Modify `scripts/lib/commit-guard.js` — 산출물 동기화.
- Modify `scripts/src/lib/seed-worktree.ts` — `isUnder` import 이동.
- Modify `scripts/lib/seed-worktree.js` — 산출물 동기화.
- Modify `scripts/src/lib/validate.ts` — commit 분기를 G6/G7/G8 + G17로 다시
  쓰고 G15 코드를 결번 주석으로 남긴다.
- Modify `scripts/lib/validate.js` — 산출물 동기화.
- Modify `test/validate-gates.test.js` — commit 게이트 테스트를 새 판정으로
  교체하고 G17 케이스를 추가한다.
- Modify `test/cli-commit.test.js` — G15를 기대하던 단언을 새 코드로 바꾼다.
- Modify `test/commit-task.test.js` — commit 게이트가 explain을 보지 않으므로
  `comprehensionOk` 분기를 정리한다.
- Modify `test/finalize-pure.test.js` — `makeAllowed`·`isUnder` import 출처를
  `scripts/lib/scope`로 바꾼다.
- Modify `test/validate-structural.test.js` — G15를 가리키는 설명 주석을
  현재 코드로 고친다.

## Do not touch
- `skills/` — 스킬 산문 이동은 TASKS-003이다.
- `docs/` — 게이트 문서 갱신은 TASKS-003이다.
- `hooks/commit-safety.js` — 훅은 그대로 남긴다.
- `scripts/src/lib/comprehension.ts` — TASKS-001이 확정한 계약을 다시
  손대지 않는다.

## Constraints
- G15 번호를 재사용하지 않는다. `validate.ts`에 결번 주석 한 줄만 남긴다
  (`G9` 결번 주석과 같은 형식).
- `bouncer commit` / `bouncer finalize`의 스테이징·커밋 동작은 바꾸지 않는다.
  G17은 같은 판정을 게이트에서 한 번 더 하는 것이다.
- `scope.ts`로의 이동은 순수 이동이다. 함수 본문·시그니처·주석을 다시 쓰지
  않는다.
- `scripts/lib/*.js`는 손으로 고치지 않는다. 빌드 산출물을 그대로 커밋한다.
- git 호출은 주입 가능한 형태로만 한다. 테스트가 실제 저장소 없이 commit
  게이트를 돌릴 수 있어야 한다.
- 이 저장소에서 이 task를 커밋할 때, 설치된 플러그인 캐시가 아직 옛 게이트를
  쓴다는 점을 전제한다. 커밋 훅이 오탐하면 워크트리의 `readAffectedPaths`로
  범위를 먼저 확인한다.

## Checklist
- [ ] `scripts/src/lib/scope.ts`를 만들고 `finalize.ts`에서 네 이름을 그대로
      옮긴다. `CONTEXT_ROOT`는 `./layout`에서 가져온다.
- [ ] `finalize.ts`·`commit.ts`·`commit-guard.ts`·`seed-worktree.ts`와
      `test/finalize-pure.test.js`의 import를 `./scope`로 바꾼다.
      `npm test`로 이동만으로 초록인지 먼저 확인한다.
- [ ] `test/validate-gates.test.js`에 실패 테스트를 추가한다: 스테이징 목록에
      `affected_paths` 밖 경로가 있으면 G17 하나가 나고, 그 경로가 메시지에
      들어 있다.
      ```js
      assert.deepStrictEqual(failures.map((f) => f.code), ['G17']);
      assert.match(failures[0].message, /src\/other\.ts/);
      ```
- [ ] 같은 파일에 통과 케이스를 추가한다: blueprint 디렉터리 하위 문서와
      `graphify-out/` 산출물만 스테이징되면 실패가 없다.
- [ ] `node --test test/validate-gates.test.js`로 실패를 확인한다.
- [ ] `validate.ts` commit 분기를 다시 쓴다. execute 분기와 같은
      `resolveTaskUnit` 해석을 쓰고 G6/G7/G8을 재판정한 뒤, `stagedFiles` →
      `isRuntimeArtifact` 필터 → `makeAllowed`로 G17을 낸다.
- [ ] `test/cli-commit.test.js`·`test/commit-task.test.js`의 G15 기대를
      정리한다.
- [ ] `npm run build`로 `scripts/lib/`를 재생성한다.
- [ ] `npm test`가 통과한다.
