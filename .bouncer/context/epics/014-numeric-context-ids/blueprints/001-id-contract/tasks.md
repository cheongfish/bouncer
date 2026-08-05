---
type: bouncer.tasks
title: path·schema·scaffold·validate를 숫자 id 정본으로 맞춤
description: 접두 없는 epic/bp id 계약과 신형 fixture 테스트
resource: .bouncer/context/epics/014-numeric-context-ids/blueprints/001-id-contract/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-05T16:54:53.735+09:00'
bouncer:
  id: TASKS-001
  epic_id: '014'
  blueprint_id: '001'
  status: verified
  affected_paths:
    - scripts/src/lib/paths.ts
    - scripts/src/lib/layout.ts
    - scripts/src/lib/schema.ts
    - scripts/src/lib/validate.ts
    - scripts/src/lib/scaffold.ts
    - scripts/src/lib/epic-index.ts
    - scripts/src/lib/templates.ts
    - scripts/src/lib/cli.ts
    - scripts/src/lib/init.ts
    - scripts/lib/paths.js
    - scripts/lib/layout.js
    - scripts/lib/schema.js
    - scripts/lib/validate.js
    - scripts/lib/scaffold.js
    - scripts/lib/epic-index.js
    - scripts/lib/templates.js
    - scripts/lib/cli.js
    - scripts/lib/init.js
    - test/paths.test.js
    - test/scaffold.test.js
    - test/validate-structural.test.js
    - test/init.test.js
    - test/cli-validate.test.js
    - test/validate-gates.test.js
    - test/current.test.js
    - test/cli-current.test.js
    - skills/bouncer-plan/SKILL.md
    - skills/spec-authoring/SKILL.md
    - docs/contributing.md
    - docs/ARCHITECTURE.md
  graph:
    generated_at: '2026-08-05T16:58:04+09:00'
    command: graphify query (source + context)
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - skills
      - docs
    basis: graph-sync가 source·context를 재빌드했다. source 질의 "parsePathIds epicDirOf isCanonicalEpicDir scaffoldEpic ensureEpicIndexEntry ID_PREFIX"는 paths·layout·scaffold·epic-index· templates·schema·validate·init(및 lib 미러)을 중심으로 모았다. finalize·verification·seed-worktree는 질의에 나왔으나 id 계약을 바꾸지 않아 Do not touch로 둔다. schema.test.js는 ID_PREFIX 존재 검사만 할 수 있어 Touch에 넣을지 구현 때 확인한다. context 질의는 EPIC-014 BP들만 모아 선행 스트림 없음을 보여 discovery Overlap과 맞다. skills/docs는 source_dirs 밖이라 예시 문자열 갱신용으로 수동 추가했다.
---
# Tasks

Blueprint: [001](index.md)

## Goal & intent
하네스가 epic/bp 정본 id를 zero-pad 세 자리로만 다루고, scaffold는
`.bouncer/context/epics/014-slug` / `blueprints/001-slug`만 만든다. 구형
`EPIC-`/`BP-` 경로 세그먼트는 id 숫자 파생과 canonical 판정에서만 임시 허용한다.
자식 문서 id는 `TASKS-001` 형태다. 검증은 `npm test`.

## Interface
- 제공: `parsePathIds` → `epicId`/`blueprintId`가 `\d{3}` 또는 null.
- 제공: scaffold/`--id`가 `\d{3}`만 수용. 신형 디렉터리명·frontmatter·epic-index 링크.
- 제공: S4 epic/blueprint = `\d{3}` 접두 없음; 자식 = `TASKS-`|`VERIFY-`|`REVIEW-`|`EXPLAIN-` + `\d{3}`.
- 제공: 전이용으로 `EPIC-\d{3}-` / `BP-\d{3}-` 경로 세그먼트도 layout·parse·epic-index가 인식.
- 제공: 전이용으로 S5가 frontmatter id에서 구형 접두(`EPIC-`/`BP-`/`TASKS-BP-` 등)를
  떼고 비교 — `014`는 `014`와, `TASKS-001`은 `TASKS-001`과 같다고 본다.
- 거부: `--id 001` / `1` / `01`. scaffold가 구형 접두 경로·메타를 새로 만들지 않음.
- 거부: 정규화 후에도 숫자가 어긋나는 frontmatter — S5 실패(예: `epics/014-…`에 `013`).

## Touch
- Modify `scripts/src/lib/paths.ts` — 숫자 파생·구형 접두 optional.
- Modify `scripts/src/lib/layout.ts` — canonical 정규식 신형 + 전이 구형.
- Modify `scripts/src/lib/schema.ts` — epic/bp `ID_PREFIX` 정리, S4용 규칙.
- Modify `scripts/src/lib/validate.ts` — S4/S5 expectedId가 숫자 정본 + 전이용 구형 접두 정규화.
- Modify `scripts/src/lib/scaffold.ts` — dir·메타·자식 id·epicId 추출.
- Modify `scripts/src/lib/epic-index.ts` — 목록·dir 정규식 신형 + 전이 구형 인식(이 레포에 `001`~`014` 실디렉터리가 있어 S13이 즉시 깨지므로 선택이 아니다).
- Modify `scripts/src/lib/templates.ts` — 예시·placeholder를 숫자 id로.
- Modify `scripts/src/lib/cli.ts` — help·`--id` 검증 메시지.
- Modify `scripts/src/lib/init.ts` — context index 주석 예시.
- Modify `scripts/lib/paths.js` — build 산출(손으로 편집하지 않음).
- Modify `scripts/lib/layout.js` — build 산출.
- Modify `scripts/lib/schema.js` — build 산출.
- Modify `scripts/lib/validate.js` — build 산출.
- Modify `scripts/lib/scaffold.js` — build 산출.
- Modify `scripts/lib/epic-index.js` — build 산출.
- Modify `scripts/lib/templates.js` — build 산출.
- Modify `scripts/lib/cli.js` — build 산출.
- Modify `scripts/lib/init.js` — build 산출.
- Modify `test/paths.test.js` — 신형·구형 경로 fixture.
- Modify `test/scaffold.test.js` — 신형 dir/id 단언.
- Modify `test/validate-structural.test.js` — S4/S5 숫자 id.
- Modify `test/init.test.js` — 예시 문자열.
- Modify `test/cli-validate.test.js` — fixture 경로·id.
- Modify `test/validate-gates.test.js` — fixture id.
- Modify `test/current.test.js` — fixture 경로(해당 시).
- Modify `test/cli-current.test.js` — fixture 경로(해당 시).
- Modify `skills/bouncer-plan/SKILL.md` — scaffold 예시 id/경로.
- Modify `skills/spec-authoring/SKILL.md` — id 언급이 있으면 숫자로.
- Modify `docs/contributing.md` — 브랜치/`<id>` 표기.
- Modify `docs/ARCHITECTURE.md` — worktree `<id>` 표기(해당 문구).

## Do not touch
- `scripts/src/lib/migrate-ids.ts` — 없음; 002가 신설.
- `skills/migrate-ids/` — 002.
- `hooks/session-graph.js` — 구형 명명 경고는 002.
- `.bouncer/context/epics/001-*` 등 기존 epic 실트리 — 003.
- `.bouncer/Distill.md` — 003.
- `scripts/src/lib/comprehension.ts` — id 계약과 무관.
- `CHANGELOG.md` — 에픽 전체를 003이 한 항목으로 쓴다.

## Constraints
- `scripts/lib/*.js`는 `npm run build`/`pretest`로만 재생성하고 손편집하지 않는다.
- 구형 경로 허용은 “읽기/판정”만; 신규 scaffold 출력에 접두를 넣지 않는다.
- G10–G15 본문·상태 판정 로직을 바꾸지 않는다.
- 공개 CLI stderr/stdout 계약(알 수 없는 사용법 → stderr)을 유지한다.
- `affected_paths`에 디렉터리 루트만 넣지 않는다.

## Checklist
- [ ] `parsePathIds`가 신형·구형 경로 모두에서 `014`/`001`을 내도록 실패 테스트를 추가하고 확인한다.
- [ ] scaffold `--id 001` 성공, `--id 001`/`1` 실패 테스트를 추가·확인한다.
- [ ] S4/S5·S13 fixture를 숫자 id로 고치고 구현한다.
- [ ] 구형 메타 fixture(`014` / `TASKS-001`)가 S5를 통과하고, 숫자가 어긋나면
  실패하는 테스트를 넣는다.
- [ ] 이 레포에서 기존 에픽 하나로 `bouncer validate --gate plan`을 돌려 S5/S13이
  나오지 않음을 확인한다(002·003이 게이트를 통과할 전제).
- [ ] `npm run build` 후 `scripts/lib` 산출을 커밋 대상에 포함한다.
- [ ] `npm test` 통과.
- [ ] skills/docs 예시가 `EPIC-00x`/`BP-00x` scaffold 경로를 더 이상 정본으로 가르치지 않는다.
