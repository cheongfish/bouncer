---
type: bouncer.tasks
title: epic·blueprint 프론트매터에 supersedes 필드 추가
description: 대체한 문서 경로를 적을 자리를 스키마·스캐폴드·구조 검사 S27에 만든다
resource: .bouncer/context/epics/049-context-searchability/blueprints/002-supersedes-field/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-25T08:54:49.054+09:00'
bouncer:
  id: TASKS-001
  epic_id: '049'
  blueprint_id: '002'
  status: verified
  commit_intent:
    - 프론트매터에서 저술 비용 없이 뽑히는 관계 중 결정끼리의 계보만 적을 자리가 없어 하드룰 7의 충돌 판정이 매번 전문 검색에 기대고 있음
    - 값을 채우는 것은 사람 판단으로 두되 형식만 검사해 소급 저술 없이 신규 문서부터 계보가 쌓이게 하려 함
  verify: npm run ci
  affected_paths:
    - scripts/src/lib/schema.ts
    - scripts/lib/schema.js
    - scripts/src/lib/scaffold.ts
    - scripts/lib/scaffold.js
    - scripts/src/lib/validate-structural.ts
    - scripts/lib/validate-structural.js
    - test/schema.test.js
    - test/scaffold.test.js
    - test/validate-structural.test.js
    - docs/compatibility.md
    - docs/gates.md
    - docs/troubleshooting.md
    - rules/okf.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-25T09:01:55.000+09:00'
    suggested_paths:
      - test
      - .bouncer/context/epics/031-document-schema/blueprints/001-schema-cutover
      - .bouncer/context/epics/019-task-pointer/blueprints/001-pointer-task-field
      - .bouncer/context/epics/048-plugin-root-resolution/blueprints/001-host-candidate-launcher
    basis:
      - graph: source
        status: reused
        query: frontmatter schema field scaffold epic blueprint structural validation code supersedes
        result: 3 nodes, all under test/ — schema.test.js, public-contract.test.js, migrate-ids.test.js; scripts/src is not reachable from these query terms
      - graph: context
        status: updated
        query: frontmatter schema field scaffold epic blueprint structural validation code supersedes
        result: 3 explain.md hits — 031 schema-cutover, 019 pointer-task-field, 048 host-candidate-launcher; 031 is the prior schema-field precedent
---
# Tasks

Blueprint: [002](../../index.md)

## Goal & intent
epic과 blueprint 프론트매터에 `bouncer.supersedes`가 생긴다. `schema.ts`가 허용
형태 판정을 한 곳에서 export하고, `scaffold epic` / `scaffold blueprint`가 빈
배열을 쓰며, 형식이 틀리면 `bouncer validate`가 S27로 거절한다. 필드가 없는 기존
문서 616개는 전부 그대로 통과한다. 값을 채우는 것은 사람의 판단이고, 이번 작업은
자리와 형식 검사까지다.

## Interface
- 제공: `schema.ts`가 `isValidSupersedes(value)`를 export한다. 판정은
  `undefined`(부재) 통과, 빈 배열 통과, 그리고 모든 원소가 공백이 아닌 문자열인
  배열 통과다.
- 제공: `scaffold epic`이 만든 epic `index.md`와 `scaffold blueprint`가 만든
  blueprint `index.md`의 `bouncer` 블록에 `supersedes: []`가 있다.
- 제공: `validate-structural.ts`가 `S27`을 낸다. 대상은 `bouncer.epic`과
  `bouncer.blueprint` 두 종류뿐이다.
- 거부: 배열이 아닌 값(문자열·객체·숫자), 원소에 빈 문자열·공백 문자열·비문자열이
  섞인 배열은 S27로 거절한다.
- 거부하지 않음: 존재하지 않는 문서를 가리키는 경로, 자기 자신 참조, 순환,
  중복 원소. 참조 무결성을 검사하지 않는다.
- 거부하지 않음: task·verification·review·explain·context_review 문서에 이 필드가
  있는 경우. 미등록 키를 거절하는 규칙을 새로 만들지 않는다.

## Touch
- Modify `scripts/src/lib/schema.ts` — `isValidSupersedes`를 구현하고 export한다.
- Modify `scripts/lib/schema.js` — 커밋되는 CJS emit.
- Modify `scripts/src/lib/scaffold.ts` — `scaffoldEpic`과 `scaffoldBlueprint`의
  `bouncer` 블록에 `supersedes: []`를 더한다.
- Modify `scripts/lib/scaffold.js` — 커밋되는 CJS emit.
- Modify `scripts/src/lib/validate-structural.ts` — `schema.ts`의 판정을 import해
  S27을 낸다.
- Modify `scripts/lib/validate-structural.js` — 커밋되는 CJS emit.
- Modify `test/schema.test.js` — `isValidSupersedes`의 통과·거부 입력을 단언한다.
- Modify `test/scaffold.test.js` — epic·blueprint에 `supersedes: []`가 있고
  task·verification·review에는 없다는 것을 단언한다.
- Modify `test/validate-structural.test.js` — S27의 거부와 부재 통과를 단언한다.
- Modify `docs/compatibility.md` — 「게이트 코드」 절의 S 범위와 목록에 `S27`을
  더한다. `test/public-contract.test.js`가 이 문서와 구현의 코드 집합을 대조한다.
- Modify `docs/gates.md` — 범위 문장 `S0–S26`을 `S0–S27`로 고치고 사람용 S 코드
  설명에 S27 한 줄을 더한다.
- Modify `docs/troubleshooting.md` — S 코드 표에 S27 행을 더한다. 그 표는 사람이
  프론트매터를 고쳐 푸는 위반만 담은 부분 집합이고 S27이 거기 해당한다.
- Modify `rules/okf.md` — Plan fields 문단에 `bouncer.supersedes`의 의미와
  "형식만 검사한다"는 한계를 영어 한두 문장으로 적는다.

## Do not touch
- `scripts/src/lib/validate-gates.ts` — G 코드를 만들지 않는다. 이 필드는 구조
  검사 대상이고 게이트 판정에 들어가지 않는다.
- `scripts/src/lib/frontmatter.ts` — 파서는 키를 알 필요가 없다.
- `scripts/src/lib/migrate-ids.ts`, `scripts/src/lib/migrate-task-layout.ts` —
  소급 저술을 하지 않으므로 마이그레이션 대상이 아니다.
- `skills/spec-authoring/references/epic.md`,
  `skills/spec-authoring/references/blueprint.md` — 필드 부재가 유효한 상태라
  기존 완성 예시는 그대로 유효하다. 예시에 빈 배열을 넣으면 사람이 채워야 할
  칸처럼 읽힌다.
- `.bouncer/context/epics/**` — 이 저장소의 기존 epic·blueprint 문서에
  `supersedes`를 소급 저술하지 않는다. 새 필드는 앞으로 스캐폴드되는 문서부터
  붙는다.
- `.bouncer/Distill.md`, `.bouncer/distill/` — 승격은 `/bouncer-finalize` 소관이다.

## Constraints
- 판정은 `schema.ts`에 한 번만 구현하고 `validate-structural.ts`가 import한다.
  epic 성공 조건 4가 `schema.ts`의 export를 요구하므로 그쪽이 집이다.
  `isValidGraphBasis`는 `validate-structural.ts`에 있지만, 그것은 S9와 G4가
  같은 술어를 쓰게 하려는 배치이고 스키마 상수 export와는 다른 문제다.
  어느 쪽이든 구현은 한 곳뿐이라는 규율은 같다.
- `docs/compatibility.md`의 **「문서 스키마」 표**에는 `supersedes`를 넣지 않는다.
  `test/public-contract.test.js`가 그 표 행의 backtick 토큰 중 `type`·`status`·
  `bouncer.*`가 아닌 것을 전부 status 값으로 간주해 `STATUS_ENUM` 값 집합과
  대조하므로, 열거값이 없는 필드 이름을 표에 넣으면 즉시 깨진다. 절 산문의
  backtick은 `SCALE_ENUM`·`AUTONOMY_ENUM` 쪽에서 따로 수집되므로 표와 규칙이
  다르다. 「게이트 코드」 절에는 `S27`을 반드시 넣는다 — 그 절은
  `scripts/lib/*.js`의 `'S27'` 리터럴 수집 결과와 대조되므로, 빠지면 같은
  테스트가 실패한다.
- S27은 새 번호다. 결번(G9·G15·S14)을 재사용하지 않는다.
- 필드 부재는 어떤 문서 종류에서도 실패가 아니다. `scale`이 S20에서 부재를
  허용하는 것과 같은 계약이다.
- `commit_type`·`scale`처럼 `supersedes`도 epic·blueprint 전용이다. 스캐폴드가
  task·verification·review·context_review에 쓰지 않는다.
- 공개 문자열과 코드 주석은 한국어를 유지한다. `rules/okf.md`는 영어다.

## Checklist
- [ ] `test/schema.test.js`에 `isValidSupersedes` 단언을 추가해 먼저 실패시킨다.
      ```js
      assert.strictEqual(schema.isValidSupersedes(undefined), true);
      assert.strictEqual(schema.isValidSupersedes([]), true);
      assert.strictEqual(schema.isValidSupersedes(['.bouncer/context/epics/033-x/index.md']), true);
      assert.strictEqual(schema.isValidSupersedes('033'), false);
      assert.strictEqual(schema.isValidSupersedes([{}]), false);
      assert.strictEqual(schema.isValidSupersedes(['']), false);
      assert.strictEqual(schema.isValidSupersedes(['  ']), false);
      assert.strictEqual(schema.isValidSupersedes(null), false);
      ```
- [ ] `test/scaffold.test.js`에 기본값 단언을 추가해 함께 실패시킨다.
      ```js
      assert.deepStrictEqual(epic.bouncer.supersedes, []);
      assert.deepStrictEqual(bp.bouncer.supersedes, []);
      assert.strictEqual(tasks.bouncer.supersedes, undefined);
      ```
- [ ] `test/validate-structural.test.js`에 S27 단언을 추가해 함께 실패시킨다.
      배열이 아닌 값과 빈 문자열 원소가 각각 S27을 내는지, 필드가 없는 문서는
      S27을 내지 않는지 본다.
- [ ] `node --test test/schema.test.js test/scaffold.test.js test/validate-structural.test.js`로
      세 파일이 실패하는 것을 확인한다.
- [ ] `schema.ts`에 `isValidSupersedes`를 구현하고 `module.exports`에 더한다.
- [ ] `scaffold.ts`의 epic·blueprint frontmatter에 `supersedes: []`를 더한다.
      `commit_type`·`scale`을 blueprint 전용으로 다루는 기존 자리 옆에 둔다.
- [ ] `validate-structural.ts`의 `checkStructural`에 S20 분기 옆으로 S27을 더한다.
      ```ts
      if (
        (docType === 'bouncer.epic' || docType === 'bouncer.blueprint')
        && !isValidSupersedes(bouncer.supersedes)
      ) {
        add('S27', 'supersedes must be an array of non-empty document paths');
      }
      ```
- [ ] `npm run build`로 세 emit 파일을 다시 생성한다.
- [ ] `docs/compatibility.md`의 S 범위 문장(`S0`–`S26`)과 목록에 `S27`을 더한다.
      「문서 스키마」 표는 건드리지 않는다.
- [ ] `docs/gates.md`의 범위 문장 「`S`로 시작하는 코드(S0–S26)」(`:17`)를
      `S0–S27`로 고치고, S20 설명 옆에 S27 한 줄을 더한다. 이 파일은 어떤
      테스트도 검사하지 않으므로 빠뜨리면 조용히 drift가 남는다.
- [ ] `docs/troubleshooting.md`의 S 코드 표에 S20 행 다음으로 S27 행을 더한다.
      해소 방법은 "값을 문서 경로 문자열 배열로 쓰거나 필드를 빼세요"다.
- [ ] `rules/okf.md` Plan fields 문단에 `bouncer.supersedes` 서술을 더한다.
- [ ] `node --test test/public-contract.test.js`로 문서와 구현의 코드 집합이
      맞는지 확인한다.
- [ ] `npm run ci`가 통과한다.
