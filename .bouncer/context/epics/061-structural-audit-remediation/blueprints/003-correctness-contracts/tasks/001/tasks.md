---
type: bouncer.tasks
title: 스킬 참조와 ACQ 배치 계약
description: Makes workflow skill reference bases and ACQ timing explicit without changing gate semantics.
resource: .bouncer/context/epics/061-structural-audit-remediation/blueprints/003-correctness-contracts/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-09-03T14:41:58.786+09:00'
bouncer:
  id: TASKS-001
  epic_id: '061'
  blueprint_id: '003'
  status: verified
  commit_intent:
    - '스킬이 다른 기준 경로의 문서를 읽는 모호성을 제거함'
    - '질문 게이트를 해당 절차 단계에서 확인하게 함'
  verify: npm run verify:strict
  affected_paths:
    - skills/bouncer-init/SKILL.md
    - skills/bouncer-plan/SKILL.md
    - skills/bouncer-execute/SKILL.md
    - skills/bouncer-commit/SKILL.md
    - skills/bouncer-finalize/SKILL.md
    - skills/bouncer-run/SKILL.md
    - rules/skill-shape.md
    - test/master-rules.test.js
    - test/skill-bouncer-surface.test.js
    - test/skill-bouncer-plan.test.js
    - test/skill-bouncer-execute.test.js
    - test/skill-bouncer-commit.test.js
    - test/skill-bouncer-finalize.test.js
    - test/skill-bouncer-run.test.js
    - test/skill-bouncer-init.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-09-03T14:45:00.000+09:00'
    suggested_paths: []
    # 유효 엔트리 필드: graph, status, query, result — 예시는 주석이라 파싱되지 않는다
    # - graph: source | test | context
    #   status: updated | reused | fail-skip | skip-disabled | missing
    #   query: <graphify 조회>
    #   result: <한 줄 요약>
    # quality/candidates는 graph-suggest 뒤에만 채운다 — scaffold가 제조하지 않는다
    basis:
      - graph: source
        status: reused
        query: workflow skill reference base ACQ gates
        result: source graph was fresh; suggestion returned 69 candidates before low-confidence filtering
      - graph: test
        status: reused
        query: workflow skill reference base ACQ gates
        result: test graph was fresh; suggestion returned no retained candidates
      - graph: context
        status: updated
        query: workflow skill reference base ACQ gates
        result: context graph was rebuilt; suggestion returned no retained candidates
    quality:
      status: low-confidence
      confidence: low
      reasons:
        - 'context seeds: 5 labels, 47 paths'
        - 'relation filter: calls, imports, imports_from (depth <= 2); contains ownership only'
        - 'result explosion: 69 candidates (>= 50)'
    candidates:
      implementation: []
      test: []
      context: []
---
# Tasks

Blueprint: [003](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | test | context
     status: updated | reused | fail-skip | skip-disabled | missing
     quality/candidates는 graph-suggest 결과로만 채운다(scaffold는 비워 둔다).
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
<!-- 구현자가 다른 문서 없이 시작할 수 있게.
     수용 기준과 검증 명령도 여기에 적거나 Checklist에 명시한다. -->
여섯 workflow skill이 루트·스킬 로컬 참조의 기준을 표기하고, 각 ACQ 게이트를 해당 numbered step에서 확인하게 한다. 마지막 `## ACQ` 절은 기존 질문·결과를 바꾸지 않는 단계 색인으로 남긴다.

## Interface
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공: 루트 보조 문서에는 `${BOUNCER_ROOT}/references/...`, 스킬 로컬 보조 문서에는 `./references/...`를 쓴다. ACQ 설명은 질문이 일어나는 step에 인라인으로 둔다.
- 거부: bare `references/...`를 새로 작성하지 않으며, ACQ 색인만 보고 질문 시점이나 답변 결과를 해석하게 하지 않는다.

## Touch
<!-- frontmatter bouncer.affected_paths의 모든 경로가 여기서 정당화되어야 합니다 (G11).
     디렉터리가 아니라 파일 단위로, 동사(Create/Modify/Delete/Rename)를 붙입니다.
     디렉터리 하나로 뭉치면 그 안 모든 파일이 열려 G11이 사실상 통과만 합니다.
     경로는 백틱으로 감쌉니다. -->
- Modify `skills/bouncer-init/SKILL.md` — 로컬 참조 표기와 step 3 ACQ를 정렬한다.
- Modify `skills/bouncer-plan/SKILL.md` — 루트·로컬 참조 표기와 발견·ID·verify·범위·승인 ACQ를 각 단계에 둔다.
- Modify `skills/bouncer-execute/SKILL.md` — 루트·로컬 참조 표기와 무질문 계약을 절차에서 확인 가능하게 둔다.
- Modify `skills/bouncer-commit/SKILL.md` — commit·next-task 동의 시점을 step 4·5에 둔다.
- Modify `skills/bouncer-finalize/SKILL.md` — 루트·로컬 참조 표기와 동의 시점을 step 1·3·4·6에 둔다.
- Modify `skills/bouncer-run/SKILL.md` — 로컬 참조 표기와 start·interactive next-task 동의 시점을 단계에 둔다.
- Modify `rules/skill-shape.md` — 명시적 참조 기준과 마지막 ACQ 색인 규약을 고정한다.
- Modify `test/master-rules.test.js` — workflow 문서의 참조 기준·ACQ 계약을 구조적으로 검증한다.
- Modify `test/skill-bouncer-surface.test.js` — workflow H2 순서와 ACQ 색인 규약을 검증한다.
- Modify `test/skill-bouncer-plan.test.js` — plan의 단계별 ACQ와 참조 표기를 검증한다.
- Modify `test/skill-bouncer-execute.test.js` — execute의 참조 표기와 무질문 계약을 검증한다.
- Modify `test/skill-bouncer-commit.test.js` — commit의 단계별 동의 계약을 검증한다.
- Modify `test/skill-bouncer-finalize.test.js` — finalize의 단계별 동의 계약을 검증한다.
- Modify `test/skill-bouncer-run.test.js` — run의 단계별 동의 계약을 검증한다.
- Modify `test/skill-bouncer-init.test.js` — init의 단계별 동의 계약을 검증한다.

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `rules/acq.md` — 공유 표시·채팅 fallback 계약은 유지한다.
- `scripts/src/lib/` — 이번 task는 문서 계약만 바꾼다.

## Constraints
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- 기존 게이트 이름, 질문 선택지, 답변에 따른 상태 전이와 중단 조건을 바꾸지 않는다.
- 루트 상대와 스킬 로컬 상대 경로만 표기 규약을 바꾸며, 파일 이동이나 참조 대상 변경을 하지 않는다.
- 테스트는 산문 키워드보다 H2 위치·명시적 경로·단계 연결을 검사한다.

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] 각 workflow skill의 보조 문서를 루트 또는 로컬 기준으로 분류하고, 같은 문자열이 다른 파일을 가리키지 않는지 실패 단언을 추가한다.
- [ ] ACQ가 있는 workflow에서 질문 설명을 해당 numbered step으로 옮기고 마지막 `## ACQ` 절을 단계 색인으로 축소한다.
- [ ] 무질문 execute workflow도 절차에서 그 사실을 확인할 수 있게 하고, `rules/skill-shape.md` 및 계약 테스트를 맞춘다.
- [ ] `npm run verify:strict`를 실행한다.
