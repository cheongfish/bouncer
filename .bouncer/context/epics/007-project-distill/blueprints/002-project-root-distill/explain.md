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
      quiz_score: '3/3'
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
