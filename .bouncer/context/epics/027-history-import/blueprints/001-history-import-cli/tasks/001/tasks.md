---
type: bouncer.tasks
title: 임포트 문서 status 어휘와 게이트 제외 분기
description: imported status를 어휘에 넣고 validate가 임포트 blueprint를 게이트 대상에서 뺀다
resource: .bouncer/context/epics/027-history-import/blueprints/001-history-import-cli/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-11T16:09:15.787+09:00'
bouncer:
  id: TASKS-001
  epic_id: '027'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - 과거 커밋에 verify를 돌릴 수 없어 임포트 문서를 정상 status로 두면 통과 흔적이 위조됨
    - 게이트 판정을 아예 건너뛰는 대신 단일 구조 코드로 거절해 포인터 설정까지 같이 막음
  affected_paths:
    - scripts/src/lib/schema.ts
    - scripts/src/lib/validate.ts
    - scripts/lib/schema.js
    - scripts/lib/validate.js
    - test/schema.test.js
    - test/validate-structural.test.js
    - test/current.test.js
    - docs/gates.md
    - docs/ARCHITECTURE.md
    - docs/troubleshooting.md
  graph:
    generated_at: '2026-08-11T16:18:24.029+09:00'
    command: graphify query (source + context)
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - docs
    basis:
      - graph: source
        status: reused
        query: STATUS_ENUM blueprint status vocabulary / validateBlueprint gate structural failure codes
        result: 38+56 hits; scripts/src/lib/{schema,validate}.ts, scripts/lib/{schema,validate}.js, test/validate-structural.test.js
      - graph: context
        status: updated
        query: import git history into imported status documents outside gates
        result: 3 hits; 027-history-import/index.md, 022-blueprint-closure BP explain.md
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`bouncer.epic`과 `bouncer.blueprint`의 status 어휘에 `imported`가 들어가고, `validateBlueprint`가 `imported` blueprint를 만나면 게이트를 평가하지 않고 구조 코드 `S18` 하나로 거절한다. 이 task가 끝나면 손으로 만든 `imported` 문서가 S6에 걸리지 않고, 그 blueprint에 게이트를 걸어도 G1·G2가 줄줄이 뜨지 않으며, `bouncer current --set`이 임포트 blueprint를 포인터로 잡지 못한다. 아직 임포트 문서를 만드는 명령은 없다.

게이트를 건너뛰고 `ok: true`를 돌려주면 안 된다. `cmdCurrent --set`은 plan 게이트가 통과하면 포인터를 쓰므로, 통과로 처리하면 임포트 문서가 작업 대상이 된다. 실패로 처리하되 이유를 `S18` 하나로 좁힌다.

## Interface
- 제공
  - `schema.ts` `STATUS_ENUM['bouncer.epic']` = `['draft', 'approved', 'closed', 'imported']`
  - `schema.ts` `STATUS_ENUM['bouncer.blueprint']` = `['draft', 'approved', 'superseded', 'closed', 'imported']`
  - `validateBlueprint`가 blueprint `index.md`의 status가 `imported`이면 구조 검사까지만 수행하고 `checkGate`를 호출하지 않는다. 대신 실패 하나를 더한다.
    ```
    { code: 'S18',
      message: 'imported document is out of gate scope',
      file: '<blueprint dir>/index.md' }
    ```
- 거부
  - `gate` 인자가 없는 호출에서도 `imported` blueprint는 `S18`로 거절한다. 게이트 요청 여부와 무관하게 작업 대상이 아니다.
  - epic만 `imported`이고 blueprint가 `approved`인 조합은 이 분기를 타지 않는다. 판정 기준은 blueprint status 하나다.
  - `S18`이 붙은 결과에 G 코드를 함께 담지 않는다.

## Touch
- Modify `scripts/src/lib/schema.ts` — `STATUS_ENUM`의 epic·blueprint 배열에 `imported` 추가
- Modify `scripts/lib/schema.js` — 위 변경의 CJS emit 갱신
- Modify `scripts/src/lib/validate.ts` — `validateBlueprint`에 `imported` 분기와 `S18` 추가
- Modify `scripts/lib/validate.js` — 위 변경의 CJS emit 갱신
- Modify `test/schema.test.js` — `deepStrictEqual`로 고정된 status 배열 갱신
- Modify `test/validate-structural.test.js` — `S18` 케이스와 G 코드 부재 assert 추가
- Modify `test/current.test.js` — `listReadyBlueprints`가 `imported` blueprint를 제외하는 회귀 추가
- Modify `docs/gates.md` — S 코드 범위와 `S18` 설명
- Modify `docs/ARCHITECTURE.md` — 게이트 코드 범위 표기 `S1–S17` → `S1–S18`
- Modify `docs/troubleshooting.md` — `S18` 대응 행 추가

## Do not touch
- `scripts/src/lib/current.ts` — 포인터 거절은 plan 게이트 실패로 이미 얻어진다. 별도 status 분기를 넣지 않는다
- `scripts/src/lib/import-history.ts` — 이 task에는 없는 파일이다
- `scripts/src/lib/cli.ts` — CLI 표면은 task 003
- `scripts/src/lib/migrate-ids.ts`
- `scripts/src/lib/finalize.ts`

## Constraints
- 기존 게이트 코드 번호와 본문 계약을 유지한다. `S14`는 은퇴한 번호이므로 재사용하지 않고 `S18`을 신설한다.
- `validateBlueprint` 반환 형태 `{ ok, failures }`를 바꾸지 않는다. `gateSkipped` 같은 새 키를 넣지 않는다.
- `checkEpicIndexConsistency`는 `imported` 분기에서도 그대로 돈다. 임포트 epic이 목록에서 빠진 상태를 이 분기가 가려서는 안 된다.
- 공개 문자열의 한국어/영어 사용은 주변 코드를 따른다. 실패 `message`는 기존 코드들과 같이 영어다.
- 하위 호환 별칭을 남기지 않는다.

## Checklist
- [ ] `test/schema.test.js`의 status 배열 assert를 `imported` 포함으로 고치고 실패를 확인한다.
```js
assert.deepStrictEqual(schema.STATUS_ENUM['bouncer.blueprint'],
  ['draft', 'approved', 'superseded', 'closed', 'imported']);
assert.deepStrictEqual(schema.STATUS_ENUM['bouncer.epic'],
  ['draft', 'approved', 'closed', 'imported']);
```
- [ ] `scripts/src/lib/schema.ts`의 두 배열에 `imported`를 더해 통과시킨다.
- [ ] `test/validate-structural.test.js`에 실패 테스트를 추가하고 실패를 확인한다. epic·blueprint status가 `imported`이고 `index.md`만 있는 blueprint에 대해:
```js
const r = validateBlueprint({ repoRoot: repo, blueprintDir: bp, gate: 'plan' });
assert.strictEqual(r.ok, false);
const codes = r.failures.map((f) => f.code);
assert.deepStrictEqual(codes, ['S18']);
assert.ok(!codes.some((c) => c.startsWith('G')));
```
- [ ] 같은 파일에 게이트 없는 호출도 `S18`을 내는 assert를 추가한다(`gate` 미지정).
- [ ] `scripts/src/lib/validate.ts`에서 `loadBlueprintDocs` 이후, `checkGate` 호출 이전에 `statusOf(docs.blueprintIndex) === 'imported'` 분기를 넣는다. 구조 실패와 `checkEpicIndexConsistency` 결과는 유지한 채 `S18`을 더하고 `checkGate`를 건너뛴다.
- [ ] `test/current.test.js`에 `imported` blueprint가 `listReadyBlueprints` 결과에 없다는 assert를 추가한다. 현재 구현은 `status !== 'approved'`를 걸러내므로 코드 변경 없이 통과해야 한다. 통과하지 않으면 구현이 아니라 assert를 의심한다.
- [ ] `docs/gates.md`의 `S0–S17`을 `S0–S18`로 고치고 `S18`이 임포트 문서를 게이트 대상에서 빼는 코드임을 한 줄로 적는다.
- [ ] `docs/ARCHITECTURE.md`의 `G1–G16/S1–S17` 표기를 `S1–S18`로 고친다.
- [ ] `docs/troubleshooting.md`에 `S18 imported document is out of gate scope` 행을 추가한다. 대응은 「임포트 문서는 작업 대상이 아니다. 새 blueprint를 만들라」다.
- [ ] `npm test`가 통과한다. `pretest`가 `tsc`를 돌리므로 `scripts/lib/*.js` emit이 갱신된 상태로 커밋한다.
