---
type: bouncer.tasks
title: 포인터 페이로드에 blueprint scale 파생값을 실음
description: bouncer current 응답에 scale을 추가해 execute가 blueprint index.md를 열지 않게 한다
resource: .bouncer/context/epics/007-project-distill/blueprints/006-brief-injection-slim/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-24T13:32:35.001+09:00'
bouncer:
  id: TASKS-001
  epic_id: '007'
  blueprint_id: '006'
  status: verified
  verify: npm run ci
  commit_type: refactor
  commit_intent:
    - execute가 필드 하나 때문에 blueprint index.md를 두 지점에서 여는 비용을 없앰
    - scale을 포인터 응답의 파생값으로 실어 SSOT는 blueprint 문서에 그대로 둠
  affected_paths:
    - scripts/src/lib/current.ts
    - scripts/lib/current.js
    - test/cli-current.test.js
    - skills/bouncer-execute/SKILL.md
    - test/skill-bouncer-execute.test.js
    - test/lightweight-cycle.test.js
    - docs/cli.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-24T13:45:00.000+09:00'
    suggested_paths: []
    basis:
      - graph: source
        status: fail-skip
        query: presentCurrent pointer payload cli current command scale blueprint
        result: 0 usable hits — every returned node resolves to a deleted path (commands/sdd-*.md, .superpowers/, skills/sdd-minimality, skills/okf-authoring); graphify skill 0.9.41 vs package 0.8.22 skew
      - graph: context
        status: fail-skip
        query: presentCurrent pointer payload cli current command scale blueprint
        result: 0 usable hits — context graph returns the same stale source nodes; paths seeded by hand instead
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`bouncer current` 응답에 blueprint `bouncer.scale` 파생값을 실어, `/bouncer-execute`가 경량 분기를 판정할 때 blueprint `index.md`(평균 451 단어)를 열지 않게 한다. 판정 지점은 step 3·step 5 두 곳으로 남고, 없어지는 것은 그 두 곳의 blueprint 문서 읽기다.

SSOT는 blueprint `index.md`로 유지한다. 포인터 파일 JSON(`{ blueprint, task?, base }`)은 바꾸지 않는다 — `scale`은 `presentCurrent`가 호출 시점에 다시 계산하는 응답 전용 파생값이라, 포인터 파일에 저장하면 문서 수정 후 stale해진다.

## Interface
- 제공: `presentCurrent`가 반환하는 객체에 최상위 `scale` 키가 생긴다. 값은 `current.blueprint`의 `index.md`에서 읽은 `bouncer.scale` 문자열이고, `bouncer current` / `--set` 두 출력 경로 모두에 실린다.
- 제공: `skills/bouncer-execute/SKILL.md`의 두 경량 분기가 「blueprint `index.md`의 `bouncer.scale`」 대신 「포인터(`bouncer current`)의 `scale`」을 근거로 적힌다.
- 거부: blueprint `index.md`가 없거나 파싱 불가하거나 `bouncer.scale`이 문자열이 아니면 `scale: null`이다. 예외를 던지지 않고 포인터도 지우지 않는다 — `task` id 해석 실패와 같은 처리다.
- 거부: `scale` 값의 enum 검사를 여기서 하지 않는다. `SCALE_ENUM` 판정은 S20의 몫이고, 알 수 없는 값도 읽은 그대로 노출한다.
- 거부: 포인터 파일 스키마에 `scale`을 저장하지 않는다.

## Touch
- Modify `scripts/src/lib/current.ts` — `presentCurrent`가 blueprint `index.md`를 읽어 `scale`을 파생하고 두 반환 분기(task 있음/없음) 모두에 싣는다
- Modify `scripts/lib/current.js` — `npm run build`가 만드는 CJS emit. 소비자는 Node 전용이라 커밋 대상이다
- Modify `test/cli-current.test.js` — 페이로드 `deepStrictEqual` 단언 세 곳(`:148`·`:161`·`:288`)에 `scale`을 넣고, 문서 부재 시 `null`인 케이스를 추가한다
- Modify `skills/bouncer-execute/SKILL.md` — step 3·step 5의 경량 분기 근거를 포인터 `scale`로 바꾼다
- Modify `test/skill-bouncer-execute.test.js` — 두 분기가 포인터를 근거로 적혔다는 계약을 고정한다
- Modify `test/lightweight-cycle.test.js` — `:54`가 `skills/bouncer-execute/SKILL.md`에 `bouncer.scale` 또는 `scale: light` 리터럴을 요구한다. 분기 문장을 고치면 이 단언이 함께 걸린다
- Modify `docs/cli.md` — `bouncer current` 행의 출력 설명에 `scale`을 적는다

## Do not touch
- `scripts/src/lib/validate-structural.ts` — S20 enum 판정은 이번 변경 대상이 아니다
- `scripts/src/lib/schema.ts` — `SCALE_ENUM`·`DEFAULT_SCALE` 상수는 그대로다
- `skills/bouncer-run/SKILL.md` — `test/skill-bouncer-run.test.js:104`가 이 문서에 `scale: light` 리터럴이 없어야 한다고 고정한다
- `.bouncer/Distill.md` 및 `.bouncer/distill/` — 승격은 `/bouncer-finalize`의 몫이다

## Constraints
- 포인터 파일 형식은 바뀌지 않는다. 기존 포인터 파일이 재작성 없이 그대로 읽혀야 한다.
- `presentCurrent`는 예외를 던지지 않는다. 문서 읽기 실패는 모두 `null`로 흡수한다.
- 하위 호환 별칭(`blueprintScale` 등)을 두지 않는다.
- 새 런타임 의존성을 넣지 않는다 — 문서 읽기는 이미 있는 `readDoc`을 쓴다.
- 공개 문자열과 코드 주석은 한국어를 유지한다.

## Checklist
- [ ] `test/cli-current.test.js`에 실패 테스트를 추가한다.
  ```js
  // writePlanPassingBlueprint 픽스처는 blueprint frontmatter에 scale이 없다 → null
  assert.deepStrictEqual(parsed.current, { blueprint: BP_REL, base: 'develop', task: null, scale: null });
  // 같은 픽스처에 bouncer.scale: full 을 넣은 케이스
  assert.strictEqual(parsed.current.scale, 'full');
  ```
- [ ] `node --test test/cli-current.test.js`로 실패를 확인한다.
- [ ] `scripts/src/lib/current.ts`의 `presentCurrent`를 구현한다 — 읽기 실패는 `try/catch`로 `null`.
- [ ] `npm run build`로 `scripts/lib/current.js` emit을 갱신한다.
- [ ] `test/skill-bouncer-execute.test.js`에 두 경량 분기의 포인터 근거 계약을 추가하고 실패를 확인한다.
- [ ] `test/lightweight-cycle.test.js:54`의 단언을 새 문구에 맞춘다 — 분기 문장이 `bouncer.scale`을 SSOT로 계속 명명하면 그대로 두고, 아니면 포인터 근거 문구로 바꾼다.
- [ ] `skills/bouncer-execute/SKILL.md` step 3·step 5의 경량 분기 문장을 고친다.
- [ ] `docs/cli.md`의 `bouncer current` 행에 `scale`을 적는다.
- [ ] `npm run ci`가 통과한다.
