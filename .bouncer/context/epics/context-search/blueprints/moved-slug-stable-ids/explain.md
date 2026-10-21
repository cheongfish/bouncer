---
type: bouncer.explain
title: moved-slug-stable-ids explain
description: Explain for moved-slug-stable-ids
resource: .bouncer/context/epics/context-search/blueprints/moved-slug-stable-ids/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-21T10:36:12.653+09:00'
bouncer:
  id: EXPLAIN-moved-slug-stable-ids
  epic_id: context-search
  blueprint_id: moved-slug-stable-ids
  status: published
  comprehension:
    - range_from: 98cadd8d216c7adf80c6477e7af9e298b893545d
      range_to: fe7c4dc3422ac5e6415b50721836aec056db64b1
      diff_sha: af8882f45621f5aa7c8a255a92f2c48443c149053d0d2fe41330d5a4e5623141
      recorded_at: '2026-10-21T10:45:00+09:00'
  task_commits:
    - task: context-search/moved-slug-stable-ids/001
      sha: fe7c4dc3
      intent_anchor: task-001
---
# Explain

## Background

`bouncer migrate merge-legacy-epics`는 legacy epic의 blueprint를 도메인 epic 아래로 옮기고 `epic_id`도 도메인 slug로 바꾼다. 그런데 문서 본문에 적힌 slug 형식 stable ID(`<legacy>/<bp>[/<ddd>]`)는 옛 epic 이름 그대로 남았다. 옮긴 Explain의 `task_commits[].task`와 `### <legacy>/<bp>/<ddd>` 제목이 `epic_id`와 어긋나 ontology의 `task_commits task identity` 검사를 통과하지 못하고, intent-provenance도 그 행을 읽지 못했다. 이 변경은 병합 재작성이 이 ID도 도메인 epic 형식으로 바꾸게 해서 옮긴 뒤에도 옛 trailer로 설계 의도를 조회할 수 있게 한다.

## Code

- `scripts/src/lib/context-ids.ts`: `replaceMovedSlugStableIds(text, registry, replacer)`를 더했다. 등록부 legacy 항목의 `moved_to`에 own property로 올라 있는 (legacy slug, blueprint slug) 쌍만 찾아 `replacer`로 바꾼다. 앞이 영숫자·`-`·`_`·`/`·`.`이면(`data/x` 안의 `a/x`, `epics/a/blueprints/x`) 건드리지 않고, 뒤가 영숫자·`-`·`_`로 이어지면(`a/x-y`) 건드리지 않는다. 바꿀 값은 기존 `normalizeStableId`가 정하고 새 정규화 규칙은 없다. fs·git을 읽지 않으며 `epic-registry`를 import하지 않는다. 같은 입력에 두 번 적용해도 결과가 같다.
- `scripts/src/lib/context-migration-rewrite.ts`: `computeRewrites` 1단계에서 번호 형식 치환 뒤에 새 헬퍼를 적용한다. 번호 형식이 먼저 만든 `<domain>/<bp>/<ddd>`는 epic이 legacy slug가 아니라서 다시 바뀌지 않는다.
- 알려진 한계: 뒤 경계는 `/<ddd>`가 아닌 `/` 뒤를 막지 않아, `a/x/index.md` 같은 문자열의 `a/x` 부분은 치환된다. `moved_to`가 없는 `migrate context-slugs` 경로의 결과는 그대로다.
- 테스트: 단위 테스트는 `test/context-ids.test.js`, 병합 회귀는 `test/migrate-merge-legacy-epics.test.js`(`task_commits`·`###` 제목·`epic_id` 일치, 검증 통과, `resolveTaskCommits` 조회)에 있다.

## Quiz

1. 등록부에서 legacy epic `a`의 `moved_to`가 `{ x: 'd1' }`일 때, 병합 이관 뒤 옮긴 문서의 `a/x/001`, `data/x`, `a/x-y`는 각각 어떻게 되는가?
   - A) 셋 다 `d1/...` 형식으로 바뀐다.
   - B) `a/x/001`만 `d1/x/001`로 바뀌고 `data/x`와 `a/x-y`는 그대로다.
   - C) 아무것도 바뀌지 않는다. 번호 형식 ID만 바뀐다.

## Tasks

### context-search/moved-slug-stable-ids/001 · `fe7c4dc3`

#### Goal & intent

`bouncer migrate merge-legacy-epics`가 옮긴 blueprint 문서에서 slug 형식 stable ID `<legacy>/<bp>[/<ddd>]`도 `<domain>/<bp>[/<ddd>]`로 바뀐다. 지금은 `computeRewrites` 1단계가 `contextIds.replaceOldStableIds`로 번호 형식 `EPIC-ddd/BP-ddd[/TASK-ddd]`만 찾는다(`scripts/src/lib/context-ids.ts`의 `OLD_STABLE_SCAN_SRC`). 그래서 `restructure()`가 `epic_id`를 도메인 slug로 바꾼 뒤에도 Explain의 `bouncer.task_commits[].task`와 `### <legacy>/<bp>/<ddd>` 제목은 옛 epic을 가리킨다. `migrate-merge-legacy-epics.ts`는 `moved_to`를 반영한 `parsed.registry`를 이미 넘기므로 원인이 아니다. 고친 뒤에는 옮긴 Explain이 `context-ontology.ts`의 `task_commits task identity` 검사를 통과하고, `intent-provenance.ts`의 `parseTaskCommitRows`가 그 행을 다시 읽는다.

결정과 제약:
- 치환 대상은 context 문서 본문 전체지만, 등록부 legacy 항목의 `moved_to`에 own property로 등록된 (legacy slug, blueprint slug) 쌍만이다. 바꿀 값은 기존 `normalizeStableId`가 정한다. 새 정규화 규칙을 만들지 않는다.
- 경계 검사: 앞이 영숫자·`-`·`_`·`/`·`.`이면 치환하지 않는다. 뒤는 `/<ddd>` 또는 영숫자·`-`·`_`가 아닌 문자이거나 끝이어야 한다. `data/x` 안의 `a/x`, `foo-bar/x` 안의 `bar/x`, `a/x-y`, `epics/a/blueprints/x` 같은 경로는 그대로 둔다.
- 번호 형식 치환이 먼저 만든 `<domain>/<bp>/<ddd>`는 다시 바뀌지 않는다(대상 쌍의 epic이 legacy slug라서). 같은 입력을 두 번 돌려도 결과가 같다.
- `moved_to`가 없는 `migrate context-slugs` 경로의 결과는 바뀌지 않는다. `scripts/src/lib/migrate-merge-legacy-epics.ts`와 `scripts/src/lib/migrate-context-slugs.ts`는 고치지 않는다.
- `context-ids.ts`는 `epic-registry.ts`를 import하지 않는다(순환). 새 헬퍼는 `RegistryLike` 구조 타입만 받고 fs·git을 읽지 않는다.
- 이전 `slug-identifiers` Explain의 "slug ID는 값을 그대로 돌려준다"는 제약은 따르지 않는다. 현재 `normalizeStableId`의 `moved_to` 동작이 기준이다.
- `scripts/lib` 빌드 산출물은 커밋 범위가 아니다.

#### Touch

- Modify `scripts/src/lib/context-ids.ts` — `moved_to`에 등록된 쌍의 slug stable ID를 경계 검사와 함께 찾아 `replacer`로 바꾸는 순수 헬퍼를 더하고 export한다(이름 예: `replaceMovedSlugStableIds(text, registry, replacer)`). 기존 `replaceOldStableIds`의 동작은 그대로 둔다.
- Modify `scripts/src/lib/context-migration-rewrite.ts` — `computeRewrites` 1단계에서 context 문서에 번호 형식 치환 뒤 새 헬퍼를 `idRegistry`와 `normalizeStableId`로 적용하고, 1단계 주석을 고친다.
- Modify `test/context-ids.test.js` — 새 헬퍼의 단위 테스트: 등록된 쌍만 바뀌고 task 유무 두 형식, 경계 검사, 상속 키, 등록부 null, 반복 적용 불변.
- Modify `test/migrate-merge-legacy-epics.test.js` — 회귀 테스트: 옮길 blueprint의 `explain.md`에 slug 형식 `task_commits` 행과 `### <legacy>/<bp>/<ddd>` 제목을 둔 fixture로 `--yes` 뒤 두 곳이 `<domain>/<bp>/<ddd>`이고 `epic_id`와 일치하며 검증이 통과함을 확인한다.
- Modify `test/migrate-context-slugs.test.js` — 공유 재작성 경로의 회귀 감시. 기존 기대가 그대로 맞으면 고치지 않는다.

### context-search/moved-slug-stable-ids/002

#### Goal & intent

TASKS-001이 통합된 상태에서 `npm run ci` 전체가 통과함을 증명한다. 공유 재작성 경로를 쓰는 `migrate context-slugs` 테스트, coverage 임계값, lint·typecheck가 함께 통과해야 한다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.