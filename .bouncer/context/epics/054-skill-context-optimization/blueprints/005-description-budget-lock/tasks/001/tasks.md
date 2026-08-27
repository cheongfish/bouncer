---
type: bouncer.tasks
title: 스킬 description 핵심 트리거 축약
description: 19개 스킬 description을 호출 계약이 앞에 오는 짧은 한 문장으로 바꾸고 기존 계약 테스트를 맞춘다
resource: .bouncer/context/epics/054-skill-context-optimization/blueprints/005-description-budget-lock/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-26T14:53:09.245+09:00'
bouncer:
  id: TASKS-001
  epic_id: '054'
  blueprint_id: '005'
  status: verified
  verify: npm run ci
  commit_intent:
    - 반복 상투 문구가 스킬 목록 예산의 절반가량을 차지해 모든 세션의 초기 컨텍스트를 늘렸음
    - 핵심 호출 조건을 보존한 채 한 문장으로 줄여 암묵·명시 호출 표면을 가볍게 하려 함
  affected_paths:
    - skills/agentic-code-benchmark/SKILL.md
    - skills/bouncer-init/SKILL.md
    - skills/bouncer-plan/SKILL.md
    - skills/bouncer-execute/SKILL.md
    - skills/bouncer-commit/SKILL.md
    - skills/bouncer-finalize/SKILL.md
    - skills/bouncer-run/SKILL.md
    - skills/discovery/SKILL.md
    - skills/spec-authoring/SKILL.md
    - skills/implementation/SKILL.md
    - skills/verification/SKILL.md
    - skills/review/SKILL.md
    - skills/minimality/SKILL.md
    - skills/debugging/SKILL.md
    - skills/graphify-runner/SKILL.md
    - skills/context-review/SKILL.md
    - skills/explain-diff/SKILL.md
    - skills/stop-slop/SKILL.md
    - skills/migrate-ids/SKILL.md
    - test/skill-bouncer-surface.test.js
    - test/skill-bouncer-commit.test.js
    - test/skill-bouncer-run.test.js
    - test/skill-context-review.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-27T15:23:59+09:00'
    suggested_paths:
      - test
      - test/helpers
      - .bouncer/distill
      - .bouncer/context/epics/054-skill-context-optimization
      - .bouncer/context/epics/054-skill-context-optimization/blueprints/006-execution-baseline/tasks/001
    # 유효 엔트리 필드: graph, status, query, result — 예시는 주석이라 파싱되지 않는다
    # - graph: source | context
    #   status: updated | reused | fail-skip | skip-disabled | missing
    #   query: <graphify 조회>
    #   result: <한 줄 요약>
    basis:
      - graph: source
        status: reused
        query: skill descriptions trigger explicit invocation implicit matching tests
        result: '72 nodes; top files: test/skill-agentic-code-benchmark.test.js, test/scaffold.test.js, test/master-rules.test.js, test/helpers/read-skill.js'
      - graph: context
        status: updated
        query: skill descriptions trigger explicit invocation implicit matching tests
        result: '7 nodes; top files: .bouncer/distill/plugin-skills.md, epic 054 index, blueprint 006 task 001'
---
# Tasks

Blueprint: [005](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | context
     status: updated | reused | fail-skip | skip-disabled | missing
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
19개 `skills/*/SKILL.md`의 `description`이 핵심 트리거를 첫 절에 둔 100~180자 한 문장이 된다. 길이는 baseline `awk`와 같은 YAML 원문 scalar 기준이다. workflow의 명시 호출 전용 계약, 내부 스킬의 Bouncer 흐름·직접 요청 계약, `agentic-code-benchmark`의 일반 암묵 호출 가능성은 유지하며 `npm run ci`가 통과해야 한다.

## Interface
- 제공:
  - workflow 여섯 개는 `/<skill-name>` 직접 요청에서만 선택된다는 조건과 핵심 산출물을 한 문장에 둔다.
  - 내부 스킬 열두 개는 어떤 Bouncer 단계에서 쓰는지 또는 어떤 사용자 요청에 직접 반응하는지를 첫 절에 둔다.
  - `agentic-code-benchmark`는 Bouncer 내부 전용이나 명시 호출 전용으로 바꾸지 않고 비교·채점 요청의 암묵 매칭 단서를 유지한다.
- 거부:
  - `name`이나 `description`을 비우거나 스킬 디렉터리를 비공개 reference로 전환하지 않는다.
  - description에 세부 절차, gate 번호, rubric 전문을 다시 싣지 않는다.
  - 본문 절차와 `CLAUDE.md`의 호출 표를 description 축약에 맞춘다는 이유로 바꾸지 않는다.

## Touch
- Modify `skills/agentic-code-benchmark/SKILL.md` — 비교·채점 트리거를 앞에 둔 일반 호출 description으로 축약한다.
- Modify `skills/bouncer-init/SKILL.md` — `/bouncer-init` 명시 호출 조건과 bootstrap 결과만 남긴다.
- Modify `skills/bouncer-plan/SKILL.md` — `/bouncer-plan` 명시 호출 조건과 계획 산출물만 남긴다.
- Modify `skills/bouncer-execute/SKILL.md` — `/bouncer-execute` 명시 호출 조건과 단일 task 실행 범위만 남긴다.
- Modify `skills/bouncer-commit/SKILL.md` — `/bouncer-commit` 명시 호출 조건과 active task commit 범위만 남긴다.
- Modify `skills/bouncer-finalize/SKILL.md` — `/bouncer-finalize` 명시 호출 조건과 blueprint 마감 범위만 남긴다.
- Modify `skills/bouncer-run/SKILL.md` — `/bouncer-run` 명시 호출 조건과 남은 task 반복 범위만 남긴다.
- Modify `skills/discovery/SKILL.md` — 변경 요청 framing 트리거와 plan 내부·직접 요청 경계를 축약한다.
- Modify `skills/spec-authoring/SKILL.md` — 계획 본문·Distill 저술 트리거와 body-only 권한을 축약한다.
- Modify `skills/implementation/SKILL.md` — 승인 task 구현 트리거와 affected scope 경계를 축약한다.
- Modify `skills/verification/SKILL.md` — verify 결과 조사 트리거와 evidence 비소유권을 축약한다.
- Modify `skills/review/SKILL.md` — task brief 대비 diff 판정 트리거와 Findings-only 결과를 축약한다.
- Modify `skills/minimality/SKILL.md` — plan·review 최소성 점검 트리거와 advisory 경계를 축약한다.
- Modify `skills/debugging/SKILL.md` — verify 실패·예상 밖 동작 트리거와 root-cause 우선 경계를 축약한다.
- Modify `skills/graphify-runner/SKILL.md` — plan 경로 후보 생성 트리거와 advisory 범위를 축약한다.
- Modify `skills/context-review/SKILL.md` — full plan 판정 트리거와 Findings-only 권한을 축약한다.
- Modify `skills/explain-diff/SKILL.md` — finalize 내부 explain·quiz 트리거와 비진입점 경계를 축약한다.
- Modify `skills/stop-slop/SKILL.md` — 한국어 Bouncer 문서 교정 트리거와 advisory 경계를 축약한다.
- Modify `skills/migrate-ids/SKILL.md` — legacy id migration 트리거와 확인 후 적용 경계를 축약한다.
- Modify `test/skill-bouncer-surface.test.js` — workflow 여섯 개의 새 짧은 명시 호출 계약을 단정한다.
- Modify `test/skill-bouncer-commit.test.js` — commit description 단언을 새 호출 문구에 맞춘다.
- Modify `test/skill-bouncer-run.test.js` — run description 단언을 새 호출 문구에 맞춘다.
- Modify `test/skill-context-review.test.js` — context-review의 plan 내부·직접 요청 계약을 새 문구로 단정한다.

## Do not touch
- `agents` — 역할별 rubric 정본은 blueprint 002에서 이미 닫혔다.
- `CLAUDE.md` — hard rule과 「When to invoke」 표는 epic Out of scope다.
- `.bouncer/distill` — 현재 Distill 문구는 runtime 정본이며 이 plan의 구현 파일이 아니다.
- `SKILL_CONTEXT_OPTIMIZATION.md` — 조사 메모는 과거 분석 자료로 남긴다.

## Constraints
- 각 description은 영어 한 문장, YAML 인용부호를 포함한 원문 scalar 기준 100~180자이며 핵심 트리거를 첫 절에 둔다.
- `skills/*/SKILL.md`에서는 frontmatter의 `description` 한 줄만 바꾸고 아래 본문은 수정하지 않는다.
- workflow 여섯 개는 명시 호출 전용이다. 내부 스킬의 사용자 직접 요청 예외와 `agentic-code-benchmark`의 암묵 호출 가능성을 보존한다.
- 스킬 이름, 공개 경로, 본문 절차, gate 계약을 바꾸지 않는다.
- 새 dependency·helper·설정 키를 만들지 않는다.

## Checklist
- [ ] 네 description 리터럴 테스트를 새 짧은 호출 계약으로 먼저 바꾼다.
- [ ] `node --test test/skill-bouncer-surface.test.js test/skill-bouncer-commit.test.js test/skill-bouncer-run.test.js test/skill-context-review.test.js`가 기존 description 때문에 실패하는지 확인한다.
- [ ] 19개 description만 축약한다. frontmatter 아래 첫 본문 줄부터는 수정하지 않는다.
- [ ] 아래 잔존 검색에서 구현 대상 `skills/`와 네 테스트의 옛 상투 문구가 0건인지 확인한다. 과거 `.bouncer/context/**`, `.bouncer/distill/**`, `SKILL_CONTEXT_OPTIMIZATION.md`는 결과에서 제외한다.
  ```bash
  rg -n 'This skill should be used|It is used only while working inside an active Bouncer blueprint' skills test/skill-bouncer-surface.test.js test/skill-bouncer-commit.test.js test/skill-bouncer-run.test.js test/skill-context-review.test.js
  ```
- [ ] 기존 `test/skill-agentic-code-benchmark.test.js`와 `test/skill-explain-diff.test.js`가 각각 일반 암묵 호출과 finalize 전용 경계를 계속 단정하는지 확인한다.
- [ ] baseline과 같은 아래 명령으로 YAML 원문 scalar 총합이 3,000자 이하인지 확인한다.
  ```bash
  awk '/^description:/ { sub(/^description:[[:space:]]*/, ""); s += length($0) } END { print s+0 }' skills/*/SKILL.md
  ```
- [ ] `npm run ci`가 통과한다.
