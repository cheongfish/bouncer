---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/079-roadmap-closeout/blueprints/001-release-artifact-governance-removal/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-28T11:23:04.410+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '079'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: develop
      range_to: 09c78b58ed7ca14dcab79add73b3b5c401cf2c1c
      diff_sha: 35737c8552987e6b04bb225c4f2d62bf90d73e55f47d32d04c91a9ed91e199d3
      quiz_score: 4/5
      disposition: Q5만 오답. github.ref_name은 run 스크립트에 직접 보간하지 않고 env REF_NAME으로 넘긴다.
      recorded_at: '2026-09-28T11:26:54+09:00'
  task_commits:
    - task: EPIC-079/BP-001/TASK-001
      sha: 32fb8e2f
      intent_anchor: task-001
    - task: EPIC-079/BP-001/TASK-002
      sha: 3bfac995
      intent_anchor: task-002
    - task: EPIC-079/BP-001/TASK-003
      sha: 09c78b58
      intent_anchor: task-003
  coordinator:
    base: 85a4d50082399389ab8cc19b3b34d8127da47596
    integration_head: 09c78b58ed7ca14dcab79add73b3b5c401cf2c1c
    integration_branch: feat/079-001-release-artifact-governance-removal
    revision: null
    worktrees:
      - /home/cheongwoon/workspace/Chunjae/bouncer/.worktrees/079/001/integration
      - /home/cheongwoon/workspace/Chunjae/bouncer/.worktrees/079/001/workers/001
      - /home/cheongwoon/workspace/Chunjae/bouncer/.worktrees/079/001/workers/002
      - /home/cheongwoon/workspace/Chunjae/bouncer/.worktrees/079/001/workers/003
    tasks:
      - id: '001'
        status: integrated
        sha: 7a246e9383e392139378c8ca41cfdfc1f92c9392
        branch: bouncer/079-001-001
        scope_revision: null
        paths: []
        actual_paths:
          - AGENTS.md
          - docs/architecture/rule-ownership.md
          - rules/commit-scope.md
          - rules/governance.md
          - rules/planning.md
          - rules/plugin-root.md
          - scripts/lib/coordinator.js
          - scripts/lib/scaffold.js
          - scripts/lib/scope.js
          - scripts/src/lib/coordinator.ts
          - scripts/src/lib/scaffold.ts
          - scripts/src/lib/scope.ts
          - skills/bouncer-init/SKILL.md
          - test/distribution.test.js
          - test/init.test.js
          - test/lightweight-cycle.test.js
          - test/master-rules.test.js
          - test/rule-ownership.test.js
          - test/skill-bouncer-surface.test.js
          - test/workflow-safety-canon.test.js
      - id: '002'
        status: integrated
        sha: 7ceb2783fab3cee6455fb414c098f104487e9a8e
        branch: bouncer/079-001-002
        scope_revision: null
        paths: []
        actual_paths:
          - docs/install.md
          - .github/workflows/release.yml
          - scripts/build-release.js
          - test/build-release.test.js
      - id: '003'
        status: integrated
        sha: ebc3089523d7885923dc3cb459884ef8c3004c80
        branch: bouncer/079-001-003
        scope_revision: null
        paths: []
        actual_paths:
          - .gitignore
          - CHANGELOG.md
          - scripts/bouncer
          - scripts/bouncer-root
          - scripts/check-emit.js
          - scripts/lib/.gitkeep
          - scripts/lib/bouncer-root.js
          - scripts/lib/cli-current-command.js
          - scripts/lib/cli-doc-commands.js
          - scripts/lib/cli-flags.js
          - scripts/lib/cli-git-commands.js
          - scripts/lib/cli-intent-command.js
          - scripts/lib/cli-project-commands.js
          - scripts/lib/cli-review-dispatch-command.js
          - scripts/lib/cli.js
          - scripts/lib/codex-agents.js
          - scripts/lib/commit-guard.js
          - scripts/lib/commit-hook.js
          - scripts/lib/commit-sha.js
          - scripts/lib/commit.js
          - scripts/lib/comprehension.js
          - scripts/lib/config.js
          - scripts/lib/coordinator.js
          - scripts/lib/current.js
          - scripts/lib/epic-index.js
          - scripts/lib/execute-prepare.js
          - scripts/lib/finalize-digest.js
          - scripts/lib/finalize-pr.js
          - scripts/lib/finalize.js
          - scripts/lib/frontmatter.js
          - scripts/lib/graph-exec.js
          - scripts/lib/graph-scope.js
          - scripts/lib/graph-search.js
          - scripts/lib/graphify.js
          - scripts/lib/import-git.js
          - scripts/lib/import-history.js
          - scripts/lib/import-render.js
          - scripts/lib/import-types.js
          - scripts/lib/init.js
          - scripts/lib/intent-bundle.js
          - scripts/lib/intent-provenance.js
          - scripts/lib/layout.js
          - scripts/lib/lease.js
          - scripts/lib/migrate-task-layout.js
          - scripts/lib/paths.js
          - scripts/lib/plan-inspect.js
          - scripts/lib/plan-snapshot.js
          - scripts/lib/plugin-root.js
          - scripts/lib/render.js
          - scripts/lib/retention-migration.js
          - scripts/lib/review-dispatch.js
          - scripts/lib/run-preflight.js
          - scripts/lib/runtime-state.js
          - scripts/lib/scaffold.js
          - scripts/lib/schema.js
          - scripts/lib/scope.js
          - scripts/lib/seed-worktree.js
          - scripts/lib/session-graph.js
          - scripts/lib/subagents.js
          - scripts/lib/symbol-index.js
          - scripts/lib/task-commits.js
          - scripts/lib/tasks-docs.js
          - scripts/lib/templates.js
          - scripts/lib/time.js
          - scripts/lib/validate-docs.js
          - scripts/lib/validate-gates.js
          - scripts/lib/validate-sections.js
          - scripts/lib/validate-structural.js
          - scripts/lib/validate.js
          - scripts/lib/verification.js
          - test/ci-contract.test.js
          - test/intent-provenance.test.js
          - test/plugin-root.test.js
      - id: '004'
        status: integrated
        sha: null
        branch: null
        scope_revision: null
        paths: []
        actual_paths: []
    decisions:
      - task: '001'
        kind: dispatch
        attempt: 1
        task_brief_hash: c2250848cb91d0942d001f40e7ae51573471e6221a3b939362d48cd82353ad37
        base_head: 85a4d50082399389ab8cc19b3b34d8127da47596
        initial_worktree_state: |
          ?? .bouncer/context/epics/079-roadmap-closeout/
      - task: '002'
        kind: dispatch
        attempt: 1
        task_brief_hash: 5052b979080836b47b98dced25b0b8b405c9ca6fae2cbe3f09018caa3ee46228
        base_head: 85a4d50082399389ab8cc19b3b34d8127da47596
        initial_worktree_state: |
          ?? .bouncer/context/epics/079-roadmap-closeout/
      - task: '001'
        kind: report
        attempt: 1
        task_brief_hash: c2250848cb91d0942d001f40e7ae51573471e6221a3b939362d48cd82353ad37
        outcome: accepted
        summary: 'accepted attempt 1: governance.md deleted, BP4 comments moved into TS, references and tests retargeted; focused tests 157 pass; scope none'
      - task: '002'
        kind: report
        attempt: 1
        task_brief_hash: 5052b979080836b47b98dced25b0b8b405c9ca6fae2cbe3f09018caa3ee46228
        outcome: accepted
        summary: 'accepted attempt 1: build-release.js, release.yml, install.md, and tests added; focused tests 17 pass and lint clean; scope none'
      - task: '002'
        kind: dispatch
        attempt: 2
        task_brief_hash: ad7a46260d81afebc2b28e327af620390f1567b3d274607285cfd8fea1291739
        base_head: 85a4d50082399389ab8cc19b3b34d8127da47596
        initial_worktree_state: |2
           M docs/install.md
          ?? .bouncer/context/epics/079-roadmap-closeout/
          ?? .github/workflows/release.yml
          ?? scripts/build-release.js
          ?? test/build-release.test.js
      - task: '002'
        kind: report
        attempt: 2
        task_brief_hash: ad7a46260d81afebc2b28e327af620390f1567b3d274607285cfd8fea1291739
        outcome: accepted
        summary: 'accepted attempt 2: F-SEC-001 github.ref_name moved to env REF_NAME; regression in test (e); lint and focused tests pass; scope none'
      - task: '001'
        kind: dispatch
        attempt: 2
        task_brief_hash: 1d6a5fd7746fd2a43ca5b7117e867a90edbb5243cc3bfa8fc49babd6741b30df
        base_head: 7a246e9383e392139378c8ca41cfdfc1f92c9392
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/079-roadmap-closeout/
      - task: '001'
        kind: report
        attempt: 2
        task_brief_hash: 1d6a5fd7746fd2a43ca5b7117e867a90edbb5243cc3bfa8fc49babd6741b30df
        outcome: accepted
        summary: 'coordinator re-baseline, no implementer rerun: record refused stale-worker-report because controller-owned tasks.md frontmatter changed after attempt 1 (status verified, commit_sha 7a246e93 stamp); brief authority sections byte-identical; attempt 1 accepted result carried forward'
      - task: '001'
        decision: 'accepted TASKS-001 at 7a246e9383e392139378c8ca41cfdfc1f92c9392 (branch bouncer/079-001-001; implementer attempt 1 + re-baseline 2; reviewer combined discovery F1 nit advisory accepted; verify npm test). changed paths: AGENTS.md, docs/architecture/rule-ownership.md, rules/commit-scope.md, rules/governance.md, rules/planning.md, rules/plugin-root.md, scripts/lib/coordinator.js, scripts/lib/scaffold.js, scripts/lib/scope.js, scripts/src/lib/coordinator.ts, scripts/src/lib/scaffold.ts, scripts/src/lib/scope.ts, skills/bouncer-init/SKILL.md, test/distribution.test.js, test/init.test.js, test/lightweight-cycle.test.js, test/master-rules.test.js, test/rule-ownership.test.js, test/skill-bouncer-surface.test.js, test/workflow-safety-canon.test.js'
      - task: '002'
        kind: dispatch
        attempt: 3
        task_brief_hash: 2887f0cdfccfb748dcf3566334fdc99cb6a6dc844e17e55df4ae7640363b044d
        base_head: 7ceb2783fab3cee6455fb414c098f104487e9a8e
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/079-roadmap-closeout/
      - task: '002'
        kind: report
        attempt: 3
        task_brief_hash: 2887f0cdfccfb748dcf3566334fdc99cb6a6dc844e17e55df4ae7640363b044d
        outcome: accepted
        summary: 'coordinator re-baseline, no implementer rerun: record refused stale-worker-report because controller-owned tasks.md frontmatter changed after attempt 2 (status verified, commit_sha 7ceb2783 stamp); brief authority sections byte-identical; attempt 2 accepted result carried forward'
      - task: '002'
        decision: 'accepted TASKS-002 at 7ceb2783fab3cee6455fb414c098f104487e9a8e (branch bouncer/079-001-002; implementer attempts 1-2 + re-baseline 3; reviewers combined+security discovery, delta; F-SEC-001 resolved, F-SEC-002 advisory accepted; verify npm test). changed paths: docs/install.md, .github/workflows/release.yml, scripts/build-release.js, test/build-release.test.js'
      - kind: fanin-verification-failed
        tasks:
          - '001'
          - '002'
        command: npm test
        exitCode: 127
        evidence_id: 32e5138a79ad921307fc012d068f38817f78e3ff6a45785c05285b5267202943
      - kind: fanin-verification-failed
        tasks:
          - '001'
          - '002'
        command: npm test
        exitCode: 127
        evidence_id: f05ed5e367c229683b3962a11ca0e768f968f7e3b5aabcefeac420f858ef8d67
      - kind: fanin-verification-failed
        tasks:
          - '001'
          - '002'
        command: npm test
        exitCode: 2
        evidence_id: 8b0cb9e6deffe766a51300e603e619a4f775f0136baf14bd1423ca1be656b598
      - kind: fanin-verification-failed
        tasks:
          - '001'
          - '002'
        command: npm test
        exitCode: 1
        evidence_id: 9fc2d00a83ef528922c465f3c7b7344730991248a698a7e98a734ca15d28df03
      - kind: fanin
        tasks:
          - '001'
          - '002'
        base_head: 85a4d50082399389ab8cc19b3b34d8127da47596
        candidate_head: 3bfac99546422578fb06d2669647cc1c70c7fb65
        evidence_id: 22e03818431071ca99e117a53f030b6a7f3b114f317ea279f747fcc08fca191b
      - task: '003'
        kind: dispatch
        attempt: 1
        task_brief_hash: bd72cfbf3628470209a418e6bb3a593caf503ff2670576be2566b382af05251d
        base_head: 3bfac99546422578fb06d2669647cc1c70c7fb65
        initial_worktree_state: |
          ?? .bouncer/context/epics/079-roadmap-closeout/
      - task: '003'
        kind: report
        attempt: 1
        task_brief_hash: bd72cfbf3628470209a418e6bb3a593caf503ff2670576be2566b382af05251d
        outcome: accepted
        summary: 'accepted attempt 1: untracked scripts/lib, check-emit inverted, launcher missing-build message, tests and CHANGELOG updated; focused tests 43 pass; scope none'
      - task: '003'
        kind: dispatch
        attempt: 2
        task_brief_hash: 38ff5ca8bc762e07fa7f219737e946be77262a957f7c1e8d6f6110aff80d9237
        base_head: 399e9647a881bf43e1ce4330309783dbd9ebf627
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/079-roadmap-closeout/
      - task: '003'
        kind: report
        attempt: 2
        task_brief_hash: 38ff5ca8bc762e07fa7f219737e946be77262a957f7c1e8d6f6110aff80d9237
        outcome: accepted
        summary: 'coordinator re-baseline, no implementer rerun: record refused stale-worker-report because controller-owned tasks.md frontmatter changed after attempt 1 (status verified, commit_sha 399e9647 stamp); brief authority sections byte-identical; attempt 1 accepted result carried forward'
      - task: '003'
        decision: 'accepted TASKS-003 at 399e9647a881bf43e1ce4330309783dbd9ebf627 (branch bouncer/079-001-003; implementer attempt 1 + re-baseline 2; reviewer combined discovery none; verify npm test). changed paths: .gitignore, CHANGELOG.md, scripts/bouncer, scripts/bouncer-root, scripts/check-emit.js, scripts/lib, test/ci-contract.test.js, test/intent-provenance.test.js, test/plugin-root.test.js'
      - kind: fanin-verification-failed
        tasks:
          - '003'
        command: npm test
        exitCode: 1
        evidence_id: 8fc2325a0c1a8c5f380761ed6ccb22e06e905cd3b7e5602da745b360a79e7467
      - task: '003'
        kind: rerecord
        reason: replace recorded SHA with squashed worker HEAD that includes scripts/lib index removal git commit --only dropped while emit files remained on disk
        previousSha: 399e9647a881bf43e1ce4330309783dbd9ebf627
        nextSha: ebc3089523d7885923dc3cb459884ef8c3004c80
        integrationHead: 3bfac99546422578fb06d2669647cc1c70c7fb65
      - kind: fanin
        tasks:
          - '003'
        base_head: 3bfac99546422578fb06d2669647cc1c70c7fb65
        candidate_head: 09c78b58ed7ca14dcab79add73b3b5c401cf2c1c
        evidence_id: 2bfe8fbc70a25481a9782ac89e538b27b64cbd69ea71bb8c6198379284ec274b
      - task: '004'
        kind: verification-retry
        reason: 'User-authorized recovery: leftover scaffold HTML comments removed from untracked plan docs (lint:context-comments now ok); clear terminalFailure so verifying 004 can re-run integrate without a source repair wave (.bouncer/ paths cannot be repaired).'
        previous:
          task: '004'
          command: npm run ci
          summary: exit code 1
          paths: []
          exitCode: 1
          repairWave: 0
      - task: '004'
        kind: verification-retry
        reason: 'User-authorized recovery: previous npm run ci failed on npm audit ETIMEDOUT to registry.npmjs.org after lint/typecheck passed; audit now reports 0 vulnerabilities. Clear terminalFailure to retry verifying 004.'
---
# Explain

## Background
설치 호스트는 저장소를 clone만 하고 `npm run build`를 돌리지 않는다. 그런데 `develop`은 TypeScript 원본과 생성 CommonJS(`scripts/lib`)를 같이 추적해서 코드 탐색이 중복됐다. 이 드라이브는 빌드 산출물을 `release` 브랜치로 올린 뒤 `develop`에서 emit 추적을 끊는다.

같은 PR에서 `rules/governance.md`도 지운다. 077에서 규범은 이미 다른 규칙 파일로 옮겼고, 남은 건 구현 설명 네 개뿐이었다. 그 문장을 `scripts/src/lib/coordinator.ts`·`scope.ts`·`scaffold.ts` 함수 주석으로 옮기고 파일과 참조를 삭제했다.

계획 DAG는 `001 ∥ 002 → 003 → 004`였고 드라이브가 엣지를 추가·분할하지 않았다. scope revision은 없다. TASKS-001·002는 병렬 worker에서 구현·리뷰·커밋한 뒤 fan-in했고, 003은 `scripts/lib` untrack SHA를 rerecord한 뒤 통합했다. 004 종단 `npm run ci`는 계획 문서 leftover scaffold HTML 주석과 npm audit `ETIMEDOUT`으로 한 번씩 실패했다. `coordinate repair`는 `.bouncer/` 경로를 받지 않아 원장 `terminalFailure`를 지운 뒤 verifying 재실행으로 통과했다.

## Intuition
설치본은 `release` 브랜치의 이미 빌드된 트리를 받고, 개발 브랜치는 TypeScript만 추적한다.

## Code
- TASKS-001 worker `bouncer/079-001-001` `7a246e93` → integration `32fb8e2f`. `rules/governance.md` 삭제. BP4 locator는 `writeVerificationTaskStatus`·`writeRepairDocuments`·`nextRevision`·`scaffoldBlueprint` 주석. actual_paths는 승인 `affected_paths`와 같다. combined 리뷰 F1 nit(advisory) 수용.
- TASKS-002 worker `bouncer/079-001-002` `7ceb2783` → integration `3bfac995`. `scripts/build-release.js`가 `npm pack --dry-run --json` 목록을 `--out`에 복사한다. `.github/workflows/release.yml`은 `bouncer--v*` 태그 또는 `develop` `workflow_dispatch`에서 CI 후 `release`에 비강제 push. security 리뷰 F-SEC-001: `github.ref_name`을 `env REF_NAME`으로 넘김(resolved). F-SEC-002 advisory 수용.
- TASKS-003 worker `bouncer/079-001-003` `ebc30895` → integration `09c78b58`. `.gitignore`에 `scripts/lib/`, `check-emit.js`는 추적 금지를 요구, launcher는 `lib` 부재 시 `npm run build` 안내. rerecord가 `--only`가 빠뜨린 index 제거를 worker HEAD에 실었다.
- TASKS-004는 worker 없이 integration `09c78b58`에서 `npm run ci`. evidence `f82f6b60016de7303f6b3ae946201992d03077b165d86921e7c167d50dfc737d`.
- 통합 브랜치 `feat/079-001-release-artifact-governance-removal`, head `09c78b58ed7ca14dcab79add73b3b5c401cf2c1c`.

## Quiz
1. `rules/governance.md`는 이 드라이브에서 어떻게 처리했는가?
   - A) 파일은 남기고 본문만 비움
   - B) 파일을 삭제하고 남은 구현 설명을 TypeScript 함수 주석으로 옮김
   - C) 파일 전체를 `agents/bouncer-coordinator.md`로 이동

2. 설치 호스트가 빌드 없이 받는 산출물은 어디에 올라가는가?
   - A) npm registry에 publish
   - B) GitHub Release asset만 첨부
   - C) `release` 브랜치에 commit·push

3. `scripts/lib` 추적 해제 뒤 `npm run check:emit`이 요구하는 것은?
   - A) 빌드 성공과 `git ls-files -- scripts/lib` 빈 출력
   - B) emit 파일이 index에 있어야 통과
   - C) emit 검사 자체를 삭제

4. TASKS-004 종단 검증은 무엇을 하는가?
   - A) source를 고친 뒤 `npm test`만 실행
   - B) 통합 checkout에서 `npm run ci`만 실행하고 source는 바꾸지 않음
   - C) repair wave 두 번 뒤 `partial_closed`로 종결

5. `release.yml`에서 `github.ref_name`은 어떻게 쓰이는가?
   - A) `${{ github.ref_name }}`을 run 스크립트에 직접 보간
   - B) `env REF_NAME`으로 넘긴 뒤 셸이 확장
   - C) 별도 repository secret에 저장

## 이해 상태
퀴즈 5문항, 응답 5문항, 정답 4문항 (`4/5`).
1. 정답 B / 응답 B → 맞음 (`rules/governance.md` 삭제 후 TS 주석으로 이전).
2. 정답 C / 응답 C → 맞음 (산출물은 `release` 브랜치).
3. 정답 A / 응답 A → 맞음 (`check:emit`은 빌드 성공과 미추적 `scripts/lib`).
4. 정답 B / 응답 B → 맞음 (004는 통합 checkout의 `npm run ci`).
5. 정답 B / 응답 A → 틀림 (`github.ref_name`은 `env REF_NAME`으로 넘긴 뒤 셸이 확장한다. run 스크립트에 `${{ github.ref_name }}`을 직접 보간하지 않는다).
점수 미달로 마감을 막지 않음.

## Tasks

### EPIC-079/BP-001/TASK-001 · `32fb8e2f`

#### Goal & intent

`rules/governance.md`에 남은 BP4 단위 네 개(`GOV-SIZING-VERIFY-RUN`, `GOV-LIGHT-SCALE-READ-SITES`, `GOV-COORD-LOCK`, `GOV-COORD-REPAIR-WRITE`)를 그 동작을 구현하는 TypeScript 함수 안 주석으로 옮기고, 파일을 삭제한 뒤 모든 참조를 새 소유자로 바꾼다. 완료 조건은 epic Success criteria 7·8이다: 삭제된 파일을 읽거나 요구하는 문장·테스트가 없고, ownership 표의 네 행이 `scripts/src/lib/*.ts`를 current owner로 가리키며 locator 검사가 통과한다.

#### Current behavior

- `rules/governance.md`(61줄)는 네 절 모두 다른 정본을 가리키는 안내 문장과, 코드 구현 설명 네 개(검증 실행 실패 시 integrated 미전이, `scale` read site 네 곳, ledger lock·revision 모델, repair write 단위)만 담는다.
- 참조 위치:
  - `AGENTS.md:25` runtime rule index 행.
  - `rules/planning.md:4-5` 머리말, `:21` 실패 전이 소유, `:108` revision 절차 소유(실제 절차는 `agents/bouncer-coordinator.md`).
  - `rules/commit-scope.md:4`, `:8` coordinator mutation 판정 소유.
  - `rules/plugin-root.md:37` 선적재 금지 예시.
  - `skills/bouncer-init/SKILL.md:53` 설치 제외 목록.
  - `scripts/src/lib/scaffold.ts:381` 주석 `(rules/governance.md)`.
  - `docs/architecture/rule-ownership.md`: `source_path`/`source_sha256` 메타데이터(`:5-6`), BP4 네 행(`:30`, `:47`, `:57`, `:66`), 참조 감사 표(`:97-102`, `:127`), 적재 설명(`:3`, `:20`, `:81`, `:83`, `:137`, `:140`, `:144`).
- 테스트 결합(모두 `node --test <file>`로 재현):
  - `test/rule-ownership.test.js:313` 테스트가 `sourceMetadata()`로 `rules/governance.md` SHA-256을 대조하고, `:516` 테스트가 BP4 행의 current owner를 `rules/governance.md`로 강제한다. `ownerSection()`(`:155`)은 owner 파일에서 heading 문자열 위치부터 다음 `\n## ` 전까지를 잘라 locator를 찾는다.
  - `test/distribution.test.js:74` 패키지 필수 목록.
  - `test/skill-bouncer-surface.test.js:180` product rule 목록.
  - `test/workflow-safety-canon.test.js:175`, `test/master-rules.test.js:730`·`:804`, `test/lightweight-cycle.test.js:42`·`:147`, `test/init.test.js:404`가 파일을 직접 읽는다.

#### Target behavior

- 성공:
  - 파일 `rules/governance.md`가 없다.
  - 네 설명은 아래 Interface의 함수 본문 첫 줄 주석으로 존재한다.
  - 규칙·skill 문서의 소유 안내는 실제 소유자(`agents/bouncer-coordinator.md` 또는 `rules/commit-scope.md`)를 가리킨다.
- 실패 방지: 삭제된 경로를 읽는 테스트가 없어 `npm test`가 `ENOENT`로 깨지지 않는다.
- 보존:
  - `rules/planning.md`, `rules/commit-scope.md`의 규범 문장 의미는 그대로다.
  - 코드 동작과 emit 결과의 실행 경로는 주석 외에 달라지지 않는다.

#### Interface

- 제공 — ownership 표 BP4 행의 새 `source`·`current owner`:

  | id | source | current owner |
  | --- | --- | --- |
  | GOV-SIZING-VERIFY-RUN | `function writeVerificationTaskStatus` / `integrated로 전이하지 않는다` | `scripts/src/lib/coordinator.ts` |
  | GOV-COORD-REPAIR-WRITE | `function writeRepairDocuments` / `한 write 단위` | `scripts/src/lib/coordinator.ts` |
  | GOV-COORD-LOCK | `function nextRevision` / `ledger lock` | `scripts/src/lib/scope.ts` |
  | GOV-LIGHT-SCALE-READ-SITES | `function scaffoldBlueprint` / `scale을 읽는 네 곳` | `scripts/src/lib/scaffold.ts` |

  locator 구절은 각 함수 선언 뒤(함수 본문 안) 주석에 그대로 들어간다. `ownerSection()`은 heading 뒤 `\n## `가 없으면 파일 끝까지 보므로 코드 파일에서도 같은 검사가 동작한다.
- 제공 — ownership 문서는 `source_path`/`source_sha256` 두 줄을 지우고, 원본 파일이 삭제돼 digest 기준선이 없다는 한 문장을 둔다.
- 거부 — `test/rule-ownership.test.js`의 새 검사:
  - `rules/governance.md`가 존재한다.
  - 어느 행이든 current owner가 `rules/governance.md`다.
  - BP4 행 current owner가 `scripts/src/lib/`로 시작하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `rules/governance.md` | 파일 전체 | Delete | BP4 구현 설명 네 개와 안내 문장 | 삭제 | Epic 077 Out of scope로 미뤄 둔 삭제 |
| `AGENTS.md` | `## Runtime rule index` | Modify | governance 색인 행 | 행 삭제 | 삭제된 파일을 색인하지 않게 함 |
| `rules/planning.md` | 머리말, `## Blueprint sizing rule`, `## Task DAG and approved scope` | Modify | governance를 소유자로 가리킴 | 머리말은 coordinator 절차를 `agents/bouncer-coordinator.md`로 가리키고, 검증 실행 실패 전이는 `scripts/src/lib/coordinator.ts`, revision 절차는 `agents/bouncer-coordinator.md`로 가리킴 | 참조 대상 삭제 |
| `rules/commit-scope.md` | 머리말 4·8행 | Modify | coordinator 판정을 governance로 가리킴 | `agents/bouncer-coordinator.md`로 가리킴 | 참조 대상 삭제 |
| `rules/plugin-root.md` | `## Master and product rules` | Modify | 선적재 금지 예시에 governance 포함 | 예시에서 제거 | 존재하지 않는 파일 예시 제거 |
| `skills/bouncer-init/SKILL.md` | 53행 설치 제외 목록 | Modify | governance를 설치 제외 파일로 나열 | 목록에서 제거 | 참조 대상 삭제 |
| `scripts/src/lib/coordinator.ts` | `writeVerificationTaskStatus`, `writeRepairDocuments` | Modify | 검증 lifecycle 기록과 repair 문서 기록 | 함수 본문 첫 줄에 GOV-SIZING-VERIFY-RUN·GOV-COORD-REPAIR-WRITE 설명 주석 추가 | ownership 표 target owner `docs/code`, consumer `scripts/lib/coordinator.js` |
| `scripts/lib/coordinator.js` | 같은 두 함수 | Modify | 위 TS의 emit | `npm run build` 재생성 | 이 task 시점에는 아직 추적 중인 emit |
| `scripts/src/lib/scope.ts` | `nextRevision` | Modify | revision 번호 계산 | lock·revision 모델 설명 주석 추가 | ownership 표 consumer `scripts/lib/scope.js` |
| `scripts/lib/scope.js` | `nextRevision` | Modify | 위 TS의 emit | 재생성 | 추적 중인 emit |
| `scripts/src/lib/scaffold.ts` | `scaffoldBlueprint` | Modify | light 문서 집합 선택, 381행 governance 주석 | read site 설명 주석 추가, 381행 주석에서 governance 경로 삭제 | ownership 표 consumer `scripts/lib/scaffold.js` |
| `scripts/lib/scaffold.js` | `scaffoldBlueprint` | Modify | 위 TS의 emit | 재생성 | 추적 중인 emit |
| `docs/architecture/rule-ownership.md` | 머리말, 메타데이터, BP4 네 행, 참조 감사 표, 적재 설명 | Modify | governance를 source로 기록 | Interface 표대로 BP4 행 갱신, 메타데이터 교체, governance 참조 행·문장 갱신 | 삭제 뒤 표가 실재 owner를 가리키게 함 |
| `test/rule-ownership.test.js` | `sourceMetadata`, 313·356·516행 테스트 | Modify | digest 대조, load graph의 조건부 source 경로 도출, BP4 governance 유지 강제 | `sourceMetadata`와 digest 대조 삭제. 356행 load graph 테스트의 `conditionalSource`는 `sourceMetadata` 대신 상수 `'rules/governance.md'`로 두어 어떤 workflow step도 삭제된 경로를 적재하지 않는다는 검사를 유지. 516행은 Interface 거부 조건 검사로 교체 | 메타데이터 삭제 뒤 세 테스트 모두 `ownership map must declare source_path`로 실패 |
| `test/rule-ownership.test.js` | `current owner preserves sizing, light, DAG, and coordinator contracts` 테스트의 locator leak 검사(:494-512) | Modify | 모든 current owner 파일 사이에서 locator 중복을 거절 | leak 비교 대상(`other`)을 `.md` owner로 한정한다. 코드 owner(`scripts/src/lib/*.ts`)는 자기 행 locator 존재만 확인한다 | `GOV-COORD-PARTIAL-CLOSE` locator `partial_closed`가 `scripts/src/lib/coordinator.ts`에 6회 있어, 코드 파일이 owner 집합에 들어오면 leak 오류로 실패함 |
| `test/distribution.test.js` | `the package contains only…` 필수 목록 | Modify | `rules/governance.md` 필수 | 목록에서 제거하고 부재 assertion 추가 | 배포 목록 변경 |
| `test/skill-bouncer-surface.test.js` | `entry Master rules load only…` | Modify | product rule 목록에 governance | 목록에서 제거 | 존재하지 않는 파일 읽기 방지 |
| `test/workflow-safety-canon.test.js` | row 6 테스트 | Modify | governance에 `named dispatch` 부재 검사 | 해당 assertion 삭제 | 파일 삭제 |
| `test/master-rules.test.js` | 730·804행 테스트 | Modify | governance 본문 부재 검사 | governance 읽기와 관련 assertion 삭제, commit-scope·coordinator 검사는 유지 | 파일 삭제 |
| `test/lightweight-cycle.test.js` | 42·147행 | Modify | governance에 `scaffoldBlueprint` 존재, `execution_mode` 부재 | 42행은 `scripts/src/lib/scaffold.ts`의 `scale을 읽는 네 곳` 검사로, 147행은 run·exec 두 문서만 순회 | 설명이 코드로 이동 |
| `test/init.test.js` | 404행 테스트 | Modify | governance+schema에 Superpowers 문구 부재 | `rules/document-schema.md`만 검사 | 파일 삭제 |

#### Constraints

- 옮기는 주석은 한국어이고, `rules/governance.md`의 해당 문장 의미를 줄이거나 늘리지 않는다. 주석은 함수당 8줄 이하로 둔다.
- TS 변경은 주석뿐이다. emit한 JS의 실행 문장 diff가 없어야 한다.
- 다른 ownership 행의 current owner, target owner, migration BP 값은 바꾸지 않는다.
- 새 gate code, CLI 동작, 문서 schema를 만들지 않는다.

### EPIC-079/BP-001/TASK-002 · `3bfac995`

#### Goal & intent

설치 호스트(Claude Code·Cursor·Codex·Antigravity)는 저장소를 clone만 하고 빌드하지 않는다. `scripts/lib`를 Git에서 빼기 전에 빌드된 플러그인 트리를 `release` 브랜치로 배포하는 경로를 만든다. 완료 조건은 epic Success criteria 2·3·4다:
- `node scripts/build-release.js --out <dir>`가 `npm pack` 목록과 파일 집합이 같은 트리를 만든다.
- 그 트리에서 `BOUNCER_HOME=<dir> node <dir>/scripts/bouncer --help`가 0으로 끝난다.
- `release.yml` 원문이 태그 trigger, 기본 브랜치 전용 `workflow_dispatch`, CI 선행, `release` fetch, 비강제 push를 선언한다. 수동 실행은 병합 직후 버전 bump·태그 없이 첫 `release`를 만드는 경로다.

#### Current behavior

- 배포물은 `develop`/태그 commit 그 자체다. `package.json` `files`(:6-22)가 패키지 표면을 정의하고, `test/distribution.test.js`의 `packageFiles()`(:15)가 `npm pack --dry-run --json`으로 그 목록을 읽어 필수 파일을 검사한다.
- `.github/workflows/test.yml`은 push·PR에서 `npm ci` → `npm run ci`만 실행한다. 릴리스 workflow는 없다.
- 릴리스 절차는 `docs/install.md` `## 1.4.92 릴리스 검증 절차`의 수동 태그 생성·push·smoke다. 설치 안내(`## Claude Code` 등)는 저장소 URL이나 로컬 경로를 그대로 plugin source로 쓴다.
- 확인한 사실: `BOUNCER_HOME=$PWD node scripts/bouncer --help`는 현재 0으로 끝난다. `scripts/bouncer:46` `runLauncher`가 설치 root가 자신이면 `./lib/cli`를 require한다.
- npm 규칙상 루트 `.gitignore`는 `files` 필드를 덮지 않는다. 이 전제는 아직 테스트로 고정돼 있지 않다.

#### Target behavior

- 성공:
  - `build-release.js`는 `npm run build`와 `npm pack --dry-run --json`을 차례로 실행하고, 목록의 각 파일을 같은 상대 경로로 `--out`에 복사한다. stdout에는 JSON `{ "ok": true, "out": "<abs>", "files": <count> }`를 쓴다.
  - workflow는 태그 push와 `develop`에서의 수동 실행 모두 `npm ci` → `npm run ci` → `build-release.js` 순서로 실행한다. 그다음 `origin/release`가 있으면 그 tip을 부모로, 없으면 parent 없는 root commit으로 산출 트리를 commit하고 `release`에 push한다. 트리는 산출물과 정확히 같다(이전 release에만 있던 파일은 사라진다).
- 실패:
  - `--out` 누락, `--out`이 비어 있지 않은 기존 디렉터리, build 실패, pack 실패, 목록 파일 부재 중 하나면 stderr에 이유를 쓰고 1로 끝난다. 이때 `--out`에 파일을 남기지 않는다.
  - workflow에서 `npm run ci`가 실패하면 release commit·push 단계에 도달하지 않는다.
- 문서: `docs/install.md`는 기본 브랜치 URL 원격 marketplace 등록이 병합 뒤 동작하지 않는다고 적고, `git clone -b release <url>` 뒤 로컬 경로 설치와 병합 직후 `gh workflow run release.yml --ref develop` 절차를 안내한다.
- 보존: `test.yml`, `package.json`, 카탈로그 두 개(`.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json`), `scripts/lib` 추적 상태는 이 task에서 바뀌지 않는다.

#### Interface

- 제공:
  - CLI `node scripts/build-release.js --out <dir>`: 종료 코드 0/1, 성공 stdout JSON은 Target behavior 형식.
  - 모듈 export `buildReleaseTree({ root, outDir, deps })` → `{ ok: true, out: string, files: number }`. 실패하면 `Error`를 throw한다.
  - 테스트 seam `deps.run(command: string, args: string[], opts: { cwd: string }) → { status: number | null, stdout: string, stderr: string }`. 기본값은 `spawnSync` argv 호출이다(셸 문자열 금지). Windows에서는 `npm.cmd`를 쓴다(`scripts/check-emit.js:36`과 같은 방식).
  - workflow `.github/workflows/release.yml`:
    - trigger는 `on.push.tags: ['bouncer--v*']`와 입력 없는 `on.workflow_dispatch`이고, `permissions: contents: write`를 둔다.
    - job 조건은 `if: github.event_name == 'push' || github.ref == 'refs/heads/develop'`이다.
    - commit 메시지는 `release: ${{ github.ref_name }} (<short sha>)`다. 태그 실행이면 태그 이름, 수동 실행이면 `develop`이 들어간다.
    - checkout 뒤 `git fetch --no-tags origin release`를 실행한다(원격 branch가 없으면 이 실패만 허용하고 orphan 분기로 간다). fetch 성공 시 `FETCH_HEAD`를 부모로 commit한다.
    - push 명령은 `git push origin HEAD:refs/heads/release`이며 `--force`를 쓰지 않는다.
- 거부 (throw → exit 1):
  - `outDir` 누락, 또는 비어 있지 않은 기존 디렉터리.
  - `deps.run` 결과 `status !== 0`(build·pack).
  - pack JSON 파싱 실패.
  - 목록 경로가 root 밖을 가리킴(`..` 포함).
- 거부 (workflow):
  - 태그가 `bouncer--v*` 형식이 아니면 실행하지 않는다.
  - branch push에서는 실행하지 않는다.
  - `develop`이 아닌 ref에서 수동 실행하면 job 조건으로 건너뛰고 `release`를 바꾸지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/build-release.js` | `buildReleaseTree`, CLI main | Create | 없음 | pack 목록 기반 release 트리 복사 | 설치 산출물의 단일 생성 경로 |
| `test/build-release.test.js` | 신규 테스트 | Create | 없음 | fixture 패키지·실제 저장소 트리·workflow 계약 검사 | Success criteria 2·3·4의 판정 지점 |
| `.github/workflows/release.yml` | `on.push.tags`, `on.workflow_dispatch`, release job | Create | 없음 | 태그 push 또는 `develop` 수동 실행 시 CI → 트리 생성 → `release` commit·push | release 브랜치 배포 경로. 수동 실행은 병합 직후 첫 `release` 생성용 |
| `docs/install.md` | 머리말, `## 1.4.92 릴리스 검증 절차`, 호스트별 설치 절 | Modify | 저장소 자체를 plugin source로 안내 | 설치 source를 `release` 브랜치로 바꾸고(`git clone -b release <url>` 뒤 로컬 경로 설치 포함), 개발 checkout은 `npm run build` 뒤 로컬 설치한다고 명시, 릴리스 절차에 workflow 결과 확인 단계 추가, 병합 직후 `gh workflow run release.yml --ref develop`으로 첫 `release`를 만드는 절차 추가 | 사용자 설치 경로 변경 |

#### Constraints

- `build-release.js`는 `node:` 표준 모듈만 require한다. `test/distribution.test.js`의 bare require 금지 검사를 통과해야 한다.
- 모든 외부 명령은 argv 배열로 `spawnSync`에 넘긴다.
- 파일 목록은 `npm pack --dry-run --json` 결과만 신뢰한다. 별도 allowlist를 만들지 않는다.
- workflow는 기존 태그 이동, 강제 push, 태그 삭제를 하지 않는다. 인증은 `GITHUB_TOKEN`만 쓰고 추가 secret을 만들지 않는다.
- `docs/install.md`는 호스트별 원격 ref 문법을 새로 단정하지 않는다. 검증된 형태인 `git clone -b release` + 로컬 경로 설치를 기본 안내로 둔다.
- 이 task는 원격 push·태그 생성을 실행하지 않는다.

### EPIC-079/BP-001/TASK-003 · `09c78b58`

#### Goal & intent

TASKS-002의 release 산출물 경로가 생긴 뒤 `develop`에서 생성 CommonJS(`scripts/lib/**`) 추적을 끊는다. emit 검사를 "추적 금지" 계약으로 바꾸고, 빌드 전 checkout에서는 두 launcher가 stack trace 대신 `npm run build` 안내를 내도록 한다. 완료 조건은 epic Success criteria 1·5·6이다. 이 blueprint 전체 변경은 `CHANGELOG.md` `## [Unreleased]`에 한 번 기록한다.

#### Current behavior

- `git ls-files scripts/lib`는 65개 파일을 반환하고 `.gitignore`에 `scripts/lib` 항목이 없다.
- `scripts/check-emit.js`의 동작:
  - `npm run build`(:36-43) 뒤 `git diff --exit-code -- scripts/lib`(:48)로 unstaged emit을 거절한다.
  - `git ls-files --others --exclude-standard -- scripts/lib`(:58-73)로 untracked emit을 거절한다.
  - 즉 "emit이 추적되고 최신이어야 한다"가 현재 계약이다.
- `test/intent-provenance.test.js:593`은 `scripts/lib/intent-provenance.js`가 index에 있어야 한다고 검사한다.
- `test/ci-contract.test.js:106-170`의 fixture(`makeEmitRepo`, :36)는 `scripts/lib/app.js`를 commit하고 clean·untracked·unstaged·staged 네 경우를 검사한다.
- `scripts/bouncer:53`은 `require('./lib/cli')`, `scripts/bouncer-root:3`은 `require('./lib/bouncer-root')`를 존재 확인 없이 호출한다. `scripts/lib`가 없으면 Node `MODULE_NOT_FOUND` stack trace로 끝난다.
- `.githooks/pre-commit`은 `npm run check:emit`을 호출하고, `test/githooks.test.js:15`·`:18`이 그 호출과 `git ls-files` 직접 사용 부재를 고정한다.

#### Target behavior

- 성공:
  - `scripts/lib/**`가 Git index에서 빠진다. 작업 트리 파일은 남고 `.gitignore`가 `scripts/lib/`를 제외한다.
  - `check:emit`은 build 성공, `git ls-files -- scripts/lib` 빈 출력, `git ls-files --others --exclude-standard -- scripts/lib` 빈 출력(ignore됨)이면 0이다.
  - 빌드 전 checkout에서 `node scripts/bouncer-root --auto`와 `node scripts/bouncer <args>`가 아래 한 줄을 stderr에 쓰고 1로 끝난다.
    ```text
    bouncer: scripts/lib is missing; run `npm run build` in <root>
    ```
- 실패:
  - build 실패 → build 종료 코드.
  - 추적된 `scripts/lib` 파일 존재 → stderr `check-emit: scripts/lib must not be tracked` 뒤 목록, exit 1.
  - ignore되지 않은 emit → stderr `check-emit: scripts/lib is not ignored` 뒤 목록, exit 1.
- 보존:
  - `check:emit`은 `npm run ci`의 첫 단계이고 coverage보다 먼저 실행된다(`test/ci-contract.test.js:72-78`).
  - pre-commit은 `npm run check:emit`을 계속 호출한다.
  - lib가 있으면 두 launcher 동작은 바뀌지 않는다.

#### Interface

- 제공:
  - `check:emit` 종료 계약은 Target behavior와 같다.
  - launcher 부재 안내 문자열은 위 코드블록 한 줄이다. `<root>`는 해당 launcher 파일의 상위 디렉터리 절대 경로다.
- 거부 (`check:emit` exit 1):
  - index에 `scripts/lib/` 아래 경로가 하나라도 있음.
  - build 뒤 ignore되지 않은 `scripts/lib` 파일이 있음.
- 거부 (launcher exit 1):
  - `scripts/bouncer`는 자기 자신을 실행하는 분기에서 `lib/cli.js`가 없을 때.
  - `scripts/bouncer-root`는 `lib/bouncer-root.js`가 없을 때.
- 다른 설치본으로 위임하는 `scripts/bouncer` 분기는 자기 lib 부재를 검사하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/lib` | 추적 중인 emit 65개 전부 | Delete | TS emit을 Git에 보관 | `git rm -r --cached scripts/lib`로 index에서만 제거 | Success criterion 1. 파일별 행 대신 디렉터리 하나로 쓰는 이유는 전부 같은 사유의 index 삭제이기 때문이다 |
| `.gitignore` | 파일 끝 | Modify | node_modules 등 제외 | `scripts/lib/` 추가 | 생성물 재추적 방지 |
| `scripts/check-emit.js` | diff·untracked 검사 블록 | Modify | 추적된 emit 최신성 검사 | Interface의 추적 금지·ignore 검사로 교체 | emit 계약 반전 |
| `test/ci-contract.test.js` | `makeEmitRepo`, 95행 원문 형태 테스트, check-emit 동작 테스트 5개 | Modify | 추적 emit fixture와 네 경우 검사, 원문에 `diff`·`--exit-code` 요구 | fixture는 `.gitignore`에 `scripts/lib/`를 두고 lib를 commit하지 않음. clean 0, 강제 추적(`git add -f`) 1, ignore 누락 1, build 실패 전파를 검사. 95행은 `diff`·`--exit-code` 요구를 지우고 `ls-files`·`--others`·`--exclude-standard` 요구와 porcelain·`shell: true` 부재 검사를 유지 | 계약 변경의 blast radius. `git diff --exit-code` 호출이 사라진다 |
| `test/intent-provenance.test.js` | `intent-provenance emit is indexed…` 테스트(:593) | Modify | TS source가 있으면 emit이 index에 있어야 함을 검사 | emit이 index에 없음(`git ls-files` 빈 출력)을 검사하도록 반전하고 주석을 새 계약으로 고침 | 추적 해제 뒤 `npm test`가 이 assertion에서 실패함 |
| `scripts/bouncer` | `runLauncher` 자기 실행 분기 | Modify | `./lib/cli` 무조건 require | `lib/cli.js` 존재 확인 후 부재 안내 | Success criterion 5 |
| `scripts/bouncer-root` | 파일 최상단 require | Modify | `./lib/bouncer-root` 무조건 require | 존재 확인 후 부재 안내 | launcher가 먼저 호출하는 경로라 여기서 막아야 안내가 보인다 |
| `test/plugin-root.test.js` | 신규 테스트 2개 | Modify | launcher·root 해석 검사 | 두 fixture로 각 launcher의 부재 안내와 exit 1을 따로 검사(Checklist) | Success criterion 5 판정 |
| `CHANGELOG.md` | `## [Unreleased]` | Modify | 빈 Unreleased | Changed: release 브랜치 배포·`scripts/lib` 미추적·개발 checkout 빌드 선행. Removed: `rules/governance.md` | blueprint 변경 기록 한 곳 |

#### Constraints

- `scripts/lib` 작업 트리 파일을 삭제하지 않는다. index에서만 뺀다(`--cached`).
- `check-emit.js`는 계속 argv 배열 `spawnSync`만 쓰고 porcelain status를 쓰지 않는다(`test/ci-contract.test.js:95` 계약).
- launcher 부재 검사는 `node:fs` 존재 확인만 한다. 자동 빌드나 npm 호출을 하지 않는다.
- CHANGELOG 문장은 기존 한국어 형식을 따른다.

### EPIC-079/BP-001/TASK-004

#### Goal & intent

TASKS-001·002·003이 모두 통합된 checkout에서 전체 CI를 한 번 실행한다. `scripts/lib`가 추적되지 않는 상태에서도 build → 테스트·coverage → lint → typecheck → audit이 통과함을 증명한다(epic Success criterion 9). 실패하면 이 task는 integrated로 올라가지 않는다.

#### Interface

- 제공: 선행 task가 모두 통합된 상태에서 verify 명령이 남기는 종단 검증 증적.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.