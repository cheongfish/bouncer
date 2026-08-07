---
type: bouncer.tasks
title: 발견 단계에 질문 체크리스트와 사전 읽기 의무, 계획 인계 계약을 명시함
description: Tasks for 004
resource: .bouncer/context/epics/004-starter-kit-convergence/blueprints/004-discovery-depth/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-04T09:46:18.557+09:00'
bouncer:
  id: TASKS-001
  epic_id: '004'
  blueprint_id: '004'
  status: verified
  affected_paths:
    - skills/discovery/SKILL.md
    - skills/bouncer-plan/SKILL.md
    - skills/review/SKILL.md
    - skills/review/reviewer-prompt.md
    - agents/bouncer-reviewer.md
    - scripts/src/lib/templates.ts
    - scripts/lib/templates.js
    - test/skill-discovery.test.js
    - test/skill-bouncer-plan.test.js
    - test/skill-review.test.js
  graph:
    generated_at: '2026-08-04T09:50:55+09:00'
    command: graphify query (graphify-out/source + graphify-out/context)
    suggested_paths:
      - skills/discovery
      - skills/bouncer-plan
      - skills/review
      - agents
      - scripts/src/lib
      - scripts/lib
      - test
    basis: graph-sync built context (source skip-fresh). Source queries "skill discovery" / "bouncer-plan skill" / "review rubric reviewer prompt" / "templates epic blueprint scaffold" hit skills 표면을 고정하는 test/skill-*.test.js, test/helpers/read-skill.js, 그리고 templates.ts와 커밋되는 emit templates.js. Context query "discovery depth blueprint epic starter kit convergence" 는 EPIC-004 / EPIC-005 review-depth 겹침을 드러냈다 (리뷰 루브릭은 EPIC-005 스트림과 접점). Context 그래프에 현재 브랜치에 없는 EPIC-010 경로가 남아 있어 겹침 판정은 파일 시스템으로 재확인했다.
---
# Tasks

Blueprint: [004](index.md)

## Goal & intent
`discovery`가 한 패스에서 목표·범위·비목표·성공 조건에 더해 **엣지 케이스·실패
모드**와 **기존 epic/blueprint·Distill과의 겹침**까지 묻고, 확인된 결과를 이름 붙인
산출로 `/bouncer-plan`에 넘긴다. plan 1단계가 그 이름들을 인용해 `spec-authoring`이
blueprint Contract의 「실패 모드·엣지 케이스」와 epic Out of scope를 빈칸으로 남기지
않게 한다. 겹침 판정의 단서인 epic `index.md` Blueprints 한 줄에 무엇을 실어야 하는지는
스캐폴드 템플릿 주석이 지시한다. 함께 리뷰 Code quality 루브릭이 「동작을 바꾸면서
테스트를 더하거나 고치지 않은 diff」를 후보로 받는다.

산출물은 에이전트가 읽는 지시문과 그것을 고정하는 테스트뿐이다. 게이트 코드,
`schema.ts`, `.bouncer/` 런타임 상태 파일은 이 작업에서 한 줄도 바뀌지 않는다.

수용 기준은 004 Success criteria **5번**과 **6번**이다. 검증 명령은 `npm test`.

## Interface
- 제공 (`skills/discovery/SKILL.md`):
  - Flow에 사전 읽기 단계가 생긴다 — 프레이밍 전에 `.bouncer/context/epics/` 인덱스와
    `.bouncer/context/Distill.md`를 읽는다.
  - 질문 체크리스트 절이 생긴다 — 엣지 케이스, 실패 모드, 명시적으로 하지 않을 것,
    기존 스트림/Distill과의 겹침.
  - Handoff 절이 생긴다 — 확인 단계가 내보내는 산출 이름을 고정한다:
    `Goal`, `Scope`, `Non-goals`, `Success criteria`,
    `Edge cases & failure modes`, `Overlap`.
- 제공 (`skills/bouncer-plan/SKILL.md` 1단계): 위 여섯 산출 이름을 인용하고,
  `Edge cases & failure modes`가 blueprint Contract의 「실패 모드·엣지 케이스」로,
  `Overlap`이 epic Out of scope 또는 기존 blueprint 재사용 판단으로 간다고 적는다.
- 제공 (`scripts/src/lib/templates.ts` epic 템플릿): `## Blueprints` 주석이 한 줄에
  **무엇을 바꾸는가 + 어디를 건드리는가**를 담으라고 지시한다.
- 제공 (리뷰 루브릭 3파일): Code quality에 「동작을 바꾸면서 테스트를 더하거나 고치지
  않은 diff」가 `minor`/`major` 후보로 들어간다.
- 거부:
  - `discovery`는 인덱스나 `Distill.md`가 **없어도 중단하지 않는다**. 없으면 겹침을
    「없음」으로 기록하고 진행한다 — 첫 사이클 프로젝트를 막으면 안 된다.
  - 리뷰의 새 항목은 **순수 문서·설정 변경에는 걸리지 않는다**. 동작이 바뀌지 않은
    diff에 테스트를 요구하지 않는다.
  - 새 게이트 코드·`schema.ts` 필드·런타임 상태 파일은 받아들이지 않는다. 이 계약을
    만족시키려 판정 로직을 추가하면 004 Success criteria 6번 위반이다.
  - discovery 산출을 새 파일로 영속화하지 않는다.

## Touch
- Modify `skills/discovery/SKILL.md` — 사전 읽기 단계, 질문 체크리스트 절, Handoff
  산출 계약을 본문에 추가한다.
- Modify `skills/bouncer-plan/SKILL.md` — 1단계가 discovery 산출 여섯 이름을 인용하고
  각 산출이 어느 문서 칸으로 가는지 적는다.
- Modify `skills/review/SKILL.md` — Code quality 루브릭에 테스트 없는 동작 변경 항목과
  순수 문서·설정 변경 예외를 추가한다.
- Modify `skills/review/reviewer-prompt.md` — 같은 항목을 디스패치되는 브리프에도 싣는다.
- Modify `agents/bouncer-reviewer.md` — 같은 항목을 명명 에이전트 루브릭에도 싣는다.
- Modify `scripts/src/lib/templates.ts` — epic 템플릿 `## Blueprints` 주석에 한 줄
  작성 기준을 넣는다.
- Modify `scripts/lib/templates.js` — 위 변경의 `tsc` emit. 손으로 고치지 말고
  `npm run build`(또는 `npm test`의 `pretest`)로 재생성한 결과를 커밋한다.
- Modify `test/skill-discovery.test.js` — 체크리스트·읽기 의무·Handoff 계약 어서션 추가.
- Modify `test/skill-bouncer-plan.test.js` — 1단계가 discovery 산출을 인용하는지 어서션 추가.
- Modify `test/skill-review.test.js` — 세 파일 모두 새 루브릭 항목을 싣는지 어서션 추가.

## Do not touch
- `scripts/src/lib/schema.ts` — 새 frontmatter 필드를 만들지 않는다.
- `scripts/src/lib/validate.ts` — 게이트 판정(G/S)은 이 blueprint의 대상이 아니다.
- `scripts/src/lib/scaffold.ts` — 스캐폴드 산출 파일 집합과 title 조립 규칙은 불변이다.
- `hooks/` — 런타임 강제를 추가하지 않는다.
- `docs/gates.md` — 새 게이트 코드가 없으므로 갱신할 것도 없다.
- `.bouncer/config.json` — 설정 스키마 불변.
- `skills/spec-authoring/SKILL.md` — 수신 측 표현은 plan 1단계 인용으로 충분하다.
  여기까지 넓히면 커밋 의도가 갈라진다.

## Constraints
- 게이트 코드·스키마·런타임 상태 파일 변경 0줄. `git diff` 결과가 이 조건을 어기면
  004 Success criteria 6번 위반이다.
- `scripts/lib/templates.js`는 생성물이다. `scripts/src/lib/templates.ts`를 고치고
  빌드해서 얻은 emit이어야 하며, 두 파일의 내용이 어긋난 채 커밋되면 안 된다.
- 리뷰 루브릭 항목은 `skills/review/SKILL.md`, `skills/review/reviewer-prompt.md`,
  `agents/bouncer-reviewer.md` 세 곳에 **함께** 들어간다. 한 곳이라도 빠지면 명명
  에이전트 경로와 폴백 경로의 판정이 갈린다.
- `discovery`의 frontmatter `description` 마지막 문장("Use only while working inside
  an active Bouncer blueprint, unless the user explicitly asks for this skill by
  name")은 유지한다. 본문의 읽기 의무를 이 예외와 모순되게 절대 조건으로 쓰지 않는다.
- 스킬 frontmatter `name`/`description` 필드 자체는 바꾸지 않는다 — 플러그인 매니페스트
  배선이 이 이름에 묶여 있다.
- 스킬 본문 산문은 영어, `.bouncer/context/` 문서 산문은 한국어라는 기존 관행을 유지한다.
- 기존 테스트의 어서션을 완화하거나 삭제하지 않는다. 추가만 한다.
- 기존 epic `index.md`의 Blueprints 줄을 소급해 다시 쓰지 않는다.

## Checklist
- [ ] `test/skill-discovery.test.js`에 실패 테스트 두 개를 먼저 추가한다.
  ```js
  test('discovery asks for edge cases, failure modes, and stream overlap', () => {
    const md = readSkill('discovery');
    assert.match(md, /edge case/i);
    assert.match(md, /failure mode/i);
    assert.match(md, /overlap/i);
    assert.match(md, /\.bouncer\/context\/epics/);
    assert.match(md, /Distill\.md/);
  });

  test('discovery names the handoff contract it passes to planning', () => {
    const md = readSkill('discovery');
    assert.match(md, /Handoff/i);
    assert.match(md, /Edge cases & failure modes/);
    assert.match(md, /Overlap/);
    // 인덱스나 Distill이 없어도 중단하지 않는다는 완화 경로가 본문에 있어야 한다.
    assert.match(md, /missing|absent|없으면|does not exist/i);
  });
  ```
- [ ] `node --test test/skill-discovery.test.js`로 두 테스트가 **실패**하는 것을 확인한다.
- [ ] `skills/discovery/SKILL.md`를 고쳐 통과시킨다 — Flow에 사전 읽기 단계,
      질문 체크리스트 절, `## Handoff` 절(위 여섯 산출 이름)을 추가하고, 인덱스/Distill
      부재 시 겹침을 「none」으로 기록하고 진행한다고 적는다.
- [ ] `test/skill-bouncer-plan.test.js`에 실패 테스트를 추가한다.
  ```js
  test('bouncer-plan step 1 cites the named discovery handoff outputs', () => {
    const { body } = parseFrontmatter(md);
    assert.match(body, /Edge cases & failure modes/);
    assert.match(body, /Overlap/);
    assert.match(body, /실패 모드|failure mode/i);
  });
  ```
- [ ] `node --test test/skill-bouncer-plan.test.js`로 실패를 확인한다.
- [ ] `skills/bouncer-plan/SKILL.md` 1단계를 고쳐 통과시킨다 — 여섯 산출 이름을 인용하고
      `Edge cases & failure modes` → blueprint Contract 「실패 모드·엣지 케이스」,
      `Overlap` → epic Out of scope 또는 기존 blueprint 재사용 판단이라고 적는다.
- [ ] `test/skill-review.test.js`에 실패 테스트를 추가한다.
  ```js
  test('review rubric flags behavior changes that ship without tests', () => {
    const md = readSkill('review');
    const agent = fs.readFileSync(
      path.join(root, 'agents', 'bouncer-reviewer.md'), 'utf8',
    );
    for (const doc of [md, reviewerPrompt, agent]) {
      assert.match(doc, /without (a )?test|테스트 없|untested/i);
      assert.match(doc, /minor|major/);
    }
    // 순수 문서·설정 변경은 대상이 아니다.
    assert.match(md, /docs-only|documentation-only|configuration-only|문서만/i);
  });
  ```
- [ ] `node --test test/skill-review.test.js`로 실패를 확인한다.
- [ ] `skills/review/SKILL.md`, `skills/review/reviewer-prompt.md`,
      `agents/bouncer-reviewer.md` Code quality 루브릭에 같은 항목과 예외를 추가해
      통과시킨다. 기본 심각도는 `minor`, 계약·공개 동작을 바꾼 경우 `major`.
- [ ] `scripts/src/lib/templates.ts`의 epic 템플릿 `## Blueprints` 주석에 한 줄 작성
      기준을 추가한다 — 무엇을 바꾸는가 + 어디를 건드리는가가 한 줄에 드러나야 다음
      discovery가 겹침을 판단할 수 있다는 취지. 목록 형식과 링크 구조는 그대로 둔다.
- [ ] `npm run build`로 `scripts/lib/templates.js`를 재생성하고, 손으로 고친 흔적 없이
      `.ts` 변경만 반영됐는지 `git diff scripts/lib/templates.js`로 확인한다.
- [ ] `npm test` 전체 통과를 확인한다.
- [ ] 게이트·스키마·상태 파일이 변경되지 않았음을 확인한다.
  ```bash
  git diff --name-only develop...HEAD -- \
    scripts/src/lib/schema.ts scripts/src/lib/validate.ts \
    scripts/src/lib/scaffold.ts hooks/ .bouncer/config.json
  ```
  출력이 비어 있어야 한다.
