---
type: bouncer.explain
title: 005 explain
description: Explain for 005
resource: .bouncer/context/epics/071-code-grounded-intent-provenance/blueprints/005-terminal-verification/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-16T22:33:21.353+09:00'
bouncer:
  id: EXPLAIN-005
  epic_id: '071'
  blueprint_id: '005'
  status: published
  comprehension:
    - range_from: develop
      range_to: bcce53dcd9ffb9805eeb26e573f6007c31a31ff1
      diff_sha: d2da27e9b93710edca9d76a6a55947b484c6dd6c5d77464e32bd1e36b0f9d52f
      quiz_score: 3/3
      disposition: 세 문항 모두 정답. 종단 회귀 경로, opaque candidate_ref, verification node 역할을 구분함.
      recorded_at: '2026-09-16T22:36:03+09:00'
  task_commits:
    - task: EPIC-071/BP-005/TASK-001
      sha: 38433a15
      intent_anchor: task-001
  coordinator:
    base: ba1a4d3246577a2748b50c53895b77423428eb98
    integration_head: bcce53dcd9ffb9805eeb26e573f6007c31a31ff1
    integration_branch: test/071-005-terminal-verification
    revision: null
    worktrees:
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/071/005/integration
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/071/005/workers/001
    tasks:
      - id: '001'
        status: integrated
        sha: 38433a15f70ab41e4d65f8f6192b7e2a76115cfc
        branch: bouncer/071-005-001
        scope_revision: null
        paths: []
        actual_paths:
          - test/terminal-intent-provenance.test.js
      - id: '002'
        status: integrated
        sha: null
        branch: null
        scope_revision: null
        paths: []
        actual_paths: []
    decisions:
      - task: '001'
        decision: 'Accepted TASKS-001 after implementer+review delta; paths: test/terminal-intent-provenance.test.js. Refused package-lock.json drift from npm install.'
      - task: '002'
        kind: env-retry
        reason: First npm run ci failed solely from missing node_modules in integration worktree (ENOENT js-yaml/typescript). Ran npm ci; npm run ci now exits 0. No Blueprint-scoped source repair warranted. Reset TASKS-002 verifying→ready to retry coordinate integrate.
        at: '2026-09-16T22:32:30.086+09:00'
---
# Explain

## Background

Epic 071의 앞선 Blueprint는 candidate 선택, trailer·Explain SHA, freshness, Graphify scope를 각각 다른 fixture에서 검증한다. 배포 CLI를 한 임시 저장소 이력으로 가로지르는 회귀가 없어, 계약이 서로 어긋나도 suite가 조용히 통과할 수 있다. 이 Blueprint는 그 단절을 `test/terminal-intent-provenance.test.js` 하나로 고정하고, TASKS-002가 integration에서 `npm run ci` 증적을 남긴다.

Drive 실제 기록(원장): DAG는 `001 → 002` 그대로였다. TASKS-001 `affected_paths`와 `actual_paths`는 모두 `test/terminal-intent-provenance.test.js`이며 scope revision은 없다. implementer가 worker `bouncer/071-005-001`에 `38433a15…`를 남겼고, integration HEAD는 cherry-pick 뒤 `bcce53dc…`다. TASKS-002는 verification node로 worker/commit 없이 `npm run ci`만 돌렸다. 첫 CI는 integration에 `node_modules`가 없어 실패했고, `npm ci` 뒤 재시도로 통과했다.

## Intuition

임시 Git 저장소 하나에서 ambiguous 함수 선택부터 두 Task trailer·Explain·freshness, 그리고 source/test Graphify까지 한 줄로 이어서 본다.

## Code

읽을 파일은 `test/terminal-intent-provenance.test.js`뿐이다. 테스트는 `scripts/lib` 배포 CLI를 spawn하고, 고정 identity로 commit하며, in-repo Graphify double로 context 산출물이 생기지 않음을 단언한다. 제품 `scripts/src/lib/`와 기존 단위 fixture는 건드리지 않았다.

## Quiz

1. 이 Blueprint가 추가한 종단 회귀의 주 경로로 맞는 것은?
   - A) `scripts/src/lib/intent-provenance.ts`를 직접 수정해 freshness enum을 바꾼다
   - B) `test/terminal-intent-provenance.test.js`가 임시 저장소에서 배포 CLI·두 Task·Graphify scope를 이어서 검증한다
   - C) `test/session-graph.test.js`에 context graph fixture를 추가한다

2. ambiguous 조회 뒤 candidate를 고를 때 테스트가 지키는 규칙은?
   - A) 배열 첫 항목을 무조건 고른다
   - B) 경로 문자열을 새로 합성해 `--candidate`에 넘긴다
   - C) payload가 돌려준 opaque `candidate_ref`를 그대로 `--candidate`에 넘긴다

3. TASKS-002 verification node가 integration에서 하는 일은?
   - A) 새 source commit을 만들고 reviewer를 돌린다
   - B) `npm run ci`를 실행해 증적만 남기고 fan-in commit은 만들지 않는다
   - C) main checkout에 `node_modules`를 커밋한다

## 이해 상태

정답: 1-B, 2-C, 3-B. 응답: B C B. 채점 3/3 전부 맞음. disposition: 종단 회귀 파일 경로, opaque candidate_ref 사용, verification node의 CI-only 역할을 구분함.

## Tasks

### Task 001

#### Goal & intent

임시 Git 저장소에서 배포된 Bouncer CLI 표면을 사용해 함수 candidate 선택부터 두 Task commit의 intent freshness와 source/test Graphify까지 이어지는 종단 회귀를 추가한다. 테스트는 실제 checkout을 바꾸지 않고 계약별 assertion으로 실패 지점을 구분해야 한다.

#### Interface

- 제공: Node test runner가 자동 발견하는 하나의 종단 회귀와, 단계별 CLI stdout·Git commit·Explain·graph 산출물 assertion을 제공한다.
- 거부: 실제 checkout 경로, 전역 Git identity, 네트워크, 사용자 입력 또는 시스템에 설치된 Graphify 실행 파일에 의존하는 fixture는 허용하지 않는다. candidate 목록의 배열 순서만으로 의미를 추정하지 않고 반환된 opaque ref를 그대로 사용한다. 현재 목록에 없는 ref는 다른 함수로 대체하지 않고 exit code 1의 조회 실패로 끝나야 한다.

#### Do not touch

- `scripts/src/lib/` — BP 001~004의 TypeScript 제품 계약은 이 Blueprint에서 바꾸지 않는다.
- `scripts/lib/` — 배포 CommonJS 산출물은 테스트 대상으로만 사용하며 수정하지 않는다.
- `test/intent-provenance.test.js` — resolver 단위 계약은 기존 fixture 그대로 유지한다.
- `test/session-graph.test.js` — graph scope 단위 계약은 기존 fixture 그대로 유지한다.
- `bouncer-roadmap.md` — 승인된 로드맵은 계획 입력이며 구현 task의 수정 대상이 아니다.

### Task 002

#### Goal & intent

TASKS-001이 integration checkout에 반영된 뒤 `npm run ci`를 한 번 실행해 emit, coverage, lint, 문서 검사, typecheck와 audit를 포함한 종단 증적을 남긴다. 이 node는 source diff, review와 commit을 만들지 않는다.

#### Interface

- 제공: `npm run ci`의 command, 실행 시각, exit code와 output tail을 담은 `verification.md` 증적을 제공한다.
- 거부: TASKS-001이 integrated되기 전 실행, source 수정, review dispatch와 commit 생성을 허용하지 않는다.

#### Do not touch

- `scripts/` — CI 실패는 이 node에서 제품 코드를 수정해 숨기지 않는다.
- `test/` — CI 실패는 이 node에서 테스트를 수정해 통과시키지 않는다.
- `package.json` — 승인된 `npm run ci` 정의를 검증 중 바꾸지 않는다.