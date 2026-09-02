---
type: bouncer.tasks
title: type 종류 대조와 scale 값 검사 추가
description: Tasks for 002
resource: .bouncer/context/epics/014-numeric-context-ids/blueprints/006-schema-cutover/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-12T14:38:53.875+09:00'
bouncer:
  id: TASKS-002
  epic_id: '014'
  blueprint_id: '006'
  status: verified
  commit_intent:
    - 문서 type이 파일 위치와 어긋나도 검증기가 잡지 못했음
    - scale 오타가 조용히 일반 경로로 흘러가는 구멍을 닫음
  affected_paths:
    - scripts/src/lib/validate.ts
    - scripts/lib/validate.js
    - test/validate-structural.test.js
    - docs/gates.md
    - docs/troubleshooting.md
  graph:
    generated_at: '2026-08-12T15:41:00.000+09:00'
    command: graphify query (source + context)
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - docs
      - skills
      - agents
    basis:
      - graph: source
        status: reused
        query: document schema frontmatter type validate scaffold blueprint init epic-index bundle root okf_version tasks-docs legacy task layout
        result: 39 nodes — init.ts·schema.ts와 scaffold.test.js·schema.test.js에 몰림. S3가 이미 resource == rel을 강제해 테스트 픽스처의 type·경로가 어긋난 곳은 없음을 확인
      - graph: context
        status: updated
        query: 문서 스키마 필드 승격 scale commit_type bouncer_schema type 대조 레거시 레이아웃 컷오버 작성 예시
        result: 6 nodes — 024-light-path/001-scale-light-convention explain.md(경량 scale 도입 경위), 006-scripts-typescript index.md
---
# Tasks

Blueprint: [006](../../index.md)

## Goal & intent
`checkStructural`이 두 가지를 더 본다. `type`이 파일 위치가 요구하는 종류와
같은지(**S19**), blueprint의 `bouncer.scale`이 허용 값인지(**S20**).

지금 `type`은 `TYPES`에 있는 값인지만 보므로(S2), `tasks.md` 자리에
`bouncer.review` 문서가 놓여도 통과한다. `resource`(S3)와 id(S5)는 각각 경로와
번호만 보므로 종류 불일치를 잡지 못한다. `scale`은 TASKS-001이 정식 필드로
올렸지만 아직 아무도 값을 확인하지 않는다.

## Interface
- 제공:
  - `validate.ts` 안의 지역 헬퍼 `expectedTypeForPath(rel)` — 경로에서 기대
    `type`을 돌려주거나, 종류를 판정할 수 없으면 `null`.
    ```
    <epic>/index.md                     → bouncer.epic
    <bp>/index.md                       → bouncer.blueprint
    <bp>/tasks/<NNN>/tasks.md           → bouncer.tasks
    <bp>/tasks/<NNN>/verification.md    → bouncer.verification
    <bp>/tasks/<NNN>/review.md          → bouncer.review
    <bp>/explain.md                     → bouncer.explain
    그 외                                → null
    ```
    task 묶음 basename은 `tasks-docs.ts`의 `TASK_UNIT_BASENAMES`에서, 종류→타입
    변환은 `schema.ts`의 `KIND_TO_TYPE`에서 가져온다.
  - **S19** — `expectedTypeForPath`가 값을 주고 `data.type`이 그것과 다르면
    실패. 메시지에 기대 타입과 실제 타입을 모두 담는다.
  - **S20** — `data.type`이 `bouncer.blueprint`이고 `bouncer.scale`이
    `undefined`가 아니면서 `SCALE_ENUM` 밖이면 실패.
- 거부:
  - `expectedTypeForPath`가 `null`이면 S19를 내지 않는다. 위치 규칙이 없는
    경로까지 강제하지 않는다.
  - `scale` 부재는 S20이 아니다. 0.7 blueprint가 그대로 통과해야 한다.
  - blueprint가 아닌 문서의 `scale`은 판정하지 않는다 — 어차피 소비자가 읽지
    않으며, 새 금지 규칙을 여기서 만들지 않는다.
  - S19는 `type`이 `TYPES` 안에 있을 때만 낸다. 알 수 없는 `type`은 S2가
    이미 조기 반환으로 처리한다.
  - 새 모듈을 만들지 않는다. `validate.ts`가 이미 `tasks-docs`·`schema`·
    `paths`를 모두 require하므로 헬퍼를 그 안에 둔다.

## Touch
- Modify `scripts/src/lib/validate.ts` — `expectedTypeForPath` 헬퍼와
  `checkStructural`의 S19·S20 분기.
- Modify `scripts/lib/validate.js` — 산출물 동기화.
- Modify `test/validate-structural.test.js` — S19·S20 실패/통과 케이스.
- Modify `docs/gates.md` — S 코드 문단에 S19·S20 추가.
- Modify `docs/troubleshooting.md` — 두 코드의 증상별 대처 행 추가.

## Do not touch
- `scripts/src/lib/schema.ts` — 상수는 TASKS-001이 확정했다. 여기서는 읽기만
  한다.
- `scripts/src/lib/tasks-docs.ts` — `TASK_UNIT_BASENAMES`를 그대로 쓴다.
  basename 지식을 `validate.ts`로 복사하지 않는다.
- `scripts/src/lib/scaffold.ts` — 쓰기 쪽은 TASKS-001이다.
- `skills/` — 스킬 산문은 이 task에 없다.

## Constraints
- S14·S9·S15는 결번이거나 이미 쓰이는 번호다. 새 코드는 S19·S20이며 기존 번호를
  재사용하지 않는다.
- task 문서 basename과 `\d{3}` 규칙은 `tasks-docs.ts`에만 있다는 불변식을
  지킨다. `expectedTypeForPath`는 `TASK_UNIT_BASENAMES`를 순회해 만들고
  `'tasks.md'` 같은 문자열을 직접 쓰지 않는다.
- 두 코드 모두 게이트와 무관한 상시 구조 검사다. `checkGate` 분기에 넣지
  않는다.
- `imported` status 문서도 구조 검사를 거친다. 임포트가 만든 문서가 S19에
  걸리면 임포트 경로의 버그이므로 예외를 파지 말고 그대로 드러낸다.
- 실패 메시지는 영어 한 줄로, 기존 S 코드 메시지 형식을 따른다.

## Checklist
- [ ] `test/validate-structural.test.js`에 실패 테스트를 추가한다: `tasks/001/`
      묶음의 `tasks.md`에 `type: bouncer.review`를 넣으면 S19 하나가 나고
      메시지에 두 타입이 들어 있다.
      ```js
      assert.ok(codes.includes('S19'));
      assert.match(msg, /bouncer\.tasks/);
      assert.match(msg, /bouncer\.review/);
      ```
- [ ] 같은 파일에 통과 케이스를 추가한다: `.bouncer/context/` 밖 문서나 알 수
      없는 basename은 S19를 내지 않는다.
- [ ] `scale` 케이스 세 개를 추가한다.
      ```js
      // 없음 → 실패 없음, 'light'/'full' → 실패 없음, 'lite' → ['S20']
      assert.deepStrictEqual(codesFor({ scale: 'lite' }), ['S20']);
      assert.deepStrictEqual(codesFor({}), []);
      ```
- [ ] `node --test test/validate-structural.test.js`로 실패를 확인한다.
- [ ] `validate.ts`에 `expectedTypeForPath`를 넣는다. epic/blueprint `index.md`
      구분은 `parsePathIds`의 `blueprintId` 유무로 하고, task 묶음은
      `/tasks/(\d{3})/` 매치 후 basename을 `TASK_UNIT_BASENAMES` 순서로 맞춘다.
- [ ] `checkStructural`의 `TYPES.includes` 통과 직후에 S19를, `bouncer` 블록을
      읽는 구간에 S20을 넣는다.
- [ ] `docs/gates.md`의 「`S`로 시작하는 코드(S0–S18)」 범위를 S20까지로 고치고
      두 코드 설명을 넣는다.
- [ ] `docs/troubleshooting.md`에 두 행을 넣는다 — S19는 문서를 옮겼거나
      복사한 뒤 `type`을 안 고친 경우, S20은 허용 값 두 개를 안내.
- [ ] `npm run build`로 `scripts/lib/`를 재생성한다.
- [ ] `npm test`가 통과한다. 이 저장소의 기존 문서 전체가 S19를 내지 않아야
      한다 — `node scripts/bouncer validate`로 확인한다.
