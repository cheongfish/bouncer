---
type: bouncer.tasks
title: description 예산과 정본 개수 회귀 잠금
description: 19개 스킬 description의 개수·개별 길이·총예산과 역할 스킬의 호출 계약 크기를 테스트로 고정한다
resource: .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/008-description-budget-lock/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-27T15:18:31.154+09:00'
bouncer:
  id: TASKS-002
  epic_id: '043'
  blueprint_id: '008'
  status: verified
  verify: npm run ci
  commit_intent:
    - description 축약 수치와 역할별 정본 경계가 문서 기준뿐이라 후속 변경에서 조용히 되돌아갈 수 있었음
    - 고정 상한과 금지 rubric 문구를 CI가 판정하게 해 예산 증액을 사람 결정으로 남기려 함
  affected_paths:
    - test/skill-bouncer-surface.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-27T15:23:59+09:00'
    suggested_paths:
      - test
      - test/helpers
      - .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/005-agent-rubric-ssot
      - .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/008-description-budget-lock
      - .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/009-execution-baseline
    # 유효 엔트리 필드: graph, status, query, result — 예시는 주석이라 파싱되지 않는다
    # - graph: source | context
    #   status: updated | reused | fail-skip | skip-disabled | missing
    #   query: <graphify 조회>
    #   result: <한 줄 요약>
    basis:
      - graph: source
        status: reused
        query: description budget canonical skill count role rubric contract
        result: '29 nodes; top files: test/skill-agentic-code-benchmark.test.js, test/master-rules.test.js, test/helpers/read-skill.js'
      - graph: context
        status: updated
        query: description budget canonical skill count role rubric contract
        result: '9 nodes; top files: epic 054 blueprints 002, 005, and 006 indexes'
---
# Tasks

Blueprint: [008](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | context
     status: updated | reused | fail-skip | skip-disabled | missing
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
새 계약 테스트가 `skills/*/SKILL.md` 정본 19개와 YAML 원문 scalar 기준 개별 description 100~180자·총합 3,000자 이하를 고정한다. implementation·review·debugging·context-review description에는 blueprint 002가 agent 정본으로 옮긴 rubric 문구가 없어야 하며 `npm run ci`가 통과해야 한다.

## Interface
- 제공: 기존 `test/skill-bouncer-surface.test.js`가 스킬 디렉터리 정렬 목록을 읽고 각 파일의 `description:` 접두어만 제거한 YAML 원문 scalar로 정본 개수 `19`, 개별 길이 범위 `100..180`, 합계 상한 `3000`을 단정한다. 네 역할 description의 rubric 금지 문구도 같은 원문 scalar에서 검사한다.
- 거부: 새 스킬이 추가되거나 description 예산을 늘릴 때 테스트 상수를 자동으로 따라 올리지 않는다. 예산 변경은 별도 계획과 사람 판단 없이는 실패해야 한다.

## Touch
- Modify `test/skill-bouncer-surface.test.js` — 기존 전체 스킬 표면 테스트에 description 정본 개수, 길이 예산, 역할별 rubric 역류 방지 계약을 더한다.

## Do not touch
- `skills` — 이 task는 task 001의 결과를 판정할 뿐 description을 다시 고치지 않는다.
- `agents` — 역할별 rubric 정본 내용은 바꾸지 않는다.
- `scripts` — 전용 lint나 새 CLI를 만들지 않고 Node test로 닫는다.

## Constraints
- Node 표준 라이브러리만 사용한다.
- 전체 스킬 표면을 이미 읽는 `test/skill-bouncer-surface.test.js`를 재사용하고 전용 test 파일이나 helper를 만들지 않는다.
- 개별 길이와 총합은 baseline 명령과 똑같이 `description:` 접두어만 제거한 한 줄의 나머지를 사용하며 YAML 인용부호를 포함한다. `parseFrontmatter(...).data.description.length`를 예산 계산에 쓰지 않는다.
- 실패 메시지에 실제 개수·길이·총합을 넣고, 상한을 올리려면 사람이 계약을 검토해야 함을 적는다.

## Checklist
- [ ] `test/skill-bouncer-surface.test.js`에 다음 상수를 추가한다.
  ```js
  const EXPECTED_SKILL_COUNT = 19;
  const MIN_DESCRIPTION_CHARS = 100;
  const MAX_DESCRIPTION_CHARS = 180;
  const MAX_TOTAL_DESCRIPTION_CHARS = 3000;
  const ROLE_SKILLS = ['implementation', 'review', 'debugging', 'context-review'];
  ```
- [ ] 테스트가 각 `skills/*/SKILL.md`에서 `^description:\s*`와 일치하는 줄을 정확히 하나 찾고 접두어만 제거한 나머지의 존재·한 문장·길이 범위와 총합을 단정하게 한다.
- [ ] 네 역할 description에서 `Detailed comments`, `Root cause → Pattern → Hypothesis → Implementation`, `Spec compliance`, `Over-engineering`, `Rubric — four scopes`, `Calibration`, `Procedure`, `Guardrails`가 발견되면 실패하게 한다.
- [ ] 예산 상한을 임시로 `1`로 낮춰 테스트가 실제 합계를 포함한 메시지로 실패하는지 확인한 뒤 `3000`으로 복원한다.
- [ ] `node --test test/skill-bouncer-surface.test.js`가 통과한다.
- [ ] `npm run ci`가 통과한다.
