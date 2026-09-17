---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/072-search-payload-context-retention/blueprints/001-graphify-compact-payload/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-17T11:00:32.068+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '072'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: develop
      range_to: 6b494ed6776f19973856274af6c336c2cca5147d
      diff_sha: 9db197425e477f5f2a9f55c570c9fd8402e0fd448ce216274d8055ee818f886f
      quiz_score: 2/3
      disposition: Q1·Q2 정답, Q3는 verification source-diff 요구로 오해. drive r2 allowlist 동기화 이유를 다시 확인함.
      recorded_at: '2026-09-17T11:02:52+09:00'
  task_commits:
    - task: EPIC-072/BP-001/TASK-001
      sha: 29efd4f9
      intent_anchor: task-001
  coordinator:
    base: ef1887d224f9dff8f7b23f86940f0d5d4c6ab80e
    integration_head: 6b494ed6776f19973856274af6c336c2cca5147d
    integration_branch: feat/072-001-graphify-compact-payload
    revision: r2
    worktrees:
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/072/001/integration
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/072/001/workers/001
    tasks:
      - id: '001'
        status: integrated
        sha: 29efd4f9eb58757a322c3d844538ae176973a267
        branch: bouncer/072-001-001
        scope_revision: r2
        paths:
          - scripts/src/lib/graph-search.ts
          - scripts/src/lib/cli-project-commands.ts
          - scripts/lib/graph-search.js
          - scripts/lib/cli-project-commands.js
          - test/graph-search.test.js
          - test/cli-project-commands.test.js
          - test/cli-help.test.js
          - references/graphify-runner/index.md
          - test/skill-graphify-runner.test.js
          - docs/cli.md
          - test/ci-contract.test.js
        actual_paths:
          - docs/cli.md
          - references/graphify-runner/index.md
          - scripts/lib/cli-project-commands.js
          - scripts/lib/graph-search.js
          - scripts/src/lib/cli-project-commands.ts
          - scripts/src/lib/graph-search.ts
          - test/ci-contract.test.js
          - test/cli-help.test.js
          - test/cli-project-commands.test.js
          - test/graph-search.test.js
          - test/skill-graphify-runner.test.js
      - id: '002'
        status: integrated
        sha: null
        branch: null
        scope_revision: null
        paths: []
        actual_paths: []
    decisions:
      - task: '001'
        kind: scope
        reason: Pre-existing base HEAD ef1887d dropped 3 distill tokens in distill-decommission-audit.test.js without updating ci-contract allowlist (102→99); npm test and terminal CI cannot pass without syncing count. Smallest in-blueprint remediation; not graph-suggest product drift.
        previous:
          - scripts/src/lib/graph-search.ts
          - scripts/src/lib/cli-project-commands.ts
          - scripts/lib/graph-search.js
          - scripts/lib/cli-project-commands.js
          - test/graph-search.test.js
          - test/cli-project-commands.test.js
          - test/cli-help.test.js
          - references/graphify-runner/index.md
          - test/skill-graphify-runner.test.js
          - docs/cli.md
        next:
          - test/ci-contract.test.js
        revision: r1
      - task: '001'
        kind: scope
        reason: Restore full TASKS-001 product scope plus ci-contract allowlist sync; r1 incorrectly replaced rather than widened affected_paths.
        previous:
          - test/ci-contract.test.js
        next:
          - scripts/src/lib/graph-search.ts
          - scripts/src/lib/cli-project-commands.ts
          - scripts/lib/graph-search.js
          - scripts/lib/cli-project-commands.js
          - test/graph-search.test.js
          - test/cli-project-commands.test.js
          - test/cli-help.test.js
          - references/graphify-runner/index.md
          - test/skill-graphify-runner.test.js
          - docs/cli.md
          - test/ci-contract.test.js
        revision: r2
      - task: '001'
        decision: 'Accepted TASKS-001: compact/debug graph-suggest; review must_fix applied; ci-contract allowlist 102→99 (r2). Workers: implementer/debugger/reviewer. Changed paths match actualPaths. SHA 29efd4f9eb58757a322c3d844538ae176973a267 on bouncer/072-001-001.'
---
# Explain

## Background

Plan이 `graph-suggest` 결과를 읽을 때 후보·근거 문자열이 기본 JSON에 그대로 실려 context가 커졌다. 이 Blueprint는 탐색량과 기본 후보 수를 고정하고, 상세 진단은 `--debug`에만 둔다. Drive는 TASKS-001 한 commit 뒤 TASKS-002에서 `npm run ci`로 전체 증적을 남겼다. 구현 중 base HEAD(`ef1887d`)가 distill allowlist 카운트를 갱신하지 않아 `npm test`가 깨져 있었고, coordinator가 TASKS-001 scope를 r2로 넓혀 `test/ci-contract.test.js` 카운트만 102→99로 맞췄다.

## Intuition

추천은 짧은 목록이고, 긴 추적 로그는 스위치를 켠 사람에게만 준다.

## Code

- `scripts/src/lib/graph-search.ts` — seed 예산(file fan-out 8, frontier 32, depth 2), 안정 정렬, compact/debug projection, 폐쇄형 basis·reason.
- `scripts/src/lib/cli-project-commands.ts` — singleton `--debug` 파싱.
- `scripts/lib/graph-search.js`, `scripts/lib/cli-project-commands.js` — tsc emit.
- `test/graph-search.test.js`, `test/cli-project-commands.test.js`, `test/cli-help.test.js` — compact/budget/debug·help 계약.
- `references/graphify-runner/index.md`, `docs/cli.md`, `test/skill-graphify-runner.test.js` — 소비 문서·회귀.
- `test/ci-contract.test.js` — distill allowlist 동기화(drive r2).

Worker branch `bouncer/072-001-001` SHA `29efd4f9eb58757a322c3d844538ae176973a267` → integration `6b494ed6776f19973856274af6c336c2cca5147d`. TASKS-002는 integration에서 `npm run ci` exit 0.

## Quiz

1. 기본 `graph-suggest` 응답에서 후보에 남기는 필드는?
   - A) `path`, `role`, `score`, `basis`
   - B) `path`, `score`, `confidence`, `basis`
   - C) `path`, `role`, `confidence`, `reasons`

2. seed별 file fan-out 또는 BFS frontier를 넘기면 기본 결과는?
   - A) 후보를 잘라 `result.ranked`로 반환한다
   - B) `low-confidence`와 빈 `suggested_paths`로 내린다
   - C) debug 없이도 상세 omission 문자열을 reasons에 넣는다

3. drive 중 `test/ci-contract.test.js`를 scope에 넣은 이유는?
   - A) graph-suggest compact basis enum을 그 파일에 정의했기 때문
   - B) base commit이 distill 토큰을 줄인 뒤 allowlist 카운트를 안 맞춰 `npm test`/`ci`가 깨졌기 때문
   - C) TASKS-002 verification node가 source diff를 만들도록 요구했기 때문

## 이해 상태

- quiz_score: 2/3
- Q1 정답 A · 응답 A · 맞음 — compact 후보는 `path`/`role`/`score`/`basis`
- Q2 정답 B · 응답 B · 맞음 — budget 초과는 `low-confidence` + 빈 `suggested_paths`
- Q3 정답 B · 응답 C · 틀림 — `test/ci-contract.test.js`는 base HEAD distill allowlist(102→99) 동기화용; verification node는 source diff를 만들지 않음
- disposition: Q1·Q2 정답, Q3는 verification source-diff 요구로 오해. drive r2 allowlist 동기화 이유를 다시 확인함.

## Tasks

### Task 001

#### Goal & intent

`graph-suggest`가 함수·path seed에서 bounded traversal을 수행하고 기본 응답에는 계획에 필요한 compact 후보만 반환하게 한다. 상세 후보와 설명은 `--debug` 요청에만 싣고, Graphify 결과는 계속 조언으로만 사용한다.

#### Interface

- 제공: `bouncer graph-suggest --query <text> [--seed <value>]... [--debug] [--repo <dir>]`. 기본 JSON의 `candidates.implementation|test[]`는 compact candidate를, 선택 `debug`는 상세 candidate·reason·traversal을 제공한다.
- 거부: 중복 `--debug`와 값이 붙은 `--debug`는 사용법 오류로 끝낸다. generic label, unsafe path, `graphify-out/`, excluded path와 연결되지 않은 test는 추천하지 않는다. cap에 걸린 부분 탐색을 `ranked`로 표시하지 않는다.

#### Do not touch

- `scripts/src/lib/intent-provenance.ts` — lazy intent와 resolver payload는 다음 Blueprint 범위다.
- `scripts/src/lib/symbol-index.ts` — source/generated 분류 변경은 다음 Blueprint에서 다룬다.
- `scripts/src/lib/session-graph.ts` — graph build와 freshness 계약은 이번 ranking payload 변경 대상이 아니다.
- `scripts/src/lib/graph-exec.ts` — Graphify 외부 프로세스와 graph schema 경계를 바꾸지 않는다.
- `.bouncer/context/epics/001-product-surface-hosts`부터 `.bouncer/context/epics/071-code-grounded-intent-provenance`까지 — 과거 계획과 Explain을 소급 수정하지 않는다.

### Task 002

#### Goal & intent

TASKS-001이 integration checkout에 반영된 뒤 `npm run ci`를 실행해 emit, coverage, lint, 문서 검사, typecheck와 audit를 포함한 전체 증적을 남긴다. 이 node는 source diff, review와 commit을 만들지 않는다.

#### Interface

- 제공: integration checkout에서 실행한 `npm run ci`의 harness verification evidence를 제공한다.
- 거부: TASKS-001이 integrated되기 전 실행, source 수정, review dispatch와 commit 생성을 허용하지 않는다.

#### Do not touch

- `scripts/` — CI 실패를 검증 node에서 제품 코드 수정으로 숨기지 않는다.
- `test/` — CI 실패를 검증 node에서 assertion 변경으로 통과시키지 않는다.
- `package.json` — 승인한 `npm run ci` 정의를 검증 중 바꾸지 않는다.