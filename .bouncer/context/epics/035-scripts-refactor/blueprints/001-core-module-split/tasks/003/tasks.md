---
type: bouncer.tasks
title: validate 모듈 책임 분해
description: 936줄 validate.ts를 문서 로딩·구조 검사·게이트 판정·섹션 파서로 나눈다
resource: .bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-14T09:53:11.293+09:00'
bouncer:
  id: TASKS-003
  epic_id: '035'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - 게이트 하나를 고칠 때 읽어야 하는 범위가 파일 전체라, 리뷰어가 변경이 다른 판정을 건드리는지 diff만으로 판단하지 못했음
    - 문서 읽기·구조 검사·게이트 판정·본문 파싱을 서로 다른 파일로 갈라 읽을 범위를 좁힘
  affected_paths:
    - scripts/src/lib/validate.ts
    - scripts/src/lib/validate-docs.ts
    - scripts/src/lib/validate-sections.ts
    - scripts/src/lib/validate-structural.ts
    - scripts/src/lib/validate-gates.ts
    - scripts/lib/validate.js
    - scripts/lib/validate-docs.js
    - scripts/lib/validate-sections.js
    - scripts/lib/validate-structural.js
    - scripts/lib/validate-gates.js
  graph:
    generated_at: '2026-08-14T10:05:38.205+09:00'
    command: graphify query "validateBlueprint checkGate checkStructural runCli parseFlags syncSessionGraphs planImport readConfig" --graph graphify-out/{source,context}/graph.json
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
    basis:
      - graph: source
        status: reused
        query: validateBlueprint checkGate checkStructural runCli parseFlags syncSessionGraphs planImport readConfig
        result: 46 nodes; validate.ts의 checkGate(L626)·validateBlueprint(L344)·checkStructural(L239)·resolveTaskUnit(L124)·isValidGraphBasis(L186)가 한 커뮤니티(9)로 묶여 회수됨.
      - graph: context
        status: updated
        query: scripts 코어 모듈 분해 리팩토링 TypeScript 구조
        result: 4 nodes; epic 006-scripts-typescript와 이번 035 인덱스만. 코드 경로 힌트 없음.
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`validate.ts` 936줄이 네 개의 형제 모듈로 나뉜다. 지금 이 파일은 성격이 다른
네 가지를 함께 쥐고 있다 — 디스크에서 문서를 읽어 오는 일, 문서 하나의 구조를
보는 일(S 코드), 게이트별 조건을 판정하는 일(G 코드, `checkGate` 혼자 300줄이 넘음),
그리고 마크다운 본문에서 섹션과 경로를 뽑는 일. 게이트 판정을 고치는 사람과
프론트매터 스키마를 고치는 사람이 같은 파일을 놓고 다투지 않게 한다.

게이트 코드와 메시지 문자열은 하나도 바뀌지 않는다. `validateBlueprint`의
반환 형태(`failures[]`의 `code` / `message` / `file`)도 그대로다.

## Interface
- 제공: `scripts/lib/validate.js`의 `module.exports` 키 집합이 지금과 동일하게
  유지된다 — `loadBlueprintDocs`, `resolveTaskUnit`, `checkStructural`,
  `checkGate`, `validateBlueprint`, `parseTasksSections`, `parseSections`,
  `extractPathCandidates`. 구현이 다른 파일로 가더라도 `validate.js`가 배럴로
  재수출한다.
- 거부: 게이트 코드(G1~G18)와 구조 코드(S1~S20)의 추가·삭제·의미 변경,
  실패 메시지 문자열 변경, `failures` 엔트리 형태 변경.

## Touch
- Create `scripts/src/lib/validate-docs.ts` — `defaultStagedFiles`,
  `readOptionalLeaf`, `loadBlueprintDocs`, `resolveTaskUnit`, `unitLeafRel`,
  `blueprintDocsExist`, `statusOf`. 디스크에서 문서를 모아 오는 층.
- Create `scripts/src/lib/validate-sections.ts` — `SECTION_DEFS`,
  `VERIFY_SECTION_DEFS`, `REVIEW_SECTION_DEFS`, `REVIEW_SEVERITY`,
  `REVIEW_STATUS`, `EXPLAIN_SECTION_HEADINGS`, `TODO_RE`, `stripComments`,
  `parseSections`, `parseTasksSections`, `extractPathCandidates`,
  `pathsOverlap`, `pathJustifiedByTouch`, `collectFindingFailures`. 본문 파싱 층.
- Create `scripts/src/lib/validate-structural.ts` — `expectedTypeForPath`,
  `checkStructural`, `GRAPH_BASIS_STATUS`, `GRAPH_BASIS_GRAPH`,
  `isValidGraphBasis`. 문서 하나를 보는 S 코드 층.
- Create `scripts/src/lib/validate-gates.ts` — `checkGate`. 게이트별 G 코드 층.
- Modify `scripts/src/lib/validate.ts` — `validateBlueprint` 오케스트레이션과
  배럴 재수출만 남긴다.
- Create `scripts/lib/validate-docs.js` — emit.
- Create `scripts/lib/validate-sections.js` — emit.
- Create `scripts/lib/validate-structural.js` — emit.
- Create `scripts/lib/validate-gates.js` — emit.
- Modify `scripts/lib/validate.js` — emit.

## Do not touch
- `test/**` — `test/validate-structural.test.js`, `test/cli-validate.test.js`가
  코드와 메시지를 고정한다. 이 테스트를 고쳐야 초록이 되면 분해가 틀린 것이다.
- `scripts/src/lib/schema.ts` — 스키마 상수는 이 task 밖이다.
- `scripts/src/lib/scope.ts` — `validate → finalize` 순환을 끊으려고 분리된
  모듈이다. 여기로 코드를 옮기거나 빼지 않는다.
- `scripts/src/lib/verification.ts`, `scripts/src/lib/comprehension.ts`,
  `scripts/src/lib/epic-index.ts` — validate가 호출만 한다.
- `hooks/**`, `scripts/vendor/**`.

## Constraints
- 옮기거나 새로 만드는 함수는 내부의 의미 있는 로직 블록(가드, 분기, 루프,
  누적, 조기 반환)마다 한국어 주석을 단다. 주석은 다음 줄이 이미 말하는
  *무엇*이 아니라 *왜*를 적는다 — 이 순서여야 하는 이유, 이 값을 거르는 이유,
  이 분기를 만들게 한 실패 사례, 의도적으로 하지 않은 선택. 게이트 분기는
  「이 코드가 왜 이 게이트에서만 걸리는가」와 폐기된 번호(G9·G15)를 왜 비워
  두는지를 남긴다. 파일이 나뉘면서 원래 문맥에서 떨어지는 코드일수록 이 주석이
  그 문맥을 대신한다.
- `validateBlueprint`는 `validate.ts`에 남긴다. 이 함수 안의 레거시 `.sdd`
  문자열이 `test/public-name-regression.test.js` allowlist에 파일명으로
  고정되어 있어, 다른 파일로 옮기면 그 테스트가 깨진다.
- 순환 금지. 의존 방향은 한쪽으로만 흐른다:
  `validate` → `validate-gates` → `validate-structural` → `validate-sections`,
  그리고 `validate-gates` / `validate-structural` → `validate-docs`.
  하위 모듈이 `validate.ts`를 require하면 안 된다.
- `isValidGraphBasis`는 계속 단일 구현이다. S9(구조)와 G4(plan)가 같은 헬퍼를
  봐야 두 경로가 다른 답을 내지 않는다. 이 헬퍼는 `validate-structural.ts`에
  두고 `validate-gates.ts`가 가져다 쓴다 — 위 의존 방향의
  `validate-gates → validate-structural` 간선이 바로 이것이다. 게이트 층에서
  같은 판정을 다시 구현하지 않는다.
- 하위 디렉터리를 만들지 않는다. 평평한 형제 파일로만 나눈다
  (emit 기준 상대 경로 불변식).
- 새 모듈은 상대 경로와 `node:` 내장만 require한다.
- 커밋 전에 `npm run build`로 emit을 갱신한다.

## Checklist
- [ ] `validate-sections.ts`를 먼저 만든다. 다른 층이 모두 여기에 의존하므로
      가장 아래층이다. 상수와 파서 함수를 본문 수정 없이 옮긴다.
- [ ] `validate-docs.ts`를 만들고 문서 로딩 함수를 옮긴다.
- [ ] `validate-structural.ts`를 만들고 `checkStructural`과 graph basis 판정을
      옮긴다.
- [ ] `validate-gates.ts`를 만들고 `checkGate`(626~932줄)를 옮긴다. 게이트별
      분기 순서와 실패 메시지 문자열을 그대로 둔다.
- [ ] `validate.ts`에 `validateBlueprint`와 배럴 재수출만 남긴다.
      `module.exports` 키 집합이 전과 같은지 확인한다:
      ```bash
      node -e "console.log(Object.keys(require('./scripts/lib/validate')).sort().join(','))"
      ```
      기대: `checkGate,checkStructural,extractPathCandidates,loadBlueprintDocs,parseSections,parseTasksSections,resolveTaskUnit,validateBlueprint`
- [ ] 순환 의존이 없는지 확인한다 — 각 하위 모듈에서
      `require('./validate')` 히트가 0이어야 한다.
- [ ] 다섯 파일이 각각 400줄 이하인지 확인한다.
- [ ] 이 저장소 자신에 대해 게이트를 돌려 회귀가 없는지 본다:
      ```bash
      node scripts/bouncer validate --blueprint .bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split --gate plan
      ```
- [ ] `npm test`가 `test/**` 수정 없이 통과한다.
- [ ] `npm run lint`가 통과하고 `git diff --exit-code -- scripts/lib`가 빌드 후
      깨끗하다.
