---
type: bouncer.tasks
title: nextBlueprint에 같은 epic 잔여 blueprint 필드를 더함
description: sameEpicPending 필드와 finalize 스킬의 인계 분기
resource: .bouncer/context/epics/009-agent-orchestration/blueprints/010-finalize-pointer-scope/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-25T11:09:18.779+09:00'
bouncer:
  id: TASKS-001
  epic_id: '009'
  blueprint_id: '010'
  status: verified
  verify: npm run ci
  commit_intent:
    - finalize 뒤 같은 epic에 남은 계획을 사용자가 스스로 기억해야 했음
    - 잔여 blueprint를 상태와 함께 페이로드에 실어 인계 확인이 뜨게 함
  affected_paths:
    - scripts/src/lib/current.ts
    - scripts/src/lib/finalize.ts
    - scripts/lib/current.js
    - scripts/lib/finalize.js
    - test/current.test.js
    - test/finalize.test.js
    - skills/bouncer-finalize/SKILL.md
    - test/skill-bouncer-finalize.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-25T11:13:54.000+09:00'
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - .bouncer/context/epics/012-finalize-handoff/blueprints/001-next-blueprint-handoff
      - .bouncer/context/epics/012-finalize-handoff/blueprints/001-next-blueprint-handoff/tasks/001
      - .bouncer/context/epics/010-active-pointer-cli/blueprints/001-current-command/tasks/001
    basis:
      - graph: source
        status: reused
        query: finalize next blueprint handoff pointer current --set nextBlueprint listReadyBlueprints same epic pending draft
        result: 27 hits, rolled up to scripts/src/lib and scripts/lib; top nodes nextBlueprint()/listReadyBlueprints()/readAffectedPaths() in current.ts, finalize.ts, cli-current-command.ts
      - graph: context
        status: updated
        query: finalize next blueprint handoff pointer current --set nextBlueprint listReadyBlueprints same epic pending draft
        result: 3 hits, all prior planning docs — epic 012 next-blueprint-handoff index/tasks and epic 010 current-command tasks
---
# Tasks

Blueprint: [010](../../index.md)

## Goal & intent
`nextBlueprint`가 지금은 `--set` 가능한 후보만 돌려주기 때문에, 같은 epic에 아직
`draft`인 blueprint가 남아 있으면 `/bouncer-finalize` step 6의 인계 확인이 통째로
건너뛰어진다. 이 task 뒤에는 `nextBlueprint` 반환에 `sameEpicPending` 배열이 함께
실려, finalize 스킬이 그 값으로 「`--set`을 제안할 형제」와 「`/bouncer-plan`으로
안내할 형제」를 갈라낸다. `listReadyBlueprints`의 후보 조건은 그대로 두므로
`bouncer current`의 `ready` 목록과 `--set` 자동 선택은 달라지지 않는다.

## Interface
- 제공: `nextBlueprint({ repoRoot, blueprintDir })`의 반환이
  `{ next, remaining, sameEpicPending }`가 된다. `sameEpicPending`은
  `{ blueprint: string, blueprintStatus: string, ready: boolean }`의 배열이며,
  finalize 대상과 같은 epic에 있고 blueprint `bouncer.status`가 `closed`가 아닌
  형제만 담는다. `blueprintStatus`는 그 blueprint `index.md`의 `bouncer.status`
  문자열이고, `ready`는 같은 호출에서 얻은 `listReadyBlueprints` 결과에 그
  blueprint 경로가 있는지로 정한다 — 후보 조건을 새로 구현하지 않는다.
  정렬은 `blueprint` 경로 사전순이다. `next`와 `remaining`의
  모양·정렬·`sharedPaths` 계산은 바뀌지 않는다.
  `finalize`의 `next()` throw 폴백도 `{ next: null, remaining: [], sameEpicPending: [] }`가 된다.
- 거부: finalize 대상 자신, `closed` blueprint, 다른 epic의 blueprint는
  `sameEpicPending`에 담지 않는다. 자기 제외는 기존 `nextBlueprint`와 같이
  정규화 전 문자열과 POSIX 정규화 경로 양쪽(`selfRaw` / `selfPosix`)으로 비교한다.
  `index.md`를 읽을 수 없거나 파싱에 실패한
  형제는 그 항목만 건너뛰고 예외를 던지지 않는다. `sameEpicPending`은 어떤 경우에도
  배열이며 `undefined`가 되지 않는다.

## Touch
- Modify `scripts/src/lib/current.ts` — 같은 epic 형제를 스캔하는 순수 헬퍼를 더하고
  `nextBlueprint` 반환에 `sameEpicPending`을 싣는다. `listReadyBlueprints`는 건드리지 않고
  `ready` 판정에 그 결과를 재사용한다. 이 파일의 기존 entry `status`는 첫 열린 task의
  상태라서 뜻이 다르므로 새 필드 이름은 `blueprintStatus`다.
- Modify `scripts/src/lib/finalize.ts` — `next()`가 throw할 때의 빈 핸드오프 폴백에
  `sameEpicPending: []`를 더한다.
- Modify `scripts/lib/current.js` — 위 변경의 커밋된 CJS emit. 손으로 고치지 않고 빌드로 갱신한다.
- Modify `scripts/lib/finalize.js` — 같은 이유의 emit 갱신.
- Modify `test/current.test.js` — 반환 전체를 `deepStrictEqual`로 비교하는 두 곳의
  기대값을 새 모양으로 고치고, `sameEpicPending`의 포함·제외·정렬·깨진 형제 케이스를 더한다.
- Modify `test/finalize.test.js` — 폴백 페이로드의 `deepStrictEqual` 기대값을 새 모양으로 고친다.
- Modify `skills/bouncer-finalize/SKILL.md` — step 6이 `sameEpicPending`을 읽어
  `--set` 제안과 `/bouncer-plan` 안내로 갈라지게 쓴다.
- Modify `test/skill-bouncer-finalize.test.js` — 그 분기가 스킬 본문에 있는지 계약으로 잠근다.

## Do not touch
- `scripts/src/lib/cli-current-command.ts` — `bouncer current`의 `ready` 표현은 이번 변경
  대상이 아니다. 여기를 고치면 포인터 명령의 출력 계약이 같이 흔들린다.
- `scripts/src/lib/validate-gates.ts` — 게이트 판정은 바뀌지 않는다. 새 필드는 보고용이다.
- `.bouncer/config.json` — 새 설정 키를 만들지 않는다.
- `skills/bouncer-commit/SKILL.md` — 같은 blueprint의 다음 task 인계는 그쪽 계약이다.

## Constraints
- `listReadyBlueprints`의 후보 조건(`approved` + 열린 task)은 그대로 둔다. 잔여 목록은
  별도 스캔으로 만든다.
- `nextBlueprint`는 순수 계산을 유지한다 — 파일 쓰기, git 호출, 프로세스 실행을 넣지 않는다.
- 새 게이트 번호를 만들지 않고 기존 G/S 코드의 판정을 바꾸지 않는다.
- 스킬 본문에서 `draft` 형제에 대해 `bouncer current --set`을 제안하지 않는다 —
  plan 게이트 G2가 거절하는 명령이다.
- `scripts/lib/*.js`는 손으로 편집하지 않는다. `npm run build`(또는 `pretest`) 산출물만 커밋한다.
- 공개 문자열과 스킬 본문의 한국어를 유지한다.

## Checklist
- [ ] `test/current.test.js`에 실패 테스트를 먼저 더한다: 같은 epic에 `draft` 형제가
      하나 있고 ready 후보가 없을 때
      `nextBlueprint(...)`가 `next: null`이면서
      `sameEpicPending`에 `{ blueprint, blueprintStatus: 'draft', ready: false }` 한 건을 담는지.
- [ ] 같은 파일에 제외 케이스를 더한다: `closed` 형제, 다른 epic의 blueprint,
      finalize 대상 자신은 `sameEpicPending`에 들어가지 않는다.
- [ ] 같은 파일에 공존 케이스를 더한다: 같은 epic에 `approved`+열린 task 형제와
      `draft` 형제가 동시에 있으면 `next`가 앞의 것을 가리키면서
      `sameEpicPending`은 두 건을 모두 담고, `ready`가 각각 `true` / `false`이며,
      배열이 `blueprint` 경로 사전순으로 정렬되어 있다.
- [ ] 같은 파일에 `ready: false` 경계 케이스를 더한다: 같은 epic 형제가 `approved`인데
      task가 전부 `verified`면 `sameEpicPending`에
      `{ blueprintStatus: 'approved', ready: false }`로 실리고 `next`는 그것을 가리키지 않는다.
- [ ] 같은 파일에 깨진 형제 케이스를 더한다: `index.md`가 없거나 파싱에 실패하는
      형제가 있어도 throw 없이 나머지 형제가 목록에 남는다.
- [ ] `npm test`로 위 테스트가 실패하는 것을 먼저 확인한다.
- [ ] `scripts/src/lib/current.ts`에 같은 epic 형제 스캔 헬퍼를 더하고 `nextBlueprint`가
      `sameEpicPending`을 반환하게 한다. `listReadyBlueprints` 본문은 그대로 둔다.
- [ ] `test/current.test.js`에서 반환 전체를 `deepStrictEqual`로 비교하는 두 곳
      (「no candidates remain」과 「excludes a closed blueprint」)의 기대값을
      새 모양으로 고친다. 후자는 `closed` 형제가 `sameEpicPending`에서도 빠지는지를
      함께 단언하는 자리다.
- [ ] `scripts/src/lib/finalize.ts`의 `next()` throw 폴백을
      `{ next: null, remaining: [], sameEpicPending: [] }`로 고치고,
      `test/finalize.test.js`의 대응 `deepStrictEqual` 기대값을 같이 고친다.
- [ ] `skills/bouncer-finalize/SKILL.md` step 6을 고친다:
      `next.next`와 `next.sameEpicPending`을 함께 읽고, 둘 다 비어 있으면 지금처럼 건너뛴다.
      `sameEpicPending`이 비어 있지 않으면 blueprint 경로와 `blueprintStatus`를
      목록으로 보여준다. `--set` 대상은 언제나 `next.next.blueprint` 하나이고,
      그 경로와 같은 항목은 잔여 목록에 다시 적지 않는다. `ready: false` 항목은
      `--set` 선택지에 올리지 않고 `/bouncer-plan`으로 안내한다는 문장을 넣는다.
- [ ] `test/skill-bouncer-finalize.test.js`에 그 스킬 본문 계약을 잠그는 테스트를 더한다 —
      본문이 `sameEpicPending`을 언급하고, `draft` 형제에 `--set`을 제안하지 않는다는
      문장을 담는지.
- [ ] `npm run build`로 `scripts/lib/current.js`와 `scripts/lib/finalize.js` emit을 갱신한다.
- [ ] `npm run ci`가 통과하는 것을 확인한다.
