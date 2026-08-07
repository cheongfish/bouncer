---
type: bouncer.tasks
title: 스킬과 문서의 task 문서 경로 안내를 디렉터리 묶음 기준으로 고침
description: Tasks for 001
resource: .bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/tasks-003.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-07T09:59:09.568+09:00'
bouncer:
  id: TASKS-003
  epic_id: '020'
  blueprint_id: '001'
  status: ready
  affected_paths:
    - CLAUDE.md
    - skills/bouncer-plan/SKILL.md
    - skills/bouncer-execute/SKILL.md
    - skills/bouncer-finalize/SKILL.md
    - skills/verification/SKILL.md
    - skills/review/SKILL.md
    - skills/review/reviewer-prompt.md
    - skills/implementation/SKILL.md
    - skills/spec-authoring/SKILL.md
    - skills/graphify-runner/SKILL.md
    - agents/bouncer-implementer.md
    - agents/bouncer-reviewer.md
    - agents/bouncer-debugger.md
    - docs/governance.md
    - docs/workflow.md
    - docs/okf.md
    - docs/gates.md
    - docs/cli.md
    - docs/ARCHITECTURE.md
    - docs/context-versioning.md
    - docs/troubleshooting.md
    - test/master-rules.test.js
    - test/skill-bouncer-plan.test.js
    - test/skill-bouncer-execute.test.js
    - test/skill-bouncer-finalize.test.js
    - test/skill-verification.test.js
    - test/skill-review.test.js
    - test/agents.test.js
    - test/public-name-regression.test.js
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
        result: >-
          15 hits — scripts/src/lib의 tasks-docs·paths·scaffold·validate·verification·
          current과 대응 scripts/lib CJS 산출물, test/cli-verify.test.js
      - graph: context
        status: updated
        query: task 단위 커밋 verification review 게이트 문서 배치
        result: >-
          5 hits — 과거 epic들의 verification.md뿐이라 affected_paths 후보가 아님.
          source_dirs가 scripts/hooks/test라 skills·agents·docs는 수동 추가
---
# Tasks

Blueprint: [001](index.md)

## Goal & intent
스킬과 문서가 `tasks-001.md`·`<bp>/verification.md` 같은 옛 경로를 지시하는 곳을
`tasks/<NNN>/…`로 바꾼다. `/bouncer-plan`은 새 blueprint를 새 레이아웃으로
스캐폴드하고 task를 더 만들 때 `bouncer scaffold task`를 쓰라고 안내한다.
`/bouncer-execute`는 포인터가 지목한 묶음의 `verification.md`·`review.md`를 대상으로
삼는다.

001·002가 코드를 바꾼 뒤라 이 task는 문구와 계약 테스트만 다룬다.

## Interface
- 제공
  - `/bouncer-plan` 3단계가 `scaffold blueprint` 산출물을 `tasks/001/` 3종으로
    적고, task 추가는 `bouncer scaffold task --blueprint <dir> --id <NNN>`으로
    안내한다.
  - `/bouncer-execute` 4·5단계가 대상 문서를 `<포인터 task 디렉터리>/verification.md`,
    `.../review.md`로 지시한다.
  - `CLAUDE.md` 하드룰 1의 task 문서 설명이 디렉터리 묶음 형태로 바뀐다.
  - `docs/governance.md`·`docs/okf.md`·`docs/gates.md`·`docs/workflow.md`가 새
    배치와 G6~G8·G13·G14의 판정 단위를 설명한다.
  - `docs/cli.md`에 `scaffold task` 항목이 생긴다.
- 거부
  - 게이트 번호나 코드 동작을 문서에서 새로 정의하지 않는다. 문서는
    `validate.ts`가 하는 일을 기술만 한다.
  - 구 레이아웃 거절 문구는 여기서 쓰지 않는다. 하드컷은 004에서 발효하므로
    이 커밋 시점에는 아직 구 레이아웃이 통과한다.

## Touch
- Modify `CLAUDE.md` — 하드룰 1의 task 문서 배치 설명
- Modify `skills/bouncer-plan/SKILL.md` — 3단계 스캐폴드 산출물과 task 추가 방법
- Modify `skills/bouncer-execute/SKILL.md` — verify·review 대상 문서 경로
- Modify `skills/bouncer-finalize/SKILL.md` — 다음 task 핸드오프의 경로 표기
- Modify `skills/verification/SKILL.md` — 읽을 verification 문서의 위치
- Modify `skills/review/SKILL.md` — 기록할 review 문서의 위치
- Modify `skills/review/reviewer-prompt.md` — 브리프 경로 표기
- Modify `skills/implementation/SKILL.md` — 브리프 경로 표기
- Modify `skills/spec-authoring/SKILL.md` — 어떤 문서의 title이 커밋 bullet이 되는지
- Modify `skills/graphify-runner/SKILL.md` — `suggested_paths`를 쓰는 문서 경로
- Modify `agents/bouncer-implementer.md` — 브리프 경로 표기
- Modify `agents/bouncer-reviewer.md` — 리뷰 대상 문서 경로 표기
- Modify `agents/bouncer-debugger.md` — 브리프 경로 표기
- Modify `docs/governance.md` — task=커밋 단위와 문서 묶음의 관계
- Modify `docs/workflow.md` — plan·execute 단계의 문서 경로
- Modify `docs/okf.md` — context 트리 배치
- Modify `docs/gates.md` — G6·G7·G8·G13·G14의 판정 단위
- Modify `docs/cli.md` — `scaffold task` 사용법
- Modify `docs/ARCHITECTURE.md` — 문서 트리 그림
- Modify `docs/context-versioning.md` — 문서 경로 예시
- Modify `docs/troubleshooting.md` — 문서 경로 예시
- Modify `test/master-rules.test.js` — 하드룰 1 문구 계약
- Modify `test/skill-bouncer-plan.test.js` — 스캐폴드 안내 계약
- Modify `test/skill-bouncer-execute.test.js` — 대상 문서 경로 계약
- Modify `test/skill-bouncer-finalize.test.js` — 핸드오프 문구 계약
- Modify `test/skill-verification.test.js` — 문서 위치 계약
- Modify `test/skill-review.test.js` — 문서 위치 계약
- Modify `test/agents.test.js` — 에이전트 문서 경로 계약
- Modify `test/public-name-regression.test.js` — 경로 허용 목록

## Do not touch
- `scripts/src/lib` — 코드는 001·002에서 확정
- `.bouncer/context/epics` — 트리 이동은 004
- `docs/PILOT.md` — 과거 파일럿 기록이라 소급 수정하지 않는다
- `skills/stop-slop` — 예시 문구는 이 변경과 무관

## Constraints
- 스킬 본문은 영어를 유지한다. 한국어로 바꾸지 않는다.
- 하드룰 2("One commit per task")의 문장을 바꾸지 않는다. 이번에 바뀌는 것은
  하드룰 1의 배치 설명뿐이다.
- `docs/PILOT.md`와 이미 발행된 `explain.md`의 경로 표기는 소급 수정하지 않는다.
  과거 기록이 그 시점 배치를 가리켜야 한다.
- 문서에서 `tasks-001.md`를 없앨 때 레거시 수용 사실 자체는 남긴다.
  `bouncer migrate task-layout`으로 옮기라는 안내를 004가 채울 자리로 비워두지
  말고, 이 커밋에서 "구 레이아웃은 마이그레이션 대상"이라고만 적는다.

## Checklist
- [ ] `test/master-rules.test.js`에 하드룰 1이 `tasks/<NNN>/` 배치를 명시하는지
      확인하는 실패 assert를 먼저 추가한다.
      ```js
      assert.match(rules, /tasks\/<NNN>\/`?\{?tasks/);
      ```
- [ ] `test/skill-bouncer-plan.test.js`에 3단계가 `scaffold task`를 안내하는지
      확인하는 assert를 추가한다.
      ```js
      assert.match(skill, /scaffold task --blueprint/);
      ```
- [ ] `test/skill-bouncer-execute.test.js`에 verify·review 대상이 포인터 task
      디렉터리임을 확인하는 assert를 추가한다.
- [ ] 위 assert들이 실패하는 것을 확인한 뒤 `CLAUDE.md`와 스킬 본문을 고친다.
- [ ] `agents/` 세 문서의 브리프·대상 경로 표기를 맞추고
      `test/agents.test.js`를 갱신한다.
- [ ] `docs/governance.md`·`workflow.md`·`okf.md`·`gates.md`·`cli.md`·
      `ARCHITECTURE.md`·`context-versioning.md`·`troubleshooting.md`의 경로 예시와
      게이트 판정 단위 설명을 갱신한다.
- [ ] `test/public-name-regression.test.js`의 경로 허용 목록에 새 배치가 걸리지
      않는지 확인하고 필요한 만큼만 갱신한다.
- [ ] `npm test`가 통과한다.
