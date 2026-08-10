---
type: bouncer.tasks
title: 좁은 범위 작업의 경량 사이클 지침 신설
description: governance에 경량 사이클을 정의하고 plan·execute·explain-diff가 그 정의를 참조하게 배선
resource: .bouncer/context/epics/024-lightweight-cycle/blueprints/001-lightweight-cycle-guidance/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-10T16:57:46.734+09:00'
bouncer:
  id: TASKS-001
  epic_id: '024'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - 좁은 수정에도 새 epic과 네임드 에이전트 왕복을 기본값으로 두어 루프 밖으로 새는 작업이 있었음
    - 게이트와 문서 종류는 그대로 두고 경량 선언 시 준비 비용만 줄이려 함
  affected_paths:
    - docs/governance.md
    - skills/bouncer-plan/SKILL.md
    - skills/bouncer-execute/SKILL.md
    - skills/explain-diff/SKILL.md
    - test/lightweight-cycle.test.js
  graph:
    generated_at: '2026-08-10T17:06:53+09:00'
    command: graphify query (source + context)
    suggested_paths:
      - docs
      - skills/bouncer-plan
      - skills/bouncer-execute
      - skills/explain-diff
      - test
    basis:
      - graph: source
        status: reused
        query: >-
          lightweight cycle guidance for narrow scope work: governance doc,
          bouncer-plan epic id allocation, bouncer-execute inline implementer
          reviewer dispatch fallback, explain-diff quiz question count, skill
          contract test
        result: >-
          skill/hook 계약 테스트 쪽으로만 히트 —
          test/skill-bouncer-surface.test.js, test/session-graph.test.js.
          source_dirs가 scripts/hooks/test라 skills/ 와 docs/ 는 그래프에
          없으므로 네 스킬·문서 디렉터리를 수동으로 더했다.
      - graph: context
        status: updated
        query: 경량 사이클 운용 지침 공용 maintenance epic 인라인 디스패치 퀴즈 문항 수 축소
        result: >-
          18노드 — EPIC-012/013/014 index.md의 Intent·Success criteria·Out of
          scope 절. 마이그레이션 전 경로 이름으로 남아 있고 이번 범위와 겹치는
          파일은 없어 suggested_paths에 반영하지 않았다.
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
<!-- 구현자가 다른 문서 없이 시작할 수 있게.
     수용 기준과 검증 명령도 여기에 적거나 Checklist에 명시한다. -->
`docs/governance.md`에 「Lightweight cycle」 절이 생기고, `/bouncer-plan`,
`/bouncer-execute`, `explain-diff` 세 스킬이 각자의 단계에서 그 절을 참조한다.
사용자가 좁은 범위를 선언한 사이클에서는 새 epic을 만들지 않고 공용 유지보수
epic에 blueprint를 쌓으며, 구현·리뷰를 인라인으로 돌리고, 퀴즈를 1문항으로
줄인다. 문서 종류와 게이트 판정은 하나도 바뀌지 않는다.

경량 여부는 사용자가 이번 세션에서 선언했는지로만 정해진다. 프론트매터 필드,
config 키, CLI 플래그, 게이트 분기 중 어느 것도 새로 만들지 않는다.

검증 명령은 `npm test`다.

## Interface
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공:
  - `docs/governance.md` `## Lightweight cycle` — 발동 조건(사용자 선언),
    줄어드는 셋(새 epic 신설 / 네임드 에이전트 왕복 / 퀴즈 문항 수), 그대로인
    것(task·verification·review·explain 문서, G1~G16, Distill 승격), 인라인
    리뷰가 자기 diff를 자기가 판정한다는 한계.
  - `skills/bouncer-plan/SKILL.md` step 2 — 경량 선언 시 새 epic id를 뽑지 않고
    공용 유지보수 epic 아래 blueprint만 스캐폴드한다. 그 epic이 없으면 일반
    순번으로 한 번 만든다.
  - `skills/bouncer-execute/SKILL.md` step 3·5 — 인라인 실행 허용 조건이
    「네임드 에이전트 미지원」에 「경량 선언」을 더한 둘이 된다. 기존 폴백 문구는
    지운 자리 없이 남는다.
  - `skills/explain-diff/SKILL.md` step 3 — 문항 수 판단에 경량 사이클이면 1을
    고른다는 근거가 붙는다.
  - `test/lightweight-cycle.test.js` — 위 네 파일의 계약을 문자열 단언으로 고정.
- 거부:
  - 경량 여부를 diff 크기·경로 수·파일 수로 자동 판정하는 규칙. 어느 문서에도
    쓰지 않는다.
  - 경량 사이클에서 게이트를 건너뛰거나 문서를 만들지 않는 예외. G6~G8·G13~G16
    문구는 그대로다.
  - `bouncer.lightweight` 같은 신규 프론트매터 필드, `config.json` 신규 키,
    `bouncer` CLI 신규 플래그.
  - 기존 「named agents are unavailable」 폴백 문구의 삭제·치환. 경량 조건은
    그 옆에 더해지는 것이지 대체가 아니다.

## Touch
<!-- frontmatter bouncer.affected_paths의 모든 경로가 여기서 정당화되어야 합니다 (G11).
     디렉터리가 아니라 파일 단위로, 동사(Create/Modify/Delete/Rename)를 붙입니다.
     디렉터리 하나로 뭉치면 그 안 모든 파일이 열려 G11이 사실상 통과만 합니다.
     경로는 백틱으로 감쌉니다. -->
- Modify `docs/governance.md` — `## Lightweight cycle` 절을 추가한다. 기존
  「Blueprint sizing rule」 본문은 그대로 둔다.
- Modify `skills/bouncer-plan/SKILL.md` — step 2(ID allocation)에 경량 선언
  분기와 `docs/governance.md` 링크를 넣는다.
- Modify `skills/bouncer-execute/SKILL.md` — step 3의 implementer 폴백 항목과
  step 5의 reviewer 디스패치 항목에 경량 선언 조건을 더하고, 그 경로에서도
  G8·G14 판정이 같다는 문장을 넣는다.
- Modify `skills/explain-diff/SKILL.md` — step 3의 문항 수 판단 항목에 경량
  사이클 근거를 더한다.
- Create `test/lightweight-cycle.test.js` — 네 파일에 걸친 교차 계약을 한
  파일에서 단언한다.

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `.bouncer/Distill.md` — 인라인 허용 조건을 못 박은 Decisions 문장은
  `/bouncer-finalize` 승격이 고친다(하드룰 7).
- `scripts/src/` — 코드 변경이 없다.
- `scripts/lib/` — 빌드 산출물이며 이 작업에서 재생성될 이유가 없다.
- `agents/bouncer-implementer.md` — 에이전트 페르소나·가드는 그대로다.
- `agents/bouncer-reviewer.md` — 위와 같다.
- `agents/bouncer-debugger.md` — 디버거 경로는 경량 사이클과 무관하다.
- `docs/workflow.md` — 같은 설명을 중복 게재하지 않는다.
- `docs/ARCHITECTURE.md` — §4 generic-skills 표를 건드리지 않는다(신규 스킬 없음).
- `CLAUDE.md` — 마스터 룰은 경로와 의무만 담고 운용 지침을 담지 않는다.

## Constraints
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- `docs/**`와 `skills/**/SKILL.md`는 영어를 유지한다. 하드룰 8의 한국어 의무는
  `.bouncer/context/epics/**`와 BP `explain.md`에만 걸린다.
- 게이트 번호(G1~G16)와 그 판정 문구를 바꾸지 않는다. 경량 사이클은 게이트가
  아니라 그 앞의 준비 비용만 건드린다.
- 「경량이면 …하지 않아도 된다」로 읽히는 문장을 쓰지 않는다. 줄어드는 것은
  epic 신설·에이전트 왕복·문항 수 셋뿐이고, 나머지는 전부 그대로다.
- 새 테스트는 `test/lightweight-cycle.test.js` 한 파일에 모은다. 스킬별 계약
  테스트 세 개에 흩는 대신 교차 계약을 한 곳에서 읽히게 한다.
- 낱말 부재 단언(`doesNotMatch`)으로 금지 규칙을 검사하지 않는다. 문서가 그
  금지를 설명하는 순간 자기모순으로 깨진다 — 긍정 문구를 단언한다.
- 기존 테스트의 단언을 고치지 않는다. 이번 변경은 전부 추가다.
- 공용 유지보수 epic의 이름은 문서에서 하나로 고정한다. 스킬 프로즈와
  governance가 다른 이름을 쓰면 분기가 성립하지 않는다.

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] `test/lightweight-cycle.test.js`를 만들고 아래 네 단언 묶음을 먼저 적는다.
      기존 테스트와 같은 스타일로 `node:test` + `node:assert`를 쓰고 파일을
      `fs.readFileSync`로 읽는다.

      governance 본문:
      ```js
      const gov = read('docs/governance.md');
      assert.match(gov, /## Lightweight cycle/);
      assert.match(gov, /declare|declaration/i);
      assert.match(gov, /maintenance epic/i);
      assert.match(gov, /inline/i);
      assert.match(gov, /one question|single question/i);
      // 그대로인 것 — 문서·게이트·승격을 이름으로 고정한다.
      assert.match(gov, /explain\.md/);
      assert.match(gov, /Distill/);
      assert.match(gov, /\bG16\b/);
      // 인라인 리뷰의 한계를 긍정 문구로 단언한다.
      assert.match(gov, /its own diff|self-review/i);
      ```

- [ ] plan 스킬 단언을 같은 파일에 추가한다.
      ```js
      const plan = read('skills/bouncer-plan/SKILL.md');
      assert.match(plan, /maintenance epic/i);
      assert.match(plan, /docs\/governance\.md/);
      ```

- [ ] execute 스킬 단언을 추가한다. 기존 폴백 문구가 남아 있는지도 함께 본다.
      ```js
      const exec = read('skills/bouncer-execute/SKILL.md');
      assert.match(exec, /named agents are unavailable/);
      assert.match(exec, /lightweight/i);
      assert.match(exec, /docs\/governance\.md/);
      // 인라인 경로에서도 게이트 판정이 같다는 문장.
      assert.match(exec, /\bG8\b/);
      assert.match(exec, /\bG14\b/);
      ```

- [ ] explain-diff 스킬 단언을 추가한다. 기존 1–10 범위 문구는 그대로 남아야
      한다.
      ```js
      const ed = read('skills/explain-diff/SKILL.md');
      assert.match(ed, /1[–~-]10/);
      assert.match(ed, /lightweight/i);
      assert.match(ed, /docs\/governance\.md/);
      ```

- [ ] `npm test`를 돌려 위 네 묶음이 **실패하는지** 확인한다. 실패하지 않으면
      단언이 이미 참인 문자열을 보고 있는 것이므로 단언을 좁힌다.

- [ ] `docs/governance.md`에 `## Lightweight cycle` 절을 쓴다. 담을 것:
      - 발동 조건 — 사용자가 좁은 범위라고 선언했을 때만. 자동 판정 없음.
      - 줄어드는 셋 — 새 epic을 만들지 않고 공용 maintenance epic에 blueprint를
        쌓는다 / implementer·reviewer를 인라인으로 돌린다 / 퀴즈를 1문항으로
        한다.
      - 그대로인 것 — `tasks/<NNN>/{tasks,verification,review}.md`와
        `explain.md`가 전부 생기고, G1~G16 판정이 같고, Distill 승격이 그대로
        일어난다.
      - 한계 — 인라인 리뷰는 같은 세션이 자기 diff를 판정한다. 판단이 서지
        않으면 네임드 에이전트 경로로 돌아간다.
      - 선언이 없으면 기존 경로가 기본값이다.

- [ ] `skills/bouncer-plan/SKILL.md` step 2에 분기를 넣는다. 사용자가 경량을
      선언하면 새 epic id를 뽑는 대신 공용 maintenance epic을 찾아 그 아래
      다음 blueprint id를 뽑고, 그 epic이 없으면 일반 순번으로 한 번 만든다.
      `docs/governance.md`의 절을 링크한다.

- [ ] `skills/bouncer-execute/SKILL.md`를 고친다. step 3의 4번 항목과 step 5의
      (2)번 항목에서 인라인 허용 조건을 「named agents unavailable」 하나에서
      「unavailable, 또는 사용자가 경량 사이클을 선언한 경우」 둘로 넓힌다.
      이어서 인라인을 골라도 G6~G8·G13·G14 판정과 리뷰 발견사항 처리 절차가
      같다는 문장을 넣고 `docs/governance.md`를 링크한다.

- [ ] `skills/explain-diff/SKILL.md` step 3의 1번 항목에 경량 사이클이면 1문항을
      고른다는 근거를 더한다. 1–10 범위·3지선다·정답 슬롯 분산·한 번에 제시
      규칙은 그대로 둔다. `docs/governance.md`를 링크한다.

- [ ] `npm test`를 다시 돌려 전부 통과하는지 확인한다. 기존 테스트가 깨지면
      추가가 아니라 변경을 한 것이므로 되돌린다.
