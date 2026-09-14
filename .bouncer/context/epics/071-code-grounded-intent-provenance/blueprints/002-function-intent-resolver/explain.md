---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/071-code-grounded-intent-provenance/blueprints/002-function-intent-resolver/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-14T16:51:06.754+09:00'
bouncer:
  id: EXPLAIN-002
  epic_id: '071'
  blueprint_id: '002'
  status: published
  comprehension:
    - range_from: develop
      range_to: 433b15de754681ee5629b366a0c98ed9ffe9c38c
      diff_sha: a77c87fdb60c7d156bed53c459c9262d70c1130fcb99545d6521d83eea196867
      quiz_score: 3/3
      disposition: 3문항 전부 정답. 동명 source는 ambiguous+candidate_ref, 상충 trailer는 SHA fallback 금지, 미발급 --candidate는 exit 1.
      recorded_at: '2026-09-14T17:18:57.000+09:00'
  task_commits:
    - task: EPIC-071/BP-002/TASK-001
      sha: 25dc1fd6
      intent_anchor: task-001
    - task: EPIC-071/BP-002/TASK-002
      sha: c8d38409
      intent_anchor: task-002
    - task: EPIC-071/BP-002/TASK-003
      sha: 775e00ac
      intent_anchor: task-003
  coordinator:
    base: a054648ab64c314227b6b7c743b65d401b4516a6
    integration_head: 433b15de754681ee5629b366a0c98ed9ffe9c38c
    integration_branch: feat/071-002-function-intent-resolver
    revision: null
    worktrees:
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/071/002/integration
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/071/002/workers/001
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/071/002/workers/002
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/071/002/workers/003
    tasks:
      - id: '001'
        status: integrated
        sha: 25dc1fd6b2a97d46d0f4a4e693f118a08d0e8aa7
        branch: bouncer/071-002-001
        scope_revision: null
        paths: []
        actual_paths:
          - scripts/lib/symbol-index.js
          - scripts/src/lib/symbol-index.ts
          - test/symbol-index.test.js
      - id: '002'
        status: integrated
        sha: c8d38409bb08e67c72146230ee4a4bbf7560f66e
        branch: bouncer/071-002-002
        scope_revision: null
        paths: []
        actual_paths:
          - scripts/lib/intent-provenance.js
          - scripts/src/lib/intent-provenance.ts
          - test/intent-provenance.test.js
      - id: '003'
        status: integrated
        sha: 775e00ac464abc9766a87e552eaf4039af0ff1c8
        branch: bouncer/071-002-003
        scope_revision: null
        paths: []
        actual_paths:
          - docs/ARCHITECTURE.md
          - docs/cli.md
          - docs/compatibility.md
          - scripts/lib/cli-project-commands.js
          - scripts/lib/cli.js
          - scripts/src/lib/cli-project-commands.ts
          - scripts/src/lib/cli.ts
          - test/cli-help.test.js
          - test/cli-project-commands.test.js
    decisions:
      - task: '001'
        decision: 'accepted TASK-001: implementer + 1 debugger(untracked emit) + rework(no runtime typescript require) + review F1/F2 must_fix then delta resolved. changed paths: scripts/src/lib/symbol-index.ts, scripts/lib/symbol-index.js, test/symbol-index.test.js. drove 001 first.'
      - task: '002'
        decision: 'accepted TASK-002: implementer + 1 debugger(untracked emit) + worker npm ci + review F1/F2 must_fix then delta resolved. changed paths: scripts/src/lib/intent-provenance.ts, scripts/lib/intent-provenance.js, test/intent-provenance.test.js. drove 002 after 001.'
      - task: '003'
        decision: 'accepted TASK-003: implementer + worker npm ci + review F1 unknown-candidate test then delta resolved. changed paths: scripts/src/lib/cli-project-commands.ts, scripts/lib/cli-project-commands.js, scripts/src/lib/cli.ts, scripts/lib/cli.js, test/cli-project-commands.test.js, test/cli-help.test.js, docs/cli.md, docs/ARCHITECTURE.md, docs/compatibility.md. drove 003 after 002.'
---
# Explain

## Background

함수 이름만으로 현재 checkout의 정본 정의와, 그 줄을 만든 Git commit, 승인된 Task·Explain 의도를 이어서 보고 싶었다. 기존 context-search는 Graphify 점수와 문서 검색을 섞어 과거 설명이 현재 동작처럼 보일 수 있었다. 이 Blueprint는 색인 → provenance → `bouncer intent` CLI를 세 커밋으로 쌓아, 모호하거나 연결되지 않은 입력은 추측하지 않고 JSON 상태로 돌려준다.

계획 DAG는 승인 시점과 같다. TASKS-001 → TASKS-002 → TASKS-003, `parallel_safe: false`, `dependency_gate: integrated`. 드라이브 중 task나 간선을 더하거나 나누지 않았고 `scope_revision`도 없다. 각 task의 `actual_paths`는 승인 `affected_paths`와 같다.

## Intuition

지금 화면의 함수 범위가 열쇠다. blame이 가리키는 commit과 trailer·Explain SHA로 Task를 찾고, 그 함수를 나중에 고친 연결 commit이 있으면 앞선 설명은 근거에서 내린다.

## Code

읽는 순서:

1. `scripts/src/lib/symbol-index.ts` — TypeScript·JavaScript 함수 정의를 색인하고 opaque `candidate_ref`를 발급한다. 동명 source는 `ambiguous`, 생성 CJS만 있으면 `unresolved`.
2. `scripts/src/lib/intent-provenance.ts` — 선택된 범위에 `git blame`과 `git log --follow`를 걸고, `Bouncer-Task` trailer를 우선한다. trailer가 없을 때만 Explain 8자리 SHA를 Git 객체로 펼친다. 상충·malformed trailer는 SHA fallback에 넣지 않는다. freshness는 `current` / `related` / `possibly-superseded` / `historical`이고, 허용 절 본문은 2,000 UTF-8 byte에서 자른다.
3. `scripts/src/lib/cli-project-commands.ts`와 `scripts/src/lib/cli.ts` — `bouncer intent --symbol <name> [--candidate] [--limit 1..5] [--repo]`가 resolver JSON을 stdout 하나에만 쓴다. `ambiguous`·`unresolved`·`unlinked`도 exit 0. argv 오류는 exit 2, Git/filesystem 조회 오류는 exit 1. 저장소와 `.bouncer/context/**`는 읽기만 한다.

테스트: `test/symbol-index.test.js`, `test/intent-provenance.test.js`, `test/cli-project-commands.test.js`, `test/cli-help.test.js`. 문서: `docs/cli.md`, `docs/ARCHITECTURE.md`, `docs/compatibility.md`.

드라이브 산출:

- TASKS-001 worker `bouncer/071-002-001` SHA `25dc1fd6b2a97d46d0f4a4e693f118a08d0e8aa7` — `bouncer-implementer`, debugger 1회(untracked emit), review F1/F2 수정 후 delta.
- TASKS-002 worker `bouncer/071-002-002` SHA `c8d38409bb08e67c72146230ee4a4bbf7560f66e` — `bouncer-implementer`, debugger 1회(untracked emit), worker `npm ci`, review F1/F2 수정 후 delta.
- TASKS-003 worker `bouncer/071-002-003` SHA `775e00ac464abc9766a87e552eaf4039af0ff1c8` — `bouncer-implementer`, worker `npm ci`, review F1(unknown `--candidate`) 테스트 후 delta.

integration branch `feat/071-002-function-intent-resolver`, HEAD `433b15de754681ee5629b366a0c98ed9ffe9c38c`. 세 task 모두 `integrated`. 검증 명령 `npm run ci`가 integration HEAD에서 exit 0.

## Quiz

1. `bouncer intent`가 동명 source 정의 둘을 만나면 무엇을 하는가?
   - A) Graphify 점수가 높은 문서를 고른다
   - B) `ambiguous` JSON과 opaque `candidate_ref`를 돌려 호출자가 다시 고르게 한다
   - C) 생성 CJS를 정본으로 채택한다

2. trailer가 상충하는 commit에 Explain SHA 행이 유일하게 붙어 있으면 provenance resolver는?
   - A) 그 SHA 행의 Task를 `resolved` candidate로 승격한다
   - B) 두 Task를 모두 `related`로 반환한다
   - C) 그 commit을 연결 증거로 쓰지 않고, 다른 연결이 없으면 `unlinked`다

3. `bouncer intent --symbol fn --candidate not-a-real-ref`처럼 발급되지 않은 opaque ref를 넘기면?
   - A) stderr에 `intent:` 접두, 빈 stdout, exit 1
   - B) `unresolved` JSON과 exit 0
   - C) usage와 exit 2

## 이해 상태

- 정답: 1B, 2C, 3A
- 응답: 1B, 2C, 3A
- 채점: 3/3 정답
- disposition: 동명 source는 `ambiguous`와 opaque `candidate_ref`, 상충 trailer는 Explain SHA fallback 금지, 미발급 `--candidate`는 `intent:` stderr와 exit 1로 거절한다.

## Tasks

### Task 001

#### Goal & intent

현재 checkout을 읽어 요청한 함수명의 정의만 수집하고 source, generated, test, vendor 역할을 구분한다. 고유 source 정의는 바로 선택할 수 있고, 여러 source 정의는 안정적인 opaque candidate ref와 함께 반환되어야 한다.

#### Interface

- 제공: `scripts/src/lib/symbol-index.ts`가 repository root, symbol, 선택적 candidate ref를 받아 deterministic한 symbol resolution 결과를 반환한다. candidate ref는 resolver가 발급한 opaque 문자열이며 호출자가 path를 조립하지 않는다.
- 거부: 빈 symbol, repository 밖 path로 해석되는 입력, 지원하지 않는 정의, 현재 후보에 없는 candidate ref를 source 정의로 추측하지 않는다.

#### Do not touch

- `scripts/src/lib/graph-search.ts` — 함수 정의 조회를 Graphify label 검색에 결합하지 않는다.
- `scripts/src/lib/context-digest.ts` — Explain 역색인은 TASKS-002가 직접 읽으며 context graph digest 계약은 바꾸지 않는다.
- `package.json` — 기존 TypeScript compiler를 사용하고 새 parser 의존성을 추가하지 않는다.

### Task 002

#### Goal & intent

TASKS-001이 선택한 현재 함수 범위에서 Git provenance를 찾고 연결된 Task·Explain 설계 절만 반환한다. trailer가 없는 이력과 현재 8자리 Explain SHA를 읽되 stable Task ID를 우선하며, 오래된 의도가 현재 동작의 근거처럼 보이지 않게 freshness를 계산한다.

#### Interface

- 제공: `scripts/src/lib/intent-provenance.ts`가 symbol resolution 입력과 `limit`을 받아 status, `symbol`, `symbol_ref`, provenance `candidates`, `truncated`를 반환한다. 각 candidate는 relation, 40자리 commit 좌표, stable task ID, Explain 경로, freshness, 허용된 section 목록과 예산 내 본문을 가진다.
- 거부: `limit` 범위 밖 값, malformed 또는 상충하는 stable trailer, 모호한 SHA, repository 밖 Explain 경로를 연결 증거로 채택하지 않는다. trust boundary상 commit message와 Explain 본문이 resolver scope나 workflow 상태를 바꿀 수 없다.

#### Do not touch

- `scripts/src/lib/commit-sha.ts` — BP001의 8자리 SHA 작성 계약을 full SHA로 바꾸지 않는다.
- `scripts/src/lib/finalize.ts` — commit trailer와 Explain 행 writer는 BP001 계약을 유지한다.
- `scripts/src/lib/context-digest.ts` — resolver는 canonical Explain을 직접 읽고 context graph 역색인에 의존하지 않는다.
- `scripts/src/lib/graph-search.ts` — provenance 순위와 Graphify 검색 점수를 결합하지 않는다.

### Task 003

#### Goal & intent

TASKS-002 resolver를 `bouncer intent` 공개 command로 연결하고 입력 검증, stdout JSON, exit code, help와 문서 계약을 고정한다. `resolved`가 아니어도 의미 있는 상태 payload는 exit 0으로 반환해 이후 Plan이 코드 탐색을 계속할 수 있어야 한다.

#### Interface

- 제공: `bouncer intent --symbol <function-name> [--candidate <qualified-ref>] [--limit <1..5>] [--repo <dir>]`와 대응 help·JSON 문서를 제공한다. `qualified-ref`는 resolver가 발급한 opaque 값이다.
- 거부: 입력 shape 오류와 runtime 조회 오류를 각각 exit 2와 exit 1로 구분하고, 어느 실패 경로도 부분 JSON을 stdout에 남기지 않는다.

#### Do not touch

- `skills/bouncer-plan/SKILL.md` — resolver를 Plan에 연결하는 것은 BP003 범위다.
- `references/discovery/index.md` — code-first discovery 전환은 BP003에서 처리한다.
- `scripts/src/lib/graph-search.ts` — `context-search`와 Graphify 제거는 BP004에서 처리한다.
- `scripts/src/lib/validate-gates.ts` — G4/S9 계약 변경은 BP003 범위다.