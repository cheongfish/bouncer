---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/context-search/blueprints/slug-identifiers/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-20T20:24:05.360+09:00'
bouncer:
  id: EXPLAIN-slug-identifiers
  epic_id: context-search
  blueprint_id: slug-identifiers
  status: draft
  comprehension: []
---
# Explain

## Background

문서 식별자가 `NNN-slug` 번호 접두에 묶여 있어 epic·blueprint를 합치거나 옮길 때마다 디렉터리 이름과 trailer, 포인터 키를 같이 바꿔야 했다. 이번 변경은 문서 식별자를 slug로, 순서를 별도 `order` 필드로 분리해 번호 없이도 경로와 실행 키가 성립하게 한다. 구형 번호 경로는 계속 읽히고, 새 형식과 같은 resolver로 해석된다.

미완 사항: terminal `npm run ci`에서 구형 번호 경로 해석 1건이 실패한 상태다(`test/execute-prepare.test.js:193`). 원인은 아래 `## Code`에 적었고, 수정은 이 PR에 포함되지 않는다.

## Code

- `scripts/src/lib/context-ids.ts` (신규): slug·구형 번호 식별자를 해석하는 resolver. `NUMERIC_SEG_RE`가 번호 세그먼트 판정을 맡는다.
  - 알려진 결함: 이 정규식이 `/^(\d{3})-([a-z0-9-]+)$/`라서 base의 `paths.ts`가 받던 `(\d{3})-[^/]+` 경로(예: 공백 포함 `001-invalid branch`)를 거절한다. `pointerKeyFromBlueprint`가 먼저 던져 `invalid-branch-name` 경로에 도달하지 못한다.
- `scripts/src/lib/paths.ts`, `epic-registry.ts`, `epics.example.json`: 경로 해석을 resolver로 옮기고 등록부 v2(항목에 `id` 없음)를 읽는다. 알려진 한계: 타입 `RegistryEpic.id`는 필수 `string`으로 남아 있고, `plan-inspect.ts`의 `summarizeRegistry`는 `id`가 없는 v2 항목을 아직 처리하지 않는다.
- `layout.ts`, `scaffold.ts`, `cli-doc-commands.ts`, `cli-usage.ts`, `epic-index.ts`, `validate*.ts`, `current.ts`: slug 경로 쓰기와 `order` 정렬, `scaffold blueprint --order`, 새 게이트 코드 S37. 구형 `EPIC-` 접두 판정은 `isLegacyEpicDirName`으로 남겼다. slug epic의 `nextBlueprintId`는 `null`이다.
- `runtime-state.ts`, `coordinator-commands.ts`: 포인터·실행 키를 slug 경로에서도 만든다. 구형 키는 바이트 단위로 같다. wave/supplement 키에는 slug 전용 테스트가 없다.
- `commit-sha.ts`, `task-commits.ts`, `intent-*.ts`, `finalize-*.ts`, `verification.ts`, `context-ontology.ts`: 두 형식 trailer와 추적 키를 함께 해석한다. `finalize.ts:731`의 `resolveTaskCommits` 호출은 `registry`를 넘기지 않는다(후속).
- `migrate-context-slugs.ts` (신규), `cli-project-commands.ts`: 번호 문서를 slug로 옮기는 이관 명령. 자동 롤백이 없고, 끝나지 않은 태스크의 `verification.md`는 이관 뒤 G13에서 실패할 수 있다. 브리프에 없던 거절 코드 `migrate-registry-missing`을 추가했다.
- `test/context-id-guard.test.js` (신규): 번호 해석을 `context-ids.ts` 밖에서 하면 실패하는 정적 가드. 가드가 `scripts/src`에서 찾은 위반은 `context-ids.ts`의 헬퍼(`formatLegacyEpicId`, `formatLegacyBlueprintId`, `parseNumericPrefix`, `parseNumericEpicDir`, `replaceOldStableIds`)로 옮겼다.
- `rules/*.md`, `skills/bouncer-plan/SKILL.md`, `references/*`, `CHANGELOG.md`: 위 동작을 설명하는 문서 갱신.

## Quiz

이 PR에서는 퀴즈를 진행하지 않았다(`bouncer.comprehension` 항목 없음, status는 draft).

## Tasks
