---
type: bouncer.tasks
title: 파생 경로 유출 방어 필터와 context 그래프 문서 갱신
description: Tasks for 002
resource: .bouncer/context/epics/060-graphify-search-quality/blueprints/004-context-section-digest/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-11T14:59:26.218+09:00'
bouncer:
  id: TASKS-002
  epic_id: '060'
  blueprint_id: '004'
  status: verified
  commit_intent:
    - 매핑이 깨지면 파생 경로가 suggested_paths를 거쳐 affected_paths까지 실릴 수 있음
    - 소비 측에서 한 겹 더 걸러 계획 문서가 존재하지 않는 경로를 승인하지 못하게 함
  affected_paths:
    - skills/graphify-runner/SKILL.md
    - test/skill-graphify-runner.test.js
    - docs/configuration.md
    - docs/ARCHITECTURE.md
  graph:
    generated_at: '2026-08-11T15:05:22+09:00'
    command: graphify query (source + context)
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - skills/graphify-runner
      - docs
    basis:
    - graph: source
      status: reused
      query: >-
        context graph section digest derived tree session-graph
        normalizeGraphPaths resolveGraphScopes graphify runner suggested paths
      result: >-
        66 nodes / 10 files. scripts/src/lib/session-graph.ts,
        scripts/src/lib/graphify.ts, scripts/src/lib/init.ts, scripts/src/lib/cli.ts
        (+ scripts/lib CJS emit). test/ and skills/ did not surface — added manually.
    - graph: context
      status: updated
      query: >-
        context graph section digest derived tree session-graph
        normalizeGraphPaths resolveGraphScopes graphify runner suggested paths
      result: >-
        3 files. epics/011-graphify-signal/blueprints/002-graph-path-contract
        (기존 그래프 경로 계약), epics/026-context-graph-slim BP·tasks 자신.
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
task 001이 빌드 경계에서 파생 경로를 원본으로 되돌린다. 이 task는 그 뒤에 소비 측 방어선을 하나 더 둔다. `graphify-runner`가 쿼리 히트를 디렉터리로 롤업하기 전에 `graphify-out/` 하위 경로를 버리므로, 매핑이 깨지거나 누군가 파생 트리를 직접 쿼리해도 존재하지 않는 경로가 `suggested_paths`에 실리지 않는다. 같은 변경으로 context 그래프의 입력이 더는 `context_dirs` 원본이 아니라는 사실을 설정·아키텍처 문서에 반영한다.

## Interface
- 제공:
  - `skills/graphify-runner/SKILL.md`의 롤업 단계가 `graphify-out/` 하위 히트를 버리라고 명시하고, 파생 이름을 스킬이 직접 번역하지 않는다는 것을 함께 못박는다.
  - `test/skill-graphify-runner.test.js`가 그 문구의 존재를 계약으로 단언한다.
  - `docs/configuration.md`의 `context_dirs` 행과 `docs/ARCHITECTURE.md` §D-1이 파생 트리 경유 빌드를 설명한다.
- 거부:
  - 스킬은 `map.json`을 읽지 않는다. 파생 이름 → 원본 경로 번역은 빌드 경계의 책임이고, 스킬은 걸러내기만 한다.
  - 필터 때문에 모든 히트가 사라져도 실패로 처리하지 않는다. 기존 graceful skip 경로를 그대로 타고 `basis` 항목을 남긴다.

## Touch
- Modify `skills/graphify-runner/SKILL.md` — 롤업 전 `graphify-out/` 히트 제외 규칙과 번역 금지 문장 추가
- Modify `test/skill-graphify-runner.test.js` — 위 문구를 계약으로 단언
- Modify `docs/configuration.md` — `context_dirs` 행에 섹션 다이제스트 경유 빌드 설명 추가
- Modify `docs/ARCHITECTURE.md` — §D Graphify 정책에 파생 트리와 화이트리스트 기술

## Do not touch
- `scripts/src/lib/context-digest.ts` — task 001에서 확정된 구현이다
- `scripts/src/lib/session-graph.ts` — 같은 이유
- `scripts/lib/context-digest.js` — 같은 이유
- `scripts/lib/session-graph.js` — 같은 이유
- `test/context-digest.test.js` — 같은 이유
- `test/session-graph.test.js` — 같은 이유
- `skills/bouncer-plan/SKILL.md` — plan 워크플로 단계는 바뀌지 않는다

## Constraints
- 스킬의 기존 단계 번호와 `basis` 상태 매핑 표를 유지한다. 필터는 4단계(롤업) 안에 들어간다.
- 스킬 YAML `description`은 건드리지 않는다. 본문에 노출되는 `##`는 따옴표 처리 규칙에 걸리므로 프론트매터에 새 헤딩 문자열을 넣지 않는다.
- 문서 표의 열 구조와 기존 행 순서를 바꾸지 않는다. `context_dirs` 행의 설명만 늘린다.
- 새 CLI나 설정 키를 만들지 않는다.

## Checklist
- [ ] `test/skill-graphify-runner.test.js`에 실패 테스트를 먼저 추가한다.
  ```js
  const skill = fs.readFileSync(path.join(root, 'skills/graphify-runner/SKILL.md'), 'utf8');
  assert.match(skill, /graphify-out\//);
  assert.match(skill, /롤업/);
  ```
  실제 단언은 「롤업 전에 `graphify-out/` 하위 히트를 제외한다」와 「파생 이름을 스킬이 번역하지 않는다」 두 규칙이 각각 본문에 있는지를 본다.
- [ ] `node --test test/skill-graphify-runner.test.js`가 실패하는 것을 확인한다.
- [ ] `skills/graphify-runner/SKILL.md` 4단계에 두 문장을 넣는다. context 그래프는 이미 저장소-상대 원본 경로만 담고 있으므로, `graphify-out/` 아래 경로가 히트에 나타나면 그것은 빌드 경계가 샌 신호이니 버린다. 파생 이름을 원본으로 되돌리는 일은 스킬이 하지 않는다.
- [ ] `docs/configuration.md`의 `context_dirs` 행을 고친다. 입력은 그대로 `context_dirs`지만, 빌드는 화이트리스트 섹션만 뽑은 `graphify-out/context-src/`를 스캔하고 결과 경로는 원본으로 되돌린다는 것을 적는다. 화이트리스트 세 종류를 함께 적는다.
- [ ] `docs/ARCHITECTURE.md` §D-1에 같은 내용을 한 항목으로 추가한다. freshness 판정 입력이 `context_dirs`와 `.bouncer/Distill.md`라는 점을 포함한다.
- [ ] `npm test`가 통과한다.
