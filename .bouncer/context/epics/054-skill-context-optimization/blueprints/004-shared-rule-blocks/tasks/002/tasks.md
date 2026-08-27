---
type: bouncer.tasks
title: ACQ 표시 계약 정본화
description: 사용자 확인의 선택지 순서와 출력 형식 및 도구 부재 fallback을 공통 규칙으로 모은다
resource: .bouncer/context/epics/054-skill-context-optimization/blueprints/004-shared-rule-blocks/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-27T13:53:33.006+09:00'
bouncer:
  id: TASKS-002
  epic_id: '054'
  blueprint_id: '004'
  status: verified
  verify: npm run ci
  commit_intent:
    - workflow마다 반복된 사용자 확인 표시 계약을 한 규칙으로 모음
    - 각 단계의 질문 시점과 선택 결과 의미는 기존 workflow가 소유하게 함
  affected_paths:
    - rules/acq.md
    - rules/skill-shape.md
    - skills/bouncer-init/SKILL.md
    - skills/bouncer-plan/SKILL.md
    - skills/bouncer-execute/SKILL.md
    - skills/bouncer-commit/SKILL.md
    - skills/bouncer-finalize/SKILL.md
    - skills/bouncer-run/SKILL.md
    - skills/bouncer-finalize/references/cleanup-handoff.md
    - skills/bouncer-finalize/references/distill-promotion.md
    - skills/bouncer-finalize/references/draft-pr.md
    - skills/explain-diff/SKILL.md
    - test/master-rules.test.js
    - test/skill-bouncer-surface.test.js
    - test/skill-bouncer-init.test.js
    - test/skill-bouncer-commit.test.js
    - test/skill-bouncer-finalize.test.js
    - test/skill-bouncer-run.test.js
    - test/skill-explain-diff.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-27T14:03:14.000+09:00'
    suggested_paths:
      - test
      - test/helpers
      - .bouncer/context/epics/037-distill-promotion-consent/blueprints/001-promotion-proposal-acq
      - .bouncer/context/epics/037-distill-promotion-consent/blueprints/001-promotion-proposal-acq/tasks/001
      - .bouncer/context/epics/037-distill-promotion-consent/blueprints/001-promotion-proposal-acq/tasks/002
    # 유효 엔트리 필드: graph, status, query, result — 예시는 주석이라 파싱되지 않는다
    # - graph: source | context
    #   status: updated | reused | fail-skip | skip-disabled | missing
    #   query: <graphify 조회>
    #   result: <한 줄 요약>
    basis:
      - graph: source
        status: reused
        query: ACQ AskUserQuestion options order recommended chat fallback workflow consent test
        result: 86개 node; 상위 경로 test·test/helpers
      - graph: context
        status: updated
        query: ACQ AskUserQuestion options order recommended chat fallback workflow consent test
        result: 9개 node; epic 037의 consent blueprint와 task 경로
---
# Tasks

Blueprint: [004](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | context
     status: updated | reused | fail-skip | skip-disabled | missing
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
ACQ 선택지 순서, recommended 표기, host 질문 도구와 chat fallback 형식을 `rules/acq.md`의 단일 계약으로 만든다. 각 workflow는 질문 시점과 선택 결과만 정의하고 공통 표시 템플릿은 반복하지 않는다.

## Interface
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공: 모든 human-facing confirmation은 공통 규칙에 따라 A/B/C 순서, recommended 표기, 도구 부재 시 동일 선택지의 chat 렌더링을 사용한다.
- 거부: 기존 ACQ gate를 삭제·병합하거나 `auto`가 건너뛰지 못하는 동의를 생략하지 않는다.

## Touch
<!-- frontmatter bouncer.affected_paths의 모든 경로가 여기서 정당화되어야 합니다 (G11).
     디렉터리가 아니라 파일 단위로, 동사(Create/Modify/Delete/Rename)를 붙입니다.
     디렉터리 하나로 뭉치면 그 안 모든 파일이 열려 G11이 사실상 통과만 합니다.
     경로는 백틱으로 감쌉니다. -->
- Create `rules/acq.md` — ACQ 선택지 순서, 권장안 표기, 출력과 fallback 계약을 정의한다.
- Modify `rules/skill-shape.md` — 마지막 ACQ 절의 구조는 유지하면서 공통 표시 계약 참조를 허용한다.
- Modify `skills/bouncer-init/SKILL.md` — promotion·gitignore 질문의 고유 조건과 결과만 남긴다.
- Modify `skills/bouncer-plan/SKILL.md` — discovery·scale·verify·scope·approval 질문 목록과 결과만 남긴다.
- Modify `skills/bouncer-execute/SKILL.md` — ACQ 없음 계약을 공통 규칙 형식으로 유지한다.
- Modify `skills/bouncer-commit/SKILL.md` — commit·next-task 질문의 고유 선택과 결과만 남긴다.
- Modify `skills/bouncer-finalize/SKILL.md` — promotion·quiz·finalize·PR·handoff 질문의 고유 조건과 결과만 남긴다.
- Modify `skills/bouncer-run/SKILL.md` — 시작·interactive task 경계 질문과 autonomy 예외만 남긴다.
- Modify `skills/bouncer-finalize/references/cleanup-handoff.md` — cleanup·next-blueprint 질문이 공통 표시 규칙을 쓰게 한다.
- Modify `skills/bouncer-finalize/references/distill-promotion.md` — list-wide consent의 고유 선택과 non-skippable 조건만 남긴다.
- Modify `skills/bouncer-finalize/references/draft-pr.md` — draft PR 질문의 고유 선택과 결과만 남긴다.
- Modify `skills/explain-diff/SKILL.md` — quiz 응답을 한 번에 받는 예외를 공통 규칙과 구분한다.
- Modify `test/master-rules.test.js` — ACQ 정본과 workflow별 적용 참조를 단언한다.
- Modify `test/skill-bouncer-surface.test.js` — workflow 마지막 ACQ 절의 구조 계약을 유지한다.
- Modify `test/skill-bouncer-init.test.js` — init 선택지 의미와 순서를 단언한다.
- Modify `test/skill-bouncer-commit.test.js` — commit·next-task 질문의 단계별 의미를 단언한다.
- Modify `test/skill-bouncer-finalize.test.js` — list-wide consent와 finalize·PR·handoff 예외를 단언한다.
- Modify `test/skill-bouncer-run.test.js` — autonomy별 시작·경계 ACQ를 단언한다.
- Modify `test/skill-explain-diff.test.js` — quiz 단일 응답 예외를 단언한다.

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `scripts/` — CLI의 `--yes`, autonomy와 next-task 동작은 바꾸지 않는다.
- `CLAUDE.md` — workflow 순서와 controller 소유권은 축약하지 않는다.
- `docs/` — 사용자 문서 표현 정리는 별도 범위다.

## Constraints
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- 각 workflow의 `## ACQ (AskUserQuestion) gates`는 마지막 H2로 남는다.
- 질문 시점, skip 가능 여부, 선택 결과의 상태 변경은 해당 workflow 본문이 소유한다.
- host ACQ 도구가 없을 때도 선택지와 권장안이 바뀌지 않는다.
- `auto`가 건너뛰는 ACQ와 항상 필요한 consent를 섞지 않는다.

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] 계약 테스트를 먼저 바꿔 공통 표시 형식과 workflow별 질문 의미가 별도로 검증되게 한다.
- [ ] `node --test test/master-rules.test.js test/skill-bouncer-surface.test.js test/skill-bouncer-init.test.js test/skill-bouncer-commit.test.js test/skill-bouncer-finalize.test.js test/skill-bouncer-run.test.js test/skill-explain-diff.test.js`로 새 정본 부재 상태의 실패를 확인한다.
- [ ] `rules/acq.md`를 만들고 workflow·reference의 공통 템플릿을 참조로 바꾼다.
- [ ] `rg -n 'AskUserQuestion|AskQuestion|recommended|Recommended|ACQ' skills/bouncer-* skills/explain-diff rules`로 남은 전체 템플릿 중복과 필수 질문 누락을 확인한다.
- [ ] `npm run ci`가 통과한다.
