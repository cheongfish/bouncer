---
type: bouncer.tasks
title: core와 기술 Distill 압축
description: 항상 샤드와 다섯 기술 샤드에서 중복 절차와 회차 기록을 걷어내며 현재 불변식과 함정을 보존한다
resource: .bouncer/context/epics/058-context-runtime-compaction/blueprints/001-master-distill-compaction/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
  - distill
timestamp: '2026-08-28T13:45:14.846+09:00'
bouncer:
  id: TASKS-002
  epic_id: '058'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - 항상 읽는 core와 기술 샤드가 다른 정본의 절차와 과거 측정치를 반복함
    - 다음 작업이 재발견해야 하는 불변식과 함정만 남겨 선택 주입량을 줄임
  verify: npm run ci
  affected_paths:
    - .bouncer/distill/core.md
    - .bouncer/distill/validate-gates.md
    - .bouncer/distill/context-layout.md
    - .bouncer/distill/git-worktree.md
    - .bouncer/distill/graph.md
    - .bouncer/distill/build-ts.md
    - test/distill.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-28T13:49:08+09:00'
    suggested_paths:
      - test
      - scripts
      - .bouncer/distill
      - .bouncer/context/epics/023-worktree-layout
    basis:
      - graph: source
        status: updated
        query: Distill core validate gates context layout git worktree graph build TypeScript shard compression byte budget
        result: 53 nodes; top paths are test/distill.test.js, test/seed-worktree.test.js, and scripts/check-emit.js
      - graph: context
        status: updated
        query: Distill core validate gates context layout git worktree graph build TypeScript shard compression byte budget
        result: 6 nodes; validate-gates, git-worktree, and epic 023 worktree layout
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
항상 읽는 `core`를 4KB 이하로 만들고, `validate-gates`, `context-layout`, `git-worktree`, `graph`, `build-ts`를 각 예산 안으로 줄인다. 현재 동작을 규정하는 불변식·함정·결정은 남기고 스킬 절차, 과거 회차 수치, 다른 샤드와 같은 문장만 제거한다.

## Interface
- 제공: 각 샤드는 기존 `distill.id`, 경로 범위, `## Invariants`·`## Gotchas`·`## Decisions` 구조를 유지하고 해당 경로의 다음 plan/execute가 코드만 보고 찾기 어려운 현재 규칙을 제공한다.
- 거부: 테스트가 있다는 이유만으로 교차 파일 계약을 삭제하거나, 한 규칙을 여러 샤드에 복제하거나, 회차 이력을 현재 결정처럼 남기지 않는다.

## Touch
- Modify `.bouncer/distill/core.md` — 전역 안전 규칙만 남기고 4,096바이트 이하로 줄인다.
- Modify `.bouncer/distill/validate-gates.md` — 필드·게이트 판정의 현재 계약만 남기고 6,144바이트 이하로 줄인다.
- Modify `.bouncer/distill/context-layout.md` — 레이아웃·마이그레이션 함정을 4,096바이트 이하로 줄인다.
- Modify `.bouncer/distill/git-worktree.md` — worktree·commit-safety·finalize 경계를 3,584바이트 이하로 줄인다.
- Modify `.bouncer/distill/graph.md` — Graphify·digest·freshness 계약을 3,072바이트 이하로 줄인다.
- Modify `.bouncer/distill/build-ts.md` — TypeScript emit·Node 소비자 계약을 1,280바이트 이하로 줄인다.
- Modify `test/distill.test.js` — 여섯 샤드의 UTF-8 바이트 예산을 고정한다.

## Do not touch
- `.bouncer/Distill.md` — 샤드 등록과 라우팅 변경은 task 003이 맡는다.
- `.bouncer/distill/plugin-skills.md` — 플러그인 규칙 분리는 task 003이 맡는다.
- `.bouncer/config.json` — 예산 기준은 모든 샤드가 줄어든 뒤 task 003에서 바꾼다.
- `CLAUDE.md` — 마스터 규칙은 task 001이 맡는다.
- `scripts/**` — Distill 런타임은 바꾸지 않는다.

## Constraints
- Distill 본문은 영어로 쓴다.
- 변경 전 각 불릿을 `keep`, `replace`, `drop`으로 판정한다. `drop`은 다른 현재 정본에 있거나 회차 이력인 경우에만 허용하고, 코드·테스트 존재만으로 삭제하지 않는다.
- `core`의 `always: true`, 각 샤드 id와 경로, 라우팅 fail-open 의미를 유지한다.
- 바이트는 frontmatter를 포함해 `Buffer.byteLength(file, 'utf8')`로 판정한다.

## Checklist
- [ ] `test/distill.test.js`에 아래 예산을 먼저 추가하고 현재 `core`, `validate-gates`, `context-layout`, `git-worktree`, `graph`, `build-ts` 중 초과 파일 때문에 실패하는지 확인한다.
  ```text
  core=4096, validate-gates=6144, context-layout=4096,
  git-worktree=3584, graph=3072, build-ts=1280
  ```
- [ ] 여섯 파일의 기존 불릿을 `keep`·`replace`·`drop`으로 분류하고, 스킬 절차와 `docs/benchmark/history.md`에 속한 회차 수치를 제거한다.
- [ ] 같은 주제의 여러 문장을 현재 계약 한 문장으로 합치고 경로·게이트 코드·필드명처럼 재발견 비용을 줄이는 식별자는 남긴다.
- [ ] `bouncer distill --all --repo "$(pwd)"`이 여섯 샤드 예산을 보고하고 본문을 절삭하지 않는지 확인한다.
- [ ] 다음 검증을 통과한다.
  ```bash
  node --test test/distill.test.js
  npm run ci
  ```
