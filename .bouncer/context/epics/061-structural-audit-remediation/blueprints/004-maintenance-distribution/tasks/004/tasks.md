---
type: bouncer.tasks
title: 자가 해석 CLI 런처로 부트스트랩 통합
description: Moves plugin-root resolution into the bouncer launcher and removes repeated workflow bootstrap blocks.
resource: .bouncer/context/epics/061-structural-audit-remediation/blueprints/004-maintenance-distribution/tasks/004/tasks.md
tags:
  - bouncer
  - tasks
  - launcher
  - plugin-root
timestamp: '2026-09-03T16:13:56.287+09:00'
bouncer:
  id: TASKS-004
  epic_id: '061'
  blueprint_id: '004'
  status: verified
  commit_intent: |-
    workflow마다 반복되는 plugin-root 부트스트랩을 런처 하나로 통합함
    최고 우선순위 설치본 선택과 기존 CLI 인자·종료 코드를 유지함
  verify: npm test
  affected_paths:
    - scripts/bouncer
    - scripts/bouncer-root
    - test/cursor-plugin.test.js
    - test/plugin-root.test.js
    - skills/bouncer-init/SKILL.md
    - skills/bouncer-plan/SKILL.md
    - skills/bouncer-execute/SKILL.md
    - skills/bouncer-commit/SKILL.md
    - skills/bouncer-finalize/SKILL.md
    - skills/bouncer-run/SKILL.md
    - skills/migrate-ids/SKILL.md
    - references/explain-diff/index.md
    - references/graphify-runner/index.md
    - references/review/index.md
    - skills/bouncer-finalize/references/cleanup-handoff.md
    - skills/bouncer-finalize/references/distill-promotion.md
    - skills/bouncer-finalize/references/explain-quiz.md
    - test/master-rules.test.js
    - test/skill-bouncer-init.test.js
    - test/skill-bouncer-plan.test.js
    - test/skill-bouncer-execute.test.js
    - test/skill-bouncer-finalize.test.js
    - test/skill-bouncer-surface.test.js
    - test/skill-bouncer-commit.test.js
    - test/skill-bouncer-run.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-09-03T16:17:10.000+09:00'
    suggested_paths: []
    basis:
      - graph: source
        status: reused
        query: bouncer launcher plugin root workflow bootstrap
        result: source graph was fresh; launcher entrypoint is outside its configured directories
      - graph: test
        status: reused
        query: bouncer launcher plugin root workflow bootstrap
        result: test graph returned only low-confidence test-only candidates
      - graph: context
        status: updated
        query: bouncer launcher plugin root workflow bootstrap
        result: context graph returned ownership matches without a functional source link
    quality:
      status: low-confidence
      confidence: low
      reasons:
        - launcher entrypoint is outside the configured source graph
        - graph result contains only test-only or ownership candidates
    candidates:
      implementation: []
      test:
        - path: test/cursor-plugin.test.js
          score: -12
          confidence: low
          basis:
            - generic name match for root
            - test-only without implementation link
      context: []
---
# 자가 해석 CLI 런처로 부트스트랩 통합

Blueprint: [004](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | test | context
     status: updated | reused | fail-skip | skip-disabled | missing
     quality/candidates는 graph-suggest 결과로만 채운다(scaffold는 비워 둔다).
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
<!-- 구현자가 다른 문서 없이 시작할 수 있게.
     수용 기준과 검증 명령도 여기에 적거나 Checklist에 명시한다. -->
`scripts/bouncer`가 `bouncer-root --auto`와 같은 우선순위 규칙으로 대상 설치본을 한 번 해석한 뒤 그 CLI를 실행한다. workflow 문서와 CLI를 호출하는 보조 reference의 독립 셸 블록은 `BOUNCER_ROOT` bootstrap 대신 `bouncer <args>`를 사용한다. 단, `cleanup-handoff.md`의 `runtime-state.worktreePathFor` 내부 API 호출은 새 CLI를 만들지 않고 `bouncer-root --auto`를 일회성 모듈 경로 해석으로만 사용한다.

## Interface
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공: 설치본 우선순위를 보존하는 자가 재실행 런처, 간결한 workflow CLI 호출 표면, 그리고 기존 `worktreePathFor` cleanup helper를 위한 일회성 모듈 경로 해석.
- 거부: 자기 자신을 재실행하는 무한 루프, `bouncer-root` 명령의 의미 변경, 인자·종료 코드 손실.

## Touch
<!-- frontmatter bouncer.affected_paths의 모든 경로가 여기서 정당화되어야 합니다 (G11).
     디렉터리가 아니라 파일 단위로, 동사(Create/Modify/Delete/Rename)를 붙입니다.
     디렉터리 하나로 뭉치면 그 안 모든 파일이 열려 G11이 사실상 통과만 합니다.
     경로는 백틱으로 감쌉니다. -->
- Modify `scripts/bouncer` — 최고 우선순위 설치본을 해석하고 현재 설치본이 아닐 때만 재실행한다.
- Modify `scripts/bouncer-root` — 런처와 공유할 설치본 우선순위 해석 표면을 유지하거나 최소 공통화한다.
- Modify `test/cursor-plugin.test.js` — workflow·보조 reference의 CLI 블록이 직접 `bouncer`를 호출하는지 검증한다.
- Modify `test/plugin-root.test.js` — 런처의 우선순위 선택, 재실행 방지, 인자·종료 코드 계약을 검증한다.
- Modify `skills/bouncer-init/SKILL.md` — CLI 예시를 직접 런처 호출로 바꾼다.
- Modify `skills/bouncer-plan/SKILL.md` — CLI 예시를 직접 런처 호출로 바꾼다.
- Modify `skills/bouncer-execute/SKILL.md` — CLI 예시를 직접 런처 호출로 바꾼다.
- Modify `skills/bouncer-commit/SKILL.md` — CLI 예시를 직접 런처 호출로 바꾼다.
- Modify `skills/bouncer-finalize/SKILL.md` — CLI 예시를 직접 런처 호출로 바꾼다.
- Modify `skills/bouncer-run/SKILL.md` — CLI 예시를 직접 런처 호출로 바꾼다.
- Modify `skills/migrate-ids/SKILL.md` — migration workflow CLI 예시를 직접 런처 호출로 바꾼다.
- Modify `references/explain-diff/index.md` — 보조 workflow CLI 예시를 직접 런처 호출로 바꾼다.
- Modify `references/graphify-runner/index.md` — graph CLI 예시를 직접 런처 호출로 바꾼다.
- Modify `references/review/index.md` — review 보조 절차의 CLI 예시를 직접 런처 호출로 바꾼다.
- Modify `skills/bouncer-finalize/references/cleanup-handoff.md` — 중첩 cleanup 절차의 CLI bootstrap은 제거하되 기존 `runtime-state.worktreePathFor` API 호출은 일회성 모듈 경로 해석으로 보존한다.
- Modify `skills/bouncer-finalize/references/distill-promotion.md` — 중첩 Distill 승격 절차의 CLI 예시를 직접 런처 호출로 바꾼다.
- Modify `skills/bouncer-finalize/references/explain-quiz.md` — 중첩 explain 절차의 CLI 예시를 직접 런처 호출로 바꾼다.
- Modify `test/master-rules.test.js` — workflow·reference 런처 계약 목록과 독립 호출 단언을 새 표면에 맞춘다.
- Modify `test/skill-bouncer-init.test.js` — init skill의 직접 런처 호출 단언을 갱신한다.
- Modify `test/skill-bouncer-plan.test.js` — plan skill의 CLI 호출 단언을 갱신한다.
- Modify `test/skill-bouncer-execute.test.js` — execute skill의 CLI 호출 단언을 갱신한다.
- Modify `test/skill-bouncer-finalize.test.js` — finalize skill의 CLI 호출 단언을 갱신한다.
- Modify `test/skill-bouncer-surface.test.js` — 전체 공개 workflow surface의 CLI 호출 단언을 갱신한다.
- Modify `test/skill-bouncer-commit.test.js` — commit skill의 CLI 호출 단언을 갱신한다.
- Modify `test/skill-bouncer-run.test.js` — run skill의 CLI 호출 단언을 갱신한다.

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `scripts/lib/**` — 런처 통합은 CLI 구현·명령 의미를 바꾸지 않는다.
- `rules/plugin-root.md` — 설치본 선택 계약은 보존하며 이번 task에서 별도 규칙 개편을 하지 않는다.

## Constraints
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- 독립 셸은 계속 최고 우선순위 설치본을 선택해야 하며, 현재 설치본이면 재실행하지 않는다.
- `bouncer-root --auto`는 호환성을 위해 유지하고, `bouncer`의 전달 인자·표준 입출력·종료 코드는 보존한다.
- 새 런타임 의존성이나 셸 문자열 실행을 추가하지 않는다.
- `cleanup-handoff.md`에서는 `BOUNCER_ROOT` 환경변수와 bootstrap 대입을 만들지 않으며, `bouncer-root --auto`는 `runtime-state` 모듈 경로를 얻는 한 번의 command substitution으로만 사용한다.

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] 다른 설치본이 선택되는 경우와 현재 설치본이 선택되는 경우의 실패·성공 테스트를 먼저 작성한다.
- [ ] 재실행 루프 없이 인자·표준 입출력·종료 코드를 전달하는 최소 런처를 구현한다.
- [ ] 모든 workflow·CLI 보조 reference의 `BOUNCER_ROOT` bootstrap 예시를 직접 `bouncer` 호출로 치환한다. 여기에는 `skills/bouncer-finalize/references/`의 중첩 reference 세 파일이 포함되며, `cleanup-handoff.md`는 기존 `worktreePathFor` 모듈 호출만 일회성 경로 해석으로 보존한다.
- [ ] master rule 및 skill surface/init/plan/execute/commit/finalize/run 테스트의 런처 계약 단언을 새 직접 호출 표면에 맞춰 갱신한다.
- [ ] 남은 bootstrap 문자열과 이전 `scripts/bouncer` 계약 단언이 의도한 예외 외에 남아 있지 않은지 검색하고 `npm test`를 실행한다.
