---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/072-search-payload-context-retention/blueprints/002-lazy-intent-runtime-boundary/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-17T13:20:12+09:00'
bouncer:
  id: EXPLAIN-002
  epic_id: '072'
  blueprint_id: '002'
  status: published
  task_commits:
    - task: EPIC-072/BP-002/TASK-001
      sha: '49000084'
      intent_anchor: task-001
  comprehension:
    - range_from: develop
      range_to: 90435b6f0472311041255ab2bb661ad5b08ad517
      diff_sha: ead5d55a2100029fbf8cd045037c4424164e936a8f90c4d3b30c9597cae39e1f
      quiz_score: 3/3
      disposition: 지연 적재 경계·거절 경로·CI scaffold 실패 원인을 모두 맞힘
      recorded_at: '2026-09-17T13:20:12+09:00'
  coordinator:
    base: 737be90cfa515d42f997aec810a699fa0cf9c86b
    integration_head: 90435b6f0472311041255ab2bb661ad5b08ad517
    integration_branch: feat/072-002-lazy-intent-runtime-boundary
    revision: null
    worktrees:
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/072/002/integration
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/072/002/workers/001
    tasks:
      - id: '001'
        status: integrated
        sha: 490000842aa348da54b1b438e693bff0e297a547
        branch: bouncer/072-002-001
        scope_revision: null
        paths: []
        actual_paths:
          - scripts/lib/cli-project-commands.js
          - scripts/src/lib/cli-project-commands.ts
          - test/cli-project-commands.test.js
          - scripts/lib/cli-intent-command.js
          - scripts/src/lib/cli-intent-command.ts
      - id: '002'
        status: integrated
        sha: null
        branch: null
        scope_revision: null
        paths: []
        actual_paths: []
    decisions:
      - task: '001'
        decision: 'Accepted TASKS-001: lazy intent command boundary. Paths: scripts/src/lib/cli-project-commands.ts, scripts/src/lib/cli-intent-command.ts, scripts/lib/cli-project-commands.js, scripts/lib/cli-intent-command.js, test/cli-project-commands.test.js. Review advisories F1-F3 accepted; verify npm test passed.'
      - task: '002'
        decision: 'Retry verification after in-blueprint plan hygiene: removed leftover scaffold HTML comments from blueprint index.md and tasks/001|002/tasks.md (lint:context-comments). coordinate repair cannot name .bouncer/ paths; reset verifying→ready to retry coordinate integrate without a source repair wave.'
      - task: '002'
        decision: 'Drive complete: TASKS-001 integrated (sha 49000084…), TASKS-002 npm run ci passed. Closing /bouncer-finalize authored explain.md draft and stopped at explain quiz consent (user owns quiz answers before remainder/PR).'
---
# Explain

## Background

`bouncer intent`의 parser와 provenance resolver가 `cli-project-commands`에 정적으로
묶여 있어, CLI를 require하거나 help·일반 명령만 실행해도 `symbol-index`와
`intent-provenance`가 module cache에 올라갔다. 일반 탐색 비용이 intent 구현을
미리 물고 들어갔다. 이 드라이브는 intent 전용 command 모듈을 분리하고, 유효한
intent 실행에서만 그 모듈과 resolver를 적재하도록 경계를 옮겼다. 공개 CLI 계약은
그대로 두었다.

Drive 기록: DAG는 승인 시점과 동일하다 (`001` commit → `002` verification).
TASKS-001 `actual_paths`는 초기 `affected_paths`와 같다 (scope revision 없음).
Worker `bouncer/072-002-001` SHA `490000842aa348da54b1b438e693bff0e297a547`를
integration `90435b6f0472311041255ab2bb661ad5b08ad517`에 fan-in했다.
TASKS-002 첫 `npm run ci`는 계획 문서 scaffold 주석 때문에 실패했고, `.bouncer/`
경로는 repair 범위 밖이라 plan hygiene 후 verifying→ready 재시도로 `npm run ci`
exit 0을 남겼다.

## Intuition

무거운 도구 상자는 서랍에 두고, `intent` 손잡이를 당길 때만 연다.

## Code

- `scripts/src/lib/cli-project-commands.ts` — `cmdIntentLazy`가 실행 시점에만
  `./cli-intent-command`를 require. help용 usage 문자열은 레지스트리에 남김.
- `scripts/src/lib/cli-intent-command.ts` — argv 검증 후 `intent-provenance`를
  require. 거절 경로(exit 2)는 resolver를 건드리지 않음.
- `scripts/lib/cli-*.js` — `npm run build` emit.
- `test/cli-project-commands.test.js` — 격리 Node process로 require/help/일반
  명령·거절 argv·유효 intent 전후 module cache를 고정.

Workers: `bouncer-implementer` (구현), discovery `bouncer-reviewer` ×3
(spec_scope / correctness_tests / minimality_maintainability; F1–F3 advisory
수용). verification node는 worker 없이 integration에서 runner 실행.

## Quiz

질문 수: 3 (단일 commit + 지연 적재 경계·검증 실패 복구를 묻기 충분한 규모).

### Q1. CLI `require`만 한 직후 `require.cache`에 무엇이 있어야 하는가?
- A) `cli-intent-command`와 `intent-provenance`만 있다
- B) `symbol-index`와 `intent-provenance`가 없다
- C) `symbol-index`만 있고 `intent-provenance`는 없다

### Q2. `--symbol` 값이 비어 argv가 거절될 때 resolver 쪽 동작은?
- A) exit 2이고 `intent-provenance`·`symbol-index`를 적재하지 않는다
- B) exit 1이고 부분 JSON을 stdout에 남긴다
- C) exit 2이지만 전용 command 모듈도 절대 require하지 않는다

### Q3. 이 드라이브에서 terminal `npm run ci`가 처음 실패한 직접 원인은?
- A) TASKS-001이 integration에 cherry-pick되지 않았다
- B) 계획 문서에 남은 scaffold HTML 주석이 `lint:context-comments`에 걸렸다
- C) coverage threshold가 `cli-intent-command.js` 때문에 미달했다

## 이해 상태

- quiz_score: 3/3
- disposition: 지연 적재 경계·거절 경로·CI scaffold 실패 원인을 모두 맞힘
- Q1 정답 B / 응답 B → 맞음 (`require`만으로는 `symbol-index`·`intent-provenance` 부재)
- Q2 정답 A / 응답 A → 맞음 (빈 `--symbol`은 exit 2, resolver 미적재)
- Q3 정답 B / 응답 B → 맞음 (scaffold HTML 주석 → `lint:context-comments`)
- recorded_at: 2026-09-17T13:20:12+09:00
- range: develop..90435b6f0472311041255ab2bb661ad5b08ad517
- diff_sha: ead5d55a2100029fbf8cd045037c4424164e936a8f90c4d3b30c9597cae39e1f

## Tasks

### Task 001

#### Goal & intent

`bouncer intent` 전용 argv parser와 handler를 일반 project command 모듈에서 분리하고 유효한 intent dispatch에서만 적재한다. CLI require와 일반 명령 뒤 `symbol-index`와 `intent-provenance`가 module cache에 없고, intent 실행 뒤에만 나타나는 회귀로 완료를 판정한다.

#### Interface

- 제공: 공개 CLI signature와 출력은 그대로 두고 내부적으로 intent command loader가 첫 intent 실행에서 전용 CommonJS command 모듈을 require한다. TypeScript 값 경계는 프로젝트의 `export =` / `import = require()` 규칙을 지킨다.
- 거부: 중복 singleton option, 빈 `--symbol`·`--candidate`, 범위 밖 `--limit`, 값 없는 `--repo`와 예상하지 않은 argument는 resolver 적재·실행 없이 기존 메시지와 exit 2로 거절한다.

#### Do not touch

- `scripts/src/lib/symbol-index.ts` — 함수 정의 검색과 source/generated 분류 알고리즘은 이번 작업의 대상이 아니다.
- `scripts/src/lib/intent-provenance.ts` — Git provenance, freshness와 payload 계산은 기존 계약을 그대로 사용한다.
- `scripts/bouncer` — 실행 launcher 경로는 바꾸지 않는다.
- `test/symbol-index.test.js` — 기존 분류 회귀는 수정 없이 통과해야 한다.
- `test/intent-provenance.test.js` — resolver 단위 계약은 수정 없이 통과해야 한다.

### Task 002

#### Goal & intent

TASKS-001이 통합된 checkout에서 전체 CI를 실행해 lazy loading, 공개 intent 계약, 생성 CommonJS와 저장소 전역 품질 계약이 함께 통과하는지 검증한다. 이 task는 source를 수정하거나 commit을 만들지 않고 verification evidence만 남긴다.

#### Interface

- 제공: integration checkout에서 `npm run ci`를 한 번 실행한 실제 verification evidence를 제공한다.
- 거부: 선행 TASKS-001이 integrated가 아니거나 command가 non-zero이면 성공 증적으로 기록하지 않는다.

#### Do not touch

- `scripts/` — 실패를 고치기 위한 source 수정은 별도 repair task에서만 수행한다.
- `test/` — CI 실패를 숨기기 위한 assertion 수정은 이 verification node의 권한 밖이다.