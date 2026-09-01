---
type: bouncer.tasks
title: 포인터에 task 필드를 넣고 검증 명령·커밋 경로·워크플로 브리프를 좁힘
description: Tasks for 001
resource: .bouncer/context/epics/018-task-unit-commits/blueprints/009-pointer-task-field/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-07T09:00:41.016+09:00'
bouncer:
  id: TASKS-001
  epic_id: '018'
  blueprint_id: '009'
  status: verified
  affected_paths:
    - scripts/src/lib/runtime-state.ts
    - scripts/src/lib/current.ts
    - scripts/src/lib/cli.ts
    - scripts/src/lib/verification.ts
    - scripts/src/lib/commit-hook.ts
    - scripts/lib/runtime-state.js
    - scripts/lib/current.js
    - scripts/lib/cli.js
    - scripts/lib/verification.js
    - scripts/lib/commit-hook.js
    - skills/bouncer-execute/SKILL.md
    - skills/bouncer-finalize/SKILL.md
    - docs/cli.md
    - docs/workflow.md
    - docs/context-versioning.md
    - test/runtime-state.test.js
    - test/current.test.js
    - test/cli-current.test.js
    - test/commit-hook.test.js
    - test/verification-runner.test.js
    - test/skill-bouncer-execute.test.js
    - test/skill-bouncer-finalize.test.js
    - test/migrate-ids.test.js
  graph:
    generated_at: '2026-08-07T09:15:00.000+09:00'
    command: graphify query on graphify-out/source/graph.json and graphify-out/context/graph.json
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - skills/bouncer-execute
      - skills/bouncer-finalize
      - docs
    basis:
      - graph: source
        status: updated
        query: runtime-state pointer schema writeRuntimeCurrent readVerifyCommand / 활성 포인터 current task 필드 검증 명령 커밋 허용 경로
        result: scripts/src/lib/verification.ts · scripts/src/lib/current.ts · scripts/src/lib/cli.ts · scripts/src/lib/tasks-docs.ts · scripts/lib 대응 emit · test/commit-hook.test.js — skills/ 경로는 config.source_dirs 밖이라 수동 추가
      - graph: context
        status: updated
        query: 활성 포인터 task 단위 커밋 결정
        result: .bouncer/context/epics/018-task-unit-commits/index.md · 019 epic·blueprint 문서 — 019가 018의 Out of scope를 이어받는 것을 확인
---
# Tasks

Blueprint: [009](index.md)

## Goal & intent
활성 포인터가 `{blueprint, base}`에서 `{blueprint, task, base}`로 넓어지고,
그 `task`가 지정된 동안 검증 명령 조회(`readVerifyCommand`)와 커밋 허용 경로
조회(`readAffectedPaths`)가 해당 task 문서 하나만 본다. 두 함수에 남아 있는
「임시 규칙(task 포인터 전)」 주석과 그 동작이 이 작업으로 사라진다.
`task`가 없는 포인터(기존 파일 포함)는 지금 동작 — 첫 선언 채택, 경로 합집합 —
을 그대로 유지한다.

## Interface
- 제공
  - `bouncer current --set <blueprint dir> [--task <NNN|TASKS-NNN>]`.
    `--task` 없이 `--set`하면 번호 오름차순 첫 `ready`/`in_progress` task 문서를
    자동 선택한다. 열린 후보가 없으면 task 없이 쓴다.
  - `bouncer current` 출력에 선택된 task가 포함된다(문서 저장소 상대 경로와
    `TASKS-NNN` id). task 미지정이면 `null`.
  - 포인터 JSON `{ "blueprint": …, "task": <rel path>, "base": … }`.
    `task` 키 부재·비문자열은 미지정으로 읽는다.
  - `listReadyBlueprints` 항목이 그 blueprint의 열린 task 문서 목록을 함께 담아
    `--set` 자동 선택과 finalize 다음-task 확인이 같은 계산을 쓴다.
- 거부
  - 존재하지 않는 task를 `--task`로 지정 — 포인터를 쓰지 않고 종료 코드 2,
    stderr에 사용 가능한 task 목록.
  - 세 자리 숫자도 `TASKS-NNN`도 아닌 `--task` 값 — 같은 방식으로 거절.
  - `--task`만 주고 `--set`을 안 준 경우 — 종료 코드 2. 포인터의 task만 바꾸는
    경로는 만들지 않는다.
  - `--clear`와 `--task` 동시 지정 — 종료 코드 2.

## Touch
- Modify `scripts/src/lib/runtime-state.ts` — 포인터 JSON에 `task` 필드를 읽고
  쓴다. 문자열일 때만 채택하고, 없으면 결과에서 `null`로 돌려준다.
- Modify `scripts/src/lib/current.ts` — `writeCurrent`가 `task`를 통과시키고,
  task 해석·자동 선택 함수를 추가하며, `listReadyBlueprints`가 열린 task 목록을
  함께 돌려준다.
- Modify `scripts/src/lib/cli.ts` — `cmdCurrent`에 `--task` 플래그, 거부 조건,
  출력의 task 필드를 더한다.
- Modify `scripts/src/lib/verification.ts` — `readVerifyCommand`가 포인터의 task
  문서만 보도록 좁히고, 임시 규칙 주석을 지운다.
- Modify `scripts/src/lib/commit-hook.ts` — `readAffectedPaths`가 포인터의 task
  문서 `affected_paths`만 쓰도록 좁히고, 임시 규칙 주석을 지운다.
- Modify `scripts/lib/runtime-state.js` — 위 변경의 CJS emit.
- Modify `scripts/lib/current.js` — 위 변경의 CJS emit.
- Modify `scripts/lib/cli.js` — 위 변경의 CJS emit.
- Modify `scripts/lib/verification.js` — 위 변경의 CJS emit.
- Modify `scripts/lib/commit-hook.js` — 위 변경의 CJS emit.
- Modify `skills/bouncer-execute/SKILL.md` — 1단계에서 포인터의 task 문서를
  브리프로 지목하고, 그 값을 이후 단계가 그대로 쓰게 한다.
- Modify `skills/bouncer-finalize/SKILL.md` — 커밋 뒤 handoff에서 같은 blueprint에
  남은 열린 task가 있으면 다음 blueprint보다 먼저 그쪽 전진을 확인한다.
- Modify `docs/cli.md` — `current --task` 사용법과 자동 선택 규칙.
- Modify `docs/workflow.md` — plan → execute 사이 포인터가 task까지 가리킨다는 한 줄.
- Modify `docs/context-versioning.md` — 포인터 파일 스키마 표기 갱신.
- Modify `test/runtime-state.test.js` — task 필드 read/write와 레거시 파일 호환.
- Modify `test/current.test.js` — task 해석·자동 선택·열린 task 목록.
- Modify `test/cli-current.test.js` — `--task` 성공·거부 경로와 출력 형태.
- Modify `test/commit-hook.test.js` — 포인터 task가 있을 때 경로가 좁혀짐.
- Modify `test/verification-runner.test.js` — 포인터 task의 `bouncer.verify` 채택과
  선언 부재 시 `config.verify` 폴백.
- Modify `test/skill-bouncer-execute.test.js` — 브리프가 포인터 task라는 계약 문구.
- Modify `test/skill-bouncer-finalize.test.js` — 다음-task 확인 계약 문구.

## Do not touch
- `scripts/src/lib/validate.ts` — plan/execute 게이트 판정은 018에서 정한 문서별
  적용 그대로다. 포인터는 게이트 입력이 아니다.
- `scripts/src/lib/tasks-docs.ts` — 이름·id 규칙 리졸버는 그대로 쓴다.
  새 판정이 필요하면 호출부에서 조합한다.
- `scripts/src/lib/scaffold.ts` — 문서 생성 규칙은 이 작업 범위 밖이다.
- `.bouncer/Distill.md` — 임시 규칙 문장 개정은 `/bouncer-finalize`의 승격 단계가
  한다. 실행 중에 직접 고치지 않는다.
- `CLAUDE.md`, `docs/governance.md`, `docs/gates.md` — 하드룰과 게이트 정의는
  바뀌지 않는다.

## Constraints
- 새 CLI 하위 명령, 새 설정 키, 새 게이트 번호를 만들지 않는다. 표면은
  `bouncer current`의 플래그 하나뿐이다.
- 포인터 파일 마이그레이션을 하지 않는다. `task` 키가 없는 파일은 읽을 때
  미지정으로 해석될 뿐이고, 다시 쓸 때만 새 형태가 된다.
- 하위 호환 별칭을 남기지 않는다. `readVerifyCommand` / `readAffectedPaths`의
  임시 규칙은 지우고 폴백 한 갈래(task 미지정)만 남긴다.
- `scripts/lib`의 CJS emit은 손으로 고치지 않고 `npm run build`(또는 `pretest`)로
  재생성한 결과를 커밋한다.
- 공개 문자열과 문서 본문의 한국어를 유지한다. `docs/`의 기존 표 형식도 유지한다.
- 포인터 없는 상태는 오류가 아니다 — 기존대로 bare `bouncer current`는 0으로
  끝나고 `ready` 후보를 붙인다.

## Checklist
- [ ] `test/runtime-state.test.js`에 실패 테스트를 먼저 추가한다: `writeRuntimeCurrent`가
      `task`를 받으면 파일에 그 키가 들어가고, `task` 없이 쓰면 키가 없다.
      `readRuntimeCurrent`는 `task` 키가 없는 기존 파일에서 `{ blueprint, base, task: null }`을
      돌려준다. 비문자열 `task`도 `null`이다.
- [ ] `runtime-state.ts`의 `writeRuntimeCurrent` / `readRuntimeCurrent`를 그 계약에
      맞춘다. 경로 값은 기존 `blueprint`처럼 `toPosix`로 정규화한다.
- [ ] `test/current.test.js`에 실패 테스트를 추가한다: 번호 문서 여럿 중 `ready`가
      `002`뿐이면 자동 선택이 `002` 문서를 고른다. `--task`에 해당하는 문서가 없으면
      해석이 실패를 돌려준다. `listReadyBlueprints` 항목이 열린 task 목록을 담는다.
- [ ] `current.ts`에 task 해석 함수를 더한다. `listTasksDocs`의 entries를 번호 순으로
      돌며 요청 값(`NNN` 또는 `TASKS-NNN`)과 `entry.id`를 맞추고, 요청이 없으면
      `bouncer.status`가 `ready`/`in_progress`인 첫 문서를 고른다. 혼재(`mixed`)이거나
      문서가 없으면 선택 없음으로 돌려준다.
- [ ] `writeCurrent`가 `task`를 `writeRuntimeCurrent`로 넘기게 한다.
- [ ] `test/cli-current.test.js`에 실패 테스트를 추가한다: `--set … --task 002`가 0으로
      끝나고 포인터에 그 문서가 남는다. 없는 번호는 종료 코드 2이고 포인터 파일이
      만들어지지 않는다. `--task`만 단독으로 주면 2. `--clear --task`도 2.
      bare `current` 출력 JSON에 `task` 키가 있다.
- [ ] `cli.ts`의 `cmdCurrent`를 그 계약에 맞춘다. 순서는 지금과 같다 — plan 게이트가
      통과한 뒤에만 포인터를 쓴다. task 해석 실패 메시지는 stderr로 내보내고 사용 가능한
      task id를 함께 적는다.
- [ ] `test/verification-runner.test.js`에 실패 테스트를 추가한다: 포인터가 `002`를
      가리키고 `001`에만 `bouncer.verify`가 있으면 `config.verify`가 쓰인다.
      포인터가 `001`을 가리키면 `001`의 선언이 쓰인다. 포인터에 task가 없으면
      기존대로 첫 선언이 쓰인다.
- [ ] `verification.ts`의 `readVerifyCommand`가 포인터 task를 반영하게 고친다.
      유효하지 않은 선언은 지금처럼 `VERIFY_COMMAND_INVALID`로 던진다.
- [ ] `test/commit-hook.test.js`에 실패 테스트를 추가한다: 포인터가 `002`를 가리키면
      `001`의 `affected_paths`에만 있는 파일 커밋이 막힌다. 포인터에 task가 없으면
      기존 합집합대로 통과한다.
- [ ] `commit-hook.ts`의 `readAffectedPaths`가 포인터 task를 반영하게 고친다.
- [ ] `skills/bouncer-execute/SKILL.md` 1단계에 포인터의 `task`를 브리프 문서로
      쓴다는 문장을 넣고, 이후 단계의 「task brief」 지칭을 그 값으로 통일한다.
      `task`가 비어 있으면 지금처럼 리졸버가 찾은 단일/첫 문서를 쓴다.
- [ ] `skills/bouncer-finalize/SKILL.md` handoff 단계에 같은 blueprint의 남은 열린
      task를 먼저 확인하는 갈래를 넣는다. 전진은 확인 후
      `bouncer current --set <bp> --task <NNN>` 실행뿐이고 자동 전진은 없다.
- [ ] `test/skill-bouncer-execute.test.js` / `test/skill-bouncer-finalize.test.js`에
      위 두 문구의 계약 assert를 더한다.
- [ ] `docs/cli.md`의 `current` 행에 `[--task <NNN>]`과 자동 선택 규칙을 적는다.
- [ ] `docs/workflow.md`와 `docs/context-versioning.md`의 포인터 서술을 새 스키마로 맞춘다.
- [ ] `npm run build`로 `scripts/lib` emit을 재생성한다.
- [ ] `npm test`가 통과한다.
