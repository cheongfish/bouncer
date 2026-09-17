---
type: bouncer.explain
title: 003 explain
description: Explain for 003
resource: .bouncer/context/epics/072-search-payload-context-retention/blueprints/003-retention-audit-migration/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-17T15:11:34.586+09:00'
bouncer:
  id: EXPLAIN-003
  epic_id: '072'
  blueprint_id: '003'
  status: published
  comprehension:
    - range_from: develop
      range_to: 35d32ec00b7a739ea39fa675c0706dba263975d7
      diff_sha: 01b4b71134c61cf3e9cf6683f1d61c6a890cdaba876640d2585999e0d777eb64
      quiz_score: 3/4
      disposition: Q3만 오답(realpath 봉쇄). 장기 절 allowlist·--apply 경계·CI scaffold 주석은 맞음.
      recorded_at: '2026-09-17T15:23:01+09:00'
  task_commits:
    - task: EPIC-072/BP-003/TASK-001
      sha: 6d142217
      intent_anchor: task-001
    - task: EPIC-072/BP-003/TASK-002
      sha: c7474a38
      intent_anchor: task-002
  coordinator:
    base: 40a6ff8a7b55c611f6b8e490c1cd31dfbe821120
    integration_head: 35d32ec00b7a739ea39fa675c0706dba263975d7
    integration_branch: feat/072-003-retention-audit-migration
    revision: null
    worktrees:
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/072/003/integration
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/072/003/workers/001
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/072/003/workers/002
    tasks:
      - id: '001'
        status: integrated
        sha: 6d142217df5c96befb43b7a66f9c2d5bbfeabd6a
        branch: bouncer/072-003-001
        scope_revision: null
        paths: []
        actual_paths:
          - docs/context-retention-and-epic-lifecycle.md
          - scripts/lib/finalize.js
          - scripts/lib/intent-provenance.js
          - scripts/src/lib/finalize.ts
          - scripts/src/lib/intent-provenance.ts
          - test/finalize-pure.test.js
          - test/finalize.test.js
          - test/intent-provenance.test.js
      - id: '002'
        status: integrated
        sha: c7474a388de44893b758da62f6c281209eeeb044
        branch: bouncer/072-003-002
        scope_revision: null
        paths: []
        actual_paths:
          - docs/cli.md
          - docs/context-retention-and-epic-lifecycle.md
          - scripts/lib/cli-project-commands.js
          - scripts/lib/retention-migration.js
          - scripts/src/lib/cli-project-commands.ts
          - test/cli-help.test.js
          - test/cli-project-commands.test.js
          - scripts/src/lib/retention-migration.ts
          - test/retention-migration.test.js
      - id: '003'
        status: integrated
        sha: null
        branch: null
        scope_revision: null
        paths: []
        actual_paths: []
    decisions:
      - task: '001'
        decision: 'Accepted TASKS-001 after implementer+verify+review/fix/delta. Changed paths: docs/context-retention-and-epic-lifecycle.md, scripts/lib/finalize.js, scripts/lib/intent-provenance.js, scripts/src/lib/finalize.ts, scripts/src/lib/intent-provenance.ts, test/finalize-pure.test.js, test/finalize.test.js, test/intent-provenance.test.js. Env remediation: symlinked node_modules into worker/integration for npm test. Review advisories CT-002 and F-mm-002 accepted with notes.'
      - task: '002'
        decision: 'Accepted TASKS-002 after implementer+verify+review(incl security)/fix/delta. Paths: docs/cli.md, docs/context-retention-and-epic-lifecycle.md, scripts/lib/cli-project-commands.js, scripts/lib/retention-migration.js, scripts/src/lib/cli-project-commands.ts, scripts/src/lib/retention-migration.ts, test/cli-help.test.js, test/cli-project-commands.test.js, test/retention-migration.test.js. Fixed F-SEC-001 realpath; F4 restore guard; F1-F3/MM-004 tests/clarity. Advisories F5,MM-001..003,005,006 accepted with notes.'
      - task: '003'
        decision: 'Retry verification after in-blueprint plan hygiene: removed leftover scaffold HTML comment from blueprint index.md (lint:context-comments). coordinate repair cannot name .bouncer/ paths; reset verifying→ready to retry coordinate integrate without a source repair wave.'
---
# Explain

## Background

신규 finalize는 task를 지우기 전에 `Goal & intent`와 `Interface`, `Do not touch`만 Explain에 남겼다. 후속 변경에 필요한 `Current behavior`, `Target behavior`, `Touch`, `Constraints`는 버리고, 실행 시점에만 유효한 `Do not touch`를 장기 의도처럼 남겼다. 이미 `closed`인 Blueprint는 `bouncer migrate`가 `task-layout`만 받아 소급 정리 경로가 없었다.

이 드라이브는 두 commit으로 나뉜다. 첫 commit은 finalize와 intent resolver의 장기 절 allowlist를 맞춘다. 둘째 commit은 `bouncer migrate retention`으로 closed Blueprint를 경로순 감사하고, 명시한 적격 경로만 Explain 승격 후 transient를 원자 삭제한다. 실제 legacy corpus 일괄 적용은 BP-004로 남긴다.

승인 DAG는 `001 → 002 → 003`이었고 드라이브 중 task·edge를 추가하거나 재배열하지 않았다. TASKS-001·002의 `actual_paths`는 각 brief `affected_paths`와 같다(scope revision 없음). Worker `bouncer/072-003-001` SHA `6d142217df5c96befb43b7a66f9c2d5bbfeabd6a`, `bouncer/072-003-002` SHA `c7474a388de44893b758da62f6c281209eeeb044`를 integration head `35d32ec00b7a739ea39fa675c0706dba263975d7`에 fan-in했다. TASKS-003 `npm run ci`는 첫 실행에서 blueprint `index.md` scaffold 주석으로 실패했고, `.bouncer/`는 repair 범위 밖이라 plan hygiene 후 verifying→ready 재시도로 exit 0을 남겼다.

## Intuition

닫을 때는 설계 절만 Explain에 남기고, 이미 닫힌 것은 감사한 뒤 적격 한 경로만 같은 규칙으로 치운다.

## Code

- `scripts/src/lib/finalize.ts` — `buildTaskContext` 장기 절 allowlist, `collectTransientRels` export
- `scripts/src/lib/intent-provenance.ts` — `parseTaskDesign` / `splitSubheadings`가 같은 여섯 절을 고르고 `Do not touch`·Checklist를 건너뜀
- `scripts/src/lib/retention-migration.ts` — `auditRetention` / `migrateRetention`, realpath 봉쇄, 실패 시 snapshot 복구
- `scripts/src/lib/cli-project-commands.ts` — `migrate retention` / `--apply --blueprint`
- 회귀: `test/finalize-pure.test.js`, `test/finalize.test.js`, `test/intent-provenance.test.js`, `test/retention-migration.test.js`, `test/cli-project-commands.test.js`
- 문서: `docs/context-retention-and-epic-lifecycle.md`, `docs/cli.md`

## Quiz

1. 신규 finalize가 Explain `## Tasks`에 승격하는 절 조합으로 맞는 것은?
   - A) Goal & intent, Interface, Do not touch
   - B) Goal & intent, 값이 있는 Current/Target behavior, Interface, Touch, Constraints
   - C) Goal & intent, Checklist, verification 원문

2. `bouncer migrate retention`에 `--apply`만 주고 `--blueprint`를 생략하면?
   - A) 모든 closed Blueprint에 즉시 적용한다
   - B) dry-run JSON만 출력하고 끝난다
   - C) 쓰기 전에 거절하고 사용법/비정상 종료로 끝난다

3. symlink로 repo 밖을 가리키는 Blueprint 경로에 `--apply`하면?
   - A) realpath 봉쇄로 `INVALID_PATH` 등으로 거절한다
   - B) 논리 경로만 검사하므로 밖 파일을 지울 수 있다
   - C) `already-compacted`로 성공 처리한다

4. TASKS-003 첫 `npm run ci` 실패의 직접 원인은?
   - A) retention-migration 단위 테스트 실패
   - B) blueprint `index.md`에 남은 scaffold HTML 주석(`lint:context-comments`)
   - C) integration worktree에 `node_modules`가 없음

## 이해 상태

- 정답: 1-B, 2-C, 3-A, 4-B
- 응답: 1-B, 2-C, 3-C, 4-B
- 채점: 1✓ 2✓ 3✗ 4✓ → `3/4`
- disposition: Q3만 오답(realpath 봉쇄). 장기 절 allowlist·`--apply` 경계·CI scaffold 주석은 맞음.

## Tasks

### Task 001

#### Goal & intent

신규 finalize가 task 문서를 삭제하기 전에 후속 변경에 필요한 설계 절을 Explain `## Tasks`로 옮기고, 실행 당시의 범위 통제와 절차 증적은 Git history에만 남긴다. `buildTaskContext`의 출력과 finalize 적용·복구 회귀가 이 계약을 직접 증명해야 한다.

#### Interface

- 제공: `collectTransientRels`는 실제 존재하는 일회성 문서 경로를 반환한다. `buildTaskContext(taskUnits)`는 장기 보존 절만 가진 결정적 Markdown을 반환하고 `writeExplainTaskContext`가 기존 `## Tasks`를 교체하거나 없으면 추가한다. `parseTaskDesign`은 연결된 task의 같은 allowlist를 intent 후보의 `sections`와 `body`로 반환한다.
- 거부: 빈 task body, 파싱되지 않는 절과 실행용 `Do not touch`·`Checklist`를 출력에 넣지 않는다. 장기 절이 하나도 없으면 새 `## Tasks`를 만들지 않는다.

#### Do not touch

- `.bouncer/context/epics/001-*`부터 `.bouncer/context/epics/071-*`까지의 legacy Blueprint 본문 — 실제 일괄 정리는 BP-004의 사용자 승인 범위다.
- `scripts/src/lib/graph-search.ts` — Graphify ranking과 payload 상한은 닫힌 BP-001의 범위다.

### Task 002

#### Goal & intent

closed Blueprint의 transient 문서를 읽어 장기 intent 승격 가능성을 결정적으로 분류하는 migration 경계를 만든다. 기본 호출은 어떤 파일도 쓰지 않고, 적용 호출은 감사에서 적격인 정확한 단일 Blueprint만 TASKS-001의 승격 계약으로 처리해야 한다.

#### Interface

- 제공: `auditRetention({ repoRoot, blueprintDir? })`은 쓰기 없는 분류 결과를, `migrateRetention({ repoRoot, blueprintDir })`은 단일 대상 적용 결과를 반환한다. CLI는 `bouncer migrate retention`과 `bouncer migrate retention --apply --blueprint <dir>`만 공개한다.
- 거부: `--apply` 없는 `--blueprint`, `--apply`만 있는 호출, 반복·알 수 없는 option, 절대 경로·`..` 탈출·Blueprint가 아닌 경로, `closed`가 아닌 대상, `eligible`이 아닌 대상에는 쓰지 않는다.

#### Do not touch

- `.bouncer/context/epics/001-*`부터 `.bouncer/context/epics/071-*`까지의 legacy Blueprint 본문 — 이 task는 fixture에서 기능을 검증하며 실제 corpus 적용은 BP-004로 넘긴다.
- `scripts/src/lib/intent-provenance.ts` — migration은 provenance를 만들거나 resolver 읽기 계약을 바꾸지 않는다.
- `scripts/src/lib/migrate-task-layout.ts` — 기존 migration의 입력·출력과 적용 동작을 보존한다.
- `scripts/src/lib/finalize.ts` — TASKS-001이 확정한 승격 helper를 소비하되 이 task에서 다시 변경하지 않는다.

### Task 003

#### Goal & intent

TASKS-001과 TASKS-002가 integration checkout에 합류한 뒤 저장소 전체 CI를 한 번 실행한다. 이 node는 source를 수정하거나 commit을 만들지 않고 결과를 `verification.md`에만 기록한다.

#### Interface

- 제공: integration checkout 저장소 루트에서 실행한 `npm run ci`의 exit code와 출력 요약을 verification evidence로 남긴다.
- 거부: worker checkout, TASKS-002가 integrated되기 전 상태, 일부 하위 명령만 골라 실행한 결과를 terminal 성공으로 인정하지 않는다.

#### Do not touch

- `scripts/`, `test/`, `docs/`, `.bouncer/context/` — verification node는 실패를 발견해도 어떤 파일도 수정하지 않는다.