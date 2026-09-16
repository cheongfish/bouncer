---
type: bouncer.explain
title: 004 explain
description: Explain for 004
resource: .bouncer/context/epics/071-code-grounded-intent-provenance/blueprints/004-context-graph-removal/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-16T11:56:40.166+09:00'
bouncer:
  id: EXPLAIN-004
  epic_id: '071'
  blueprint_id: '004'
  status: published
  task_commits:
    - task: EPIC-071/BP-004/TASK-001
      sha: c2a804ff
      intent_anchor: task-001
    - task: EPIC-071/BP-004/TASK-002
      sha: 8f92edff
      intent_anchor: task-002
    - task: EPIC-071/BP-004/TASK-003
      sha: f63c4654
      intent_anchor: task-003
    - task: EPIC-071/BP-004/TASK-004
      sha: 3341e536
      intent_anchor: task-004
  comprehension:
    - range_from: develop
      range_to: d3dd3c0ee9b5f1f0bab9e87916e553b8ce6efe13
      diff_sha: 2967569f0af3219ddf8a7db8810fd8e8dbb9425139e43cdd5028e6fa3440909b
      quiz_score: 4/4
      disposition: 네 문항 모두 정답. context-search 제거·graphSuggest 두 키·graph-sync 두 scope·init에서 context_dirs 부재를 맞췄음.
      recorded_at: '2026-09-16T12:17:32+09:00'
  coordinator:
    base: 6acda69486f01f9ae3bc12a1a1ca6b69dbc4b87f
    integration_head: d3dd3c0ee9b5f1f0bab9e87916e553b8ce6efe13
    integration_branch: feat/071-004-context-graph-removal
    revision: null
    worktrees:
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/071/004/integration
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/071/004/workers/001
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/071/004/workers/002
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/071/004/workers/003
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/071/004/workers/004
    tasks:
      - id: '001'
        status: integrated
        sha: c2a804ff15e9b4f3f3b20f80db85364f16b50256
        branch: bouncer/071-004-001
        scope_revision: null
        paths: []
        actual_paths:
          - docs/cli.md
          - docs/context-search-benchmark.md
          - scripts/lib/cli-project-commands.js
          - scripts/lib/cli.js
          - scripts/lib/graph-search.js
          - scripts/src/lib/cli-project-commands.ts
          - scripts/src/lib/cli.ts
          - scripts/src/lib/graph-search.ts
          - skills/bouncer-execute/SKILL.md
          - skills/bouncer-run/SKILL.md
          - test/ci-contract.test.js
          - test/cli-help.test.js
          - test/cli-project-commands.test.js
          - test/context-corpus-search.test.js
          - test/context-digest.test.js
          - test/fixtures/context-corpus-queries.json
          - test/graph-search.test.js
          - test/master-rules.test.js
          - test/skill-bouncer-execute.test.js
      - id: '002'
        status: integrated
        sha: 8f92edff90dfa47994cef32707154289c1772a93
        branch: bouncer/071-004-002
        scope_revision: null
        paths: []
        actual_paths:
          - scripts/lib/cli-project-commands.js
          - scripts/lib/graph-search.js
          - scripts/src/lib/cli-project-commands.ts
          - scripts/src/lib/graph-search.ts
          - test/ci-contract.test.js
          - test/fixtures/graph-search-quality.json
          - test/graph-search.test.js
      - id: '003'
        status: integrated
        sha: f63c46544540814e2a074f218cbca2b3486fcae0
        branch: bouncer/071-004-003
        scope_revision: null
        paths: []
        actual_paths:
          - hooks/session-graph.js
          - scripts/lib/cli-project-commands.js
          - scripts/lib/context-digest.js
          - scripts/lib/graph-exec.js
          - scripts/lib/graph-scope.js
          - scripts/lib/graphify.js
          - scripts/lib/session-graph.js
          - scripts/src/lib/cli-project-commands.ts
          - scripts/src/lib/context-digest.ts
          - scripts/src/lib/graph-exec.ts
          - scripts/src/lib/graph-scope.ts
          - scripts/src/lib/graphify.ts
          - scripts/src/lib/session-graph.ts
          - test/ci-contract.test.js
          - test/cli-help.test.js
          - test/context-digest.test.js
          - test/graphify.test.js
          - test/session-graph.test.js
      - id: '004'
        status: integrated
        sha: 3341e53674f2f3d609f70be39a7274ba5428ad31
        branch: bouncer/071-004-004
        scope_revision: null
        paths: []
        actual_paths:
          - CHANGELOG.md
          - config.example.json
          - docs/ARCHITECTURE.md
          - docs/compatibility.md
          - docs/configuration.md
          - docs/context-retention-and-epic-lifecycle.md
          - docs/graphify-context-contribution.md
          - docs/install.md
          - docs/troubleshooting.md
          - docs/workflow.md
          - references/graphify-runner/index.md
          - references/spec-authoring/index.md
          - rules/okf.md
          - scripts/lib/init.js
          - scripts/src/lib/init.ts
          - test/init.test.js
          - test/skill-graphify-runner.test.js
          - test/skill-spec-authoring.test.js
      - id: '005'
        status: integrated
        sha: null
        branch: null
        scope_revision: null
        paths: []
        actual_paths: []
    decisions:
      - task: '001'
        decision: 'Accepted TASKS-001 after implementer+review: removed context-search CLI/impl/skills/tests/docs. Review F001 export-absence test fixed; F002 advisory accepted (Checklist-directed). Paths: docs/cli.md, docs/context-search-benchmark.md, scripts/lib/cli-project-commands.js, scripts/lib/cli.js, scripts/lib/graph-search.js, scripts/src/lib/cli-project-commands.ts, scripts/src/lib/cli.ts, scripts/src/lib/graph-search.ts, skills/bouncer-execute/SKILL.md, skills/bouncer-run/SKILL.md, test/ci-contract.test.js, test/cli-help.test.js, test/cli-project-commands.test.js, test/context-corpus-search.test.js, test/context-digest.test.js, test/fixtures/context-corpus-queries.json, test/graph-search.test.js, test/master-rules.test.js, test/skill-bouncer-execute.test.js. Worker implementer SHA c2a804ff15e9b4f3f3b20f80db85364f16b50256 branch bouncer/071-004-001.'
      - task: '002'
        decision: 'Accepted TASKS-002: graphSuggest source+test only; removed context score/candidates. F1 connectedFixture fixed; F2/F3 advisory accepted. Paths: scripts/src/lib/graph-search.ts scripts/lib/graph-search.js scripts/src/lib/cli-project-commands.ts scripts/lib/cli-project-commands.js test/graph-search.test.js test/fixtures/graph-search-quality.json test/ci-contract.test.js. Worker SHA 8f92edff90dfa47994cef32707154289c1772a93 branch bouncer/071-004-002.'
      - task: '003'
        decision: 'Accepted TASKS-003: source+test only graph plan/build; deleted context-digest; F1 dead branch fixed; F2/F3 advisory accepted. Paths: hooks/session-graph.js scripts/lib/cli-project-commands.js scripts/lib/context-digest.js scripts/lib/graph-exec.js scripts/lib/graph-scope.js scripts/lib/graphify.js scripts/lib/session-graph.js scripts/src/lib/cli-project-commands.ts scripts/src/lib/context-digest.ts scripts/src/lib/graph-exec.ts scripts/src/lib/graph-scope.ts scripts/src/lib/graphify.ts scripts/src/lib/session-graph.ts test/ci-contract.test.js test/cli-help.test.js test/context-digest.test.js test/graphify.test.js test/session-graph.test.js. SHA f63c46544540814e2a074f218cbca2b3486fcae0 branch bouncer/071-004-003.'
      - task: '004'
        decision: 'Accepted TASKS-004: drop context_dirs from init/example; strip context graph docs/rules/refs; CHANGELOG Removed; SC21 clean. Repair fixed F1-F6; F7 advisory accepted. SHA 3341e53674f2f3d609f70be39a7274ba5428ad31 branch bouncer/071-004-004.'
      - task: '005'
        decision: 'Retry verification after in-blueprint plan hygiene: removed leftover scaffold HTML comment from blueprint index.md (lint:context-comments). coordinate repair cannot name .bouncer/ paths; reset ready→verifying→integrate without a source repair wave.'
---
# Explain

## Background
Plan이 코드와 intent provenance만으로도 근거를 잡게 된 뒤에도 context graph는
SessionStart마다 digest·graph를 다시 만들고, `context-search`와
`graph-suggest`의 context 점수가 검색·추천 입력을 키웠다. 이 drive는 공개
명령·점수·빌드·설정 기본값·문서 안내를 네 commit으로 걷어 Graphify를
source·test 두 scope만 남겼다. 종단 `npm run ci`로 통합 검증까지 끝냈다.

## Intuition
세 번째 그래프(context)를 빼면, 검색·추천·세션 빌드가 모두 코드/테스트
그래프만 본다.

## Code
- `scripts/src/lib/cli.ts` / `cli-project-commands.ts` — `context-search` 등록
  삭제, graph-sync·graph-suggest usage를 source·test로 맞춤
- `scripts/src/lib/graph-search.ts` — context-search 구현 삭제 후
  `graphSuggest`도 context load·점수·`candidates.context` 제거
- `scripts/src/lib/context-digest.ts` 삭제, `graph-scope`·`session-graph`·
  `graph-exec`·`graphify` — 계획·빌드·upgrade를 source·test만
- `scripts/src/lib/init.ts` / `config.example.json` — 새 config에서
  `context_dirs` 제거
- `references/graphify-runner/index.md`, `rules/okf.md`, docs — context
  질의·digest 안내 삭제; runner는 sync → resolve/skip → rank
- Drive 실제 경로: ledger `actualPaths`가 각 task `affected_paths`와 일치
  (scope revision 없음). Worker `bouncer/071-004-00{1..4}` → integration
  head `d3dd3c0ee9b5f1f0bab9e87916e553b8ce6efe13`

## Quiz
1. 완료 후 `bouncer context-search`를 호출하면 어떤 결과가 맞는가?
   - A) JSON 후보를 stdout에 쓰고 종료 코드 0
   - B) stderr에 `unknown command: context-search`, stdout 비움, 종료 코드 2
   - C) deprecated 경고 후 빈 `candidates` JSON, 종료 코드 0

2. `graphSuggest` 결과의 `candidates` 키 집합은?
   - A) `implementation`, `test`, `context`
   - B) `implementation`, `test` (빈 `context` 배열 포함)
   - C) `implementation`, `test`만 (context 키·빈 배열 없음)

3. SessionStart / `graph-sync`의 `graphs[].name`은?
   - A) `source`, `test`, `context`
   - B) `source`, `test`
   - C) `source`만 (`test_dirs` 없으면 test 행 생략)

4. 새 `init` config와 `config.example.json`에서 `context_dirs`는?
   - A) 기본값 `.bouncer/context`로 기록된다
   - B) 키가 없다 (기존 config의 키는 덮어쓰지 않음)
   - C) 키가 있으면 경고 후 삭제한다

## 이해 상태
정답: 1B, 2C, 3B, 4B. 응답: 1B, 2C, 3B, 4B. 결과 4/4 전부 맞음. disposition: context-search unknown/2, candidates는 implementation·test만, graphs는 source·test, 새 config에 context_dirs 키 없음.

## Tasks

### Task 001

#### Goal & intent

`bouncer context-search` 명령과 그 검색 구현을 삭제한다. 완료 후 help 목록에 명령이 없고, 호출은 `unknown command`와 종료 코드 2로 끝난다. `/bouncer-run`은 drive 시작 때 context 질의를 하지 않는다. 검증 명령은 `npm test`다.

#### Interface

- 제공: 새 공개 surface는 없다.
- 거부: `context-search`는 `unknown command`로 종료 코드 2를 반환한다. 위 네 export는 제거한다. 호환 alias와 deprecated stub은 두지 않는다.

#### Do not touch

- `scripts/src/lib/context-digest.ts` — TASKS-003이 모듈째 삭제한다.
- `scripts/src/lib/session-graph.ts` — TASKS-003 소유.
- `test/fixtures/graph-search-quality.json` — TASKS-002 소유.
- `skills/bouncer-plan/SKILL.md` — BP 003 소유.
- `references/discovery/index.md` — BP 003 소유.
- `scripts/src/lib/validate-structural.ts` — BP 003 소유.

### Task 002

#### Goal & intent

`graphSuggest`가 context graph 파일을 열지 않고 source·test graph만으로 후보를 매긴다. 완료 후 결과의 `candidates`는 `implementation`, `test` 두 키만 가지고, `reasons`에 `context`로 시작하는 줄이 없다. 검증 명령은 `npm test`다.

#### Interface

- 제공: `GraphSuggestResult.candidates = { implementation: Candidate[], test: Candidate[] }`.
- 거부: `candidates.context`, `SCORE.contextHit`, `ROLE_PRIORITY.context`, `ReachFlags.contextHit`를 두지 않는다. 빈 context 배열도 두지 않는다.

#### Do not touch

- `scripts/src/lib/graph-scope.ts` — `DEFAULT_CONTEXT_OUT` export 삭제는 TASKS-003 소유.
- `scripts/src/lib/context-digest.ts` — TASKS-003 소유.
- `scripts/src/lib/validate-structural.ts` — `SCOPE_CANDIDATE_ROLES`는 BP 003 소유.
- `references/graphify-runner/index.md` — TASKS-004 소유.

### Task 003

#### Goal & intent

SessionStart hook과 `bouncer graph-sync`가 source·test 두 scope만 계획하고 빌드한다. `context-digest` 모듈을 삭제해 `graphify-out/context-src/`와 `graphify-out/context/`를 만들지 않는다. 검증 명령은 `npm test`다.

#### Interface

- 제공: `resolveGraphScopes({ sourceDirs, testDirs, excludeDirs, testUnconfiguredReason })`가 길이 2 배열을 반환한다.
- 거부: `contextDirs` 인자와 `SessionGraphDeps.contextDirs`를 받지 않는다. 다음 export를 삭제한다.
  - `DEFAULT_CONTEXT_OUT`, `DEFAULT_CONTEXT_DIRS`, `realContextDirs`
  - `normalizeGraphPaths`의 `map` 옵션
  - `context-digest` 모듈(`require`하면 `MODULE_NOT_FOUND`가 난다)

#### Do not touch

- `scripts/src/lib/init.ts` — 기본 config의 `context_dirs` 삭제는 TASKS-004 소유.
- `config.example.json` — TASKS-004 소유.
- `scripts/src/lib/config.ts` — `context_dirs`를 읽지 않으므로 바꿀 이유가 없다.
- `scripts/check-context-comments.js` — `.bouncer/context` 문서 lint로 무관하다.
- `scripts/src/lib/validate-structural.ts` — BP 003 소유.

### Task 004

#### Goal & intent

새 `init` config와 `config.example.json`에서 `context_dirs`를 뺀다. rule·reference·docs에서 context graph의 빌드·질의·derived anchor 안내를 지운다. 완료 후 epic Success criteria 21의 참조 검색이 0건이다. 검증 명령은 `npm test`다.

#### Interface

- 제공: 새 기본 config shape는 `source_dirs`, `graphify`, `verify`, `verify_allowlist`, `base_branch`, `autonomy`, `pr`, `subagents` 키를 가진다.
- 거부: 새 config에 `context_dirs`를 쓰지 않는다. 문서는 `context-search` 명령과 context graph 질의를 안내하지 않는다.

#### Do not touch

- `scripts/src/lib/graph-scope.ts` — TASKS-003 소유.
- `skills/bouncer-plan/SKILL.md` — BP 003 소유.
- `references/discovery/index.md` — BP 003 소유.
- `docs/gates.md` — G4 서술은 BP 003 소유.
- `docs/distill-decommission-audit.md` — 과거 감사 기록.
- `.bouncer/config.json` — 기존 config의 `context_dirs`가 무시되는지 확인하는 실사용 사례로 남긴다.

### Task 005

#### Goal & intent

TASKS-001부터 TASKS-004까지 integrated된 integration checkout에서 `npm run ci`를 한 번 실행하고 `verification.md`에 증적을 남긴다. 이 node는 source를 바꾸지 않고 commit도 만들지 않는다.

#### Interface

- 제공: `verification.md`의 `npm run ci` 실행 증적.
- 거부: source diff, reviewable commit, `review.md`, `affected_paths`를 만들지 않는다.

#### Do not touch

- `scripts/src/lib/` — verification node는 source를 바꾸지 않는다.
- `test/` — 실패는 repair task가 고친다.