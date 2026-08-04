---
type: bouncer.tasks
title: discovery에 질문 체크리스트와 선행 Read·핸드오프 계약을 추가함
description: discovery 스킬 보강과 plan 진입 문구, epic 템플릿 안내
resource: .bouncer/context/epics/EPIC-004-starter-kit-convergence/blueprints/BP-004-discovery-depth/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-04T08:34:43.498+09:00'
bouncer:
  id: TASKS-BP-004
  epic_id: EPIC-004
  blueprint_id: BP-004
  status: ready
  affected_paths:
    - skills/discovery/SKILL.md
    - skills/bouncer-plan/SKILL.md
    - scripts/src/lib/templates.ts
    - scripts/lib/templates.js
    - test/skill-discovery.test.js
  graph:
    generated_at: '2026-08-04T08:41:25+09:00'
    command: graphify query (source + context)
    suggested_paths:
      - skills/discovery
      - skills/bouncer-plan
      - scripts/src/lib
      - scripts/lib
      - test
    basis: >-
      graph-sync는 source를 skip-fresh, context를 재빌드했다. source 질의
      "discovery skill questions prior art handoff plan epic index template"은
      test/skill-bouncer-surface.test.js·test/init.test.js·
      test/session-graph.test.js 세 노드만 돌려줬다 — config.source_dirs가
      scripts/hooks/test라 skills/ 자체가 색인되지 않아 그래프로는 스킬 본문
      경로를 찾을 수 없고, 스킬을 문자열로 검사하는 테스트만 잡힌다. 그래서
      skills/discovery·skills/bouncer-plan은 수동으로 보탰다. context 질의
      "discovery skill depth questions handoff epic index duplication"은
      EPIC-005/008/009 index.md의 Intent·Blueprints·Success criteria 골격을
      돌려줬고, 이는 겹치는 스트림이 없다는 확인일 뿐 이번 변경의 경로는
      아니다. scripts/src/lib·scripts/lib은 epic 템플릿 문구가 templates.ts에
      있고 그 빌드 산출물을 함께 커밋해야 해서 넣었다.
---
# Tasks

Blueprint: [BP-004](index.md)

## Goal & intent
`discovery` 스킬을 읽은 에이전트가 여섯 단계를 훑는 대신, 각 단계에서 무엇을 물어야
하는지와 착수 전에 무엇을 읽어야 하는지를 안다. 확인된 framing이 `/bouncer-plan`의
`spec-authoring`으로 넘어갈 때 실려야 할 항목이 출력 계약으로 적혀 있다. epic 템플릿의
Blueprints 안내는 "한 줄만 보고 겹치는지 판단할 수 있게" 쓰라고 말한다. 코드 경로·게이트
판정·문서 스키마는 바뀌지 않는다. 검증은 `npm test`.

## Interface
- 제공: `skills/discovery/SKILL.md`에 세 가지가 추가된다.
  1. **Prior art** — Flow의 Request 다음, Goal 이전에 오는 선행 Read 단계.
     `.bouncer/context/Distill.md`와 `.bouncer/context/epics/*/index.md`의 Blueprints
     목록을 읽고, 겹치는 스트림이 있으면 framing에 명시한다.
  2. **질문 체크리스트** — Scope / Non-goals / Success criteria 단계에서 최소한
     엣지 케이스, 실패 모드, "하지 않을 것", 기존 스트림과의 겹침을 한 패스에서 묻는다.
  3. **Handoff** — Confirmation 이후 다음 단계로 넘기는 산출 목록: 목표, 범위,
     비목표, 번호 붙은 성공 조건, 기존 스트림과의 관계. 다섯 항목 전부가 실려야 한다.
- 제공: `skills/bouncer-plan/SKILL.md` 1단계가 discovery의 선행 Read와 핸드오프 산출을
  전제로 인용한다. 새 단계 번호를 추가하지 않고 기존 1단계 문장만 보강한다.
- 제공: `scripts/src/lib/templates.ts`의 `epic.md` 템플릿 Blueprints 주석이 목록 한 줄의
  목적 설명을 "한 줄만 보고 이 스트림과 겹치는지 판단할 수 있게" 쓰라고 안내한다.
- 거부: 파일을 만들지 않는다. discovery는 계속 산출물 파일을 쓰지 않으며, 선행 Read
  결과가 비어 있어도(에픽이 없거나 Distill이 갓 만들어졌어도) 흐름이 막히지 않는다.
- 거부: 게이트 코드·`bouncer.*` 필드·`.bouncer/` 런타임 상태를 늘리지 않는다.
  discovery 미확인은 여전히 게이트 실패가 아니다.

## Touch
- Modify `skills/discovery/SKILL.md` — Prior art 단계, 단계별 질문 체크리스트,
  Handoff 출력 계약 추가.
- Modify `skills/bouncer-plan/SKILL.md` — 1단계 문장이 discovery 선행 Read와 핸드오프
  다섯 항목을 전제로 인용하도록 보강.
- Modify `scripts/src/lib/templates.ts` — `epic.md` 템플릿의 Blueprints 안내 주석 문구.
- Modify `scripts/lib/templates.js` — 위 소스의 빌드 산출물. `npm run build`
  (`pretest`)로 재생성해 커밋한다. 손으로 편집하지 않는다.
- Modify `test/skill-discovery.test.js` — 새 문구를 검사하는 표면 테스트 추가.

## Do not touch
- `skills/review/SKILL.md` — 리뷰 루브릭은 `reviewer-prompt.md`·`agents/`와 한 커밋
  단위다. 별도 blueprint에서 다룬다.
- `skills/review/reviewer-prompt.md` — 같은 이유.
- `agents/bouncer-reviewer.md` — 같은 이유.
- `scripts/src/lib/validate.ts` — 게이트 판정은 이 변경의 범위 밖이다.
- `scripts/src/lib/schema.ts` — 새 문서 필드를 만들지 않는다.
- `.bouncer/context/epics/EPIC-004-starter-kit-convergence/blueprints/BP-002-init-rules-scaffold`
  — BP-002 상태 정리는 별개 결정이다.

## Constraints
- 스킬은 안내다. 어떤 문장도 새 게이트 코드나 새 필수 산출물을 만들지 않는다.
- 선행 Read는 의무이되 결과의 공백은 정상이다. "에픽이 없으면 멈춘다"로 읽히는 문구를
  쓰지 않는다.
- `discovery`는 범용 스킬이므로 본문은 기존과 같이 **영어**로 쓴다.
  `skills/bouncer-plan/SKILL.md`도 현행 언어를 유지한다.
- 스킬 frontmatter의 `name`은 바꾸지 않는다. `description`에 따옴표 없는 `##`을 쓰지
  않는다 (YAML 주석으로 잘린다).
- 기존 Flow 단계의 이름과 순서를 바꾸지 않는다. Prior art는 삽입이고 재배열이 아니다.
- `scripts/lib/*.js`는 `npm run build` 산출물이다. 소스는 항상 `scripts/src/**`.
- 새 파일·새 디렉터리·새 의존성을 추가하지 않는다.

## Checklist
- [ ] `test/skill-discovery.test.js`에 실패 테스트를 먼저 추가하고 `npm test`로
      **예상된 이유로** 실패하는지 확인한다.
      ```js
      test('discovery reads prior art and defines a handoff contract', () => {
        const md = readSkill('discovery');
        assert.match(md, /\.bouncer\/context\/Distill\.md/);
        assert.match(md, /\.bouncer\/context\/epics/);
        assert.match(md, /edge case/i);
        assert.match(md, /failure mode/i);
        assert.match(md, /handoff/i);
      });
      ```
- [ ] `skills/discovery/SKILL.md`의 `## Flow`에 Request 다음 단계로 **Prior art**를
      삽입하고, 이후 단계 번호를 다시 매긴다. 본문에 읽을 대상 두 경로를 그대로 적는다.
- [ ] 같은 파일의 Scope / Non-goals / Success criteria 단계에 질문 체크리스트를 붙인다 —
      엣지 케이스, 실패 모드, 하지 않을 것, 기존 스트림과의 겹침.
- [ ] 같은 파일에 `## Handoff` 섹션을 추가한다. 다음 단계로 넘기는 다섯 항목(목표,
      범위, 비목표, 번호 붙은 성공 조건, 기존 스트림과의 관계)을 목록으로 적고, 그 중
      하나라도 비면 Confirmation을 다시 돌라고 적는다.
- [ ] `skills/bouncer-plan/SKILL.md` 1단계 문장을 보강한다 — discovery가 선행 Read와
      다섯 항목 핸드오프를 마친 상태를 전제로 하고, 성공 조건이 4단계 epic 본문의
      번호 목록이 된다는 기존 문장과 이어지게 한다. 단계 번호는 그대로 1~9다.
- [ ] `scripts/src/lib/templates.ts`의 `epic.md` Blueprints 주석에 한 줄 목적 설명
      기준을 넣는다 — 목록 한 줄만 읽고 새 요청이 이 스트림과 겹치는지 판단할 수 있을 것.
- [ ] `npm test`가 통과할 때까지 마무리한다 (`pretest`가 `scripts/lib/templates.js`를
      재생성하므로 산출물 diff가 함께 남는지 확인한다).
- [ ] `test/init.test.js`의 `## Success criteria` 검사와 `test/scaffold.test.js`가
      템플릿 문구 변경으로 깨지지 않는지 확인한다. 깨지면 문구를 고치지 말고 왜 그
      테스트가 본문에 결합돼 있는지 리뷰에 남긴다.
