---
type: bouncer.tasks
title: light 전용 scaffold와 plan gate 도입
description: 명시적 light 경로의 문서 세트와 필수 절을 줄이되 승인 범위와 실행 게이트는 유지한다
resource: .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/002-light-plan-contract/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-21T20:32:39.595+09:00'
bouncer:
  id: TASKS-001
  epic_id: '043'
  blueprint_id: '002'
  status: verified
  commit_intent:
    - light 선언도 full과 같은 계획 문서와 판정을 요구해 340줄의 고정비가 들었음
    - 명시적 light scaffold와 축약 plan gate로 핵심 승인·증적 계약만 유지함
  verify: npm run ci
  affected_paths:
    - scripts/src/lib/cli-doc-commands.ts
    - scripts/src/lib/scaffold.ts
    - scripts/src/lib/templates.ts
    - scripts/src/lib/validate-gates.ts
    - scripts/lib/cli-doc-commands.js
    - scripts/lib/scaffold.js
    - scripts/lib/templates.js
    - scripts/lib/validate-gates.js
    - skills/bouncer-plan/SKILL.md
    - skills/spec-authoring/SKILL.md
    - skills/context-review/SKILL.md
    - rules/governance.md
    - docs/compatibility.md
    - docs/cli.md
    - docs/gates.md
    - docs/workflow.md
    - docs/ARCHITECTURE.md
    - docs/troubleshooting.md
    - docs/benchmark/protocol.md
    - test/scaffold.test.js
    - test/validate-gates.test.js
    - test/lightweight-cycle.test.js
    - test/skill-bouncer-plan.test.js
    - test/skill-context-review.test.js
    - test/cli-help.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-21T20:41:35.000+09:00'
    suggested_paths:
      - test
      - .bouncer/context/epics/024-light-path
      - .bouncer/context/epics/017-verify-wrapper-guidance
      - .bouncer/context/epics/041-plan-mermaid-zoom
    basis:
      - graph: source
        status: reused
        query: scale light scaffold blueprint compact templates plan gate G10 G18 workflow compatibility
        result: '3 hits; G10 and G18 fixtures in test/validate-gates.test.js and compatibility fixture'
      - graph: context
        status: updated
        query: scale light scaffold blueprint compact templates plan gate G10 G18 workflow compatibility
        result: '3 hits; epics 024 light-path, 017 verify guidance, 041 plan authoring'
---
# Tasks

Blueprint: [002](../../index.md)

## Goal & intent
`bouncer scaffold blueprint --scale light`가 100줄 이하의 plan 단계 문서 세트를 만들고, plan gate가 light의 축약 계약을 판정하게 한다. full scaffold와 execute·commit·finalize 게이트는 기존 계약을 유지한다.

## Interface
- 제공: 선택 인자 `--scale light | full`; light는 blueprint index와 축약 tasks/verification/review를 만들고 context-review를 생략한다. G10은 light에서 Goal & intent·Touch·Checklist만 요구하고 G18은 적용하지 않는다.
- 거부: 알려지지 않은 scale은 첫 파일 쓰기 전에 exit 2다. `--scale` 생략/`full`은 기존 다섯 plan 문서와 Interface·Do not touch·G18을 그대로 요구한다. light도 비어 있는 `affected_paths`, scope evidence, Touch 근거는 통과하지 못한다.

## Touch
- Modify `scripts/src/lib/cli-doc-commands.ts` — blueprint scaffold의 `--scale`을 검증·전달한다.
- Modify `scripts/src/lib/scaffold.ts` — scale별 문서 세트와 축약 task 생성을 선택한다.
- Modify `scripts/src/lib/templates.ts` — light blueprint/task/review/verification 본문을 추가한다.
- Modify `scripts/src/lib/validate-gates.ts` — light에만 G18 면제와 축약 G10 필수 절을 적용한다.
- Modify `scripts/lib/cli-doc-commands.js` — CLI TypeScript 변경을 emit한다.
- Modify `scripts/lib/scaffold.js` — scaffold TypeScript 변경을 emit한다.
- Modify `scripts/lib/templates.js` — template TypeScript 변경을 emit한다.
- Modify `scripts/lib/validate-gates.js` — gate TypeScript 변경을 emit한다.
- Modify `skills/bouncer-plan/SKILL.md` — light scaffold·작성·context review 분기와 gate 계약을 설명한다.
- Modify `skills/spec-authoring/SKILL.md` — light task의 세 필수 절과 축약 작성 규칙을 설명한다.
- Modify `skills/context-review/SKILL.md` — light에는 context-review 문서·판정이 없고 full rubric만 소유함을 적는다.
- Modify `rules/governance.md` — light에서 줄어드는 문서·G10·G18과 유지되는 실행 게이트를 정본화한다.
- Modify `docs/compatibility.md` — 호환성 파기 이유·영향·full 대체 경로를 기록한다.
- Modify `docs/cli.md` — `scaffold blueprint --scale` 표면을 기록한다.
- Modify `docs/gates.md` — light G10·G18 분기와 유지 게이트를 기록한다.
- Modify `docs/workflow.md` — plan light 흐름과 full 복귀 절차를 기록한다.
- Modify `docs/ARCHITECTURE.md` — context-reviewer가 full plan의 판정자라는 경계를 명시한다.
- Modify `docs/troubleshooting.md` — G10 누락 절 안내를 full 다섯 절과 light 세 절로 나눈다.
- Modify `docs/benchmark/protocol.md` — 3회차 light on arm이 축약 plan 계약을 따르도록 프로토콜을 갱신한다.
- Modify `test/scaffold.test.js` — full 불변, light 문서 목록·100줄 상한·잘못된 scale을 단언한다.
- Modify `test/validate-gates.test.js` — light/full G10·G18 분기와 G4·G5·G11·G12 불변을 단언한다.
- Modify `test/lightweight-cycle.test.js` — 경량 사이클의 새 문서·게이트 계약을 단언한다.
- Modify `test/skill-bouncer-plan.test.js` — plan 스킬의 light scaffold·review 분기를 단언한다.
- Modify `test/skill-context-review.test.js` — context-review가 full 전용임을 단언한다.
- Modify `test/cli-help.test.js` — scaffold blueprint help에 `--scale light|full`을 단언한다.

## Do not touch
- `scripts/src/lib/validate-structural.ts` — `SCALE_ENUM`, S20, 문서 스키마는 유지한다.
- `scripts/src/lib/verification.ts` — G13 원장과 verify 실행은 유지한다.
- `scripts/src/lib/commit.ts` — commit scope는 유지한다.
- `skills/bouncer-execute/` — 기존 `scale: light` inline 실행 계약을 바꾸지 않는다.
- `skills/explain-diff/` — 1문항 계약을 바꾸지 않는다.
- `.bouncer/config.json` — 새 설정·자동 판정을 넣지 않는다.

## Constraints
- `scale: light`는 사용자 선언과 CLI flag로만 발동한다. 경로 수·diff 크기로 추론하지 않는다.
- full의 생성 파일, 템플릿 본문, G10, G18 테스트는 바이트·동작 수준에서 유지한다.
- light는 tasks·verification·review, G3~G5·G11·G12, G6~G8·G13·G14·G16·G17을 유지한다.
- 계획 단계 100줄은 고정 timestamp로 scaffold한 blueprint 디렉터리의 `index.md`와 `tasks/001/{tasks,verification,review}.md` 전체 줄 수 합계다.
- 기존 helper·`SCALE_ENUM`·template renderer를 재사용하고 새 의존성이나 별도 모드 설정을 만들지 않는다.

## Checklist
- [ ] full scaffold의 파일 목록·본문·G10·G18이 기존과 같다는 회귀 테스트를 먼저 고정한다.
- [ ] `--scale light`, `--scale full`, 생략, 알 수 없는 값의 실패 테스트를 추가한다.
- [ ] light가 네 문서만 만들고 전체 줄 수 합계가 `<= 100`이며 context-review가 없음을 단언한다.
- [ ] light task에서 Goal & intent·Touch·Checklist 중 하나가 비면 G10, Interface·Do not touch가 없으면 통과함을 단언한다.
- [ ] light에서도 G4·G5·G11·G12가 full과 같은 실패를 내고 full의 G18 면제가 없음을 단언한다.
- [ ] CLI·scaffold·template·gate를 구현하고 `npm run build`로 네 CJS 산출물을 갱신한다.
- [ ] plan/spec-authoring/context-review 스킬과 governance·compatibility·CLI·gate·workflow·architecture·troubleshooting·benchmark 문서를 같은 계약으로 갱신한다.
- [ ] `npm run ci`가 통과한다.
