---
type: bouncer.tasks
title: execute 게이트와 증적 기록을 포인터가 지목한 task 묶음으로 좁힘
description: Tasks for 001
resource: .bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-07T09:59:09.568+09:00'
bouncer:
  id: TASKS-002
  epic_id: '020'
  blueprint_id: '001'
  status: verified
  affected_paths:
    - scripts/src/lib/validate.ts
    - scripts/src/lib/verification.ts
    - scripts/src/lib/finalize.ts
    - scripts/lib/validate.js
    - scripts/lib/verification.js
    - scripts/lib/finalize.js
    - test/validate-gates.test.js
    - test/verification-runner.test.js
    - test/finalize-pure.test.js
    - test/cli-verify.test.js
  graph:
    generated_at: '2026-08-07T10:17:53.578+09:00'
    command: graphify query (source + context)
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - skills
      - agents
      - docs
      - .bouncer/context/epics
    basis:
      - graph: source
        status: reused
        query: listTasksDocs tasks-docs scaffold validate verification migrate cli lib
        result: 15 hits — scripts/src/lib의 tasks-docs·paths·scaffold·validate·verification· current과 대응 scripts/lib CJS 산출물, test/cli-verify.test.js
      - graph: context
        status: updated
        query: task 단위 커밋 verification review 게이트 문서 배치
        result: 5 hits — 과거 epic들의 verification.md뿐이라 affected_paths 후보가 아님. source_dirs가 scripts/hooks/test라 skills·agents·docs는 수동 추가
---
# Tasks

Blueprint: [001](index.md)

## Goal & intent
execute 게이트가 활성 포인터의 task 묶음 하나만 판정하고, verify 실행 증적이 그
묶음의 `verification.md`에 기록된다. 같은 blueprint의 다른 task가 아직 `draft`나
`pending`이어도 지금 커밋하려는 task의 게이트를 막지 않는다.

019가 정한 폴백은 그대로다. 포인터에 task가 없거나 지목한 문서가 사라지면 번호가
가장 앞선 묶음을 쓴다.

## Interface
- 제공
  - `loadBlueprintDocs`가 `docs.taskUnits`를 돌려준다. 각 원소는
    `{ number, dir, tasks, verification, review }`이고 뒤 셋은 파싱된
    `{ data, body, rel }` (파일이 없으면 `undefined`).
  - `checkGate('execute', …)`가 `ctx.taskUnit`(포인터로 결정된 묶음) 하나에 대해
    G6·G7·G8·G13·G14를 매긴다. 실패의 `file`은 그 묶음 안의 실제 경로다.
  - `recordVerificationResult({ repoRoot, verificationRel, … })`가 blueprint 고정
    경로 대신 전달받은 문서에 기록한다.
  - `runVerification`이 `readVerifyCommand`와 같은 규칙으로 대상 묶음을 고르고
    그 묶음의 `verification.md`에 기록한다.
  - `finalize`의 수정 내용 bullet이 대상 task 묶음의 `tasks` / `verification`
    `title`에서 나온다.
- 거부
  - 대상 묶음에 `verification.md`가 없으면 `VERIFY_DOCUMENT_MISSING`으로 실패하고
    파일을 새로 만들지 않는다.
  - 대상 묶음에 `tasks.md`가 없으면 G6이 실패한다. 다른 묶음의 `tasks.md`로
    대체하지 않는다.
  - plan 게이트(G3·G4·G5·G10~G12)는 지금처럼 모든 묶음에 걸린다. 포인터로
    좁히지 않는다.

## Touch
- Modify `scripts/src/lib/validate.ts` — `loadBlueprintDocs`의 묶음 로딩과 execute 게이트의 대상 선택
- Modify `scripts/src/lib/verification.ts` — 증적 기록 대상을 인자로 받도록 변경
- Modify `scripts/src/lib/finalize.ts` — 커밋 bullet의 title 출처를 대상 묶음으로 변경
- Modify `test/validate-gates.test.js` — 묶음별 G6·G7·G8·G13·G14 판정
- Modify `test/verification-runner.test.js` — 기록 경로가 대상 묶음인지
- Modify `test/finalize-pure.test.js` — bullet 출처
- Modify `test/cli-verify.test.js` — CLI 경유 증적 기록 경로
- Modify `scripts/lib/validate.js` `scripts/lib/verification.js` `scripts/lib/finalize.js` — `npm run build`가 다시 만드는 CJS 산출물

## Do not touch
- `scripts/src/lib/tasks-docs.ts` — 리졸버는 001에서 확정
- `scripts/src/lib/paths.ts` — 001
- `scripts/src/lib/scaffold.ts` — 001
- `scripts/src/lib/cli.ts` — 001과 004
- `scripts/src/lib/templates.ts` — 001
- `skills` — 003
- `docs` — 003
- `.bouncer/context/epics` — 004

## Constraints
- 게이트 번호와 실패 메시지 문자열을 바꾸지 않는다. `docs/gates.md`와
  `test/validate-gates.test.js`가 기대하는 코드 G6·G7·G8·G13·G14를 그대로 쓴다.
- 구 레이아웃 blueprint에서 동작이 바뀌면 안 된다. 묶음이 레거시 한 벌이면
  지금과 같은 판정 결과가 나와야 한다.
- 포인터 해석은 019의 `readVerifyCommand`·`readAffectedPaths`가 쓰는 규칙과
  같은 함수를 재사용한다. 두 번째 해석기를 만들지 않는다.
- `verification.md`는 `recordVerificationResult`가 통째로 다시 쓴다. 사람이 쓴
  선언을 그 문서에 넣는 경로를 새로 만들지 않는다.

## Checklist
- [ ] `test/validate-gates.test.js`에 실패 테스트를 먼저 추가한다. `tasks/001/`이
      완결되고 `tasks/002/`가 `draft`/`pending`인 fixture에서 포인터가
      `tasks/001/tasks.md`를 가리킬 때:
      ```js
      const res = validateBlueprint({ repoRoot, blueprintDir, gate: 'execute' });
      assert.equal(res.ok, true);
      ```
      포인터가 `tasks/002/tasks.md`를 가리키면 G6·G7·G8이 나오고 각 `file`이
      `tasks/002/` 아래 경로임을 확인한다.
- [ ] G13이 대상 묶음의 `verification.md` 본문·frontmatter만 보는지 확인하는
      테스트를 추가한다. 다른 묶음의 증적이 깨져 있어도 통과해야 한다.
- [ ] 위 테스트가 실패하는 것을 확인한 뒤 `validate.ts`를 구현한다.
      `docs.tasks`(첫 문서 호환 필드)는 남기되 execute 분기에서는 쓰지 않는다.
- [ ] `test/verification-runner.test.js`에서 포인터가 `tasks/002`를 가리킬 때
      `runVerification` 후 `tasks/002/verification.md`의 `bouncer.verification.exit_code`가
      기록되고 `tasks/001/verification.md`는 변하지 않음을 확인하고 구현한다.
- [ ] 대상 묶음에 `verification.md`가 없을 때 `VERIFY_DOCUMENT_MISSING`이 나고
      파일이 생성되지 않음을 확인한다.
- [ ] `finalize-pure.test.js`에서 수정 내용 bullet이 대상 묶음의 tasks·verification
      `title`에서 나오는지 확인하고 구현한다.
- [ ] 레거시 fixture(루트 `tasks.md` + 루트 `verification.md`)로 기존 테스트가
      그대로 통과하는지 확인한다.
- [ ] `npm test`가 통과한다.
