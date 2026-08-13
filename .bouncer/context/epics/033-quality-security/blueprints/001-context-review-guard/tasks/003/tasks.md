---
type: bouncer.tasks
title: G18 plan 게이트로 context 리뷰 승격
description: Tasks for 003
resource: .bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-13T09:30:48.388+09:00'
bouncer:
  id: TASKS-003
  epic_id: '033'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - 계획 판정이 자문에 머물러 있어 어긋난 브리프도 plan 게이트를 통과했음
    - context-review.md의 status와 findings 형식을 G18로 승격해 승인을 막게 함
  affected_paths:
    - scripts/src/lib/validate.ts
    - scripts/lib/validate.js
    - test/validate-gates.test.js
    - test/cli-validate.test.js
    - test/cli-current.test.js
    - test/skill-bouncer-plan.test.js
    - docs/gates.md
    - skills/bouncer-plan/SKILL.md
  graph:
    generated_at: '2026-08-13T10:05:00+09:00'
    command: graphify query "context review document type scaffold schema validate plan gate G18 findings severity subagent named agent skill minimality ladder prompt injection trust boundary security docs" --graph graphify-out/{source,context}/graph.json
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - docs
      - skills
    basis:
      - graph: source
        status: reused
        query: context review document type scaffold schema validate plan gate G18 findings severity subagent named agent skill minimality ladder prompt injection trust boundary security docs
        result: 44 nodes; test/schema.test.js가 상위 히트지만 게이트 테스트는 잡히지 않음. validate 경로와 docs/gates.md는 기존 게이트 구조를 보고 손으로 더함
      - graph: context
        status: updated
        query: context review document type scaffold schema validate plan gate G18 findings severity subagent named agent skill minimality ladder prompt injection trust boundary security docs
        result: 8 nodes; epic 031 document-schema의 Success criteria와 explain 본문 — 같은 validate.ts 확장 선례. G18을 가리키는 히트는 없음
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`bouncer validate --gate plan`이 `context-review.md`를 판정 대상으로 삼는다.
문서가 없거나 status가 `accepted`가 아니거나 findings 형식이 어긋나면 **G18**로
막힌다. 게이트가 읽는 것은 status와 세 필드뿐이고 판정 문장 자체는 읽지 않으므로,
LLM 판단이 게이트가 되지 않고 결정적 코드가 게이트로 남는다(하드룰 4).
TASKS-002가 이 blueprint의 문서를 이미 만들어 뒀으므로, 이 커밋 직후
`bouncer current --set`이 자기 자신에서 막히지 않는다.

## Interface
- 제공:
  - plan 게이트에 **G18**. `contextReview` 슬롯은 TASKS-001이 이미 열어 뒀으므로
    이 task는 `docs.contextReview`를 읽어 판정만 한다. 실패 메시지는 사유별로
    갈린다.
    ```
    G18 context-review.md missing
    G18 context-review.status != accepted
    G18 context-review missing ## Findings body section
    G18 context-review finding <id> severity invalid: <value>
    G18 context-review finding <id> status invalid: <value>
    G18 context-review finding <id> accepted without note
    ```
  - findings 판정 규칙은 G14의 것과 같다 — `id`·`severity`·`status`가 있어야
    하고 `accepted`에는 비지 않은 `note`가 붙는다.
- 거부:
  - `scale: light`라는 이유의 면제. 조건 분기를 만들지 않는다.
  - execute / commit / finalize 게이트에 G18을 넣는 것. plan 전용이다.
  - `context_review.findings`가 배열이 아닌 값 — 빈 배열과 같게 취급하지 않고
    형식 위반으로 막는다.

## Touch
- Modify `scripts/src/lib/validate.ts` — plan 게이트 G18 판정과 G14 findings
  검사부의 공용 헬퍼 추출
- Modify `scripts/lib/validate.js` — 위 emit
- Modify `test/validate-gates.test.js` — G18 통과·실패 분기
- Modify `test/cli-validate.test.js` — CLI 출력에 G18 코드가 실림
- Modify `test/cli-current.test.js` — `writePlanPassingBlueprint`와
  `writeNumberedPlanBlueprint`가 accepted `context-review.md`를 쓰게 함.
  `current --set`이 plan 게이트를 타므로 G18 이후 이 픽스처가 같이 맞아야 한다
- Modify `docs/gates.md` — plan 행에 G18 추가
- Modify `skills/bouncer-plan/SKILL.md` — 마지막 단계의 게이트 코드 목록 갱신
- Modify `test/skill-bouncer-plan.test.js` — 그 목록을 보는 단언

## Do not touch
- `scripts/src/lib/scaffold.ts` — 문서 생성은 TASKS-001이 끝냈다.
- `skills/context-review/SKILL.md` · `agents/bouncer-context-reviewer.md` —
  판정 주체 계약은 TASKS-002가 확정했다.
- `scripts/src/lib/commit.ts` · `scripts/src/lib/finalize.ts` — G18은 plan 전용
  이므로 마감·커밋 경로는 바뀌지 않는다.
- `.bouncer/context/epics/` 아래 032까지의 기존 문서 — 소급 생성하지 않는다.

## Constraints
- findings 판정은 G14와 같은 규칙이므로 로직을 복제하지 말고 공용 헬퍼로 뽑아
  두 게이트가 같은 답을 내게 한다. 규칙이 갈라지면 두 리뷰 문서가 다른 계약을
  갖게 된다.
- 게이트는 finding의 본문 문장을 읽지 않는다. status와 세 필드, `## Findings`
  절의 존재까지다.
- 기존 게이트 코드 번호와 메시지 형식을 바꾸지 않는다. G18은 새 번호다.
- 문서가 없을 때의 메시지는 파일 경로를 함께 알려 `bouncer scaffold
  context-review`로 이어지게 한다.
- 비자명한 판단은 한국어 주석으로 남긴다 — 특히 `light` 면제를 두지 않은 이유.

## Checklist
- [ ] `test/validate-gates.test.js`에 실패 테스트를 먼저 추가하고 실패를
      확인한다. 최소 다섯 갈래다 — 문서 없음, status `pending`, `## Findings`
      절 없음, severity 값 오류, `accepted` finding에 `note` 없음. 정상 문서
      통과 1건도 함께 둔다.
- [ ] G14의 findings 검사부를 공용 헬퍼로 뽑고 G14와 G18이 모두 그것을 부르게
      한다. 기존 G14 메시지 문자열은 그대로 유지한다.
- [ ] plan 게이트에 G18을 넣는다. blueprint 단위 판정이므로 task 묶음 순회
      (G3–G5·G10–G12) 밖에 둔다.
- [ ] `test/cli-validate.test.js`에 G18이 CLI JSON 출력의 `failures`에 실리는지
      추가한다.
- [ ] `test/cli-current.test.js`의 plan 통과 픽스처 두 헬퍼가 accepted
      `context-review.md`(`findings: []`, `## Findings`)를 쓴다.
- [ ] `docs/gates.md` plan 행과 `skills/bouncer-plan/SKILL.md` 게이트 목록을
      갱신하고, `test/skill-bouncer-plan.test.js`가 G18을 보게 한다.
- [ ] `npm test`가 통과한다.
- [ ] `node scripts/bouncer validate --blueprint
      .bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard
      --gate plan`이 통과한다.
