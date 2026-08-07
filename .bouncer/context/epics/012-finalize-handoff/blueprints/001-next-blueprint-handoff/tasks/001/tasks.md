---
type: bouncer.tasks
title: 다음 후보 계산 함수를 더해 마감 반환에 싣고 스킬이 확인 후 포인터를 옮기게 함
description: nextBlueprint 신설, finalize 반환의 next 필드, 마감 스킬 인계 단계
resource: .bouncer/context/epics/012-finalize-handoff/blueprints/001-next-blueprint-handoff/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-04T18:03:35.679+09:00'
bouncer:
  id: TASKS-001
  epic_id: '012'
  blueprint_id: '001'
  status: verified
  affected_paths:
    - scripts/src/lib/current.ts
    - scripts/lib/current.js
    - scripts/src/lib/finalize.ts
    - scripts/lib/finalize.js
    - skills/bouncer-finalize/SKILL.md
    - test/current.test.js
    - test/finalize.test.js
    - test/skill-bouncer-finalize.test.js
    - docs/workflow.md
  graph:
    generated_at: '2026-08-04T18:20:00+09:00'
    command: graphify query (source + context)
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - skills
      - docs
    basis: 'graph-sync가 source·context를 모두 재빌드했다(built: source, context / failed: [] / missing: []). source 질의 "nextBlueprint listReadyBlueprints finalize pointer current --set epic Blueprints order handoff"는 current.ts/js와 finalize.ts/js를 중심으로 돌려줬고, current의 import 간선이 runtime-state·frontmatter·paths와 소비자 cli·advisor·commit-hook을 함께 보여줬다. 소비자 중 cli는 finalize 결과를 그대로 직렬화해 새 필드가 배선 없이 흘러나가므로 Do not touch로 내렸고, advisor·commit-hook은 이번 계약과 무관해 같은 처리를 했다. context 질의 "finalize next blueprint notification pointer advance ready candidates"는 EPIC-011의 BP distill만 집었다 — 선행 스트림이 없다는 뜻이고 discovery의 Overlap(EPIC-010 후속, 신규 열거 로직 없음)과 일치한다. skills와 docs는 config.source_dirs(scripts/hooks/test) 밖이라 질의에 나오지 않아 수동으로 보탰다.'
---
# Tasks

Blueprint: [001](index.md)

## Goal & intent
마감이 끝나는 자리에서 "다음은 무엇인가"를 하네스가 답한다. `nextBlueprint`가 이미 있는
후보 열거(`listReadyBlueprints`)와 이미 있는 순서(에픽 `## Blueprints` 목록)를 합쳐 다음
후보 하나와 남은 목록을 계산하고, `finalize`가 그 결과를 반환에 실어 명령 출력으로
흘려보낸다. 마감 스킬은 그것을 보여주고 승낙을 받은 경우에만 `bouncer current --set`을
실행한다. 새 상태 파일도 새 CLI 명령도 만들지 않으며, 커밋 후 포인터를 지우는 현행 동작은
그대로다. 검증은 `npm test`.

## Interface
- 제공: `current` 모듈이 `nextBlueprint({ repoRoot, blueprintDir })`를 내보낸다. 반환은
  `{ next, remaining }`이며 `next`는 `{ blueprint, epic, sameEpic, sharedPaths }` 또는
  `null`, `remaining`은 `{ blueprint, epic, sameEpic }` 배열이다. `blueprint`는 repo
  기준 posix 경로로 `listReadyBlueprints`와 같은 형식이다.
- 제공: 정렬 규칙 — (1) `blueprintDir`와 같은 에픽의 후보가 앞, (2) 같은 에픽 안에서는
  에픽 `index.md` 본문 `## Blueprints`의 링크 등장 순서, (3) 그 목록에 없는 후보는
  경로 사전순으로 그 뒤, (4) 다른 에픽은 에픽 디렉터리 이름 사전순.
- 제공: `sharedPaths`는 마감 대상 tasks의 `affected_paths`와 후보 tasks의
  `affected_paths` 교집합이다. 순서는 후보 쪽 배열 순서를 따른다.
- 제공: `finalize(...)`가 dry-run 반환과 커밋 완료 반환 양쪽에 `next`를 싣는다. 값은
  `nextBlueprint`의 반환 객체 그대로다.
- 제공: `skills/bouncer-finalize/SKILL.md`에 워크트리 정리(현행 5단계)와 최종 보고 사이
  단계가 하나 늘어난다. 후보·경고를 보여주고 명시적 승낙 뒤에만
  `node "${BOUNCER_ROOT}/scripts/bouncer" current --set <다음 블루프린트>`를 실행한다.
- 거부: `nextBlueprint`는 어떤 파일도 쓰지 않는다. 포인터 기록은 오직 `current --set`이
  하며, 그 명령은 plan 게이트를 통과할 때만 기록한다 — 이 계약을 우회하지 않는다.
- 거부: 후보가 없을 때 `next`는 `null`이고 이것은 오류가 아니다. `finalize`의 `ok`와 종료
  코드는 후보 유무에 영향받지 않는다.
- 거부: 마감 대상 자신은 후보가 될 수 없다. `listReadyBlueprints`가 `verified`를 이미
  제외하지만, 그와 별개로 `blueprintDir`와 같은 경로는 결과에서 제외한다.
- 거부: 문서를 읽을 수 없어도 예외를 던지지 않는다. 에픽 `index.md`를 못 읽으면 그 에픽의
  후보는 사전순으로만 정렬하고, tasks를 못 읽으면 `sharedPaths`는 `[]`가 된다.
- 거부: 스킬은 승낙 없이 포인터를 옮기지 않는다. "예"가 없으면 명령만 보여준다.

## Touch
- Modify `scripts/src/lib/current.ts` — `nextBlueprint`와 에픽 `## Blueprints` 순서
  파싱을 추가하고 export한다. `listReadyBlueprints`의 현재 계약은 그대로 둔다.
- Modify `scripts/lib/current.js` — 위 소스의 빌드 산출물. `npm run build`(`pretest`)로
  재생성해 커밋한다. 손으로 편집하지 않는다.
- Modify `scripts/src/lib/finalize.ts` — `nextBlueprint`를 주입 가능한 의존성으로 받아
  dry-run·커밋 완료 반환에 `next`를 싣는다. 스테이징·커밋·포인터 해제 순서는 그대로.
- Modify `scripts/lib/finalize.js` — 위 소스의 빌드 산출물.
- Modify `skills/bouncer-finalize/SKILL.md` — 인계 단계를 추가하고 최종 보고 항목에
  포인터 전진 여부를 더한다.
- Modify `test/current.test.js` — `nextBlueprint`의 단위 테스트를 더한다.
- Modify `test/finalize.test.js` — 반환에 `next`가 실리는지, 후보 없음이 `ok`를 흔들지
  않는지 단언을 더한다.
- Modify `test/skill-bouncer-finalize.test.js` — 새 단계 문구에 대한 단언을 더한다.
- Modify `docs/workflow.md` — 4번 항목에 마감이 다음 후보를 통지하고 확인 후 포인터를
  옮긴다는 한 줄을 더한다.

## Do not touch
- `scripts/src/lib/cli.ts` — `cmdFinalize`가 결과 객체를 통째로 직렬화하므로 `next`는
  배선 없이 흘러나간다. 명령 표면을 건드릴 이유가 없다.
- `scripts/src/lib/runtime-state.ts` — 포인터 파일의 위치와 형식은 그대로다.
- `scripts/src/lib/validate.ts` — 게이트 판정은 이 변경과 무관하다.
- `scripts/src/lib/advisor.ts` — `detectPhase`·`advise`는 이번 범위 밖이다.
- `scripts/src/lib/commit-hook.ts`, `hooks/commit-safety.js` — 커밋 가드는 별개 경로다.
- `scripts/src/lib/schema.ts`, `.bouncer/config.json` — 새 설정 키를 만들지 않는다.
- `skills/bouncer-execute/SKILL.md`, `skills/bouncer-plan/SKILL.md` — 워크플로 순서와
  다른 스킬의 포인터 사용은 바뀌지 않는다.
- `.bouncer/context/index.md` — 에픽 목록 드리프트는 이 에픽 밖이다.

## Constraints
- 다음 후보는 **계산**이지 기억이 아니다. 후보나 순서를 어떤 파일에도 저장하지 않는다.
- `nextBlueprint`는 부수효과가 없다. 파일 쓰기·git 호출·프로세스 실행을 하지 않는다.
- 후보 원천은 `listReadyBlueprints` 하나다. 승인·ready 판정을 다시 구현하지 않는다.
- 문서 하나가 깨져도 나머지 열거가 살아남는다 — `listReadyBlueprints`의 per-entry
  try/catch 성질을 정렬 단계에서도 유지한다.
- `finalize`의 `ok`, 종료 코드, out-of-scope 하드 중단, 커밋 후 `clearCurrent` 호출은
  모두 현행 그대로다. 기존 `test/finalize.test.js`가 수정 없이 통과해야 하며 그것이 이
  커밋의 경계다.
- `scripts/lib/*.js`는 `npm run build` 산출물이다. 소스는 항상 `scripts/src/**`.
- 새 런타임 의존성을 추가하지 않는다 (Node 표준 라이브러리 + 벤더링 `js-yaml`).
- 스킬 본문은 현행 언어(영어)를 유지한다. 라이브러리 공개 문자열도 기존 관례대로 영어.
- 스킬은 포인터를 `bouncer current --set`으로만 옮긴다. `node -e`로 `scripts/lib/current`를
  직접 부르지 않는다.
- 워크트리를 남긴 채 전진하면 공유 포인터 때문에 그 워크트리의 커밋 가드가 새 블루프린트
  경로를 강제한다는 경고를 스킬 문구에 남긴다.

## Checklist
- [ ] `test/current.test.js`에 실패 테스트를 먼저 추가하고 `npm test`로 **예상된 이유로**
      실패하는지 확인한다. 최소한 아래를 덮는다.
      ```js
      // 같은 에픽 우선 + ## Blueprints 순서를 따른다
      assert.strictEqual(res.next.blueprint, '.bouncer/context/epics/E-1/blueprints/002-b');
      assert.strictEqual(res.next.sameEpic, true);
      // 마감 대상 자신은 후보가 아니다
      assert.ok(!res.remaining.some((r) => r.blueprint === finalized));
      // 후보 없음은 null
      assert.deepStrictEqual(nextBlueprint({ repoRoot, blueprintDir: only }), { next: null, remaining: [] });
      // affected_paths 교집합이 sharedPaths로
      assert.deepStrictEqual(res.next.sharedPaths, ['scripts/src/lib/session-graph.ts']);
      ```
- [ ] `scripts/src/lib/current.ts`에 에픽 `## Blueprints` 순서 파서를 추가한다. 본문에서
      `## Blueprints` 절만 읽고 링크 대상의 블루프린트 디렉터리 이름을 등장 순서대로
      뽑는다. 절이 없거나 파일을 읽을 수 없으면 빈 배열을 돌려주고 던지지 않는다.
      ```js
      // * [제목](blueprints/001-slug/index.md) - 한 줄 목적
      /\]\(blueprints\/([^/)]+)\/index\.md\)/g
      ```
- [ ] `nextBlueprint({ repoRoot, blueprintDir })`를 추가하고 export한다. `blueprintDir`는
      들어온 값과 `toPosix` 정규화 양쪽으로 비교해 자기 자신을 제외한다. 정렬은 Interface
      의 네 규칙을 그대로 구현하고, 첫 항목이 `next`, 나머지가 `remaining`이다.
- [ ] `sharedPaths`를 계산한다. 양쪽 tasks의 `affected_paths`를 `readDoc`으로 읽어
      교집합을 만들고, 읽기 실패나 배열이 아닌 값은 `[]`로 처리한다.
      ```js
      const shared = candidatePaths.filter((p) => finalizedPaths.includes(p));
      ```
      경로 비교는 문자열 동등만 쓴다 — 상위 디렉터리 포함 관계를 추론하지 않는다.
- [ ] `scripts/src/lib/finalize.ts`에서 `nextBlueprint`를 주입 가능한 인자로 받고
      (`clearPointer`와 같은 방식) dry-run·커밋 완료 반환에 `next`를 싣는다.
      ```js
      function finalize({
        repoRoot, blueprintDir, yes = false, git,
        clearPointer = clearCurrent, next = nextBlueprint,
      }) { … }
      ```
      계산은 반환 직전에 한 번만 하고, 실패해도 마감을 깨지 않도록 감싼다
      (`next` 계산 예외 → `{ next: null, remaining: [] }`).
- [ ] `test/finalize.test.js`에 단언을 더한다.
      ```js
      assert.ok('next' in res);
      assert.strictEqual(res.ok, true);        // 후보가 없어도 ok는 그대로
      ```
      기존 테스트는 수정하지 않는다. 수정이 필요하다면 계약을 깬 것이다.
- [ ] `skills/bouncer-finalize/SKILL.md`에 6단계 **Next blueprint handoff**를 추가하고
      현행 6단계 Report를 7단계로 민다. 본문에 담을 것:
      - `finalize --yes` 출력의 `next`를 근거로 쓴다(스킬이 후보를 다시 계산하지 않는다).
      - 커밋할 것이 없어 `--yes`를 돌리지 않은 경우 dry-run 출력의 `next`를 쓴다.
      - `next`가 `null`이면 이 단계를 건너뛴다.
      - `sharedPaths`가 비어 있지 않으면 다음 블루프린트가 이번 커밋 위에서 갈라져야
        한다는 경고를 함께 보여준다. 전진은 막지 않는다.
      - 워크트리를 남겨 둔 경우 공유 포인터 때문에 그 워크트리의 커밋 가드가 새
        블루프린트 경로를 강제한다는 점을 경고한다.
      - 승낙 시에만 실행:
        ```bash
        BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
        node "${BOUNCER_ROOT}/scripts/bouncer" current --set <next.blueprint>
        ```
      - `current --set`이 plan 게이트 실패로 거절하면 그 사실을 보고하고 마감은 정상
        종료한다.
      - 7단계 Report에 포인터를 옮겼는지 / 비워 두었는지를 항목으로 더한다.
- [ ] `test/skill-bouncer-finalize.test.js`에 단언을 더한다.
      ```js
      assert.match(body, /current --set/);
      assert.match(body, /next/);
      assert.match(body, /ask|confirm|승낙/i);
      ```
- [ ] `docs/workflow.md` 4번 항목에 마감이 다음 후보를 통지하고 확인 후 포인터를 옮긴다는
      한 줄을 더한다. 5번 `bouncer advise` 항목과 CLI 표는 건드리지 않는다(새 명령 없음).
- [ ] 통합 확인: 같은 에픽에 ready 블루프린트가 둘인 임시 저장소에서 앞의 것을 마감했을 때
      `bouncer finalize --blueprint <dir>` 출력의 `next.blueprint`가 뒤의 것을 가리키는지
      확인한다.
- [ ] `npm test`가 통과할 때까지 마무리한다. `pretest`가 `scripts/lib/*.js`를 재생성하므로
      산출물 diff가 함께 남는지 확인한다.
