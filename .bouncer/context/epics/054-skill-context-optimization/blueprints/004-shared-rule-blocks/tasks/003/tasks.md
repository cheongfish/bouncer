---
type: bouncer.tasks
title: current pointer 처리 정본화
description: active pointer의 읽기와 task 선택 및 확인 후 이동 계약을 공통 규칙으로 모은다
resource: .bouncer/context/epics/054-skill-context-optimization/blueprints/004-shared-rule-blocks/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-27T13:53:33.041+09:00'
bouncer:
  id: TASKS-003
  epic_id: '054'
  blueprint_id: '004'
  status: verified
  verify: npm run ci
  commit_intent:
    - workflow마다 반복된 active pointer 처리 규칙을 한 정본으로 모음
    - task 선택과 확인 후 이동 및 gate 선행 계약을 보존함
  affected_paths:
    - rules/current-pointer.md
    - skills/bouncer-plan/SKILL.md
    - skills/bouncer-execute/SKILL.md
    - skills/bouncer-commit/SKILL.md
    - skills/bouncer-finalize/SKILL.md
    - skills/bouncer-run/SKILL.md
    - skills/bouncer-finalize/references/cleanup-handoff.md
    - test/master-rules.test.js
    - test/skill-bouncer-surface.test.js
    - test/skill-bouncer-commit.test.js
    - test/skill-bouncer-finalize.test.js
    - test/skill-bouncer-run.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-27T14:03:14.000+09:00'
    suggested_paths:
      - scripts/src/lib
      - test
      - test/helpers
      - .bouncer/context/epics/010-active-pointer-cli/blueprints/001-current-command
      - .bouncer/context/epics/010-active-pointer-cli/blueprints/001-current-command/tasks/001
      - .bouncer/context/epics/012-finalize-handoff/blueprints/001-next-blueprint-handoff/tasks/001
    # 유효 엔트리 필드: graph, status, query, result — 예시는 주석이라 파싱되지 않는다
    # - graph: source | context
    #   status: updated | reused | fail-skip | skip-disabled | missing
    #   query: <graphify 조회>
    #   result: <한 줄 요약>
    basis:
      - graph: source
        status: reused
        query: bouncer current pointer task path set clear plan gate workflow handoff test
        result: 78개 node; 상위 경로 scripts/src/lib·test·test/helpers
      - graph: context
        status: updated
        query: bouncer current pointer task path set clear plan gate workflow handoff test
        result: 9개 node; epic 010·012의 pointer와 handoff 경로
---
# Tasks

Blueprint: [004](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | context
     status: updated | reused | fail-skip | skip-disabled | missing
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
`bouncer current`의 읽기, `null` 처리, task brief 선택, `--set`·`--clear`의 확인·gate 계약을 `rules/current-pointer.md`에 모은다. workflow에는 해당 단계가 pointer를 읽거나 이동하는 이유와 고유 중단 조건만 남긴다.

## Interface
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공: pointer는 CLI를 통해 읽고 쓰며 반환된 `blueprint`와 `task.path`를 그대로 사용한다. `/bouncer-run`의 `auto`는 시작 ACQ가 이후 next-task 이동을 미리 승인하고, `interactive`는 각 task 경계에서 다시 확인한다.
- 거부: `scripts/lib/current` 직접 호출, 경로 재구성, 승인 없는 next-task 이동, 자동 next-blueprint 이동, gate 우회를 허용하지 않는다.

## Touch
<!-- frontmatter bouncer.affected_paths의 모든 경로가 여기서 정당화되어야 합니다 (G11).
     디렉터리가 아니라 파일 단위로, 동사(Create/Modify/Delete/Rename)를 붙입니다.
     디렉터리 하나로 뭉치면 그 안 모든 파일이 열려 G11이 사실상 통과만 합니다.
     경로는 백틱으로 감쌉니다. -->
- Create `rules/current-pointer.md` — pointer 저장 위치와 JSON/CLI 표면, task 선택, 확인 후 이동 계약을 정의한다.
- Modify `skills/bouncer-plan/SKILL.md` — approval 뒤 최초 pointer 설정과 plan gate 관계만 남긴다.
- Modify `skills/bouncer-execute/SKILL.md` — pointer task brief 선택과 null·status 중단 조건만 남긴다.
- Modify `skills/bouncer-commit/SKILL.md` — 현재 task 해석과 확인 후 next-task 이동 예외만 남긴다.
- Modify `skills/bouncer-finalize/SKILL.md` — current 읽기와 finalize 뒤 clear·handoff 관계만 남긴다.
- Modify `skills/bouncer-run/SKILL.md` — loop가 pointer task를 읽고 autonomy에 따라 이동하는 예외만 남긴다.
- Modify `skills/bouncer-finalize/references/cleanup-handoff.md` — next blueprint 확인 후 `current --set` 적용 지점을 남긴다.
- Modify `test/master-rules.test.js` — 공통 pointer 정본과 workflow 참조를 단언한다.
- Modify `test/skill-bouncer-surface.test.js` — null 처리와 CLI 사용 계약을 새 정본 기준으로 단언한다.
- Modify `test/skill-bouncer-commit.test.js` — task 선택과 next-task 확인 계약을 유지한다.
- Modify `test/skill-bouncer-finalize.test.js` — finalize clear와 next-blueprint handoff 계약을 유지한다.
- Modify `test/skill-bouncer-run.test.js` — autonomy별 pointer advance 계약을 유지한다.

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `scripts/lib/current.js` — pointer 저장·해석 구현은 바꾸지 않는다.
- `scripts/lib/validate.js` — `current --set`의 plan gate 동작은 바꾸지 않는다.
- `test/current.test.js` — CLI 내부 계약은 이번 문서 정본화의 변경 대상이 아니다.
- `CLAUDE.md` — Git common directory와 pointer shape hard rule은 유지한다.

## Constraints
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- pointer 파일을 직접 읽거나 쓰지 않고 `bouncer current` 표면만 사용한다.
- `current.task.path`가 없을 때의 first/single task resolver 계약을 유지한다.
- 최초 blueprint 설정과 next-blueprint 이동은 해당 사용자 확인과 plan gate를 선행한다. next-task는 `/bouncer-run`의 시작 ACQ가 `auto` 이동을 포괄하고, `interactive`에서는 task 경계 ACQ 뒤에만 이동한다.
- execute worktree와 main worktree가 Git common pointer를 공유한다는 계약을 바꾸지 않는다.

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] 계약 테스트를 먼저 바꿔 pointer 정본, CLI-only 사용, task 선택, confirm-then-set을 분리해 단언한다.
- [ ] `node --test test/master-rules.test.js test/skill-bouncer-surface.test.js test/skill-bouncer-commit.test.js test/skill-bouncer-finalize.test.js test/skill-bouncer-run.test.js`로 새 정본 부재 상태의 실패를 확인한다.
- [ ] `rules/current-pointer.md`를 만들고 workflow·handoff reference의 반복 설명을 적용 지점 참조로 바꾼다.
- [ ] `rg -n 'scripts/lib/current|current --set|current --clear|current.task.path' skills rules`로 직접 helper 호출 금지와 이동 계약 중복을 확인한다.
- [ ] `npm run ci`가 통과한다.
