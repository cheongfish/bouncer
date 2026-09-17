---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/007-project-distill/blueprints/002-project-root-distill/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-13T15:26:34.770+09:00'
bouncer:
  id: EXPLAIN-002
  epic_id: '007'
  blueprint_id: '002'
  status: published
  comprehension:
    - range_from: develop
      range_to: 0b210b66e1c8b301ccc29b94979a425ee5fab76d
      diff_sha: dd4e4401f6ee3ccca82b8e36bde490d5af17e63258fc264d5f131d631fab4e12
      quiz_score: 3/3
      disposition: 전부 정답 — project-root·Distill 기준·비-Git 거절 계약을 맞춤
      recorded_at: '2026-08-13T15:27:45+09:00'
---
# Explain

## Background

설치된 플러그인과 소비 저장소가 각각 `.bouncer/Distill.md`를 가질 수 있는데,
스킬은 상대 경로만 적고 어느 트리를 읽는지 고정하지 않았다. execute linked
worktree에서 cwd를 다시 잡으면 Distill이 없는 checkout을 프로젝트로 오인할
수도 있었다. 이 변경은 `runtimePaths()`가 이미 계산하는 main worktree를
`projectRoot`로 노출하고, Distill을 다루는 워크플로는
`${PROJECT_ROOT}/.bouncer/Distill.md`만 쓰게 한다.

## Intuition

플러그인 상자 안 Distill이 아니라, 지금 작업 중인 저장소의 현관(main
worktree)에 있는 Distill만 본다.

## Code

- `scripts/src/lib/runtime-state.ts` — `projectRoot`(= main worktree). Git
  계산을 스킬에 복제하지 않는다.
- `scripts/src/lib/cli.ts` — `bouncer project-root [--repo]` 성공 시 경로 한
  줄, 비-Git은 stderr+1.
- `CLAUDE.md`, `rules/plugin-root.md` — plugin root vs `PROJECT_ROOT` 역할.
- `skills/bouncer-{plan,execute,run,finalize}/SKILL.md` — CLI로
  `PROJECT_ROOT` 확정 후 Distill Read/Write.
- `skills/discovery/SKILL.md`, `skills/spec-authoring/SKILL.md` — 호출자가
  넘긴 절대 Distill 경로만 사용(`BOUNCER_ROOT` 해석 없음).
- `test/cli-project-root.test.js`, `test/runtime-state.test.js`,
  `test/master-rules.test.js` — primary/linked/비-Git·스킬 계약.

## Quiz

1. `bouncer project-root`가 stdout에 찍는 값은?
   - A) 현재 cwd (linked worktree면 그 경로)
   - B) 소비 저장소 main worktree 절대 경로
   - C) `BOUNCER_ROOT` (플러그인 설치 경로)

2. Distill을 읽을 때 기준 경로는?
   - A) `${PROJECT_ROOT}/.bouncer/Distill.md` (`bouncer project-root`로 확정)
   - B) `${BOUNCER_ROOT}/.bouncer/Distill.md`
   - C) execute worktree cwd 아래 `.bouncer/Distill.md`

3. `--repo`가 Git 저장소가 아니면?
   - A) cwd를 stdout에 출력하고 종료 코드 0
   - B) 빈 stdout과 종료 코드 0
   - C) stderr에 원인을 쓰고 종료 코드 1

## 이해 상태

- 점수: 3/3
- 정답: 1B · 2A · 3C
- 응답: 1B · 2A · 3C
- 채점: 1✓ 2✓ 3✓
- disposition: 전부 정답 — project-root·Distill 기준·비-Git 거절 계약을 맞춤
- range: develop..0b210b66e1c8b301ccc29b94979a425ee5fab76d
- diff_sha: dd4e4401f6ee3ccca82b8e36bde490d5af17e63258fc264d5f131d631fab4e12

## Tasks

### Task 001

#### Goal & intent

`bouncer project-root`가 현재 checkout 종류와 무관하게 소비 저장소의 main
worktree 절대 경로를 출력하게 한다. Distill을 읽거나 쓰는 워크플로는
`${PROJECT_ROOT}/.bouncer/Distill.md`만 사용하며, plugin root와 execute
worktree cwd는 Distill 경로의 기준이 아니다. 검증 명령은 `npm test`다.

#### Interface

- 제공: `runtimePaths({ repoRoot })`가 `projectRoot`를 반환한다.
  `bouncer project-root [--repo <dir>]`는 그 절대 경로와 줄바꿈만 stdout에
  출력한다. primary checkout과 linked worktree에서 같은 값을 반환한다.
- 제공: `/bouncer-plan`, `/bouncer-execute`, `/bouncer-run`,
  `/bouncer-finalize`가 CLI 출력으로 `PROJECT_ROOT`를 확정한다.
  `discovery`와 `spec-authoring`은 호출자가 넘긴 절대 Distill 경로를 사용한다.
- 거부: 비-Git 경로는 빈 stdout이나 현재 cwd로 대체하지 않고 stderr 메시지와
  종료 코드 `1`로 거절한다. Distill이 없을 때 plugin 트리의 같은 상대 경로로
  fallback하지 않는다.

#### Touch

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

#### Constraints

- `runtimePaths()`의 git-common-dir 기반 main-root 계산을 단일 정본으로 재사용한다.
  스킬이나 새 helper에서 Git 경로 계산을 복제하지 않는다.
- `BOUNCER_ROOT`는 plugin 실행 파일 위치로만 사용한다. plugin root와 project
  root가 같은 도그푸드 환경도 정상 입력이다.
- 각 workflow shell block은 기존 규칙대로 `BOUNCER_ROOT`를 자체 선언한다.
- `discovery`와 `spec-authoring`은 전문 스킬이므로 `BOUNCER_ROOT` 해석이나
  `scripts/bouncer` 호출을 넣지 않는다.
- CLI 성공 stdout은 경로 한 줄만 유지한다. 진단은 stderr로 보낸다.
- 새 설정 키, 의존성, 상태 파일, Distill 복사 동작을 추가하지 않는다.
