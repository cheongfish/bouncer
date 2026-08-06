---
type: bouncer.tasks
title: task 문서 이름·id 규칙을 리졸버로 모으고 소비자를 통일함
description: Tasks for 001
resource: .bouncer/context/epics/018-task-unit-commits/blueprints/001-tasks-doc-resolver/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-06T17:29:57.449+09:00'
bouncer:
  id: TASKS-001
  epic_id: '018'
  blueprint_id: '001'
  status: verified
  affected_paths:
    - scripts/src/lib/tasks-docs.ts
    - scripts/src/lib/paths.ts
    - scripts/src/lib/scaffold.ts
    - scripts/src/lib/validate.ts
    - scripts/src/lib/current.ts
    - scripts/src/lib/commit-hook.ts
    - scripts/src/lib/verification.ts
    - scripts/lib/tasks-docs.js
    - scripts/lib/paths.js
    - scripts/lib/scaffold.js
    - scripts/lib/validate.js
    - scripts/lib/current.js
    - scripts/lib/commit-hook.js
    - scripts/lib/verification.js
    - test/tasks-docs.test.js
    - test/paths.test.js
    - test/scaffold.test.js
    - test/validate-structural.test.js
    - test/validate-gates.test.js
    - test/current.test.js
    - test/commit-hook.test.js
    - test/verification-runner.test.js
    - CLAUDE.md
    - docs/governance.md
    - docs/gates.md
    - docs/ARCHITECTURE.md
    - docs/troubleshooting.md
    - docs/context-versioning.md
    - skills/bouncer-plan/SKILL.md
    - skills/bouncer-execute/SKILL.md
    - skills/implementation/SKILL.md
    - skills/review/SKILL.md
    - skills/review/reviewer-prompt.md
    - skills/graphify-runner/SKILL.md
    - agents/bouncer-implementer.md
    - agents/bouncer-reviewer.md
    - agents/bouncer-debugger.md
  graph:
    generated_at: '2026-08-06T17:44:00.000+09:00'
    command: graphify query on graphify-out/source/graph.json and graphify-out/context/graph.json
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - docs
      - skills
      - agents
    basis:
      - graph: source
        status: reused
        query: tasks document file name resolver validate gates scaffold pointer commit hook verify command
        result: 76 nodes, 전부 test/ 아래(validate-gates.test.js, validate-structural.test.js, scaffold.test.js). source_dirs가 scripts/hooks/test라 skills/·docs/·agents/는 반환되지 않아 수동으로 더함
      - graph: context
        status: updated
        query: task 문서 커밋 단위 blueprint 게이트 문서 이름
        result: 18 nodes; 이번 epic 018 index.md와 014-numeric-context-ids(= 문서 id 규칙을 정한 선행 작업), 013-comprehension-gate. 코드 경로 제안은 없음
---
# Tasks

Blueprint: [001](index.md)

## Goal & intent

blueprint 디렉터리 안에 `tasks-001.md`, `tasks-002.md` 처럼 번호가 붙은 task 문서를
여러 개 둘 수 있게 만든다. 지금은 `tasks.md`라는 이름이 스캐폴드·검증·포인터 조회·
커밋 훅·검증 명령 조회 다섯 곳에 각각 박혀 있어, 이름 규칙 하나를 바꾸려면 다섯 곳을
동시에 손대야 한다. 그 이름 판단을 모듈 하나로 모으고 나머지는 그 모듈을 부르게 한다.

호환이 이 작업의 절반이다. 이미 쌓인 blueprint는 전부 `tasks.md` 하나를 갖고 있고,
그 문서들을 건드리지 않고도 검증이 그대로 통과해야 한다. 그래서 리졸버는 두 이름을
모두 받되, 한 blueprint 안에 두 형식이 섞이는 것만 거절한다.

실행 시점에 어느 task를 작업 중인지 고르는 일은 여기서 하지 않는다. 포인터는
`{blueprint, base}` 그대로 두고, 값이 하나여야 하는 자리(검증 명령, 커밋 허용 경로)는
이 blueprint에서 정한 규칙 — 첫 선언 채택, 경로는 합집합 — 으로 넘긴다.

## Interface

- 제공
  - `scripts/src/lib/tasks-docs.ts` — blueprint 디렉터리를 받아 task 문서 목록을
    번호 오름차순으로 돌려준다. 각 항목은 저장소 상대 경로와 task id를 갖는다.
    호출자가 레거시 단일 `tasks.md`인지, 두 형식이 섞였는지 구분할 수 있어야 한다.
    task 파일 이름 정규식(`tasks-\d{3}\.md`)과 id 유도 규칙은 이 모듈에만 둔다.
  - `parsePathIds` — `tasks-{ddd}.md`를 kind `tasks`로 인식한다.
  - `scaffold blueprint` — `tasks-001.md`를 만들고 `bouncer.id`를 `TASKS-001`로 쓴다.
  - `validate` — 발견된 모든 task 문서에 구조 검사와 plan 게이트
    G3·G4·G5·G10·G11·G12를 각각 적용하고, 실패의 `file`은 해당 task 문서 경로다.
    두 형식이 섞이면 새 구조 실패 코드로 거절한다.
  - `current`의 ready 목록·`affected_paths` 조회, `commit-hook`의 허용 경로 조회,
    `verification`의 검증 명령 조회 — 모두 리졸버를 거친다.
- 거부
  - 포인터 스키마 확장. `{blueprint, base}` 그대로 둔다.
  - `verification.md` / `review.md`를 task별로 나누는 일.
  - finalize의 커밋 메시지 구성 변경.
  - 이미 있는 `tasks.md` 문서를 새 이름으로 옮기는 일.
  - 새 설정 키, 새 CLI 하위 명령, 새 frontmatter 필드.

## Touch

- Add `scripts/src/lib/tasks-docs.ts` — task 파일 이름 정규식, 목록 조회, id 유도,
  레거시·혼재 판정을 담는다.
- Modify `scripts/src/lib/paths.ts` — `parsePathIds`가 `tasks-{ddd}.md`를 tasks
  문서로 인식하게 한다. 이름 정규식은 `tasks-docs`에서 가져온다.
- Modify `scripts/src/lib/scaffold.ts` — blueprint 스캐폴드가 `tasks-001.md`를
  만들고 id를 `TASKS-001`로 쓴다.
- Modify `scripts/src/lib/validate.ts` — 문서 로딩을 task 문서 목록으로 넓히고,
  S5 기대 id를 파일 이름에서 유도하며, plan 게이트를 문서마다 돌리고, 혼재를
  거절하는 구조 코드를 더한다.
- Modify `scripts/src/lib/current.ts` — ready 판정과 `affected_paths` 수집을
  리졸버 기반으로 바꾼다. 경로는 모든 task 문서의 합집합.
- Modify `scripts/src/lib/commit-hook.ts` — 허용 경로 조회를 합집합으로 바꾼다.
- Modify `scripts/src/lib/verification.ts` — 검증 명령을 번호가 앞선 선언에서 읽는다.
- Add `test/tasks-docs.test.js` — 리졸버 단위 테스트.
- Modify `test/paths.test.js` — 새 이름의 kind 인식을 잡는다.
- Modify `test/scaffold.test.js` — 새로 만들어지는 파일 이름과 id를 잡는다.
- Modify `test/validate-structural.test.js` — 파일 이름별 기대 id와 혼재 거절을 잡는다.
- Modify `test/validate-gates.test.js` — 여러 task 문서에 게이트가 각각 걸리는 것을 잡는다.
- Modify `test/current.test.js` — 여러 task 문서에서의 ready 판정과 경로 합집합을 잡는다.
- Modify `test/commit-hook.test.js` — 허용 경로 합집합을 잡는다.
- Modify `test/verification-runner.test.js` — 검증 명령의 첫 선언 채택을 잡는다.
- Modify `CLAUDE.md` — 하드룰 2를 "one commit per task"로 고치고, task 문서가
  여러 개일 수 있다는 사실을 문서 규칙(하드룰 1)에 반영한다.
- Modify `docs/governance.md` — 커밋 단위 설명을 task 기준으로 고친다.
- Modify `docs/gates.md` — plan 게이트가 task 문서마다 적용된다는 것과 새 구조
  코드를 표에 넣는다.
- Modify `docs/ARCHITECTURE.md` — 문서 세트 설명에서 task 문서 이름을 고친다.
- Modify `docs/troubleshooting.md` — worktree에 task 문서가 없는 항목의 이름을 고친다.
- Modify `docs/context-versioning.md` — task 문서 이름 언급을 고친다.
- Modify `skills/bouncer-plan/SKILL.md` — 스캐폴드 결과와 본문 작성 대상이
  `tasks-001.md`임을 반영한다.
- Modify `skills/bouncer-execute/SKILL.md` — 브리프를 가리키는 문장을 새 이름 기준으로 고친다.
- Modify `skills/implementation/SKILL.md` — 브리프 이름을 고친다.
- Modify `skills/review/SKILL.md` — 브리프 이름을 고친다.
- Modify `skills/review/reviewer-prompt.md` — 브리프 이름을 고친다.
- Modify `skills/graphify-runner/SKILL.md` — `suggested_paths`를 쓰는 대상 문서 이름을 고친다.
- Modify `agents/bouncer-implementer.md` — 브리프 이름을 고친다.
- Modify `agents/bouncer-reviewer.md` — 브리프 이름을 고친다.
- Modify `agents/bouncer-debugger.md` — 브리프 이름을 고친다.
- Modify `scripts/lib/tasks-docs.js`, `scripts/lib/paths.js`, `scripts/lib/scaffold.js`,
  `scripts/lib/validate.js`, `scripts/lib/current.js`, `scripts/lib/commit-hook.js`,
  `scripts/lib/verification.js` — `npm run build`가 만드는 CJS 산출물을 함께 커밋한다.

## Do not touch

- `scripts/src/lib/runtime-state.ts` — 포인터 스키마는 다음 blueprint에서 넓힌다.
- `scripts/src/lib/finalize.ts` — 커밋 메시지 구성과 PR 단위는 이 blueprint 범위 밖이다.
- `scripts/src/lib/migrate-ids.ts` — 새 이름은 마이그레이션 대상이 아니다.
- `scripts/src/lib/seed-worktree.ts` — 문서 디렉터리 단위로 옮기므로 이름 규칙과 무관하다.
- `scripts/src/lib/schema.ts` — 문서 타입·id 접두·status 열거는 그대로다.
- `scripts/src/lib/init.ts` — 부트스트랩 경로는 건드리지 않는다.
- `skills/bouncer-finalize/SKILL.md` — finalize 단위 변경은 이 blueprint 범위 밖이다.
- `.bouncer/config.json`, `config.example.json` — 새 설정 키를 만들지 않는다.

## Constraints

- 기존 `tasks.md` 하나짜리 blueprint는 문서를 고치지 않고 통과해야 한다. 이 저장소에
  이미 쌓인 문서가 회귀 테스트 역할을 하므로, `npm test`가 그것을 검증한다.
- task 파일 이름 정규식과 id 유도 규칙은 `tasks-docs` 모듈 한 곳에만 둔다. 다른
  모듈이 `tasks.md`나 `tasks-\d{3}` 문자열을 직접 매칭하지 않는다.
- 새 구조 실패 코드는 이미 쓰인 S0~S13 다음 번호를 쓴다.
- 값이 하나여야 하는 자리의 규칙을 코드 주석에 남긴다 — 검증 명령은 번호가 앞선
  선언, 허용 경로는 합집합. 둘 다 task 포인터가 생기면 좁혀질 임시 규칙이다.
- 게이트 실패 보고의 `file`은 문제가 있는 task 문서 경로여야 한다. 첫 문서 경로로
  뭉뚱그리면 어느 task가 미달인지 알 수 없다.
- 사용자 대상 문서와 스킬 본문의 한국어 문장은 그대로 한국어로 쓴다.
- `scripts/lib` CJS 산출물은 `npm run build`로 다시 만들어 함께 커밋한다. 손으로
  고치지 않는다.

## Checklist

- [ ] `test/tasks-docs.test.js`를 먼저 쓴다. 다음을 각각 잡는다 — `tasks.md`만
      있을 때 레거시 단일 항목, `tasks-001.md`/`tasks-003.md`가 번호 순으로
      나오는 것, 두 형식이 섞였을 때의 혼재 표시, `tasks-1.md`가 목록에서 빠지는 것,
      task 문서가 없을 때 빈 목록.
- [ ] `npm test`로 실패를 확인한다.
- [ ] `scripts/src/lib/tasks-docs.ts`를 구현한다. 이름 정규식, 목록 조회, id 유도,
      레거시·혼재 판정만 담고 문서 파싱은 하지 않는다.
- [ ] `parsePathIds`가 새 이름을 tasks로 인식하게 하고 `test/paths.test.js`에
      해당 케이스를 더한다.
- [ ] `scaffold blueprint`가 `tasks-001.md`(id `TASKS-001`)를 만들게 하고
      `test/scaffold.test.js`의 기대 파일 목록과 id를 갱신한다.
- [ ] `validate`의 문서 로딩을 task 문서 목록으로 넓힌다. 구조 검사는 모든 task
      문서에 적용한다.
- [ ] S5 기대 id를 파일 이름에서 유도한다. `tasks.md`는 `TASKS-{blueprint id}`,
      `tasks-{NNN}.md`는 `TASKS-{NNN}`. `test/validate-structural.test.js`에
      두 경우와 어긋난 id를 모두 잡는 테스트를 더한다.
- [ ] 혼재를 새 구조 코드로 거절하고 같은 테스트 파일에서 확인한다.
- [ ] plan 게이트 G3·G4·G5·G10·G11·G12를 task 문서마다 돌린다. 두 문서 중 하나만
      미달일 때 그 문서 경로로 실패가 보고되는지 `test/validate-gates.test.js`에서
      확인한다.
- [ ] `current`의 ready 판정을 "task 문서 중 하나라도 `ready`/`in_progress`"로,
      `affected_paths` 조회를 합집합으로 바꾸고 `test/current.test.js`에 더한다.
- [ ] `commit-hook`의 허용 경로를 합집합으로 바꾸고 `test/commit-hook.test.js`에 더한다.
- [ ] `verification`의 검증 명령 조회를 번호가 앞선 선언 기준으로 바꾼다. 선언이
      유효하지 않으면 지금처럼 즉시 거절한다. `test/verification-runner.test.js`에
      두 문서가 서로 다른 값을 선언한 경우를 더한다.
- [ ] `CLAUDE.md` 하드룰 2를 "one commit per task"로 고치고, 하드룰 1에 task 문서가
      blueprint 하나에 여러 개일 수 있다는 문장을 넣는다. blueprint가 리뷰 단위(PR)로
      남는다는 것도 같이 적는다.
- [ ] `docs/governance.md`의 커밋 단위 설명을 task 기준으로 고친다.
- [ ] `docs/gates.md`에 plan 게이트가 task 문서마다 적용된다는 문장과 새 구조 코드
      행을 넣는다.
- [ ] `docs/ARCHITECTURE.md`, `docs/troubleshooting.md`, `docs/context-versioning.md`의
      task 문서 이름 언급을 고친다.
- [ ] 스킬과 named agent 문서 아홉 개의 브리프 이름 언급을 고친다 — `bouncer-plan`,
      `bouncer-execute`, `implementation`, `review`, `reviewer-prompt`,
      `graphify-runner`, `bouncer-implementer`, `bouncer-reviewer`, `bouncer-debugger`.
- [ ] `npm run build`로 `scripts/lib` 산출물을 다시 만든다.
- [ ] `npm test`가 통과하는 것을 확인한다. 이 저장소에 이미 있는 `tasks.md`
      blueprint들이 그대로 통과하는지 함께 본다.
