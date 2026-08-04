---
type: bouncer.tasks
title: current 명령과 후보 열거를 만들고 세 워크플로 스킬을 배선함
description: bouncer current 읽기·set·clear, 후보 열거, 스킬·문서 경로 정정
resource: .bouncer/context/epics/EPIC-010-active-pointer-cli/blueprints/BP-001-current-command/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-04T08:59:20.769+09:00'
bouncer:
  id: TASKS-BP-001
  epic_id: EPIC-010
  blueprint_id: BP-001
  status: verified
  affected_paths:
    - scripts/src/lib/cli.ts
    - scripts/lib/cli.js
    - scripts/src/lib/current.ts
    - scripts/lib/current.js
    - test/cli-current.test.js
    - test/current.test.js
    - test/cli-help.test.js
    - test/skill-bouncer-plan.test.js
    - test/skill-bouncer-execute.test.js
    - test/skill-bouncer-surface.test.js
    - skills/bouncer-plan/SKILL.md
    - skills/bouncer-execute/SKILL.md
    - skills/bouncer-finalize/SKILL.md
    - skills/bouncer-init/SKILL.md
    - docs/cli.md
    - docs/workflow.md
  graph:
    generated_at: '2026-08-04T09:06:00+09:00'
    command: graphify query (source + context)
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - skills
      - docs
    basis: >-
      graph-sync가 source·context를 모두 재빌드했다. source 질의 "active
      blueprint pointer current readCurrent writeCurrent clearCurrent cli
      subcommand runtime state"는 current.ts/js의 세 함수와 runtime-state,
      그리고 commit-hook·finalize·advisor를 돌려줬다. 앞의 둘은 포인터의
      소비자이고 이 변경은 그들을 건드리지 않으므로 Do not touch로 내렸다.
      cli.ts는 질의에 직접 나오지 않았는데, 지금 CLI가 current를 전혀
      require하지 않아 그래프에 간선이 없기 때문이다 — 이 blueprint가 만들려는
      것이 바로 그 없는 간선이라 수동으로 넣었다. context 질의 "active pointer
      cli command skill wiring plan execute finalize preflight"는 EPIC-003
      BP-002(commands-to-skills)와 EPIC-008 BP-001(seed-plan-artifacts)을
      집었다 — 각각 포인터 진입 가드와 워크트리 포인터 공유를 세운 선행
      스트림이고, 둘 다 닫혀 있어 겹치는 작업은 없다. skills·docs는
      config.source_dirs(scripts/hooks/test) 밖이라 수동으로 보탰다.
---
# Tasks

Blueprint: [BP-001](index.md)

## Goal & intent
`bouncer current`로 활성 포인터를 읽고(`--set`으로) 기록하고(`--clear`로) 지울 수 있다.
포인터가 비어 있으면 같은 출력에 실행 가능한 블루프린트 후보가 딸려 오므로, execute는
"계획이 안 됐다"와 "계획은 됐는데 포인터가 없다"를 구분해 안내한다. plan·execute·finalize는
더 이상 `node -e`로 `scripts/lib/current`를 직접 부르지 않고, 포인터 파일 위치를
`.bouncer/current`라고 적은 문장이 저장소에서 사라진다. 포인터 파일의 실제 위치와 형식,
커밋 가드, finalize의 clear 동작은 그대로다. 검증은 `npm test`.

## Interface
- 제공: `bouncer current` — 활성 포인터를 읽는다. 출력은
  `{ "ok": true, "current": { "blueprint": "<dir>", "base": "<branch>" } }`.
  포인터가 없으면 `current`는 `null`이고 `ready` 배열이 함께 온다:
  `{ "ok": true, "current": null, "ready": [{ "blueprint": "<dir>", "status": "ready" }] }`.
  포인터가 있을 때는 `ready`를 담지 않는다. 종료 코드는 두 경우 모두 `0` — 포인터 부재는
  오류가 아니라 상태다.
- 제공: `bouncer current --set <blueprint dir> [--base <branch>]` — 대상에
  `validateBlueprint({ gate: 'plan' })`을 돌려 통과할 때만 포인터를 기록한다. 통과 시
  `{ "ok": true, "current": {...} }`와 종료 코드 `0`. `--base`가 없으면
  `.bouncer/config.json`의 `base_branch`를 쓰고, 파일이나 키가 없으면 `develop`을 쓴다
  (`skills/bouncer-plan/SKILL.md` 8단계가 지금 쓰는 규칙과 동일).
- 제공: `bouncer current --clear` — 포인터를 제거하고 `{ "ok": true, "current": null }`,
  종료 코드 `0`. 포인터가 없어도 같은 결과다.
- 제공: `scripts/src/lib/current.ts`가 `listReadyBlueprints({ repoRoot })`를 내보낸다.
  반환은 `[{ blueprint, status }]`이며 `blueprint`는 저장소 상대 POSIX 경로, `status`는
  tasks 문서의 상태다. 경로 오름차순으로 정렬한다.
- 거부: `--set`의 대상이 plan 게이트를 통과하지 못하면 **포인터를 쓰지 않고**
  `{ "ok": false, "failures": [...] }`와 종료 코드 `1`을 낸다. 실패 목록은
  `validateBlueprint`가 준 것을 가공 없이 싣는다.
- 거부: `--set`에 값이 없으면(`--set`만 오거나 다음 토큰이 `--`로 시작하면)
  `current: --set requires a blueprint directory`를 **stderr**로 내고 종료 코드 `2`.
- 거부: `--set`과 `--clear`가 함께 오면 `current: --set and --clear are mutually
  exclusive`를 stderr로 내고 종료 코드 `2`.
- 거부: `listReadyBlueprints`는 blueprint가 `approved`가 아니거나 tasks 상태가
  `ready`/`in_progress`가 아닌 것을 후보에서 뺀다. `verified`는 후보가 아니다. 문서가
  없거나 파싱에 실패하는 블루프린트는 그 항목만 건너뛰고 열거를 계속한다 — 문서 하나가
  깨졌다고 목록 전체가 사라지면 안 된다.

## Touch
- Modify `scripts/src/lib/current.ts` — `listReadyBlueprints` 추가. 기존 세 함수의
  시그니처는 그대로 둔다.
- Modify `scripts/lib/current.js` — 위 소스의 빌드 산출물. `npm run build`(`pretest`)로
  재생성해 커밋한다. 손으로 편집하지 않는다.
- Modify `scripts/src/lib/cli.ts` — `cmdCurrent` 추가, `USAGE`에 `current` 항목 추가,
  `runCli`의 `switch`에 분기 추가.
- Modify `scripts/lib/cli.js` — 위 소스의 빌드 산출물. 재생성해 커밋한다.
- Create `test/cli-current.test.js` — 읽기(포인터 있음/없음), `--set` 성공·게이트 실패,
  `--clear` 멱등, 사용법 오류 종료 코드를 덮는다.
- Modify `test/current.test.js` — `listReadyBlueprints`의 선별·정렬·깨진 문서 건너뛰기.
- Modify `test/cli-help.test.js` — `SUBCOMMANDS` 배열에 `current` 추가.
- Modify `skills/bouncer-plan/SKILL.md` — 8단계의 `node -e` 블록을 `bouncer current --set`
  으로 교체하고, 괄호 안 `.bouncer/current` 설명 문장을 실제 위치로 고친다.
- Modify `skills/bouncer-execute/SKILL.md` — 1단계 읽기를 `bouncer current`로 교체하고,
  `null` 처리를 후보 유무로 분기시킨다. 2단계의 `.bouncer/current` 언급도 고친다.
- Modify `skills/bouncer-finalize/SKILL.md` — 프리플라이트 읽기를 `bouncer current`로
  교체하고 `.bouncer/current` 언급을 고친다.
- Modify `skills/bouncer-init/SKILL.md` — 4단계 설명문의 `.bouncer/current` 경로 문장을
  고친다. 동작 변경은 없다.
- Modify `test/skill-bouncer-plan.test.js` — `.bouncer/current` 정규식 단언을 새 명령
  단언으로 교체.
- Modify `test/skill-bouncer-execute.test.js` — 같은 이유로 교체.
- Modify `test/skill-bouncer-surface.test.js` — execute/finalize 진입 가드 단언을 새 문구에
  맞춘다. 가드가 여전히 존재한다는 성질은 유지한다.
- Modify `docs/cli.md` — `current` 행 추가.
- Modify `docs/workflow.md` — 6행의 `.bouncer/current` 경로 문장을 고친다.

## Do not touch
- `scripts/src/lib/runtime-state.ts` — 포인터 파일의 위치와 형식은 불변이다. 이 변경은
  그 위에 표면만 올린다.
- `scripts/src/lib/finalize.ts` — 커밋 후 `clearPointer` 호출은 그대로다. 다음 후보 통지는
  별도 blueprint다.
- `scripts/src/lib/commit-hook.ts` — 커밋 가드 판정은 바뀌지 않는다.
- `scripts/src/lib/commit-guard.ts` — 같은 이유.
- `scripts/src/lib/validate.ts` — `--set`은 기존 plan 게이트를 호출할 뿐 판정을 바꾸지
  않는다.
- `scripts/src/lib/advisor.ts` — 단계 추론과 명령 추천은 이 blueprint의 범위 밖이다.

## Constraints
- 포인터 파일을 읽고 쓰는 코드는 `current.ts` → `runtime-state.ts` 경로 하나만 쓴다.
  CLI가 파일 경로를 직접 다루지 않는다.
- 새 명령의 출력은 기존 명령과 같이 **stdout JSON**, 오류 안내는 **stderr**, 종료 코드는
  `0/1/2` 관례를 따른다. stdout은 파이프 청정을 유지한다.
- `readCurrent` / `writeCurrent` / `clearCurrent`의 시그니처와 반환값을 바꾸지 않는다.
  기존 호출자와 테스트가 그대로 통과해야 한다.
- 포인터 부재는 오류가 아니다. 인자 없는 읽기는 어떤 경우에도 종료 코드 `0`이다.
- `listReadyBlueprints`는 부작용이 없다 — 파일을 쓰거나 포인터를 건드리지 않는다.
- 새 런타임 의존성을 추가하지 않는다 (Node 표준 라이브러리 + 벤더링 `js-yaml`).
- 스킬 본문은 현행 언어(영어)를 유지한다. 공개 오류 메시지도 기존 관례대로 영어
  소문자 문장이다.
- `scripts/lib/*.js`는 `npm run build` 산출물이다. 소스는 항상 `scripts/src/**`.

## Checklist
- [ ] `test/current.test.js`에 `listReadyBlueprints` 실패 테스트를 먼저 추가하고
      `npm test`로 **예상된 이유로** 실패하는지 확인한다.
      - blueprint `approved` + tasks `ready` → 후보에 포함
      - blueprint `approved` + tasks `in_progress` → 포함
      - tasks `verified` → 제외, blueprint `draft` → 제외
      - 두 에픽에 걸친 후보가 경로 오름차순으로 정렬된다
      - frontmatter가 깨진 블루프린트가 섞여도 나머지가 그대로 나온다
- [ ] `scripts/src/lib/current.ts`에 `listReadyBlueprints({ repoRoot })`를 구현한다.
      `.bouncer/context/epics/*/blueprints/*/`를 훑어 `index.md`와 `tasks.md`를
      `readDoc`으로 읽고, 아래 조건만 남긴다.
      ```js
      const READY_TASK_STATUS = ['ready', 'in_progress'];
      // blueprint.bouncer.status === 'approved' && READY_TASK_STATUS.includes(tasks.bouncer.status)
      ```
      정렬은 `list.sort((a, b) => a.blueprint.localeCompare(b.blueprint))`.
      개별 문서의 읽기 실패는 `try/catch`로 그 항목만 건너뛴다.
- [ ] `test/cli-current.test.js`를 만들고 실패를 확인한다. 최소 다음을 덮는다.
      ```js
      // 포인터 없음 + 후보 있음
      assert.strictEqual(r.code, 0);
      assert.strictEqual(JSON.parse(r.out).current, null);
      assert.ok(JSON.parse(r.out).ready.length > 0);
      // --set 게이트 실패 시 포인터가 쓰이지 않는다
      assert.strictEqual(r.code, 1);
      assert.strictEqual(readCurrent({ repoRoot: repo }), null);
      // --set 값 누락
      assert.strictEqual(capture(['current', '--set']).code, 2);
      // --clear 멱등
      assert.strictEqual(capture(['current', '--clear']).code, 0);
      ```
- [ ] `scripts/src/lib/cli.ts`에 `cmdCurrent(rest, io)`를 추가하고 `runCli`의 `switch`에
      `case 'current':`를 넣는다. `USAGE`에 아래 두 줄을 추가한다.
      ```
  current    [--set <blueprint dir> [--base <branch>]] [--clear]
             Show the active blueprint pointer, or set / clear it.
      ```
- [ ] `test/cli-help.test.js`의 `SUBCOMMANDS`에 `'current'`를 추가한다.
- [ ] `skills/bouncer-plan/SKILL.md` 8단계의 `node -e` 블록을 교체한다.
      ```bash
      BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
      node "${BOUNCER_ROOT}/scripts/bouncer" current --set <blueprint dir>
      ```
      괄호 안의 `.bouncer/current` 설명 문장은 지우거나 실제 위치(Git common directory
      아래 `bouncer/current`)로 고친다.
- [ ] `skills/bouncer-execute/SKILL.md` 1단계를 `node "${BOUNCER_ROOT}/scripts/bouncer"
      current`로 바꾸고, `null` 처리를 분기시킨다 — `ready`가 비어 있지 않으면 후보를
      보여주고 `current --set <dir>`을 안내한 뒤 멈추고, 비어 있을 때만 `/bouncer-plan`을
      안내한다. 2단계의 `.bouncer/current` 언급도 고친다.
- [ ] `skills/bouncer-finalize/SKILL.md` 프리플라이트를 같은 명령으로 바꾸고 경로 문장을
      고친다. finalize의 `null` 안내는 지금처럼 `/bouncer-plan`으로 두어도 된다 — 마감할
      대상은 진행 중이던 사이클이지 대기 중인 후보가 아니다.
- [ ] `skills/bouncer-init/SKILL.md` 4단계 설명문의 경로 표현만 고친다.
- [ ] `test/skill-bouncer-plan.test.js`·`test/skill-bouncer-execute.test.js`·
      `test/skill-bouncer-surface.test.js`의 `.bouncer/current` 단언을 새 명령·문구
      단언으로 교체한다. execute/finalize에 진입 가드가 있다는 성질 자체는 유지한다.
- [ ] `docs/cli.md`에 `current` 행을 추가하고 `docs/workflow.md` 6행의 경로를 고친다.
- [ ] `grep -rn "\.bouncer/current" --include=*.md skills docs`가 비는지 확인한다
      (`.bouncer/context/` 아래 과거 블루프린트 문서와 `CHANGELOG.md`는 기록이므로 제외).
- [ ] `npm test`가 통과할 때까지 마무리한다 (`pretest`가 `scripts/lib/*.js`를 재생성하므로
      산출물 diff가 함께 남는지 확인한다).
