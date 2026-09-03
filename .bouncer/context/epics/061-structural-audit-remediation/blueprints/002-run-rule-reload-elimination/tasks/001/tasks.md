---
type: bouncer.tasks
title: 반복 규칙 적재 계약 정리
description: Defines and tests one-time immutable rule loading for a bouncer-run drive.
resource: .bouncer/context/epics/061-structural-audit-remediation/blueprints/002-run-rule-reload-elimination/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-09-03T13:39:01.745+09:00'
bouncer:
  id: TASKS-001
  epic_id: '061'
  blueprint_id: '002'
  status: verified
  commit_intent:
    - 같은 drive에서 불변 규칙을 반복 적재해 토큰을 낭비하던 문제를 줄임
    - 새 세션의 초기 규칙 적재와 반복 단계의 재적재 생략 경계를 명확히 함
  affected_paths:
    - rules/plugin-root.md
    - skills/bouncer-run/SKILL.md
    - test/master-rules.test.js
    - test/skill-bouncer-run.test.js
    - test/lightweight-cycle.test.js
  verify: npm test
  scope_evidence:
    producer: graphify
    generated_at: '2026-09-03T13:40:23.000+09:00'
    suggested_paths: []
    basis:
      - graph: source
        status: reused
        query: session scoped immutable rule loading run loop
        result: source graph was fresh; no functional implementation candidate was ranked
      - graph: test
        status: reused
        query: session scoped immutable rule loading run loop
        result: test graph was fresh; only low-confidence test-only candidates were ranked
      - graph: context
        status: updated
        query: session scoped immutable rule loading run loop
        result: context graph rebuilt; 17 related context paths were found without a functional link
    quality:
      status: low-confidence
      confidence: low
      reasons:
        - 'context seeds: 2 labels, 17 paths'
        - 'relation filter: calls, imports, imports_from (depth ≤ 2); contains ownership only'
        - 'no source/context functional link; no implementation candidates'
    candidates:
      implementation: []
      test:
        - path: test/helpers/read-skill.js
          score: -3
          confidence: low
          basis: [imports_from relation, imports relation, test-only without implementation link, test-only without implementation link]
        - path: test/lightweight-cycle.test.js
          score: -3
          confidence: low
          basis: [imports_from relation, test-only without implementation link, test-only without implementation link]
        - path: test/skill-bouncer-execute.test.js
          score: -3
          confidence: low
          basis: [imports_from relation, test-only without implementation link, test-only without implementation link]
        - path: test/skill-bouncer-finalize.test.js
          score: -3
          confidence: low
          basis: [imports_from relation, test-only without implementation link, test-only without implementation link]
        - path: test/skill-bouncer-plan.test.js
          score: -3
          confidence: low
          basis: [imports_from relation, test-only without implementation link, test-only without implementation link]
        - path: test/skill-bouncer-run.test.js
          score: -3
          confidence: low
          basis: [imports_from relation, test-only without implementation link, test-only without implementation link]
        - path: test/skill-context-review.test.js
          score: -3
          confidence: low
          basis: [imports_from relation, test-only without implementation link, test-only without implementation link]
        - path: test/skill-debugging.test.js
          score: -3
          confidence: low
          basis: [imports_from relation, test-only without implementation link, test-only without implementation link]
        - path: test/skill-discovery.test.js
          score: -3
          confidence: low
          basis: [imports_from relation, test-only without implementation link, test-only without implementation link]
        - path: test/skill-graphify-runner.test.js
          score: -3
          confidence: low
          basis: [imports_from relation, test-only without implementation link, test-only without implementation link]
        - path: test/skill-implementation.test.js
          score: -3
          confidence: low
          basis: [imports_from relation, test-only without implementation link, test-only without implementation link]
        - path: test/skill-minimality.test.js
          score: -3
          confidence: low
          basis: [imports_from relation, test-only without implementation link, test-only without implementation link]
        - path: test/skill-review.test.js
          score: -3
          confidence: low
          basis: [imports_from relation, test-only without implementation link, test-only without implementation link]
        - path: test/skill-spec-authoring.test.js
          score: -3
          confidence: low
          basis: [imports_from relation, test-only without implementation link, test-only without implementation link]
        - path: test/skill-stop-slop.test.js
          score: -3
          confidence: low
          basis: [imports_from relation, test-only without implementation link, test-only without implementation link]
        - path: test/skill-verification.test.js
          score: -3
          confidence: low
          basis: [imports_from relation, test-only without implementation link, test-only without implementation link]
        - path: test/master-rules.test.js
          score: -12
          confidence: low
          basis: [seed match rule, generic name match for run, test-only without implementation link, test-only without implementation link, contains-only reach]
        - path: test/skill-agentic-code-benchmark.test.js
          score: -12
          confidence: low
          basis: [generic name match for run, test-only without implementation link, test-only without implementation link, contains-only reach]
        - path: test/skill-bouncer-surface.test.js
          score: -12
          confidence: low
          basis: [generic name match for run, test-only without implementation link, test-only without implementation link, contains-only reach]
      context:
        - path: .bouncer/context/epics/009-agent-orchestration/blueprints/008-run-loop/tasks/002/tasks.md
          score: 4
          confidence: medium
          basis: [context graph hit]
        - path: .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/007-shared-rule-blocks/tasks/001/tasks.md
          score: 4
          confidence: medium
          basis: [context graph hit]
        - path: .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/007-shared-rule-blocks/tasks/002/tasks.md
          score: 4
          confidence: medium
          basis: [context graph hit]
        - path: .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/007-shared-rule-blocks/tasks/003/tasks.md
          score: 4
          confidence: medium
          basis: [context graph hit]
        - path: .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/007-shared-rule-blocks/tasks/005/tasks.md
          score: 4
          confidence: medium
          basis: [context graph hit]
---
# Tasks

Blueprint: [002](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | test | context
     status: updated | reused | fail-skip | skip-disabled | missing
     quality/candidates는 graph-suggest 결과로만 채운다(scaffold는 비워 둔다).
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
<!-- 구현자가 다른 문서 없이 시작할 수 있게.
     수용 기준과 검증 명령도 여기에 적거나 Checklist에 명시한다. -->
`/bouncer-run`은 drive 시작에서 불변 규칙을 한 번 적재하고 task 반복에서는 이를 다시 읽지 않는다. 새 세션과 독립 workflow의 초기 적재 보장은 유지하며, Distill·brief·ACQ·gate의 task별 처리는 계속 수행한다.

## Interface
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공: `rules/plugin-root.md`가 workflow 규칙의 세션 단위 적재를 정의하고, `skills/bouncer-run/SKILL.md`가 loop 진입 1회 적재와 후속 반복 재적재 금지를 명시한다.
- 거부: 반복 생략을 새 세션의 초기 적재, 독립 workflow의 적재, task별 Distill re-ground·brief·ACQ·gate 생략으로 해석하지 않는다.

## Touch
<!-- frontmatter bouncer.affected_paths의 모든 경로가 여기서 정당화되어야 합니다 (G11).
     디렉터리가 아니라 파일 단위로, 동사(Create/Modify/Delete/Rename)를 붙입니다.
     디렉터리 하나로 뭉치면 그 안 모든 파일이 열려 G11이 사실상 통과만 합니다.
     경로는 백틱으로 감쌉니다. -->
- Modify `rules/plugin-root.md` — workflow 규칙을 세션 최초에 적재하고 같은 세션에서는 재적재하지 않는 공통 계약을 적는다.
- Modify `skills/bouncer-run/SKILL.md` — drive 시작의 1회 적재와 task 반복의 재적재 금지를 loop 절차에 한정해 적는다.
- Modify `test/master-rules.test.js` — 공통 계약과 `/bouncer-run`의 세션·drive 경계를 구조적으로 단언한다.
- Modify `test/skill-bouncer-run.test.js` — loop 문서가 초기 적재와 반복 생략을 함께 표현하는지 단언한다.
- Modify `test/lightweight-cycle.test.js` — plan/execute light-path 단언을 영어 스킬 본문에 맞춘다.

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `rules/governance.md` — light-cycle 분리와 조건부 적재는 별도 감사 항목이다.
- `rules/okf.md` — 저술 전용 적재 전환은 별도 감사 항목이다.
- `skills/bouncer-execute/SKILL.md` — 독립 execute workflow의 초기 적재 계약은 이 task의 변경 대상이 아니다.
- `skills/bouncer-commit/SKILL.md` — 독립 commit workflow의 초기 적재 계약은 이 task의 변경 대상이 아니다.

## Constraints
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- 새 runtime 설정, CLI, dependency, abstraction을 추가하지 않는다.
- 반복 생략은 동일 `/bouncer-run` drive의 불변 규칙에만 한정하고, task별 re-ground·brief·ACQ·gate 절차를 약화하지 않는다.
- 문서 본문과 커밋 제목은 한국어로 쓰고, 테스트는 특정 산문 표현보다 세션과 drive의 경계를 확인한다.

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] 기존 규칙·run-loop 계약 테스트에 세션 최초 적재와 동일 drive 반복 생략의 실패 단언을 추가하고, 변경 전 문서에서 실패함을 확인한다.
- [ ] `rules/plugin-root.md`에 workflow 규칙의 세션 단위 적재 계약을 추가한다.
- [ ] `skills/bouncer-run/SKILL.md`에 loop 진입 시 1회 적재와 task 반복 중 재적재 금지를 명시한다.
- [ ] 테스트 단언이 새 계약을 통과하고 독립 workflow의 초기 적재 요구를 계속 확인하도록 정리한다.
- [ ] `npm test`를 실행해 전체 계약 테스트가 통과함을 확인한다.
