---
type: bouncer.tasks
title: 루트 task 레이아웃 서술과 해석 폴백 제거
description: Tasks for 003
resource: .bouncer/context/epics/031-document-schema/blueprints/001-schema-cutover/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-12T14:38:53.911+09:00'
bouncer:
  id: TASKS-003
  epic_id: '031'
  blueprint_id: '001'
  status: ready
  commit_intent:
    - 코드는 이미 거절하는 레이아웃을 문서와 스킬이 아직 선택지로 서술하고 있었음
    - 대표 task 경로 폴백이 남아 있어 없는 레거시 파일을 가리킬 수 있었음
  affected_paths:
    - scripts/src/lib/validate.ts
    - scripts/lib/validate.js
    - test/validate-structural.test.js
    - CLAUDE.md
    - docs/okf.md
    - docs/governance.md
    - docs/context-versioning.md
    - skills/review/SKILL.md
    - skills/review/assets/reviewer-prompt.md
    - skills/implementation/SKILL.md
    - skills/graphify-runner/SKILL.md
    - skills/bouncer-execute/SKILL.md
    - agents/bouncer-reviewer.md
    - agents/bouncer-implementer.md
    - agents/bouncer-debugger.md
  graph:
    generated_at: '2026-08-12T15:41:00.000+09:00'
    command: graphify query (source + context)
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
        query: document schema frontmatter type validate scaffold blueprint init epic-index bundle root okf_version tasks-docs legacy task layout
        result: 39 nodes — source_dirs가 scripts/hooks/test라 이 task의 실제 대상인 skills·docs·agents는 잡히지 않음. 남은 자리는 grep으로 직접 열거
      - graph: context
        status: updated
        query: 문서 스키마 필드 승격 scale commit_type bouncer_schema type 대조 레거시 레이아웃 컷오버 작성 예시
        result: 6 nodes — 024-light-path/001-scale-light-convention explain.md(경량 scale 도입 경위), 006-scripts-typescript index.md
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
루트 `tasks.md` / `tasks-<NNN>.md`는 이미 task 문서로 해석되지 않고 S15로
거절된다. 그런데 문서·스킬·에이전트 산문 열 곳 남짓이 아직 그것을 "또는 레거시
루트 task 문서"라는 살아있는 선택지로 서술하고, `loadBlueprintDocs`는 묶음이
하나도 없을 때 대표 task 경로를 레거시 basename으로 채운다. 읽는 쪽이 두 레이아웃을
다 지원한다고 믿게 만드는 마지막 자리를 닫는다.

남기는 것은 `bouncer migrate task-layout`의 **입력**이라는 서술 하나다. 명령과
`tasks-docs.ts`의 탐지는 그대로다 — S15 메시지가 그 위에 서 있다.

## Interface
- 제공:
  - `loadBlueprintDocs`의 `rels.tasks`가 묶음이 없을 때 `<bp>/tasks/001/tasks.md`
    를 가리킨다. `LEGACY_TASKS_BASENAME` import는 사라진다.
  - 워크플로 스킬·에이전트 브리프가 task 브리프 경로를 `tasks/<NNN>/tasks.md`
    하나로만 지칭한다.
  - 문서에서 루트 레이아웃은 `bouncer migrate task-layout` 입력으로만 등장한다.
- 거부:
  - `bouncer migrate task-layout` 명령, `tasks-docs.ts`의 `LEGACY_TASKS_BASENAME`
    ·`NUMBERED_TASKS_RE`·`legacyFiles` 탐지, S15 자체는 건드리지 않는다.
  - `docs/gates.md`의 S15 설명은 이미 "하나뿐"이라고 쓰여 있으므로 손대지
    않는다.
  - 스킬 산문에서 문장을 지우기만 하고 브리프 섹션 목록·리뷰 루브릭·가드 문구를
    다시 쓰지 않는다.

## Touch
- Modify `scripts/src/lib/validate.ts` — `LEGACY_TASKS_BASENAME` import 제거와
  `rels.tasks` 폴백 교체.
- Modify `scripts/lib/validate.js` — 산출물 동기화.
- Modify `test/validate-structural.test.js` — 묶음 없는 blueprint가 어떤 경로를
  보고하는지 고정하는 단언.
- Modify `CLAUDE.md` — 하드룰 1의 「legacy … remain migration targets until the
  layout cutover」 문장을 마이그레이션 입력 서술로 교체.
- Modify `docs/okf.md` — 「Root task layouts are retained only as migration
  targets during the transition」 교체.
- Modify `docs/governance.md` — 루트 문서 문장을 마이그레이션 입력으로 한정.
- Modify `docs/context-versioning.md` — 37행 괄호 안 레거시 언급 제거.
- Modify `skills/review/SKILL.md` — 브리프 경로에서 레거시 대안 제거.
- Modify `skills/review/assets/reviewer-prompt.md` — 같은 문구.
- Modify `skills/implementation/SKILL.md` — 같은 문구.
- Modify `skills/graphify-runner/SKILL.md` — YAML `description`과 본문 두 곳.
- Modify `skills/bouncer-execute/SKILL.md` — 브리프 문서 지칭.
- Modify `agents/bouncer-reviewer.md` — `description`과 브리프 섹션 안내.
- Modify `agents/bouncer-implementer.md` — `description`.
- Modify `agents/bouncer-debugger.md` — 브리프 섹션 안내 두 곳.

## Do not touch
- `scripts/src/lib/tasks-docs.ts` — 레거시 탐지는 S15의 근거다.
- `scripts/src/lib/migrate-task-layout.ts` 및 `test/migrate-task-layout.test.js`
  — 마이그레이션 경로는 유지한다.
- `docs/gates.md`·`docs/troubleshooting.md` — S15 서술은 이미 정확하다.
- `docs/cli.md` — `migrate task-layout` 항목은 남는다.
- `skills/spec-authoring/` — TASKS-004다.

## Constraints
- 스킬 `description`은 YAML 한 줄 문자열이다. 따옴표를 유지하고 `##`을 넣지
  않는다(주석으로 잘린다).
- 리뷰어 루브릭·`reviewer-prompt.md`·`agents/` 문서·execute 디스패치는 한
  커밋 단위라는 기존 규칙을 지킨다. 이 task가 그 넷을 함께 담는다.
- 문구 교체는 의미를 좁히기만 한다. 브리프 섹션 목록, 가드, 출력 계약은 그대로
  둔다.
- `scripts/lib/*.js`는 손으로 고치지 않는다.

## Checklist
- [ ] `test/validate-structural.test.js`에 실패 테스트를 추가한다: `tasks/`
      묶음이 없는 blueprint를 validate하면 보고 경로가 레거시 basename이 아니다.
      ```js
      assert.ok(!files.some((f) => /\/tasks\.md$/.test(f)));
      ```
- [ ] `node --test test/validate-structural.test.js`로 실패를 확인한다.
- [ ] `validate.ts`의 import에서 `LEGACY_TASKS_BASENAME`을 빼고 `rels.tasks`
      폴백을 `${bp}/tasks/001/tasks.md`로 바꾼다.
- [ ] `grep -rn "legacy root task\|tasks-<NNN>\.md\|tasks-NNN\.md" docs skills
      agents CLAUDE.md`로 남은 자리를 뽑고, Touch에 적힌 파일을 하나씩 고친다.
- [ ] 같은 grep을 다시 돌려 남는 것이 `docs/gates.md`·`docs/troubleshooting.md`
      ·`docs/cli.md`의 마이그레이션 서술뿐인지 확인한다.
- [ ] `npm run build`로 `scripts/lib/`를 재생성한다.
- [ ] `npm test`가 통과한다.
