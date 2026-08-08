---
type: bouncer.tasks
title: finalize가 마감한 blueprint를 closed로 잠금
description: Tasks for 001
resource: .bouncer/context/epics/022-blueprint-closure/blueprints/001-closed-status/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-08T13:17:10.191+09:00'
bouncer:
  id: TASKS-001
  epic_id: '022'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - finalize가 끝나도 blueprint status가 approved로 남아 마감 여부를 문서에서 읽을 수 없음
    - 마감 시점에 closed를 찍고 plan 게이트가 그 사유를 구분해 보고하게 함
  affected_paths:
    - scripts/src/lib/schema.ts
    - scripts/lib/schema.js
    - scripts/src/lib/finalize.ts
    - scripts/lib/finalize.js
    - scripts/src/lib/validate.ts
    - scripts/lib/validate.js
    - test/schema.test.js
    - test/finalize.test.js
    - test/validate-gates.test.js
    - test/current.test.js
    - docs/gates.md
    - docs/workflow.md
  graph:
    generated_at: '2026-08-08T13:30:24.658+09:00'
    command: graphify query (source + context)
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - docs
    basis:
      - graph: source
        status: reused
        query: blueprint closed status lock finalize scaffold task validate G2 schema
          status enum
        result: 57 nodes; scripts/src/lib/{finalize,validate,scaffold,current,cli}.ts,
          test/schema.test.js. source_dirs가 scripts/hooks/test라 docs/는 반환되지 않아
          suggested_paths에 손으로 추가
      - graph: context
        status: updated
        query: 마감된 blueprint 잠금 status closed finalize 전이
        result: 19 nodes; 022 epic/blueprint 본문과 EPIC-012 finalize-handoff — 코드 경로 히트 없음
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
blueprint status 어휘에 `closed`가 생기고, `bouncer finalize --yes`가 마감한
blueprint의 `index.md`를 `closed`로 바꿔 그 변경을 finalize 커밋에 함께 담는다.
그 뒤 `bouncer validate --gate plan`은 잠긴 blueprint를 미승인 `draft`와 구분되는
사유로 보고하고, `bouncer current --set`은 포인터를 쓰지 않는다. `listReadyBlueprints`가
잠긴 blueprint를 후보에서 빼는 성질도 회귀 테스트로 고정한다.

이 task는 잠금 신호를 세우는 데까지다. 잠긴 blueprint에 `scaffold task`를 거절하는
일은 002가 맡는다.

## Interface
- 제공
  - `schema.STATUS_ENUM['bouncer.blueprint']`가
    `['draft', 'approved', 'superseded', 'closed']`가 된다.
  - `finalize({ repoRoot, blueprintDir, yes: true, ... })`가 blueprint `index.md`의
    `bouncer.status`를 `closed`로 쓰고 그 경로를 stage 대상에 넣는다. 반환값에
    `closed` 필드가 생기고, 값은 이번 실행이 잠금을 기록한 문서의 repo 상대 경로,
    잠금을 기록하지 않았으면 `null`이다.
  - `finalize({ ..., yes: false })`(dry-run)가 파일을 쓰지 않은 채 `closed`에
    「쓰게 될 경로」를 담아 반환한다.
  - `validate --gate plan`이 `closed` blueprint에 대해 G2를 마감 사유 문구로 낸다.
- 거부
  - dry-run은 어떤 문서도 수정하지 않는다.
  - 이미 `bouncer.status`가 `closed`인 blueprint에는 다시 쓰지 않고 `closed: null`을
    반환한다. 그 실행에서 stage 대상이 비면 기존대로 커밋을 건너뛴다.
  - `index.md`가 없거나 프론트매터 파싱에 실패하면 status를 쓰지 않고 `closed: null`을
    반환한다. finalize를 실패시키지 않는다.
  - out-of-scope 검사는 status를 쓰기 **전에** 끝낸다. 위반이 있으면 문서를 건드리지
    않고 기존 `reason: 'out-of-scope'` 반환을 유지한다.
  - `closed`에서 `approved`로 되돌리는 전이는 제공하지 않는다.

## Touch
- Modify `scripts/src/lib/schema.ts` — blueprint status 어휘에 `closed` 추가
- Modify `scripts/lib/schema.js` — 위 변경의 CJS emit
- Modify `scripts/src/lib/finalize.ts` — 잠금 전이 헬퍼 추가, stage 대상 합류,
  빈-커밋 건너뛰기 분기와 반환 형태 갱신
- Modify `scripts/lib/finalize.js` — 위 변경의 CJS emit
- Modify `scripts/src/lib/validate.ts` — G2 메시지를 `closed`와 그 밖으로 분기
- Modify `scripts/lib/validate.js` — 위 변경의 CJS emit
- Modify `test/schema.test.js` — blueprint status 어휘 assert 추가
- Modify `test/finalize.test.js` — 잠금 전이·dry-run 무수정·재실행 멱등 케이스와
  기존 빈-커밋 단정 갱신
- Modify `test/validate-gates.test.js` — `closed` blueprint의 G2 사유 assert
- Modify `test/current.test.js` — `closed` blueprint가 `listReadyBlueprints`와
  `nextBlueprint` 후보에서 빠지는 회귀
- Modify `docs/gates.md` — G2 설명에 잠금 사유 추가
- Modify `docs/workflow.md` — finalize 단계에 blueprint 잠금과 수동 해제 기술

## Do not touch
- `scripts/src/lib/scaffold.ts` — 잠긴 blueprint의 task 스캐폴드 거절은 002 담당
- `scripts/lib/scaffold.js` — 같은 이유
- `test/scaffold.test.js` — 같은 이유
- `skills/` — 차단은 CLI와 게이트에서 하고 스킬 프로즈는 바꾸지 않는다
- `.bouncer/Distill.md` — Distill 승격은 `/bouncer-finalize` 몫이다

## Constraints
- `scripts/lib/*.js`는 손으로 고치지 않는다. `scripts/src/**` 를 고치고
  `npm run build`(또는 `pretest`)로 emit을 재생성한 결과를 커밋한다.
- CLI·게이트 메시지는 기존 코드와 같이 영어로 쓴다. 문서 본문만 한국어다.
- 기존 게이트 번호와 본문 계약을 유지한다. 새 G/S 코드를 만들지 않고 G2 문구만 나눈다.
- `superseded`는 어휘에서 빼지 않는다.
- `makeAllowed`가 `blueprintDir` 하위를 허용하는 성질에 기대어 status 변경이
  out-of-scope로 잡히지 않는다. 그 의존을 주석 한 줄로 남긴다.
- 프론트매터 재기록은 `parseFrontmatter` + `renderDoc` 조합을 쓴다
  (`migrate-ids.ts`와 같은 방식). 별도 YAML 직렬화 경로를 새로 만들지 않는다.
- `finalize`의 기존 반환 키(`ok` `dryRun` `staged` `commitMessage` `committed`
  `pointerCleared` `next` `reason` `violations` `failures`)는 이름과 의미를 유지한다.

## Checklist
- [ ] `test/schema.test.js`의 「id prefix and status enum per type」에 아래를 더하고
      실패를 확인한다.
      ```js
      assert.deepStrictEqual(schema.STATUS_ENUM['bouncer.blueprint'],
        ['draft', 'approved', 'superseded', 'closed']);
      ```
- [ ] `scripts/src/lib/schema.ts`의 `'bouncer.blueprint'` 어휘에 `'closed'`를 더한다.
- [ ] `test/finalize.test.js`에 잠금 전이 테스트를 더하고 실패를 확인한다.
      `--yes` 실행 뒤 blueprint `index.md`를 다시 읽어 status가 바뀌었고,
      그 경로가 stage 목록에 들어갔는지 본다.
      ```js
      assert.strictEqual(res.closed,
        `${blueprintDir}/index.md`);
      assert.ok(res.staged.includes(`${blueprintDir}/index.md`));
      assert.match(fs.readFileSync(path.join(repo, blueprintDir, 'index.md'), 'utf8'),
        /status: closed/);
      ```
- [ ] dry-run이 문서를 수정하지 않는 테스트를 더한다. `yes` 없이 부른 뒤 파일
      내용이 그대로이고 `res.closed`가 잠글 경로를 가리키는지 본다.
      ```js
      assert.strictEqual(res.dryRun, true);
      assert.match(before, /status: approved/);
      assert.strictEqual(after, before);
      ```
- [ ] 이미 `closed`인 blueprint에 `--yes`로 다시 돌리는 테스트를 더한다.
      status는 재기록되지 않고, 다른 변경이 없으면 커밋을 건너뛴다.
      ```js
      assert.strictEqual(res.closed, null);
      assert.strictEqual(res.committed, false);
      ```
- [ ] `scripts/src/lib/finalize.ts`에 blueprint `index.md`를 `closed`로 재기록하는
      헬퍼를 추가한다. 이미 `closed`이거나 파일 없음·파싱 실패면 아무것도 쓰지 않고
      `null`을 돌린다.
- [ ] `finalize`의 `--yes` 경로를 다음 순서로 맞춘다 — stage 후보 수집 →
      out-of-scope 검사 → 잠금 기록 → 잠근 경로를 stage 후보에 합침(중복 제거) →
      비었으면 커밋 건너뛰고 포인터 정리 → 아니면 stage·commit·포인터 정리.
      dry-run은 out-of-scope 검사 다음에 `closed` 예정 경로를 담아 바로 반환한다.
- [ ] 기존 빈-커밋 테스트(`test/finalize.test.js`의 `committed: false` 단정)를
      「이미 `closed`인 blueprint」 전제로 고쳐 여전히 성립하게 한다.
- [ ] `test/validate-gates.test.js`에 `closed` blueprint의 plan 게이트 테스트를
      더하고 실패를 확인한다. 코드는 `G2`이되 메시지가 미승인 문구와 달라야 한다.
- [ ] `scripts/src/lib/validate.ts`의 G2 판정을 status에 따라 분기한다.
      `closed`면 마감 사유와 새 blueprint 안내를 담은 영어 문구를, 그 밖이면
      기존 `blueprint.status != approved`를 그대로 낸다.
- [ ] `test/current.test.js`에 `closed` blueprint가 `listReadyBlueprints` 결과와
      `nextBlueprint` 후보에 없다는 회귀 테스트를 더한다.
- [ ] `docs/gates.md`의 plan 행 G2 설명에 잠금 blueprint가 같은 코드로 걸린다는
      점을 한 구절 더한다.
- [ ] `docs/workflow.md`의 `/bouncer-finalize` 항목에 blueprint가 `closed`로
      잠긴다는 것과, 해제는 `index.md` status를 손으로 `approved`로 돌리는
      방법뿐이라는 것을 적는다.
- [ ] `npm test`를 돌려 통과를 확인한다.
      ```bash
      npm test
      ```
