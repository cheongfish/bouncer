---
type: bouncer.tasks
title: 소비 프로젝트 Distill 루트 해석 일원화
description: Tasks for 001
resource: .bouncer/context/epics/007-project-distill/blueprints/002-project-root-distill/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-13T15:07:32.982+09:00'
bouncer:
  id: TASKS-001
  epic_id: '007'
  blueprint_id: '002'
  status: verified
  commit_intent:
    - 플러그인 트리의 도그푸드 Distill을 소비 프로젝트 노트로 오독할 위험을 제거함
    - linked worktree에서도 main worktree의 Distill SSOT를 일관되게 사용함
  verify: npm test
  affected_paths:
    - scripts/src/lib/runtime-state.ts
    - scripts/lib/runtime-state.js
    - scripts/src/lib/cli.ts
    - scripts/lib/cli.js
    - CLAUDE.md
    - rules/plugin-root.md
    - skills/bouncer-plan/SKILL.md
    - skills/bouncer-execute/SKILL.md
    - skills/bouncer-run/SKILL.md
    - skills/bouncer-finalize/SKILL.md
    - skills/discovery/SKILL.md
    - skills/spec-authoring/SKILL.md
    - docs/cli.md
    - docs/troubleshooting.md
    - test/runtime-state.test.js
    - test/cli-project-root.test.js
    - test/cli-help.test.js
    - test/master-rules.test.js
  graph:
    generated_at: '2026-08-13T15:10:00+09:00'
    command: graph-sync + graphify query source/context
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - .bouncer/context/epics/007-project-distill
      - .bouncer/context/epics/023-worktree-layout/blueprints/001-nested-worktree-path
      - .bouncer/context/epics/028-antigravity-host/blueprints/001-antigravity-plugin-surface
    basis:
      - graph: source
        status: updated
        query: project root main worktree runtimePaths CLI Distill BOUNCER_ROOT linked worktree
        result: runtime-state TS/CJS와 연결된 CLI·테스트 경로를 포함해 60개 노드를 반환함
      - graph: context
        status: updated
        query: project Distill project root plugin root worktree runtime path contract
        result: epic 007 Distill, epic 023 worktree, epic 028 plugin-root 설명 경로 3곳을 반환함
---
# Tasks

Blueprint: [002](../../index.md)

## Goal & intent
`bouncer project-root`가 현재 checkout 종류와 무관하게 소비 저장소의 main
worktree 절대 경로를 출력하게 한다. Distill을 읽거나 쓰는 워크플로는
`${PROJECT_ROOT}/.bouncer/Distill.md`만 사용하며, plugin root와 execute
worktree cwd는 Distill 경로의 기준이 아니다. 검증 명령은 `npm test`다.

## Interface
- 제공: `runtimePaths({ repoRoot })`가 `projectRoot`를 반환한다.
  `bouncer project-root [--repo <dir>]`는 그 절대 경로와 줄바꿈만 stdout에
  출력한다. primary checkout과 linked worktree에서 같은 값을 반환한다.
- 제공: `/bouncer-plan`, `/bouncer-execute`, `/bouncer-run`,
  `/bouncer-finalize`가 CLI 출력으로 `PROJECT_ROOT`를 확정한다.
  `discovery`와 `spec-authoring`은 호출자가 넘긴 절대 Distill 경로를 사용한다.
- 거부: 비-Git 경로는 빈 stdout이나 현재 cwd로 대체하지 않고 stderr 메시지와
  종료 코드 `1`로 거절한다. Distill이 없을 때 plugin 트리의 같은 상대 경로로
  fallback하지 않는다.

## Touch
- Modify `scripts/src/lib/runtime-state.ts` — 기존 main worktree 계산값을
  `projectRoot`로 노출한다.
- Modify `scripts/lib/runtime-state.js` — TypeScript 변경의 Node 소비용 CJS
  산출물을 갱신한다.
- Modify `scripts/src/lib/cli.ts` — `project-root` 명령과 비-Git 실패 출력을
  추가한다.
- Modify `scripts/lib/cli.js` — TypeScript 변경의 Node 소비용 CJS 산출물을
  갱신한다.
- Modify `CLAUDE.md` — Project Distill의 project-root 해석 의무를 고정한다.
- Modify `rules/plugin-root.md` — plugin root와 consuming project root의 역할을
  구분한다.
- Modify `skills/bouncer-plan/SKILL.md` — plan 진입 시 `PROJECT_ROOT`를 확정하고
  Distill을 읽는다.
- Modify `skills/bouncer-execute/SKILL.md` — linked worktree에서도 main
  worktree Distill을 읽는다.
- Modify `skills/bouncer-run/SKILL.md` — 주행 시작과 re-ground가 같은 절대
  Distill 경로를 사용한다.
- Modify `skills/bouncer-finalize/SKILL.md` — Distill 승격 쓰기 대상을
  project root 아래로 고정한다.
- Modify `skills/discovery/SKILL.md` — 호출자가 넘긴 절대 Distill 경로를
  pre-read에 사용한다.
- Modify `skills/spec-authoring/SKILL.md` — finalize가 넘긴 절대 경로에만
  Distill을 승격한다.
- Modify `docs/cli.md` — `bouncer project-root`의 출력과 실패 계약을 기록한다.
- Modify `docs/troubleshooting.md` — Distill 누락 안내의 기준을 consuming
  project root로 명시한다.
- Modify `test/runtime-state.test.js` — primary/linked/Win32의 `projectRoot`
  반환값을 단언한다.
- Create `test/cli-project-root.test.js` — CLI stdout과 비-Git stderr/종료 코드를
  검증한다.
- Modify `test/cli-help.test.js` — 새 명령이 help 목록에서 빠지지 않게 한다.
- Modify `test/master-rules.test.js` — 마스터 룰과 여섯 스킬의 Distill 루트
  계약을 단언한다.

## Do not touch
- `.bouncer/Distill.md` — 이번 작업은 제품 자체의 도그푸드 노트를 수정하지 않는다.
- `scripts/src/lib/layout.ts` — 저장소 상대 Distill 상수는 파일 배치 계약으로 유지한다.
- `scripts/src/lib/seed-worktree.ts` — Distill을 execute worktree로 옮기지 않는
  기존 정책을 유지한다.
- `hooks/` — Read 차단으로 해결하지 않는다.
- `.claude-plugin/` — 패키징 제외 정책은 별도 blueprint에서 검증한다.

## Constraints
- `runtimePaths()`의 git-common-dir 기반 main-root 계산을 단일 정본으로 재사용한다.
  스킬이나 새 helper에서 Git 경로 계산을 복제하지 않는다.
- `BOUNCER_ROOT`는 plugin 실행 파일 위치로만 사용한다. plugin root와 project
  root가 같은 도그푸드 환경도 정상 입력이다.
- 각 workflow shell block은 기존 규칙대로 `BOUNCER_ROOT`를 자체 선언한다.
- `discovery`와 `spec-authoring`은 전문 스킬이므로 `BOUNCER_ROOT` 해석이나
  `scripts/bouncer` 호출을 넣지 않는다.
- CLI 성공 stdout은 경로 한 줄만 유지한다. 진단은 stderr로 보낸다.
- 새 설정 키, 의존성, 상태 파일, Distill 복사 동작을 추가하지 않는다.

## Checklist
- [ ] `test/runtime-state.test.js`와 새 `test/cli-project-root.test.js`에 실패
  테스트를 먼저 추가한다.
  ```js
  assert.strictEqual(primaryPaths.projectRoot, primary);
  assert.strictEqual(linkedPaths.projectRoot, primary);
  assert.strictEqual(projectRootStdout, `${primary}\n`);
  ```
- [ ] `test/master-rules.test.js`가 workflow 네 곳의 `project-root` 해석과
  전문 스킬 두 곳의 caller-provided 절대 경로 계약을 검사하게 한다.
  operational `Read .bouncer/Distill.md`와 `BOUNCER_ROOT` 기반 Distill 경로는
  허용하지 않는다.
- [ ] 다음 명령으로 새 테스트가 구현 전 실패하는지 확인한다.
  ```bash
  node --test test/runtime-state.test.js test/cli-project-root.test.js test/master-rules.test.js
  ```
- [ ] `runtimePaths()` 반환 shape와 `bouncer project-root`를 구현하고
  `npm run build`로 `scripts/lib` CJS를 갱신한다.
- [ ] 네 workflow 스킬이 CLI로 `PROJECT_ROOT`를 확정하게 하고,
  `discovery`·`spec-authoring`에는 caller-provided 절대 Distill 경로만 남긴다.
- [ ] `CLAUDE.md`, `rules/plugin-root.md`, `docs/cli.md`,
  `docs/troubleshooting.md`의 설명을 같은 계약으로 맞춘다.
- [ ] primary checkout, linked worktree, plugin/project root 동일 환경,
  비-Git 경로 사례가 테스트에 포함됐는지 확인한다.
- [ ] `npm test`가 통과한다.
