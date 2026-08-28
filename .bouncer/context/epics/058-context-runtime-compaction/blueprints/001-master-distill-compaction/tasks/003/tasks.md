---
type: bouncer.tasks
title: 플러그인·벤치마크 Distill 분리
description: 과대 plugin-skills 샤드를 압축·분리하고 경로 선택과 전체 바이트 예산을 저장소 계약으로 고정한다
resource: .bouncer/context/epics/058-context-runtime-compaction/blueprints/001-master-distill-compaction/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
  - distill
timestamp: '2026-08-28T13:45:14.880+09:00'
bouncer:
  id: TASKS-003
  epic_id: '058'
  blueprint_id: '001'
  status: ready
  commit_intent:
    - 일반 플러그인 규칙과 벤치마크 런북이 한 샤드에 섞여 선택 읽기 효과가 약함
    - 두 경로를 겹치지 않게 분리하고 저장소 자체에 실효 바이트 예산을 적용함
  verify: npm run ci
  affected_paths:
    - .bouncer/Distill.md
    - .bouncer/distill/core.md
    - .bouncer/distill/plugin-skills.md
    - .bouncer/distill/plugin-benchmark.md
    - .bouncer/config.json
    - docs/configuration.md
    - test/distill.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-28T13:49:08+09:00'
    suggested_paths:
      - test
      - .bouncer/distill
      - .bouncer/context/epics/007-project-distill/blueprints/001-global-distill-runtime
    basis:
      - graph: source
        status: updated
        query: plugin skills benchmark Distill shard paths routing glob max bytes S26 fail open repository test
        result: 62 nodes; top paths are test/distill.test.js, test/validate-structural.test.js, and test/trust-boundary.test.js
      - graph: context
        status: updated
        query: plugin skills benchmark Distill shard paths routing glob max bytes S26 fail open repository test
        result: 8 nodes; plugin-skills and epic 007 Project Distill contracts
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`plugin-skills`를 일반 플러그인 계약과 벤치마크 전용 규칙으로 분리해 각 경로가 필요한 비항상 샤드 하나만 선택하게 한다. 최종 Distill 합계는 31,176바이트 이하, 모든 샤드는 6,144바이트 이하로 만들고 저장소의 `max_bytes`도 같은 값으로 낮춘다.

## Interface
- 제공: `.bouncer/Distill.md`가 `plugin-benchmark`를 등록한다. `plugin-skills`는 entry skill·helper reference·agent·rules·host manifest·일반 문서를, `plugin-benchmark`는 benchmark skill·`docs/benchmark/**`·`.benchmarks/**`를 담당한다. `core`는 경로 매칭 없이 `always`로만 선택된다.
- 거부: 한 경로가 두 플러그인 샤드에 동시에 매칭되는 광역 glob, 미분류 경로의 `core` 단독 선택, `pulls`로 always 샤드를 다시 연결하는 구성을 허용하지 않는다.

## Touch
- Modify `.bouncer/Distill.md` — 새 샤드 id·경로와 갱신된 샤드 설명을 등록한다.
- Modify `.bouncer/distill/core.md` — `paths: ["**"]` 매칭을 제거하고 `always` 선택만 남겨 미분류 경로의 fail-open을 복원한다.
- Modify `.bouncer/distill/plugin-skills.md` — 일반 플러그인 규칙만 남기고 광역 `skills/**`·`docs/**`를 겹치지 않는 경로 집합으로 바꾼다.
- Create `.bouncer/distill/plugin-benchmark.md` — benchmark 실행·기록에서 재발견하면 안 되는 규칙을 옮긴다.
- Modify `.bouncer/config.json` — `distill.max_bytes`를 6,144로 낮춘다.
- Modify `docs/configuration.md` — 현재 샤드 수·분포와 저장소의 6KB dogfood 기준을 맞춘다.
- Modify `test/distill.test.js` — 8개 샤드 목록, 선택 경로, fail-open, 샤드별·전체 예산을 고정한다.

## Do not touch
- `.bouncer/distill/validate-gates.md` — task 002 결과를 유지한다.
- `.bouncer/distill/context-layout.md` — task 002 결과를 유지한다.
- `.bouncer/distill/git-worktree.md` — task 002 결과를 유지한다.
- `.bouncer/distill/graph.md` — task 002 결과를 유지한다.
- `.bouncer/distill/build-ts.md` — task 002 결과를 유지한다.
- `skills/**` — 분류 경로만 바꾸고 스킬 본문은 바꾸지 않는다.
- `scripts/**` — 라우터 구현과 구조 검사 코드는 바꾸지 않는다.
- `docs/benchmark/**` — 기존 benchmark 결과와 프로토콜은 이동하거나 고치지 않는다.

## Constraints
- 두 Distill 본문은 영어로 쓰고 각 불릿의 의미를 `keep`·`replace`·`move`·`drop`으로 판정한다.
- `plugin-skills`와 `plugin-benchmark` 합계는 8,900바이트 이하이고 각 파일은 6,144바이트 이하여야 한다.
- 전체 8개 샤드 파일 합계는 31,176바이트 이하여야 한다.
- `routing_enabled: true`, 기존 샤드 id, stdout/stderr와 절삭 금지 계약을 유지한다.
- `.bouncer/config.json`의 다른 설정은 바꾸지 않는다.

## Checklist
- [ ] `test/distill.test.js`의 저장소 샤드 기대값을 8개로 바꾸고 아래 경로 계약과 바이트 예산을 먼저 추가해 실패를 확인한다.
  ```text
  docs/configuration.md -> core + plugin-skills
  docs/benchmark/history.md -> core + plugin-benchmark
  skills/bouncer-plan/SKILL.md -> core + plugin-skills
  skills/agentic-code-benchmark/SKILL.md -> core + plugin-benchmark
  unclassified.xyz -> full 8 shards
  each shard <= 6144, plugin pair <= 8900, total <= 31176
  ```
- [ ] `plugin-skills`의 benchmark 불릿을 새 샤드로 옮기고, 남은 반복 절차·회차 이력은 다른 현재 정본을 확인한 뒤 합치거나 제거한다.
- [ ] `plugin-skills`의 `paths`를 entry skills, helper references, agents, rules, host manifests, top-level docs의 양의 패턴으로 좁히고 benchmark 패턴과 교집합이 없게 한다.
- [ ] `core`의 `paths: ["**"]`를 인덱스와 샤드에서 제거해 `always`는 유지하고 미분류 경로가 전량으로 fail-open하게 한다.
- [ ] `.bouncer/config.json`과 `docs/configuration.md`를 8개 샤드·6KB 기준으로 맞춘다.
- [ ] 아래 명령에서 S26·구조 경고가 없고 전체가 31,176바이트 이하인지 확인한다.
  ```bash
  bouncer distill --all --repo "$(pwd)"
  node --test test/distill.test.js
  npm run ci
  ```
