---
type: bouncer.tasks
title: plugin root와 master rule 로딩 정본화
description: plugin root 해석과 master rule 로딩 계약을 한 정본으로 모으고 각 소비 문서에는 적용 지점만 남긴다
resource: .bouncer/context/epics/054-skill-context-optimization/blueprints/004-shared-rule-blocks/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-26T14:53:09.210+09:00'
bouncer:
  id: TASKS-001
  epic_id: '054'
  blueprint_id: '004'
  status: verified
  verify: npm run ci
  commit_intent:
    - plugin root와 master rule 로딩의 반복 설명을 한 정본으로 모음
    - 각 스킬의 독립 shell 해석과 제품 규칙 로딩 시점을 보존함
  affected_paths:
    - rules/plugin-root.md
    - skills/bouncer-init/SKILL.md
    - skills/bouncer-plan/SKILL.md
    - skills/bouncer-execute/SKILL.md
    - skills/bouncer-commit/SKILL.md
    - skills/bouncer-finalize/SKILL.md
    - skills/bouncer-run/SKILL.md
    - skills/bouncer-plan/references/context-review.md
    - skills/bouncer-finalize/references/cleanup-handoff.md
    - skills/bouncer-finalize/references/distill-promotion.md
    - skills/bouncer-finalize/references/explain-quiz.md
    - skills/explain-diff/SKILL.md
    - skills/graphify-runner/SKILL.md
    - skills/migrate-ids/SKILL.md
    - skills/review/SKILL.md
    - test/master-rules.test.js
    - scripts/src/lib/seed-worktree.ts
    - scripts/lib/seed-worktree.js
    - test/seed-worktree.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-27T14:03:14.000+09:00'
    suggested_paths:
      - test
      - test/helpers
      - .bouncer/context/epics/003-multi-agent-plugin/blueprints/002-commands-to-skills
      - .bouncer/context/epics/007-project-distill/blueprints/002-project-root-distill
      - .bouncer/context/epics/048-plugin-root-resolution/blueprints/001-host-candidate-launcher
    # 유효 엔트리 필드: graph, status, query, result — 예시는 주석이라 파싱되지 않는다
    # - graph: source | context
    #   status: updated | reused | fail-skip | skip-disabled | missing
    #   query: <graphify 조회>
    #   result: <한 줄 요약>
    basis:
      - graph: source
        status: reused
        query: plugin root master rules workflow skill launcher project root shell contract test
        result: 89개 node; 상위 경로 test·test/helpers
      - graph: context
        status: updated
        query: plugin root master rules workflow skill launcher project root shell contract test
        result: 9개 node; epic 003·007·048의 관련 blueprint 경로
---
# Tasks

Blueprint: [004](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | context
     status: updated | reused | fail-skip | skip-disabled | missing
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
`BOUNCER_ROOT` 선택과 workflow 시작 시 master rule·제품 규칙을 읽는 계약을 `rules/plugin-root.md` 한 곳에서 설명한다. 모든 소비 문서는 이 정본을 가리키되, 독립 shell block마다 `bouncer-root --auto`를 다시 실행하는 hard rule은 유지한다.

## Interface
- 제공: `rules/plugin-root.md`가 설치 후보 선택, `BOUNCER_HOME` override, provider 분리, `CLAUDE.md`와 제품 규칙 로딩 시점을 함께 설명한다. workflow와 shell을 실행하는 보조 스킬은 필요한 위치에서 이 규칙을 참조한다.
- 거부: shell block의 실제 `bouncer-root --auto` 실행을 생략하거나 plugin root를 cwd·project root·Distill base로 재해석하지 않는다.

## Touch
- Modify `rules/plugin-root.md` — plugin root 해석과 master rule·제품 규칙 로딩의 단일 계약을 정의한다.
- Modify `skills/bouncer-init/SKILL.md` — 시작 시점의 적용 지점과 init 예외만 남긴다.
- Modify `skills/bouncer-plan/SKILL.md` — plan 시작과 project-root 분리 지점에서 공통 규칙을 참조한다.
- Modify `skills/bouncer-execute/SKILL.md` — execute 시작과 worktree/project-root 분리 지점에서 공통 규칙을 참조한다.
- Modify `skills/bouncer-commit/SKILL.md` — commit preflight shell의 공통 규칙 참조를 정리한다.
- Modify `skills/bouncer-finalize/SKILL.md` — finalize checkout 예외와 공통 규칙 참조를 분리한다.
- Modify `skills/bouncer-run/SKILL.md` — drive 시작 시 한 번 묶는 project root와 독립 shell 해석을 구분한다.
- Modify `skills/bouncer-plan/references/context-review.md` — reviewer model 조회 shell이 공통 root 규칙을 적용하게 한다.
- Modify `skills/bouncer-finalize/references/cleanup-handoff.md` — main-worktree cleanup shell의 root 적용 지점을 남긴다.
- Modify `skills/bouncer-finalize/references/distill-promotion.md` — execute-checkout audit shell의 root 적용 지점을 남긴다.
- Modify `skills/bouncer-finalize/references/explain-quiz.md` — explain scaffold shell의 root 적용 지점을 남긴다.
- Modify `skills/explain-diff/SKILL.md` — CLI 호출에 공통 root 규칙을 참조한다.
- Modify `skills/graphify-runner/SKILL.md` — graph-sync와 query shell에 공통 root 규칙을 참조한다.
- Modify `skills/migrate-ids/SKILL.md` — migration shell의 공통 root 규칙을 참조한다.
- Modify `skills/review/SKILL.md` — review가 호출하는 CLI shell의 공통 root 규칙을 참조한다.
- Modify `test/master-rules.test.js` — 정본 1개와 소비 지점 참조, 독립 shell resolution 보존을 단언한다.
- Modify `scripts/src/lib/seed-worktree.ts` — execute worktree가 개발 의존성을 갖춘 뒤 검증을 시작하도록 준비 절차를 추가한다.
- Modify `scripts/lib/seed-worktree.js` — TypeScript 정본과 같은 런타임 준비 절차를 반영한다.
- Modify `test/seed-worktree.test.js` — 새 worktree의 의존성 준비와 재사용 시의 불필요한 재실행 방지를 검증한다.

## Do not touch
- `scripts/` — launcher, runtime path와 CLI 구현은 바꾸지 않는다.
- `CLAUDE.md` — hard rule 본문과 workflow 순서를 축약하지 않는다.
- `docs/` — 설치·설정 사용자 문서는 이번 지시문 정본화 범위가 아니다.

## Constraints
- 각 독립 shell block은 `BOUNCER_ROOT="$(bouncer-root --auto)" || exit $?`를 직접 실행한다.
- `PROJECT_ROOT`와 `BOUNCER_ROOT`의 역할, provider 선택과 host 설치 후보 선택의 분리를 유지한다.
- workflow skill의 `Plugin root`·`Master rules` label과 `CLAUDE.md` 인용은 `rules/skill-shape.md` 계약대로 남긴다.
- 새 helper, 환경 변수, launcher fallback을 만들지 않는다.

## Checklist
- [ ] 계약 테스트를 먼저 추가해 모든 workflow가 `rules/plugin-root.md`와 `CLAUDE.md`를 가리키고, 독립 shell block의 `bouncer-root --auto`가 남는지 단언한다.
- [ ] `node --test test/master-rules.test.js test/skill-bouncer-surface.test.js`로 새 계약의 실패를 확인한다.
- [ ] `rules/plugin-root.md`에 공통 설명을 모으고 소비 문서에는 적용 지점·예외만 남긴다.
- [ ] `rg -n 'BOUNCER_ROOT 해석|Plugin root|Master rules|bouncer-root --auto' skills rules`로 설명 중복과 shell resolution 누락을 확인한다.
- [ ] 새 execute worktree가 `npm run ci`에 필요한 개발 의존성을 준비하는지 단위 테스트로 확인한다.
- [ ] `npm run ci`가 통과한다.
