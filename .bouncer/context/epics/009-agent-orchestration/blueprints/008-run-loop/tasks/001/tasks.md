---
type: bouncer.tasks
title: autonomy 설정 표면 등록
description: Tasks for 001
resource: .bouncer/context/epics/009-agent-orchestration/blueprints/008-run-loop/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-12T18:02:00.160+09:00'
bouncer:
  id: TASKS-001
  epic_id: '009'
  blueprint_id: '008'
  status: verified
  commit_intent:
    - 자율 주행 수준을 프로젝트마다 선언할 자리가 없어 루프가 확인 지점을 코드 밖에서 추측하게 됨
    - 허용 값과 기본값을 스키마에 등록하고 init이 쓰게 해 해석 경로를 하나로 둠
  affected_paths:
    - scripts/src/lib/schema.ts
    - scripts/lib/schema.js
    - scripts/src/lib/init.ts
    - scripts/lib/init.js
    - config.example.json
    - docs/configuration.md
    - test/schema.test.js
    - test/init.test.js
  graph:
    generated_at: '2026-08-12T18:20:00+09:00'
    command: graphify query "autonomous run loop skill autonomy config schema init default workflow command execute commit pointer" --graph graphify-out/{source,context}/graph.json
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - docs
    basis:
      - graph: source
        status: reused
        query: autonomous run loop skill autonomy config schema init default workflow command execute commit pointer
        result: 67 nodes; top hits test/init.test.js, test/schema.test.js, test/helpers/read-skill.js. source_dirs가 scripts/hooks/test라 docs/는 히트가 없어 손으로 더함
      - graph: context
        status: updated
        query: autonomous run loop skill autonomy config schema init default workflow command execute commit pointer
        result: 6 nodes; epic 032/031/009 index.md의 Success criteria 섹션. 설정 표면 선례는 009(subagent-model-config)
---
# Tasks

Blueprint: [008](../../index.md)

## Goal & intent
`autonomy`가 `config.json`의 정식 필드가 된다. `schema.ts`가 허용 값과 기본값을
export하고, `bouncer init`이 새 저장소의 `config.json`에 `"auto"`를 써 넣으며,
설정 문서가 두 값의 차이를 서술한다. 이 task는 값을 **등록**만 한다 — 그 값을
읽어 동작을 가르는 쪽은 TASKS-002의 스킬이다.

## Interface
- 제공:
  - `scripts/src/lib/schema.ts`가 두 상수를 추가로 export한다.
    ```ts
    const AUTONOMY_ENUM = ['auto', 'interactive'];
    const DEFAULT_AUTONOMY = 'auto';
    ```
    기존 `module.exports` 목록에 두 이름을 덧붙인다. 문서 필드 등록
    (`TYPES` / `KIND_TO_TYPE` / `STATUS_ENUM`)은 건드리지 않는다 — `autonomy`는
    프로젝트 설정이지 문서 frontmatter가 아니다.
  - `scripts/src/lib/init.ts`의 `defaultConfig`가 `autonomy: 'auto'`를 포함한다.
    자리는 `base_branch` 다음, `pr` 앞이다.
  - `config.example.json`에 같은 줄이 같은 자리에 있다.
- 거부:
  - 이미 있는 `config.json`에 키를 채워 넣지 않는다. `init`의 ready-bootstrap
    경로와 `--promote-graphify` 경로는 지금처럼 `graphify.enabled`(및 성공 시
    `bin`)만 바꾼다.
  - 허용 목록 밖 값을 판정하는 코드를 넣지 않는다. `validate`·CLI·게이트에
    `autonomy` 분기를 만들지 않는다.

## Touch
- Modify `scripts/src/lib/schema.ts` — `AUTONOMY_ENUM`·`DEFAULT_AUTONOMY` 선언과 export 추가
- Modify `scripts/lib/schema.js` — 위 변경의 CJS emit(`npm run build` 산출물, 커밋 대상)
- Modify `scripts/src/lib/init.ts` — `defaultConfig`에 `autonomy: 'auto'` 추가
- Modify `scripts/lib/init.js` — 위 변경의 CJS emit
- Modify `config.example.json` — 기본 설정 예시에 같은 키 추가
- Modify `docs/configuration.md` — 설정 표에 `autonomy` 행 추가
- Modify `test/schema.test.js` — 두 상수의 값 단언 추가
- Modify `test/init.test.js` — `config.json` 정확 형태 단언(`deepStrictEqual`)에 새 키 반영

## Do not touch
- `scripts/src/lib/validate.ts` — 설정 값은 게이트 대상이 아니다
- `scripts/src/lib/cli.ts` — 새 명령·플래그를 만들지 않는다
- `skills/` 전체 — 값을 읽는 쪽은 TASKS-002가 만든다
- `.bouncer/config.json` — 이 저장소의 기존 설정은 `init`이 바꾸지 않는 대상이며, 손으로 고치면 그 규칙을 스스로 어긴다

## Constraints
- TypeScript 원본을 고치고 `npm run build`(또는 `pretest`)로 `scripts/lib/`
  emit을 재생성해 함께 커밋한다. emit만 손으로 고치지 않는다.
- 새 상수 옆에 왜 이 값이 필요한지 한국어 주석을 남긴다. 기존 `SCALE_ENUM`·
  `DEFAULT_SCALE` 주석과 같은 밀도로 쓴다.
- 부재를 `auto`로 읽는다는 규칙을 주석에 명시한다. 소비자가 `interactive`인지만
  비교하도록 두고, `auto` 전용 분기를 새로 만들 여지를 남기지 않는다.
- `init.test.js`의 `deepStrictEqual` 단언은 키를 빼먹으면 실패하므로, 기대값
  객체에 새 키를 넣어 형태를 고정한 채로 통과시킨다.

## Checklist
- [ ] `test/schema.test.js`에 실패하는 단언을 먼저 추가하고 실패를 확인한다.
      ```js
      assert.deepStrictEqual(schema.AUTONOMY_ENUM, ['auto', 'interactive']);
      assert.strictEqual(schema.DEFAULT_AUTONOMY, 'auto');
      ```
- [ ] `test/init.test.js`의 `init writes the exact config.json shape` 기대값에
      `autonomy: 'auto'`를 넣고 실패를 확인한다.
- [ ] `scripts/src/lib/schema.ts`에 두 상수를 선언하고 `module.exports`에 더한다.
- [ ] `scripts/src/lib/init.ts` `defaultConfig`에 `autonomy: 'auto'`를
      `base_branch` 다음 자리에 넣는다.
- [ ] `config.example.json`에 같은 키를 같은 자리에 넣는다.
- [ ] `docs/configuration.md` 설정 표에 행을 추가한다. 기본값은 `"auto"`,
      설명은 `/bouncer-run`의 확인 지점을 정한다는 것과 `interactive`가 task
      경계 확인을 더한다는 것.
- [ ] `npm run build`로 `scripts/lib/schema.js`·`scripts/lib/init.js`를
      재생성한다.
- [ ] `npm test`가 통과한다.
