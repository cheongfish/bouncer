---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/007-project-distill/blueprints/005-checkout-relative-distill/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-15T15:17:00.314+09:00'
bouncer:
  id: EXPLAIN-005
  epic_id: '007'
  blueprint_id: '005'
  status: published
  comprehension:
    - range_from: develop
      range_to: ec573e44b28aa04500b1458cc150e91fc1259ca5
      diff_sha: f4db01cf74b43e3192977e6cda4879dad254832637f353932f095c3547ac6b77
      quiz_score: '3/3'
      disposition: 세 문항 모두 정답. Distill base가 checkout 우선이며 finalize 승격은 payload repoRoot와 같은 cwd에서 이뤄진다는 계약을 확인함.
      recorded_at: '2026-08-15T15:18:10+09:00'
---
# Explain

## Background
`distill.ts`의 옛 `resolveProjectRoot`는 전달받은 root를 항상
`runtimePaths().projectRoot`(main worktree)로 덮어썼다. `cmdDistill`도
`readShards`에 main root만 넣었다. 그 결과 `--repo`는 저장소만 고르고
checkout은 고르지 못했고, `/bouncer-finalize` 승격 쓰기는 main Distill로,
`finalize --yes` remainder 커밋은 execute worktree로 갈라져 승격분이
커밋·PR에서 빠졌다.

이번 변경은 Distill base를 현재 checkout 우선으로 해석하고, finalize 승격
경로의 출처를 `bouncer distill --all --json` payload의 `repoRoot` 하나로
고정한다. plan/execute/run의 `project-root` 읽기 경로는 그대로 둔다.

## Intuition
책장(main)과 작업대(execute worktree)가 둘 다 `.bouncer/Distill.md`를 가질 수
있을 때, finalize는 작업대에 쓴 뒤 그 작업대에서 커밋한다. 책장 주소로 써서
작업대 장부에만 올리면 장부에 빈칸이 남는다.

## Code
- `scripts/src/lib/distill.ts` — `resolveDistillRoot`: (1) 해당 root에
  `.bouncer/Distill.md`가 있으면 그 root, (2) 없으면 `runtimePaths().projectRoot`,
  (3) Git 불가 시 전달 root. `readShards`의 `repoRoot`가 이 값이다.
- `scripts/src/lib/cli-project-commands.ts` — `cmdDistill`이 Git 가용성만
  `runtimePaths`로 보고, 읽기·config base는 `resolveDistillRoot` 결과를 쓴다.
- `skills/bouncer-finalize/SKILL.md` — 승격 audit은 `--repo` 없이, step 3
  finalize와 **같은 checkout cwd**에서 돌린다. 승격 절대 경로는 payload
  `repoRoot`에서만 온다.
- `CLAUDE.md` 하드룰 7 — plan/execute/run은 `PROJECT_ROOT`, finalize 승격은
  payload `repoRoot`.
- 회귀: `test/distill.test.js`, `test/cli-project-commands.test.js`,
  `test/finalize.test.js`(linked checkout에서 Distill·shard가 staged에 포함).

## Quiz
1. finalize 승격 audit을 어디에 두고, Distill 절대 경로는 어디서 받나?
   - A) main worktree에서 `bouncer project-root`로 조립한다
   - B) `--repo`로 main을 넘기고, cwd는 상관없다
   - C) execute worktree(같은 checkout)에서 돌리고, payload `repoRoot`를 쓴다

2. linked checkout에 `.bouncer/Distill.md`가 있을 때 `resolveDistillRoot`는?
   - A) 그 linked checkout root를 반환한다
   - B) 항상 `runtimePaths().projectRoot`(main)를 반환한다
   - C) shard 디렉터리 유무로 base를 고른다

3. plan/execute의 Distill 읽기와 finalize 승격 base의 관계는?
   - A) 둘 다 항상 execute worktree cwd다
   - B) plan/execute는 `project-root`/`PROJECT_ROOT`, finalize 승격은 payload
     `repoRoot`(checkout 우선)다
   - C) 둘 다 `bouncer project-root`만 쓴다

## 이해 상태
- quiz_score: 3/3
- 응답: 1C, 2A, 3B
- 정답: 1C, 2A, 3B — 전부 맞음
- disposition: 세 문항 모두 정답. Distill base가 checkout 우선이며 finalize 승격은 payload repoRoot와 같은 cwd에서 이뤄진다는 계약을 확인함.
- range: develop..ec573e44b28aa04500b1458cc150e91fc1259ca5
- diff_sha: f4db01cf74b43e3192977e6cda4879dad254832637f353932f095c3547ac6b77
- recorded_at: 2026-08-15T15:18:10+09:00
