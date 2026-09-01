---
type: bouncer.tasks
title: 번들 루트 스키마 버전과 blueprint 기본 필드 추가
description: Tasks for 001
resource: .bouncer/context/epics/014-numeric-context-ids/blueprints/006-schema-cutover/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-12T14:38:53.836+09:00'
bouncer:
  id: TASKS-001
  epic_id: '014'
  blueprint_id: '006'
  status: verified
  commit_intent:
    - 문서 스키마 버전을 선언할 자리가 없어 호환 약속을 걸 기준점이 없었음
    - scale과 commit_type이 산문에만 있어 scaffold 결과와 코드가 어긋나 있었음
  affected_paths:
    - scripts/src/lib/schema.ts
    - scripts/lib/schema.js
    - scripts/src/lib/scaffold.ts
    - scripts/lib/scaffold.js
    - scripts/src/lib/init.ts
    - scripts/lib/init.js
    - scripts/src/lib/epic-index.ts
    - scripts/lib/epic-index.js
    - .bouncer/context/index.md
    - test/schema.test.js
    - test/scaffold.test.js
    - test/init.test.js
    - test/lightweight-cycle.test.js
    - docs/okf.md
    - docs/workflow.md
    - docs/governance.md
    - skills/bouncer-plan/SKILL.md
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
        result: 39 nodes — init.ts·schema.ts와 scaffold.test.js·schema.test.js에 몰림. source_dirs가 scripts/hooks/test라 skills·docs·agents는 조사로 직접 더함
      - graph: context
        status: updated
        query: 문서 스키마 필드 승격 scale commit_type bouncer_schema type 대조 레거시 레이아웃 컷오버 작성 예시
        result: 6 nodes — 024-light-path/001-scale-light-convention explain.md(경량 scale 도입 경위), 006-scripts-typescript index.md
---
# Tasks

Blueprint: [006](../../index.md)

## Goal & intent
`schema.ts`가 `bouncer.scale`·`bouncer.commit_type`·번들 루트
`bouncer_schema`를 아는 상수로 갖고, scaffold와 init이 그 값을 실제로 쓴다.
지금은 `scale`이 스킬 산문에만 있고 `commit_type`은 `finalize.ts`가 읽되
scaffold가 만들지 않아 항상 `'feat'` 폴백으로 떨어진다. 이 task는 쓰기만
한다 — 값 검사는 TASKS-002다.

`scale`을 정식 필드로 올리면 "선언이 없으면 키 자체를 넣지 않는다"는 현재 plan
규칙이 성립하지 않는다. scaffold가 `full`을 쓰고 경량 선언은 그 값을 `light`로
바꾸는 형태로 바뀌므로, 그 규칙을 담은 스킬·문서 산문도 같은 커밋에서 고친다.

## Interface
- 제공:
  - `scripts/src/lib/schema.ts`가 네 이름을 추가로 export한다.
    ```js
    BOUNCER_SCHEMA_VERSION  // '0.1'
    SCALE_ENUM              // ['light', 'full']
    DEFAULT_SCALE           // 'full'
    DEFAULT_COMMIT_TYPE     // 'feat'
    ```
  - `scaffoldBlueprint`가 쓰는 `index.md` `bouncer:` 블록에
    `commit_type: feat`와 `scale: full`이 들어간다. 키 순서는 `status` 뒤.
  - `init`의 `CONTEXT_INDEX`와 `epic-index`의 `EMPTY_CONTEXT_INDEX`가 만드는
    번들 루트 frontmatter가 두 줄이 된다.
    ```yaml
    okf_version: "0.1"
    bouncer_schema: "0.1"
    ```
- 거부:
  - epic·tasks·verification·review·explain 문서에는 `scale`도 `commit_type`도
    쓰지 않는다. 두 필드는 blueprint 전용이다.
  - 이미 있는 번들 루트 `index.md`를 코드가 소급 수정하지 않는다.
    `ensureEpicIndexEntry`는 파일이 없을 때만 frontmatter를 만든다. 이
    저장소의 기존 파일은 사람이 한 줄 넣는다.
  - `scale`의 소비자에 `full` 분기를 만들지 않는다. 판정은 계속
    `scale === 'light'` 한 줄이다.

## Touch
- Modify `scripts/src/lib/schema.ts` — 네 상수 추가와 export.
- Modify `scripts/lib/schema.js` — 산출물 동기화.
- Modify `scripts/src/lib/scaffold.ts` — `scaffoldBlueprint`의 `bouncer:`에
  `commit_type`·`scale` 기본값을 넣는다.
- Modify `scripts/lib/scaffold.js` — 산출물 동기화.
- Modify `scripts/src/lib/init.ts` — `CONTEXT_INDEX`에 `bouncer_schema` 줄.
- Modify `scripts/lib/init.js` — 산출물 동기화.
- Modify `scripts/src/lib/epic-index.ts` — `EMPTY_CONTEXT_INDEX`에 같은 줄.
- Modify `scripts/lib/epic-index.js` — 산출물 동기화.
- Modify `.bouncer/context/index.md` — 이 저장소 번들 루트에 `bouncer_schema`
  한 줄을 넣는다(코드가 소급 수정하지 않으므로 손으로).
- Modify `test/schema.test.js` — 네 상수의 값을 고정하는 단언 추가.
- Modify `test/scaffold.test.js` — blueprint frontmatter에 두 필드가 있고
  task·epic 문서에는 없음을 단언.
- Modify `test/init.test.js` — 번들 루트 frontmatter 두 줄 단언.
- Modify `docs/okf.md` — `bouncer_schema`가 무엇이고 왜 문서마다 두지 않는지.
- Modify `skills/bouncer-plan/SKILL.md` — 경량 선언 문구를 "키를 넣지 않는다"
  에서 "scaffold가 쓴 `full`을 `light`로 바꾼다"로. `schema.ts`에 등록하지
  않는다는 서술도 지운다.
- Modify `docs/workflow.md` — 같은 문구(72·86행 부근).
- Modify `docs/governance.md` — 같은 문구(21–24·50행 부근).
- Modify `test/lightweight-cycle.test.js` — 위 문구 단언을 새 표현으로.

## Do not touch
- `scripts/src/lib/validate.ts` — 구조 검사 추가는 TASKS-002다.
- `scripts/src/lib/finalize.ts` — `commit_type`의 `'feat'` 폴백은 남긴다.
- `skills/explain-diff/SKILL.md` — `light` 소비 규칙은 그대로다.
- `skills/spec-authoring/` — 작성 예시는 TASKS-004다.
- `docs/gates.md` — 새 코드 문서화는 TASKS-002다.

## Constraints
- `bouncer_schema` 값은 문자열 `"0.1"`이다. `1.0` 승격은 epic 029 소관이며 이
  blueprint에서 값을 올리지 않는다.
- 세 필드 모두 **선택**이다. 부재를 실패로 만드는 코드를 이 task에 넣지 않는다.
- `scale` 기본값은 `full`이고, 필드가 없는 문서도 `full`로 읽힌다. 소비자
  코드·산문은 `light`인지만 본다.
- `scripts/lib/*.js`는 손으로 고치지 않는다. `npm run build` 산출물을 그대로
  커밋한다.
- 스킬·문서 산문을 고칠 때 경량 경로의 판단 기준(사용자에게 묻는다, 진단으로
  자동 판정하지 않는다)은 바꾸지 않는다. 바뀌는 것은 키를 어떻게 쓰는가뿐이다.

## Checklist
- [ ] `test/schema.test.js`에 실패 테스트를 추가한다.
      ```js
      assert.strictEqual(schema.BOUNCER_SCHEMA_VERSION, '0.1');
      assert.deepStrictEqual(schema.SCALE_ENUM, ['light', 'full']);
      assert.strictEqual(schema.DEFAULT_SCALE, 'full');
      assert.strictEqual(schema.DEFAULT_COMMIT_TYPE, 'feat');
      ```
- [ ] `test/scaffold.test.js`에 실패 테스트를 추가한다: scaffold한 blueprint
      `index.md`의 `bouncer`에 두 필드가 있고, 같은 호출이 만든
      `tasks/001/tasks.md`에는 없다.
      ```js
      assert.strictEqual(bp.bouncer.commit_type, 'feat');
      assert.strictEqual(bp.bouncer.scale, 'full');
      assert.strictEqual(tasks.bouncer.scale, undefined);
      ```
- [ ] `test/init.test.js`에 실패 테스트를 추가한다: `bouncer init` 후
      `.bouncer/context/index.md` frontmatter에 `okf_version`과
      `bouncer_schema`가 모두 `'0.1'`이다.
- [ ] `node --test test/schema.test.js test/scaffold.test.js test/init.test.js`
      로 세 실패를 확인한다.
- [ ] `schema.ts`에 네 상수를 넣고 `module.exports`에 추가한다.
- [ ] `scaffold.ts`의 `scaffoldBlueprint` `bouncerDoc` 인자에
      `commit_type: DEFAULT_COMMIT_TYPE`, `scale: DEFAULT_SCALE`을 넣는다.
- [ ] `init.ts`의 `CONTEXT_INDEX`와 `epic-index.ts`의 `EMPTY_CONTEXT_INDEX`에
      `bouncer_schema: "0.1"` 줄을 넣는다. 두 문자열이 같은 frontmatter를
      만들어야 한다.
- [ ] `.bouncer/context/index.md`에 같은 줄을 손으로 넣는다.
- [ ] `skills/bouncer-plan/SKILL.md`·`docs/workflow.md`·`docs/governance.md`의
      경량 선언 문구를 고친다. 「선언이 없으면 키를 쓰지 않는다」 →
      「scaffold가 `full`을 쓰므로 경량이면 그 값을 `light`로 바꾸고, 되돌릴
      때는 `full`로 되돌린다」.
- [ ] `test/lightweight-cycle.test.js`의 해당 단언을 새 문구에 맞춘다.
- [ ] `docs/okf.md`에 `bouncer_schema` 문단을 넣는다 — 번들 루트 한 곳에만
      두는 이유와 값이 `0.1`인 이유.
- [ ] `npm run build`로 `scripts/lib/`를 재생성한다.
- [ ] `npm test`가 통과한다.
