---
type: bouncer.tasks
title: named agent model fallback 정본화
description: named agent model 해석과 slug 거절 시 inherit 재시도 및 host fallback 계약을 공통 규칙으로 모은다
resource: .bouncer/context/epics/054-skill-context-optimization/blueprints/004-shared-rule-blocks/tasks/004/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-27T13:53:33.075+09:00'
bouncer:
  id: TASKS-004
  epic_id: '054'
  blueprint_id: '004'
  status: verified
  verify: npm run ci
  commit_intent:
    - named agent마다 반복된 model 해석과 fallback 절차를 한 정본으로 모음
    - 역할별 입력과 출력 및 호출 상한은 각 workflow에 유지함
  affected_paths:
    - rules/subagent-model.md
    - skills/bouncer-plan/references/context-review.md
    - skills/bouncer-execute/SKILL.md
    - skills/bouncer-execute/references/agent-dispatch.md
    - skills/bouncer-execute/references/verification-recovery.md
    - skills/review/SKILL.md
    - test/master-rules.test.js
    - test/skill-bouncer-plan.test.js
    - test/skill-bouncer-execute.test.js
    - test/skill-review.test.js
    - test/skill-bouncer-run.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-27T14:03:14.000+09:00'
    suggested_paths:
      - scripts/lib
      - scripts/src/lib
      - test
      - test/helpers
      - .bouncer/context/epics/009-subagent-model-config/blueprints/001-subagent-model-config-contract
      - .bouncer/context/epics/009-subagent-model-config/blueprints/002-named-agent-routing
      - .bouncer/context/epics/009-subagent-model-config/blueprints/002-named-agent-routing/tasks/001
    # 유효 엔트리 필드: graph, status, query, result — 예시는 주석이라 파싱되지 않는다
    # - graph: source | context
    #   status: updated | reused | fail-skip | skip-disabled | missing
    #   query: <graphify 조회>
    #   result: <한 줄 요약>
    basis:
      - graph: source
        status: reused
        query: named agent model resolveSubagentModel inherit fallback dispatch reviewer implementer debugger test
        result: 31개 node; 상위 경로 scripts/lib·scripts/src/lib·test·test/helpers
      - graph: context
        status: updated
        query: named agent model resolveSubagentModel inherit fallback dispatch reviewer implementer debugger test
        result: 10개 node; epic 009의 model 설정과 routing 경로
---
# Tasks

Blueprint: [004](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | context
     status: updated | reused | fail-skip | skip-disabled | missing
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
named agent의 provider별 model 해석, slug 거절 시 `inherit` 재시도, named agent 미지원 시 inline·generic fallback 계약을 `rules/subagent-model.md`에 모은다. plan·execute·review 문서는 역할별 입력·출력과 호출 상한만 소유한다.

## Interface
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공: 모든 named dispatch가 `resolveSubagentModel`의 결과를 사용하고, host가 slug를 거절할 때만 `inherit`로 한 번 재시도하며, named agent 미지원 시 명시된 fallback을 사용한다.
- 거부: host가 Codex라는 이유로 named dispatch를 건너뛰거나, 역할별 behavioral brief·read-only 권한·재호출 상한을 공통 규칙으로 이동하지 않는다.

## Touch
<!-- frontmatter bouncer.affected_paths의 모든 경로가 여기서 정당화되어야 합니다 (G11).
     디렉터리가 아니라 파일 단위로, 동사(Create/Modify/Delete/Rename)를 붙입니다.
     디렉터리 하나로 뭉치면 그 안 모든 파일이 열려 G11이 사실상 통과만 합니다.
     경로는 백틱으로 감쌉니다. -->
- Create `rules/subagent-model.md` — model 해석, `inherit` 재시도, named-agent 미지원 fallback의 공통 순서를 정의한다.
- Modify `skills/bouncer-plan/references/context-review.md` — context reviewer의 역할 입력과 full-plan 조건만 남긴다.
- Modify `skills/bouncer-execute/SKILL.md` — dispatch 공통 순서 참조와 light·run 예외의 적용 지점을 분리한다.
- Modify `skills/bouncer-execute/references/agent-dispatch.md` — implementer·reviewer 역할 입력과 light/run 예외만 남긴다.
- Modify `skills/bouncer-execute/references/verification-recovery.md` — debugger 증적 입력과 1회 상한만 남긴다.
- Modify `skills/review/SKILL.md` — standalone review 호출의 역할 계약과 공통 model 규칙 적용 지점을 분리한다.
- Modify `test/master-rules.test.js` — model·fallback 정본과 각 dispatch reference의 참조를 단언한다.
- Modify `test/skill-bouncer-plan.test.js` — context reviewer dispatch와 full-only 조건을 단언한다.
- Modify `test/skill-bouncer-execute.test.js` — 역할별 dispatch와 light/run 예외를 단언한다.
- Modify `test/skill-review.test.js` — reviewer 역할 계약이 공통 model 규칙과 분리되는지 단언한다.
- Modify `test/skill-bouncer-run.test.js` — run이 execute의 named dispatch 예외를 유지하는지 단언한다.

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `scripts/src/lib/subagents.ts` — provider·model 해석의 TypeScript 정본은 바꾸지 않는다.
- `scripts/lib/subagents.js` — 커밋된 런타임 산출물은 바꾸지 않는다.
- `scripts/lib/init.js` — provider별 기본 `inherit` 설정은 바꾸지 않는다.
- `agents/` — blueprint 002가 정본화한 역할별 rubric과 권한은 건드리지 않는다.
- `test/subagents.test.js` — 런타임 model 해석의 단위 테스트는 이번 문서 이동 대상이 아니다.

## Constraints
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- 공통 규칙은 resolve → named dispatch → rejected slug의 `inherit` retry → unsupported host fallback 순서를 보존한다.
- 역할 이름, 입력 문서, 출력 필드, read-only 여부와 재호출 상한은 각 호출 문서에 남긴다.
- configured model이 `inherit`이거나 비문자열이면 부모 세션 상속이라는 런타임 의미를 바꾸지 않는다.
- 새 provider 설정이나 subagent helper를 만들지 않는다.

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] 계약 테스트를 먼저 바꿔 공통 model 순서와 역할별 dispatch 계약을 별도로 단언한다.
- [ ] `node --test test/master-rules.test.js test/skill-bouncer-plan.test.js test/skill-bouncer-execute.test.js test/skill-review.test.js test/skill-bouncer-run.test.js`로 새 정본 부재 상태의 실패를 확인한다.
- [ ] `rules/subagent-model.md`를 만들고 세 dispatch 문서와 review skill의 반복 순서를 참조로 바꾼다.
- [ ] `rg -n 'resolveSubagentModel|retry with `inherit`|inherit.*fallback|named agents are unavailable' skills rules`로 공통 순서 중복과 역할별 예외 누락을 확인한다.
- [ ] `npm run ci`가 통과한다.
