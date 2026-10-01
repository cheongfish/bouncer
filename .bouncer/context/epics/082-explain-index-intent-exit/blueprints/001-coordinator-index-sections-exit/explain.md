---
type: bouncer.explain
title: explain coordinator 인덱스 축소와 intent sections 거부 정합
description: 닫힌 explain의 coordinator를 task 인덱스로 줄이고, intent sections의 비정규 --task를 exit 1 intent-task-invalid로 거절한다
resource: .bouncer/context/epics/082-explain-index-intent-exit/blueprints/001-coordinator-index-sections-exit/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-01T16:00:00.000+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '082'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: 63fade808a31823c6f2102a244ca0fb8d4cca994
      range_to: 10634c6216681a6208802d48d6e06dc6c9865ee2
      diff_sha: 1589f79cac3e91d37745ad7be88ca8931ffe866230223ae37497ad3dfc828922
      quiz_score: 3/4
      disposition: Q4는 repair 004 경로가 cli-intent-command.ts뿐인데 finalize.ts와 rules/cli.md를 골랐음.
      recorded_at: '2026-10-01T16:00:00.000+09:00'
  task_commits:
    - task: EPIC-082/BP-001/TASK-001
      sha: f8b7ad58
      intent_anchor: task-001
    - task: EPIC-082/BP-001/TASK-002
      sha: 91e73ee1
      intent_anchor: task-002
    - task: EPIC-082/BP-001/TASK-004
      sha: 10634c62
      intent_anchor: task-004
  coordinator:
    base: 63fade808a31823c6f2102a244ca0fb8d4cca994
    integration_head: 10634c6216681a6208802d48d6e06dc6c9865ee2
    integration_branch: fix/082-001-coordinator-index-sections-exit
    revision: r1
    worktrees:
      - /home/cheongwoon/workspace/Chunjae/bouncer/.worktrees/082/001/integration
      - /home/cheongwoon/workspace/Chunjae/bouncer/.worktrees/082/001/workers/001
      - /home/cheongwoon/workspace/Chunjae/bouncer/.worktrees/082/001/workers/002
      - /home/cheongwoon/workspace/Chunjae/bouncer/.worktrees/082/001/workers/004
    tasks:
      - id: '001'
        status: integrated
        sha: ed567bc8553c6bf006dbaa19770b312d603c65bf
        branch: bouncer/082-001-001
        scope_revision: null
        paths: []
        actual_paths:
          - CHANGELOG.md
          - rules/document-schema.md
          - scripts/src/lib/finalize.ts
          - test/finalize.test.js
      - id: '002'
        status: integrated
        sha: f4b6e5d7ebba5f959f5d1e123d6d098b0ffa33eb
        branch: bouncer/082-001-002
        scope_revision: null
        paths: []
        actual_paths:
          - CHANGELOG.md
          - rules/cli.md
          - scripts/src/lib/cli-intent-command.ts
          - test/cli-project-commands.test.js
      - id: '003'
        status: integrated
        sha: null
        branch: null
        scope_revision: null
        paths: []
        actual_paths: []
      - id: '004'
        status: integrated
        sha: ffe5709b94133b77a6e7734ec62e7229bc2af4e7
        branch: bouncer/082-001-004
        scope_revision: r1
        paths:
          - scripts/src/lib/cli-intent-command.ts
        actual_paths:
          - scripts/src/lib/cli-intent-command.ts
    decisions:
      - task: '001'
        kind: dispatch
        attempt: 1
        task_brief_hash: 4e91bbbc5de4d0053e6de7dcab3a1f27f95b8e44367e1a9c3a61ab6ec4b150f8
        base_head: 63fade808a31823c6f2102a244ca0fb8d4cca994
        initial_worktree_state: |
          ?? .bouncer/context/epics/082-explain-index-intent-exit/
      - task: '001'
        kind: report
        attempt: 1
        task_brief_hash: 4e91bbbc5de4d0053e6de7dcab3a1f27f95b8e44367e1a9c3a61ab6ec4b150f8
        outcome: accepted
        summary: TASKS-001 implementer mapped writeExplainCoordinator to index keys, updated finalize tests, document-schema, CHANGELOG; focused tests 52 pass; scope none
      - task: '001'
        kind: dispatch
        attempt: 2
        task_brief_hash: 82a9699fff984d511e395a2ed9df200fb1c2719ebb63f7f1d86eac5e3213ad0f
        base_head: ed567bc8553c6bf006dbaa19770b312d603c65bf
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/082-explain-index-intent-exit/
      - task: '001'
        kind: report
        attempt: 2
        task_brief_hash: 82a9699fff984d511e395a2ed9df200fb1c2719ebb63f7f1d86eac5e3213ad0f
        outcome: accepted
        summary: 'TASKS-001 attempt 2 re-ack: source already at ed567bc8; no further source edits; focused tests 52 pass; scope none'
      - task: '001'
        decision: 'accepted TASKS-001 r2: CHANGELOG.md, rules/document-schema.md, scripts/src/lib/finalize.ts, test/finalize.test.js; worker bouncer/082-001-001 SHA ed567bc8553c6bf006dbaa19770b312d603c65bf'
      - kind: fanin
        tasks:
          - '001'
        base_head: 63fade808a31823c6f2102a244ca0fb8d4cca994
        candidate_head: f8b7ad58010e7a777569cee6459b9fa64856ace0
        evidence_id: 84e40ca1732dcccbc16589a9381f264204d31c316e73a13713beeef968cea383
      - task: '002'
        kind: dispatch
        attempt: 1
        task_brief_hash: fe547b56715d4ac112c02291af4c70f35744c93860d5834aa7baec2b30230453
        base_head: f8b7ad58010e7a777569cee6459b9fa64856ace0
        initial_worktree_state: |
          ?? .bouncer/context/epics/082-explain-index-intent-exit/
      - task: '002'
        kind: report
        attempt: 1
        task_brief_hash: fe547b56715d4ac112c02291af4c70f35744c93860d5834aa7baec2b30230453
        outcome: accepted
        summary: 'TASKS-002 implementer: parseSectionsArgs defers canonical check; intent-task-invalid next rewritten; tests/docs/CHANGELOG; 38 pass; scope none'
      - task: '002'
        kind: dispatch
        attempt: 2
        task_brief_hash: 6554052233ec6e8b7af639ff9a2ed66a2e465e4f317d4dc249ec1029abfdb8c8
        base_head: f4b6e5d7ebba5f959f5d1e123d6d098b0ffa33eb
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/082-explain-index-intent-exit/
      - task: '002'
        kind: report
        attempt: 2
        task_brief_hash: 6554052233ec6e8b7af639ff9a2ed66a2e465e4f317d4dc249ec1029abfdb8c8
        outcome: accepted
        summary: 'TASKS-002 attempt 2 re-ack: source already at f4b6e5d7; no further source edits; 38 pass; scope none'
      - task: '002'
        decision: 'accepted TASKS-002 r2: CHANGELOG.md, rules/cli.md, scripts/src/lib/cli-intent-command.ts, test/cli-project-commands.test.js; worker bouncer/082-001-002 SHA f4b6e5d7ebba5f959f5d1e123d6d098b0ffa33eb'
      - kind: fanin
        tasks:
          - '002'
        base_head: f8b7ad58010e7a777569cee6459b9fa64856ace0
        candidate_head: 91e73ee1fdd67c97bb2bd507481512ffd034c6e5
        evidence_id: a13ef42c2d1c4e88c596807ceff5df410b7b248671f1ae33a00012e2aee04f78
      - task: '004'
        kind: repair
        wave: 1
        reason: Wrap cmdIntentSections intent-task-invalid next assignment so eslint max-len 120 passes. Necessary for Blueprint success criterion 7 (npm run ci) without changing the sections exit-1 contract.
        failure:
          task: '003'
          command: npm run ci
          summary: eslint max-len 145 on cli-intent-command.ts:481 (intent-task-invalid next rewrite); tests 1766 pass then lint fails
          paths:
            - scripts/src/lib/cli-intent-command.ts
          exitCode: 1
          repairWave: 0
        previousDag:
          - id: '001'
            depends_on: []
          - id: '002'
            depends_on:
              - '001'
          - id: '003'
            depends_on:
              - '001'
              - '002'
        nextDag:
          - id: '001'
            depends_on: []
          - id: '002'
            depends_on:
              - '001'
          - id: '003'
            depends_on:
              - '004'
          - id: '004'
            depends_on:
              - '002'
        previousScope: []
        nextScope:
          - scripts/src/lib/cli-intent-command.ts
        necessity: terminal CI failure requires a Blueprint-scoped source repair
        revision: r1
      - task: '004'
        kind: dispatch
        attempt: 1
        task_brief_hash: 8caf77ef0b976c49006a18b7c631b7126420246819c8662af558fc41a043981c
        base_head: 91e73ee1fdd67c97bb2bd507481512ffd034c6e5
        initial_worktree_state: |
          ?? .bouncer/context/epics/082-explain-index-intent-exit/
      - task: '004'
        kind: report
        attempt: 1
        task_brief_hash: 8caf77ef0b976c49006a18b7c631b7126420246819c8662af558fc41a043981c
        outcome: accepted
        summary: TASKS-004 wrap cmdIntentSections nextHint under max-len 120; eslint on file pass; existing sections next test pass; scope none
      - task: '004'
        kind: dispatch
        attempt: 2
        task_brief_hash: fbca728c3f0b56943d2612b3324008a5643b58959e1fc57a1d2167f67d0e62ec
        base_head: ffe5709b94133b77a6e7734ec62e7229bc2af4e7
        initial_worktree_state: |2
           M .bouncer/context/index.md
          ?? .bouncer/context/epics/082-explain-index-intent-exit/
      - task: '004'
        kind: report
        attempt: 2
        task_brief_hash: fbca728c3f0b56943d2612b3324008a5643b58959e1fc57a1d2167f67d0e62ec
        outcome: accepted
        summary: 'TASKS-004 attempt 2 re-ack: wrap already at ffe5709b; no further source edits; npm run lint pass; scope none'
      - task: '004'
        decision: 'accepted TASKS-004 r2: scripts/src/lib/cli-intent-command.ts; worker bouncer/082-001-004 SHA ffe5709b94133b77a6e7734ec62e7229bc2af4e7'
      - kind: fanin
        tasks:
          - '004'
        base_head: 91e73ee1fdd67c97bb2bd507481512ffd034c6e5
        candidate_head: 10634c6216681a6208802d48d6e06dc6c9865ee2
        evidence_id: 75e3648c7ae46ab934f16866a11b08209431466e3af494644d63d578836e0a04
---
# Explain

## Background

닫힌 `explain.md`의 `bouncer.coordinator`가 worktree 절대경로와 결정 로그까지 실어 검색을 방해했다. `writeExplainCoordinator`는 `integration_branch`와 task별 `id`·`branch`·`scope_revision`·`actual_paths`만 남긴다.

`bouncer intent sections`는 비정규 `--task`를 usage exit 2로 먼저 막아, `intent-task-invalid` exit 1 계약과 어긋났다. `parseSectionsArgs`는 비어 있지 않은 `--task`를 받고 canonical 판정은 `loadExecutionTask`에 맡긴다.

통합 HEAD는 `10634c6216681a6208802d48d6e06dc6c9865ee2`, 브랜치는 `fix/082-001-coordinator-index-sections-exit`, revision은 `r1`이다.

## Intuition

explain 앞머리에는 task→브랜치·실제 경로 색인만 두고, sections의 잘못된 `--task`는 사용법 오류가 아니라 JSON 거절로 떨어진다.

## Code

- `scripts/src/lib/finalize.ts` — `writeExplainCoordinator`. worker `bouncer/082-001-001` SHA `ed567bc8553c6bf006dbaa19770b312d603c65bf`. 실제 경로: `scripts/src/lib/finalize.ts`, `test/finalize.test.js`, `rules/document-schema.md`, `CHANGELOG.md`. 초기 `paths`는 비어 있었고 `scopeRevision`은 없다.
- `scripts/src/lib/cli-intent-command.ts` — `parseSectionsArgs`, `cmdIntentSections`. worker `bouncer/082-001-002` SHA `f4b6e5d7ebba5f959f5d1e123d6d098b0ffa33eb`. 실제 경로: `scripts/src/lib/cli-intent-command.ts`, `test/cli-project-commands.test.js`, `rules/cli.md`, `CHANGELOG.md`.
- repair `004` wave 1: 같은 `cli-intent-command.ts`에서 `intent-task-invalid` `next` 대입을 max-len 120 이하로 나눔. worker `bouncer/082-001-004` SHA `ffe5709b94133b77a6e7734ec62e7229bc2af4e7`. `scopeRevision` `r1`. 이전 DAG는 `003 → 001,002`. 다음 DAG는 `004 → 002`, `003 → 004`.
- 검증 `003`은 `npm run ci`. 통과 증적 id `f955b4a2b9c219066fe0d214317970e33e78c5e6898c703527532c73f790934f`.

## Quiz

1. `finalize --yes`가 explain에 쓰는 `bouncer.coordinator`에 남는 것은?
   - A) `base`, `integration_head`, `worktrees`, `decisions`
   - B) `integration_branch`와 `tasks[]`의 `id`, `branch`, `scope_revision`, `actual_paths`
   - C) `task_commits` SHA 목록만

2. 비정규 `--task`를 받은 `bouncer intent sections`의 거절은?
   - A) stderr usage, exit 2
   - B) `intent bundle`을 다시 만들라는 `next`, exit 2
   - C) stdout `reason: "intent-task-invalid"`, exit 1, `next`는 canonical `intent sections` 경로

3. repair wave 1 이후 종단 검증 `003`의 의존은?
   - A) `004`
   - B) `001`과 `002`만
   - C) 의존 없음

4. `004`가 고친 소스 경로는?
   - A) `scripts/src/lib/finalize.ts`와 `rules/cli.md`
   - B) `scripts/src/lib/cli-intent-command.ts`만
   - C) `.bouncer/runtime/coordinator.json`

## 이해 상태

퀴즈 4문항, 응답 B/C/A/A, 정답 B/C/A/B. 1·2·3 맞음, 4 틀림. `quiz_score` `3/4`. Q4는 repair 004 경로가 `scripts/src/lib/cli-intent-command.ts`뿐인데 `finalize.ts`와 `rules/cli.md`를 골랐음.

## Tasks

### EPIC-082/BP-001/TASK-001 · `f8b7ad58`

#### Goal & intent

`finalize --yes`가 explain.md에 쓰는 `bouncer.coordinator`를 `integration_branch`와 `tasks[]`(`id`, `branch`, `scope_revision`, `actual_paths`)로 줄인다. 원장이 사라진 뒤에도 task→브랜치·실제 변경 파일 엣지는 남기고, 머신 경로·예상 scope·결정 로그·`task_commits`와 겹치는 SHA는 남기지 않는다. 수용 기준은 epic Success criteria 1·2·5(document-schema 부분)·6(이 task 항목)이다.

#### Current behavior

- `scripts/src/lib/finalize.ts:939` `writeExplainCoordinator`가 `bouncer.coordinator`에 `base`, `integration_head`, `integration_branch`, `revision`, `worktrees`, `tasks[]`(`id`, `status`, `sha`, `branch`, `scope_revision`, `paths`, `actual_paths`), `decisions`를 쓴다(`finalize.ts:950`–`966`). `fs.writeFileSync`(`finalize.ts:967`)가 유일한 file I/O다.
- 호출은 `finalize.ts:1247` 한 곳이고, `buildCoordinatorProvenance`(`finalize.ts:705`) 결과를 그대로 넘긴다. provenance가 `null`이거나 explain.md가 없으면 `false`를 돌려주고 쓰지 않는다.
- `buildCoordinatorProvenance`의 `worktrees` 주석(`finalize.ts:742`–`745`)은 "여기 중첩된 값은 explain frontmatter에 남는 기록"이라고 적는다.
- 재현: `test/finalize.test.js:1599` `finalize --yes copies coordinator provenance into explain frontmatter`가 `recorded.integration_head`와 `recorded.worktrees`를 단언한다. `npm run build && node --test test/finalize.test.js`로 실행한다.
- 실측: 081 explain.md는 820줄 중 494줄, 080은 1256줄 중 736줄이 frontmatter다.

#### Target behavior

- 성공: provenance가 있고 explain.md가 있으면 frontmatter가 아래와 같다. 다른 `bouncer.*` 키(`task_commits`, `comprehension` 등)는 바뀌지 않는다.
  ```yaml
  coordinator:
    integration_branch: <provenance.integrationBranch>
    tasks:
      - id: <task.id>
        branch: <task.branch>
        scope_revision: <task.scopeRevision>
        actual_paths: <task.actualPaths>
  ```
- 보존: provenance `null`·explain.md 부재는 `false`이고 파일을 쓰지 않는다. finalize 반환값의 `coordinator`·`worktrees`, finalize digest의 `coordinator`, `buildCoordinatorProvenance` 반환 shape는 바뀌지 않는다.
- 보존: 이미 닫힌 explain.md는 다시 쓰지 않는다.

#### Interface

- 제공: explain.md `bouncer.coordinator` = `{ integration_branch, tasks: [{ id, branch, scope_revision, actual_paths }] }`. 키 순서는 위와 같다.
- 거부(쓰지 않는 키): `base`, `integration_head`, `revision`, `worktrees`, `decisions`, `tasks[].status`, `tasks[].sha`, `tasks[].paths`.
- 함수 시그니처 `writeExplainCoordinator({ repoRoot, blueprintDir, provenance }) → boolean`은 그대로다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/finalize.ts` | `writeExplainCoordinator`, `buildCoordinatorProvenance` 주석 | Modify | provenance 전체를 explain frontmatter로 복사 | 인덱스 필드만 매핑하고, `worktrees` 주석에서 explain 기록 문구를 고친다 | explain frontmatter의 유일한 writer다 |
| `test/finalize.test.js` | `finalize --yes copies coordinator provenance into explain frontmatter` | Modify | `integration_head`·`worktrees` 기록을 단언 | 정확한 키 집합과 빠진 키를 단언 | 바뀐 shape를 단언하는 유일한 테스트다 |
| `rules/document-schema.md` | `## Task bundle and commit records` | Modify | explain `task_commits`만 서술 | explain `bouncer.coordinator` 형태 한 문단 추가 | explain frontmatter 스키마의 정본 문서다 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 비어 있음 | `### Changed` 항목 하나 | 프로젝트 changelog 규칙 |

#### Constraints

- frontmatter 키는 snake_case를 유지한다.
- `buildCoordinatorProvenance`의 반환 shape와 finalize 반환값 `worktrees` 정리 계약을 바꾸지 않는다.
- 닫힌 explain.md를 고치는 코드·스크립트를 더하지 않는다.
- 코드 주석은 한국어로 쓴다.

### EPIC-082/BP-001/TASK-002 · `91e73ee1`

#### Goal & intent

`bouncer intent sections`가 절대경로·`..` 포함·비정규 layout인 `--task`를 exit 1 stdout `{ ok: false, reason: "intent-task-invalid", cause, next }`로 거절하게 한다. `--task`·`--role`의 누락·중복·빈 값과 허용 밖 role은 exit 2로 남고, `intent bundle`의 exit 2 경계는 바꾸지 않는다. 수용 기준은 epic Success criteria 3·4·5(cli 부분)·6(이 task 항목)이다.

#### Current behavior

- `scripts/src/lib/cli-intent-command.ts` `parseSectionsArgs`가 `--task` 값이 `/`로 시작하거나 `..`를 포함하거나 `CANONICAL_TASK_RE`에 맞지 않으면 `fail('--task must be a repo-relative canonical tasks.md path')`를 돌려준다(`cli-intent-command.ts:291`–`297`). `cmdIntent`가 이를 stderr `intent: …`와 exit 2로 낸다(`cli-intent-command.ts:355`–`356`).
- `cmdIntentSections`(`cli-intent-command.ts:463`)는 `projectRoleIntentSections`가 던진 Error의 `reason`이 `SECTIONS_FAIL_REASONS`(이미 `intent-task-invalid` 포함, `cli-intent-command.ts:41`–`46`)에 있으면 stdout JSON과 exit 1을 낸다.
- `projectRoleIntentSections`는 `loadExecutionTask`(`scripts/src/lib/intent-bundle.ts:336`)가 던지면 `failIntentSections('intent-task-invalid', message, next)`로 바꾼다(`intent-bundle.ts:1001`–`1011`). `loadExecutionTask`는 fs 접근 전에 절대경로·`..`(`intent-bundle.ts:351`)와 비정규 layout(`intent-bundle.ts:354`)을 거절한다.
- 재현: `node scripts/bouncer intent sections --task /tmp/x/tasks.md --role implementer; echo $?` → stderr `intent: --task must be a repo-relative canonical tasks.md path`, exit 2.
- 비정규 `--task` 경로를 단언하는 테스트는 sections·bundle 모두 없다(`rg -n "repo-relative canonical" test`가 빈 결과).

#### Target behavior

- 성공(거부 경로): `--task`가 비어 있지 않은 문자열이면 파서는 받는다. 비정규 값은 `cmdIntentSections`에서 exit 1, stdout `{ ok: false, reason: "intent-task-invalid", cause: <loadExecutionTask 메시지>, next }`, stderr 빈 문자열이다. 이 reason의 `next`는 `cmdIntentSections`가 `bouncer intent sections --task .bouncer/context/epics/<ddd>-<slug>/blueprints/<ddd>-<slug>/tasks/<ddd>/tasks.md --role <요청한 role>`로 바꿔 낸다. 지금 `projectRoleIntentSections`가 주는 `next`(`intentBundleNext`, `intent-bundle.ts:964`)는 같은 비정규 경로로 bundle을 다시 만들라고 해서, 따르면 exit 2로 끝난다.
- 보존: `--task` 누락·값 없음·`--`로 시작하는 값·공백뿐인 값·중복, `--role` 누락·중복·허용 밖 값, 다른 형식 옵션, 남는 positional은 exit 2다.
- 보존: `intent bundle`의 `parseBundleArgs`는 비정규 `--task`를 계속 exit 2로 거절한다. 그 정규식 `CANONICAL_TASK_RE`는 bundle이 계속 쓴다.
- 보존: 정상 sections 출력(exit 0)과 `intent-bundle-missing`·`intent-bundle-stale`·`intent-sections-drift` 경로.

#### Interface

- 제공: `bouncer intent sections --task <path> --role <implementer|reviewer|debugger> [--repo <dir>]`의 비정규 task 거부 = exit 1 JSON `reason: "intent-task-invalid"`.
- 제공: `intent-task-invalid`의 `next` = `bouncer intent sections --task .bouncer/context/epics/<ddd>-<slug>/blueprints/<ddd>-<slug>/tasks/<ddd>/tasks.md --role <요청한 role>`. `<요청한 role>`은 파싱된 `--role` 값이다. 다른 세 reason의 `next`는 그대로다.
- 거부(exit 2, stderr usage): 위 보존 목록의 argv 형식 오류.
- 거부(exit 1, stdout JSON): 비정규 task 경로. 비정규 task 경로란 repo 상대 `.bouncer/context/epics/<ddd>-<slug>/blueprints/<ddd>-<slug>/tasks/<ddd>/tasks.md` 형태가 아닌 값이다. 예: `/abs/tasks.md`, `.bouncer/context/epics/073-epic/../x/tasks.md`, `tasks.md`.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/cli-intent-command.ts` | `parseSectionsArgs`, `cmdIntentSections` | Modify | 비정규 `--task`를 usage로 거절, 실패 JSON의 `next` 전달 | 파서는 비어 있지 않은 값만 확인하고 canonical 판정을 넘긴다. `cmdIntentSections`는 `intent-task-invalid`일 때 `next`를 canonical 경로 형식 명령으로 바꾼다 | 081 계약과 어긋난 지점이고, `intent-bundle.ts`를 건드리지 않고 `next`를 고칠 수 있는 자리다 |
| `test/cli-project-commands.test.js` | `intent sections …` 테스트들 | Modify | sections argv exit 2와 정상 출력만 단언 | sections 비정규 task exit 1 테스트와 bundle 비정규 task exit 2 테스트를 더한다 | CLI exit 경계를 단언하는 파일이다 |
| `rules/cli.md` | `intent sections` 문단 | Modify | 실패 reason 셋만 나열 | `intent-task-invalid`를 더하고, 이 reason은 bundle 재생성이 아니라 `--task` 경로 수정이 복구임을 적는다 | CLI 결과 처리 정본 문서다 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | TASKS-001 항목 | `### Fixed` 항목 하나 | 프로젝트 changelog 규칙 |

#### Constraints

- `parseBundleArgs`와 `intent --symbol` query 파서의 동작을 바꾸지 않는다.
- `SECTIONS_FAIL_REASONS` 집합을 바꾸지 않는다.
- 유효 argv 전에는 `intent-bundle`을 require하지 않는다는 기존 경계를 유지한다.
- 코드 주석은 한국어로 쓴다.

### EPIC-082/BP-001/TASK-003

#### Goal & intent

TASKS-001과 TASKS-002가 integration에 모두 들어간 상태에서 저장소 CI 전체(emit 검사, coverage 테스트, lint, docs·context 주석 lint, typecheck, audit)가 통과함을 증명한다. epic Success criteria 7의 판정 근거다.

#### Interface

- 제공: 선행 task가 모두 통합된 상태에서 verify 명령이 남기는 종단 검증 증적.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.

### EPIC-082/BP-001/TASK-004 · `10634c62`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `scripts/src/lib/cli-intent-command.ts` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.