---
type: bouncer.tasks
title: finalize 스킬에 보존과 후속 blueprint 규칙을 반영함
description: Finalize guidance records the compact closed-blueprint lifecycle and directs follow-up work to sibling blueprints.
resource: .bouncer/context/epics/018-task-unit-commits/blueprints/020-completed-context-retention/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-09-03T09:28:55.071+09:00'
bouncer:
  id: TASKS-002
  epic_id: '018'
  blueprint_id: '020'
  status: verified
  affected_paths:
    - skills/bouncer-finalize/SKILL.md
    - test/skill-bouncer-finalize.test.js
  verify: npm test
  scope_evidence:
    producer: graphify
    generated_at: '2026-09-03T09:28:55.071+09:00'
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
        query: finalize workflow closed blueprint cleanup retention skill documentation
        result: graph-sync reused the current source graph; graph-suggest returned no ranked source candidates.
      - graph: test
        status: reused
        query: finalize workflow closed blueprint cleanup retention skill documentation
        result: graph-sync reused the current test graph; graph-suggest returned no ranked test candidates.
      - graph: context
        status: reused
        query: finalize workflow closed blueprint cleanup retention skill documentation
        result: graph-sync reused the current context graph; relation results exceeded the confidence limit.
    quality:
      status: low-confidence
      confidence: low
      reasons:
        - 'context seeds: 4 labels, 36 paths'
        - 'relation filter: calls, imports, imports_from (depth ≤ 2); contains ownership only'
        - 'result explosion: 58 candidates (≥ 50)'
    candidates:
      implementation: []
      test: []
      context: []
  commit_intent:
    - 마감 스킬이 닫힌 blueprint의 문서 보존 경계를 설명하지 않아 후속 판단이 갈림
    - finalize 뒤 남는 증적과 sibling blueprint 전환 규칙을 한 계약으로 안내함
---
# Tasks

Blueprint: [020](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | test | context
     status: updated | reused | fail-skip | skip-disabled | missing
     quality/candidates는 graph-suggest 결과로만 채운다(scaffold는 비워 둔다).
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
<!-- 구현자가 다른 문서 없이 시작할 수 있게.
     수용 기준과 검증 명령도 여기에 적거나 Checklist에 명시한다. -->
`/bouncer-finalize`는 G16 뒤에 삭제되는 일회성 문서, 남는 explain·verification
증적, closed Blueprint의 후속 작업 처리 규칙을 안내한다. 사용자는 closed Blueprint를
다시 열지 않고 열려 있는 같은 Epic의 sibling Blueprint 또는 새 Epic으로 후속 작업을
계획한다.

## Interface
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공: finalize 절차는 deletion이 remainder commit의 일부이며 G16·verify 실패가
  발생하면 수행하지 않는다는 계약을 명시한다.
- 거부: finalize는 archive 보관, closed Blueprint 재개, 과거 보존 문서의 소급
  편집을 제안하지 않는다.

## Touch
<!-- frontmatter bouncer.affected_paths의 모든 경로가 여기서 정당화되어야 합니다 (G11).
     디렉터리가 아니라 파일 단위로, 동사(Create/Modify/Delete/Rename)를 붙입니다.
     디렉터리 하나로 뭉치면 그 안 모든 파일이 열려 G11이 사실상 통과만 합니다.
     경로는 백틱으로 감쌉니다. -->
- Modify `skills/bouncer-finalize/SKILL.md` — finalize 순서와 보고 항목에 보존·정리
  경계 및 sibling Blueprint 후속 규칙을 적는다.
- Modify `test/skill-bouncer-finalize.test.js` — 스킬이 삭제 조건·보존 문서·후속
  계획 규칙을 유지하도록 계약 테스트를 추가한다.

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `skills/bouncer-plan/SKILL.md` — plan의 ID·승인·scope evidence 절차는 이 task에서
  바꾸지 않는다.
- `skills/bouncer-finalize/references/cleanup-handoff.md` — 포인터·worktree handoff
  세부 계약은 유지한다.

## Constraints
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- 설명은 한국어로 쓰고, ACQ의 기존 동의 시점과 선택지를 바꾸지 않는다.
- 스킬은 구현을 대신하지 않는다. 삭제의 실제 조건·허용 경로는 001의 CLI·검증
  계약을 그대로 가리킨다.

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] `test/skill-bouncer-finalize.test.js`에 보존 대상·삭제 대상·G16 실패 시
  무변경·sibling Blueprint 후속을 단언한다.
- [ ] finalize 스킬의 deterministic core와 최종 보고를 새 수명주기와 맞춘다.
- [ ] `npm test`를 실행한다.
