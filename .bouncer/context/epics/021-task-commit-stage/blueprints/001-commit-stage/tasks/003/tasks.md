---
type: bouncer.tasks
title: bouncer commit과 commit 게이트를 신설함
description: Tasks for 003
resource: .bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-07T14:13:08.438+09:00'
bouncer:
  id: TASKS-003
  epic_id: '021'
  blueprint_id: '001'
  status: ready
  commit_intent:
    - task 하나를 닫는 명령이 없어 커밋이 blueprint 마감 명령에 얹혀 있음
    - task 커밋을 독립 명령과 독립 게이트로 떼어내 반복 실행이 가능하게 함
  affected_paths:
    - scripts/src/lib/commit.ts
    - scripts/src/lib/cli.ts
    - scripts/src/lib/validate.ts
    - scripts/lib/commit.js
    - scripts/lib/cli.js
    - scripts/lib/validate.js
    - test/commit-task.test.js
    - test/cli-commit.test.js
    - test/cli-help.test.js
    - test/validate-gates.test.js
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
`bouncer commit`이 task 하나를 닫는다. 범위 검사 → 스테이징 → 커밋까지가 이
명령의 책임이고, 같은 blueprint의 다음 열린 task 후보를 결과에 담아 스킬이
확인 후 포인터를 옮길 수 있게 한다. 판정은 새 게이트 `commit`이 맡고, G15는
그쪽으로 옮긴다.

이 task까지는 `finalize`가 여전히 커밋을 할 수 있다. 004가 그 경로를 걷어낸다.

## Interface
- 제공
  - `scripts/src/lib/commit.ts`의 `commitTask({ repoRoot, blueprintDir, yes,
    git })`:
    ```
    { ok: false, reason: 'validate', failures }
    { ok: false, reason: 'out-of-scope', violations }
    { ok: true, dryRun: true, staged, commitMessage, nextTask }
    { ok: true, committed: true, staged, commitMessage, nextTask }
    ```
    `nextTask`는 같은 blueprint의 다른 열린 task 중 번호가 가장 앞선 것
    (`{ id, path, status }`) 또는 `null`.
  - CLI `bouncer commit --blueprint <dir> [--yes]`가 그 JSON을 stdout에 낸다.
    실패는 non-zero exit.
  - `bouncer validate --gate commit`이 G15를 판정한다.
- 거부
  - `commit` 게이트가 실패하면 아무것도 스테이징하지 않는다.
  - 범위 밖 파일이 하나라도 있으면 hard abort — 스테이징 없음, 위반 목록 반환.
  - 스테이징할 변경이 없으면 빈 커밋을 만들지 않는다. `--yes`여도
    `committed: false`와 빈 `staged`로 성공 반환한다.
  - 포인터를 쓰거나 옮기지 않는다. 이동은 `bouncer current --set`뿐이다.

## Touch
- Create `scripts/src/lib/commit.ts` — task 커밋 코어와 다음 task 후보 계산
- Create `test/cli-commit.test.js` — CLI 경유 dry-run·커밋·실패 종료 코드
- Create `test/commit-task.test.js` — `commitTask`의 반환 형태와 거부 조건
- Modify `scripts/src/lib/cli.ts` — `commit` 서브커맨드와 usage
- Modify `scripts/src/lib/validate.ts` — `commit` 게이트 분기로 G15 이동
- Modify `scripts/lib/cli.js` `scripts/lib/validate.js` — CJS 산출물
- Create `scripts/lib/commit.js` — CJS 산출물
- Modify `test/validate-gates.test.js` — G15가 `--gate commit`에서 나오는지
- Modify `test/cli-help.test.js` — usage에 `commit`이 보이는지

## Do not touch
- `scripts/src/lib/finalize.ts` — 004에서 축소한다. 여기서는 export만 재사용한다
- `scripts/src/lib/current.ts` — 포인터 API는 019 그대로
- `scripts/src/lib/comprehension.ts` `scripts/src/lib/scaffold.ts` — 002
- `skills` `docs` — 005

## Constraints
- `makeAllowed` / `isRuntimeArtifact` / `realGit`는 `finalize.ts`에서 import해
  재사용한다. 같은 로직을 `commit.ts`에 복사하지 않는다.
- `finalize.ts`가 `commit.ts`를 require하지 않게 한다(순환 방지). 의존은 한
  방향 — `commit.ts` → `finalize.ts`.
- 게이트 이름은 `plan` | `execute` | `commit` | `finalize` 넷이다. 알 수 없는
  게이트는 지금처럼 throw한다.
- 이 커밋 시점의 `finalize` 게이트는 기존 동작(G15)을 그대로 둔다. 같은 판정을
  두 게이트가 공유해도 이 단계에서는 무해하고, 004가 정리한다.
- 알 수 없는 CLI 사용법은 stderr로 내보내 stdout을 파이프-클린하게 유지한다.
- **도구 스큐 주의.** `BOUNCER_HOME`이 이 저장소를 가리켜 CLI는 수정 즉시
  반영되지만, 워크플로 스킬과 commit-safety 훅은 설치된 플러그인 캐시(0.6.0)를
  읽는다. 이 커밋 이후 캐시의 `/bouncer-finalize`는 여전히 `finalize --yes`로
  task를 커밋하려 하고 `bouncer commit`을 모른다. 이 blueprint의 나머지 task는
  `bouncer commit`을 직접 호출해 닫는다. 커밋이 막히면 스킬/훅 버전 스큐를 먼저
  의심하고, worktree 자신의 `readAffectedPaths`로 범위를 확인한다.
- `commitTask`는 throw하지 않는다. git 실패는 예외를 그대로 올리는 현행
  `finalize`와 같은 수준으로 두되, 검증·범위 실패는 반환값으로 표현한다.

## Checklist
- [ ] `test/commit-task.test.js`를 먼저 쓴다. 주입 `git` 더블로 dry-run이
      스테이징하지 않고 `commitMessage`를 돌려주는지, `--yes` 경로가
      `stage` → `commit` 순으로 호출하는지 확인한다:
      ```js
      assert.deepStrictEqual(calls, ['stage', 'commit']);
      ```
- [ ] 범위 밖 파일이 있을 때 `{ ok: false, reason: 'out-of-scope' }`이고
      `stage`가 호출되지 않는지 확인한다.
- [ ] 변경이 없을 때 `--yes`가 `commit`을 호출하지 않고 성공하는지 확인한다.
- [ ] 같은 blueprint에 열린 task가 둘일 때 `nextTask`가 번호가 앞선 다른
      task이고, 없으면 `null`인지 확인한다. 포인터 파일이 바뀌지 않는 것도
      확인한다.
- [ ] `test/validate-gates.test.js`에서 `--gate commit`이 G15를 내고,
      알 수 없는 게이트가 여전히 throw하는지 확인한다.
- [ ] `test/cli-commit.test.js`에서 게이트 실패 시 non-zero exit과 stdout JSON
      형태를 확인한다.
- [ ] 위 테스트가 실패하는 것을 확인한 뒤 `commit.ts` → `validate.ts` →
      `cli.ts` 순으로 구현한다.
- [ ] `npm run build` 후 `npm test`가 통과한다.
