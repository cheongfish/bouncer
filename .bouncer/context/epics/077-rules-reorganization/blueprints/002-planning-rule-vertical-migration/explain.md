---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/077-rules-reorganization/blueprints/002-planning-rule-vertical-migration/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-22T15:29:31.068+09:00'
bouncer:
  id: EXPLAIN-002
  epic_id: '077'
  blueprint_id: '002'
  status: published
  comprehension:
    - range_from: develop
      range_to: 1891971a48daa989b8a5f26c8dfe1299394183d3
      diff_sha: 8f9cddfd18f6aaccd1be4c02a6593e6b5622be327600816430a7da8560762828
      quiz_score: 3/3
      disposition: 세 문항 모두 정답. 계획 정본·schema 경로·scope r2 이유를 구분함.
      recorded_at: '2026-09-22T16:24:06+09:00'
  task_commits:
    - task: EPIC-077/BP-002/TASK-001
      sha: 1d6e71e7
      intent_anchor: task-001
    - task: EPIC-077/BP-002/TASK-002
      sha: de32a7bb
      intent_anchor: task-002
  coordinator:
    base: 768bb9b4abea576671cd5e1c5dd433695a987cba
    integration_head: 4cccfef083cd322852cbf7f77e342edb5f5c9d32
    integration_branch: refactor/077-002-planning-rule-vertical-migration
    revision: r2
    worktrees:
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/077/002/integration
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/077/002/workers/001
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/077/002/workers/002
    tasks:
      - id: '001'
        status: integrated
        sha: 1d6e71e700b8f157c9c92dad22a00d70ca03c1a4
        branch: bouncer/077-002-001
        scope_revision: null
        paths: []
        actual_paths:
          - AGENTS.md
          - docs/architecture/rule-ownership.md
          - docs/workflow.md
          - references/spec-authoring/index.md
          - rules/governance.md
          - scripts/lib/templates.js
          - scripts/src/lib/templates.ts
          - skills/bouncer-plan/SKILL.md
          - test/lightweight-cycle.test.js
          - test/master-rules.test.js
          - test/rule-ownership.test.js
          - test/skill-bouncer-plan.test.js
          - test/skill-bouncer-surface.test.js
          - test/skill-spec-authoring.test.js
          - rules/planning.md
      - id: '002'
        status: integrated
        sha: de32a7bb5346aa14bd65bfdb7c6067cabb1b409a
        branch: bouncer/077-002-002
        scope_revision: r2
        paths:
          - rules/okf.md
          - rules/document-schema.md
          - AGENTS.md
          - rules/plugin-root.md
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-init/SKILL.md
          - references/spec-authoring/index.md
          - docs/architecture/rule-ownership.md
          - test/master-rules.test.js
          - test/skill-spec-authoring.test.js
          - test/skill-bouncer-init.test.js
          - test/init.test.js
          - test/distill-decommission-audit.test.js
          - test/skill-bouncer-surface.test.js
          - test/skill-bouncer-plan.test.js
        actual_paths:
          - rules/okf.md
    decisions:
      - task: '001'
        kind: dispatch
        attempt: 1
        task_brief_hash: 4ca48e540360aca44dd328f3ab65f07011cdaea69657eaab5aef7a4dc7025340
        base_head: 768bb9b4abea576671cd5e1c5dd433695a987cba
        initial_worktree_state: |
          ?? .bouncer/context/epics/077-rules-reorganization/blueprints/002-planning-rule-vertical-migration/
      - task: '001'
        kind: report
        attempt: 1
        task_brief_hash: 4ca48e540360aca44dd328f3ab65f07011cdaea69657eaab5aef7a4dc7025340
        outcome: rework
        summary: 'discovery combined: must_fix F-001 planning.md intro lists init/scaffold as readers but load graph and init skill do not open planning.md; fix intro audience to match BP2 consumers that actually load the canon (plan/spec-authoring/template). advisory F-002/F-003 noted.'
      - task: '001'
        kind: dispatch
        attempt: 2
        task_brief_hash: b75e49268292a29d06a5b80fcab34b9b56806e48a492eb4bf354a21a9316a30d
        base_head: 768bb9b4abea576671cd5e1c5dd433695a987cba
        initial_worktree_state: |2
           M AGENTS.md
           M docs/architecture/rule-ownership.md
           M docs/workflow.md
           M references/spec-authoring/index.md
           M rules/governance.md
          M  scripts/lib/templates.js
          M  scripts/src/lib/templates.ts
           M skills/bouncer-plan/SKILL.md
           M test/lightweight-cycle.test.js
           M test/master-rules.test.js
           M test/rule-ownership.test.js
           M test/skill-bouncer-plan.test.js
           M test/skill-bouncer-surface.test.js
           M test/skill-spec-authoring.test.js
          ?? .bouncer/context/epics/077-rules-reorganization/blueprints/002-planning-rule-vertical-migration/
          ?? rules/planning.md
      - task: '001'
        kind: report
        attempt: 2
        task_brief_hash: b75e49268292a29d06a5b80fcab34b9b56806e48a492eb4bf354a21a9316a30d
        outcome: accepted
        summary: 'F-001 intro audience fixed; discovery advisories F-002/F-003 accepted; delta clean; execute gate passed. Paths: AGENTS.md, rules/planning.md, rules/governance.md, skills/bouncer-plan/SKILL.md, references/spec-authoring/index.md, scripts/src/lib/templates.ts, scripts/lib/templates.js, docs/workflow.md, docs/architecture/rule-ownership.md, test/lightweight-cycle.test.js, test/master-rules.test.js, test/rule-ownership.test.js, test/skill-bouncer-plan.test.js, test/skill-spec-authoring.test.js, test/skill-bouncer-surface.test.js.'
      - task: '001'
        kind: dispatch
        attempt: 3
        task_brief_hash: 3a5c994dd111cd612f22faac177b5fe30ba8d3268fb9ebea14eb71c78b9d9d0e
        base_head: 1d6e71e700b8f157c9c92dad22a00d70ca03c1a4
        initial_worktree_state: |
          ?? .bouncer/context/epics/077-rules-reorganization/blueprints/002-planning-rule-vertical-migration/
      - task: '001'
        kind: report
        attempt: 3
        task_brief_hash: 3a5c994dd111cd612f22faac177b5fe30ba8d3268fb9ebea14eb71c78b9d9d0e
        outcome: accepted
        summary: 'Post-stamp revalidation: HEAD 1d6e71e7 already contains full TASKS-001 affected_paths set; no further edits. Ready to record.'
      - task: '001'
        decision: TASKS-001 recorded at 1d6e71e7; paths AGENTS.md rules/planning.md rules/governance.md skills/bouncer-plan/SKILL.md references/spec-authoring/index.md scripts/src/lib/templates.ts scripts/lib/templates.js docs/workflow.md docs/architecture/rule-ownership.md test/lightweight-cycle.test.js test/master-rules.test.js test/rule-ownership.test.js test/skill-bouncer-plan.test.js test/skill-spec-authoring.test.js test/skill-bouncer-surface.test.js
      - task: '002'
        kind: dispatch
        attempt: 1
        task_brief_hash: 3017c1a6c17ea7e63af3b6d00afa9c156d149426e61ecfdf7f7c0b0c6eec2500
        base_head: e356b032e41011359936f8edad6237bddbad2d38
        initial_worktree_state: |
          ?? .bouncer/context/epics/077-rules-reorganization/blueprints/002-planning-rule-vertical-migration/
      - task: '002'
        kind: report
        attempt: 1
        task_brief_hash: 3017c1a6c17ea7e63af3b6d00afa9c156d149426e61ecfdf7f7c0b0c6eec2500
        outcome: scope_revision
        summary: 'Implementer Scope impact: test/skill-bouncer-plan.test.js asserts Author loads rules/okf.md; retargeting skills/bouncer-plan/SKILL.md requires revising that test into affected_paths. init.test.js already in scope for historical path string. workflow-safety-canon optional — not revising unless CI requires.'
      - task: '002'
        kind: scope
        reason: Author-step positive assertion still locks rules/okf.md; must retarget with skills/bouncer-plan/SKILL.md in the same commit or CI fails.
        previous:
          - rules/okf.md
          - rules/document-schema.md
          - AGENTS.md
          - rules/plugin-root.md
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-init/SKILL.md
          - references/spec-authoring/index.md
          - docs/architecture/rule-ownership.md
          - test/master-rules.test.js
          - test/skill-spec-authoring.test.js
          - test/skill-bouncer-init.test.js
          - test/init.test.js
          - test/distill-decommission-audit.test.js
          - test/skill-bouncer-surface.test.js
        next:
          - test/skill-bouncer-plan.test.js
        revision: r1
      - task: '002'
        kind: dispatch
        attempt: 2
        task_brief_hash: c51a1e0fc5915a3f4cbc48f673a1ceae9d900edd186fc825f06737adcf53b31c
        base_head: e356b032e41011359936f8edad6237bddbad2d38
        initial_worktree_state: |
          ?? .bouncer/context/epics/077-rules-reorganization/blueprints/002-planning-rule-vertical-migration/
      - task: '002'
        kind: report
        attempt: 2
        task_brief_hash: c51a1e0fc5915a3f4cbc48f673a1ceae9d900edd186fc825f06737adcf53b31c
        outcome: scope_revision
        summary: r1 revise replaced affected_paths instead of union; need full original set plus test/skill-bouncer-plan.test.js before implementation.
      - task: '002'
        kind: scope
        reason: Restore full TASKS-002 scope after r1 replacement; keep skill-bouncer-plan.test.js unioned with original affected_paths.
        previous:
          - test/skill-bouncer-plan.test.js
        next:
          - rules/okf.md
          - rules/document-schema.md
          - AGENTS.md
          - rules/plugin-root.md
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-init/SKILL.md
          - references/spec-authoring/index.md
          - docs/architecture/rule-ownership.md
          - test/master-rules.test.js
          - test/skill-spec-authoring.test.js
          - test/skill-bouncer-init.test.js
          - test/init.test.js
          - test/distill-decommission-audit.test.js
          - test/skill-bouncer-surface.test.js
          - test/skill-bouncer-plan.test.js
        revision: r2
      - task: '002'
        kind: dispatch
        attempt: 3
        task_brief_hash: 84037f95786def37bbc7ea444b43e116909853ea3760d19f28910505b29b3280
        base_head: e356b032e41011359936f8edad6237bddbad2d38
        initial_worktree_state: |
          ?? .bouncer/context/epics/077-rules-reorganization/blueprints/002-planning-rule-vertical-migration/
      - task: '002'
        kind: report
        attempt: 3
        task_brief_hash: 84037f95786def37bbc7ea444b43e116909853ea3760d19f28910505b29b3280
        outcome: accepted
        summary: Schema path rename okf→document-schema complete; consumers/tests retargeted including skill-bouncer-plan.test.js; discovery review no findings; execute gate passed. Scope revised r1/r2 for plan test path.
      - task: '002'
        kind: dispatch
        attempt: 4
        task_brief_hash: 2ce0f02ae72f638a67904c0b1c510c43d95019fdd2e27cea4bfc87740b948b72
        base_head: de32a7bb5346aa14bd65bfdb7c6067cabb1b409a
        initial_worktree_state: |
          ?? .bouncer/context/epics/077-rules-reorganization/blueprints/002-planning-rule-vertical-migration/
      - task: '002'
        kind: report
        attempt: 4
        task_brief_hash: 2ce0f02ae72f638a67904c0b1c510c43d95019fdd2e27cea4bfc87740b948b72
        outcome: accepted
        summary: 'Post-stamp revalidation: tip de32a7bb completes okf deletion after 836f8ac retargets; full schema rename landed. Ready to record.'
      - task: '002'
        decision: TASKS-002 recorded at de32a7bb (pair 836f8ac+de32a7bb); paths rules/document-schema.md rules/okf.md AGENTS.md rules/plugin-root.md skills/bouncer-plan/SKILL.md skills/bouncer-init/SKILL.md references/spec-authoring/index.md docs/architecture/rule-ownership.md and listed tests including skill-bouncer-plan.test.js; scope r2.
---
# Explain

## Background

계획 정책과 문서 schema가 `rules/governance.md`·`rules/okf.md`에 섞여 있어 plan·init·spec-authoring가 실행 계약까지 한꺼번에 읽어야 했다. 이 blueprint는 계획 규범을 `rules/planning.md`로, schema 정본을 `rules/document-schema.md`로 옮기고 활성 소비자와 characterization만 새 경로를 보게 한다. scaffold 산출물, gate code, OKF 필드 의미는 그대로 둔다.

## Intuition

혼합 정본을 소비자 경계에 맞춰 둘로 자른다. 계획 판단은 planning을 읽고, 문서 모양은 document-schema를 읽으며, 실행·coordinator는 governance에 남는다.

## Code

먼저 읽을 경로:

- `rules/planning.md` — Blueprint 크기, light/full, 계획 시점 DAG·범용 epic 명명
- `rules/governance.md` — BP3·BP4 실행·coordinator 잔여
- `rules/document-schema.md` — 이전 `rules/okf.md` schema 본문(제목·경로만 변경)
- `AGENTS.md`, `skills/bouncer-plan/SKILL.md`, `skills/bouncer-init/SKILL.md`, `references/spec-authoring/index.md`
- `docs/architecture/rule-ownership.md` — BP2 이동 후 digest·locator·load graph
- characterization: `test/rule-ownership.test.js`, `test/lightweight-cycle.test.js`, `test/master-rules.test.js`, schema·skill surface 테스트들

드라이브 실제 결과(원장 기준):

- DAG: TASKS-001 → TASKS-002 (순서 유지). TASKS-002 `affected_paths`에 `test/skill-bouncer-plan.test.js`를 r2로 합류
- TASKS-001 worker `bouncer/077-002-001` @ `1d6e71e7` → integration
- TASKS-002 worker `bouncer/077-002-002` @ `de32a7bb` (부모 `836f8ac` 포함) → tip cherry-pick 후 부모 커밋을 integration에 보완 반영
- integration HEAD: `1891971` (verify: `npm run ci`)

## Quiz

1. BP2 계획 규범의 새 정본 경로는?
   - A) `rules/governance.md`
   - B) `rules/planning.md`
   - C) `rules/okf.md`

2. 문서 schema 정본을 옮긴 뒤 활성 경로로 남는 것은?
   - A) `rules/okf.md` alias 유지
   - B) `rules/document-schema.md`만
   - C) 두 파일에 본문 복제

3. TASKS-002 범위 개정(r2)이 `affected_paths`에 더한 이유는?
   - A) Author 단계 테스트가 옛 `okf.md` 경로를 고정해서
   - B) `scaffold.ts`를 함께 고치려고
   - C) CHANGELOG 역사 문자열을 지우려고

## 이해 상태

정답: 1-B, 2-B, 3-A. 응답: 1-B, 2-B, 3-A. 결과: 3/3 전부 정답. disposition: 세 문항 모두 정답. 계획 정본·schema 경로·scope r2 이유를 구분함.

## Tasks

### Task 001

#### Goal & intent

`rules/governance.md`의 BP2 소유 규범을 `rules/planning.md`로 옮기고 plan·spec-authoring·template과 characterization 검사가 새 정본을 읽게 한다. scaffold 결과와 plan gate 의미가 이전과 같고 BP3·BP4 소유 문장이 `rules/governance.md`에 남으면 완료다.

#### Current behavior

- `rules/governance.md:3-131`은 one-commit 크기, verification node, light/full, DAG와 승인 scope를 실행·coordinator 규칙과 같은 파일에 둔다.
- `skills/bouncer-plan/SKILL.md:144`와 `references/spec-authoring/index.md:26,174`가 저술 단계에서 `rules/governance.md` 전체를 읽도록 요구한다.
- `scripts/src/lib/templates.ts`와 생성물 `scripts/lib/templates.js`의 안내 주석, `docs/workflow.md`, `test/lightweight-cycle.test.js`, `test/master-rules.test.js`가 현재 파일명을 계약 위치로 사용한다.
- `docs/architecture/rule-ownership.md`와 `test/rule-ownership.test.js`가 BP2 이동 전 source digest와 locator를 고정한다. 현재 기준선은 `npm run ci`로 재현한다.

#### Target behavior

- 성공: BP2 소유 규범과 범용 epic 명명 규칙이 `rules/planning.md`에 있고 직접 소비자와 검사가 해당 위치를 읽는다.
- 실패: BP2 ownership 행의 규범이 두 정본에 남거나 BP3/BP4 행의 source locator가 사라지면 characterization이 실패한다.
- 보존: `bouncer scaffold` 산출물, light/full 판정, DAG readiness, G10/G18/G19와 20-path warning의 동작 및 exit code는 바뀌지 않는다.

#### Interface

- 제공: `rules/planning.md`는 Blueprint 크기, verification node 형태, light 선언과 문서 집합, 계획 시점 DAG·scope, 범용 epic 명명을 묶은 계획 정본이다.
- 거부: planning 소비자가 `rules/governance.md`를 계획 정본으로 다시 인용하거나 ownership 표에서 BP2 규범의 현재 소유자가 둘이면 테스트가 실패해야 한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `AGENTS.md` | `Runtime rule index` | Modify | governance를 계획·실행 혼합 정본으로 안내 | planning과 잔여 governance 책임을 분리해 안내 | 모든 workflow의 rule index |
| `rules/planning.md` | `신규 추출 지점: planning policy` | Create | 계획 전용 정본 없음 | BP2 규범과 범용 epic 명명 계약 소유 | 새 소비자 경계의 정본 |
| `rules/governance.md` | `Blueprint sizing rule`, `Lightweight cycle`, `Task DAG and approved scope` | Modify | 계획·실행 규범 혼합 소유 | BP2 규범 제거, BP3·BP4 규범 보존 | 중복 정본 방지 |
| `skills/bouncer-plan/SKILL.md` | `2. Scaffold`, `3. Author` | Modify | governance 전체 적재 | planning 정본을 판단 직전에 적재 | plan 직접 소비자 |
| `references/spec-authoring/index.md` | `Steps`, `tasks on a light blueprint` | Modify | governance의 계획 절 참조 | planning 정본 참조 | 저술 소비자 |
| `scripts/src/lib/templates.ts` | `TEMPLATES` planning comments | Modify | governance 경로를 안내 | planning 경로로 안내 | template 원본 소비자 |
| `scripts/lib/templates.js` | `TEMPLATES` planning comments | Modify | 생성 JavaScript가 옛 경로 안내 | TypeScript와 같은 새 경로 반영 | 배포 실행물 동기화 |
| `docs/workflow.md` | `Lightweight cycle` reference | Modify | 사용자 설명이 governance 절 연결 | planning 정본 연결 | 활성 문서 링크 보존 |
| `docs/architecture/rule-ownership.md` | `소유권`, `workflow별 load graph`, `source digest` | Modify | BP2 이전 기준선 | 이동 후 소유자·locator·적재 단계 기록 | BP01 마이그레이션 안전망 |
| `test/lightweight-cycle.test.js` | light planning contract tests | Modify | governance 파일명 고정 | planning 정본의 동일 계약 검증 | light 회귀 방지 |
| `test/master-rules.test.js` | approved DAG contract | Modify | governance에서 DAG 확인 | planning 정본과 schema의 DAG 일치 확인 | G19 계약 보존 |
| `test/rule-ownership.test.js` | ownership parser and characterization | Modify | 이동 전 digest·locator 검증 | BP2 이후 단일 소유권과 BP3 잔여 검증 | 정본 중복·누락 검출 |
| `test/skill-bouncer-plan.test.js` | plan rule-loading assertions | Modify | 새 planning 적재를 검사하지 않음 | 단계별 planning 참조를 고정 | workflow load graph 회귀 방지 |
| `test/skill-spec-authoring.test.js` | authoring planning reference assertions | Modify | governance 경로를 전제 | planning 정본 참조를 고정 | authoring 적재 회귀 방지 |
| `test/skill-bouncer-surface.test.js` | allowed rule surface | Modify | planning 정본이 공개 rule 목록에 없음 | 새 planning 경로를 허용 목록에 반영 | 배포 표면 검사 |

#### Constraints

- BP01 ownership 행 중 `migration BP`가 `BP2`인 규범만 옮기며 BP3·BP4 행의 문장은 보존한다.
- TypeScript와 생성 JavaScript의 template 문자열은 같은 commit에서 일치시킨다.
- 공개 명령, scaffold 출력, gate code와 상태 전이를 변경하지 않는다.

### Task 002

#### Goal & intent

`rules/okf.md`를 책임이 드러나는 `rules/document-schema.md`로 이전하고 master index, plan·init·spec-authoring과 schema 검사가 새 경로만 사용하게 한다. field 의미와 scaffold 산출물이 바뀌지 않고 활성 `rules/okf.md` 참조가 사라지면 완료다.

#### Current behavior

- `rules/okf.md`가 frontmatter authorship, plan fields, DAG, review risk와 task bundle lifecycle을 소유하지만 경로 이름은 Bouncer document schema 책임을 드러내지 않는다.
- `AGENTS.md`, `rules/plugin-root.md`, plan·init·spec-authoring과 여러 테스트가 `rules/okf.md`를 활성 경로로 직접 연다.
- `scripts/src/lib/scaffold.ts:145-379`의 `scaffoldEpic`, `scaffoldTask`, `scaffoldBlueprint`와 `scripts/src/lib/templates.ts:320-322`의 `templateBody`는 schema에 맞는 문서를 만들며 공개 shape를 변경할 이유가 없다.
- 활성 참조 목록과 현재 검사는 `rg -n 'rules/okf\\.md|okf\\.md'` 및 `npm run ci`로 재현한다.

#### Target behavior

- 성공: schema 정본과 runtime rule index가 `rules/document-schema.md`를 가리키고 계획·초기화·저술 소비자와 관련 검사가 같은 경로를 사용한다.
- 실패: 활성 workflow나 테스트가 `rules/okf.md`를 열거나 두 파일에 schema 본문이 중복되면 source-ownership 검사가 실패한다.
- 보존: OKF 0.1, `bouncer_schema: "0.1"`, frontmatter 필드 의미, task bundle 이름과 scaffold bytes는 그대로다.

#### Interface

- 제공: `rules/document-schema.md`가 OKF 호환성과 Bouncer planning document schema의 유일한 제품 정본이다.
- 거부: `rules/okf.md` 호환 alias나 복제본을 남기지 않으며 기존 field enum·gate 의미를 경로 이전의 명분으로 변경하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `rules/okf.md` | `OKF` | Delete | 문서 schema 정본 | 새 경로로 이전 후 제거 | 중복 정본 방지 |
| `rules/document-schema.md` | `Document schema` | Create | 해당 경로 없음 | 기존 schema 의미를 이름이 맞는 정본으로 소유 | 제안된 목표 소유자 |
| `AGENTS.md` | `Runtime rule index` | Modify | `okf.md`를 schema 정본으로 안내 | 새 정본 경로 안내 | 모든 workflow의 rule index |
| `rules/plugin-root.md` | `Master and product rules` | Modify | 조건부 rule 예시에 옛 경로 사용 | 새 schema 경로 사용 | rule-loading 계약 |
| `skills/bouncer-plan/SKILL.md` | `3. Author` | Modify | `okf.md` 직접 적재 | `document-schema.md` 적재 | plan authoring 소비자 |
| `skills/bouncer-init/SKILL.md` | `Result` source list | Modify | 설치하지 않는 plugin source에 옛 경로 열거 | 새 schema 경로 열거 | init 경계 설명 |
| `references/spec-authoring/index.md` | `Steps`, `review_risk` | Modify | schema 규칙을 옛 경로로 참조 | 새 정본 참조 | 저술 소비자 |
| `docs/architecture/rule-ownership.md` | `workflow별 load graph`, `current owner` | Modify | plan load graph와 소비자에 옛 경로 기록 | 새 schema 정본과 소비자 기록 | BP01 기준선 완결 |
| `test/master-rules.test.js` | runtime index and DAG assertions | Modify | 옛 schema 파일을 읽음 | 새 정본을 읽고 필드 의미 검증 | master/schema 계약 보존 |
| `test/skill-spec-authoring.test.js` | schema authoring assertions | Modify | 옛 경로에 tags·review_risk 검사 | 새 정본의 동일 계약 검사 | authoring 회귀 방지 |
| `test/skill-bouncer-init.test.js` | init master-rule boundary | Modify | `okf.md` 문자열만 금지 | 새 schema 경로도 startup 비적재로 확인 | init load graph 보존 |
| `test/init.test.js` | schema source assertions | Modify | `rules/okf.md`를 plugin source로 검사 | 새 정본을 검사 | init 산출물 불변 확인 |
| `test/distill-decommission-audit.test.js` | canonical rule paths | Modify | 제거된 정본 경로 fixture | 새 정본 경로 fixture | 감사 경로 유효성 |
| `test/skill-bouncer-surface.test.js` | allowed rule surface | Modify | 공개 rule 목록에 옛 경로 | 새 schema 경로 반영 | 배포 표면 검사 |

#### Constraints

- schema 본문은 경로와 최상위 제목을 제외하고 의미를 바꾸지 않는다.
- active source, skill, reference와 test만 전환하며 changelog의 역사적 문자열은 부재 검사 대상에서 제외한다.
- 호환 alias를 남기지 않고 모든 전환을 한 task commit에 담는다.