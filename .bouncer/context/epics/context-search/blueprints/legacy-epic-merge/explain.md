---
type: bouncer.explain
title: legacy-epic-merge explain
description: Explain for legacy-epic-merge
resource: .bouncer/context/epics/context-search/blueprints/legacy-epic-merge/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-21T09:19:02.472+09:00'
bouncer:
  id: EXPLAIN-legacy-epic-merge
  epic_id: context-search
  blueprint_id: legacy-epic-merge
  status: published
  comprehension:
    - range_from: cccba2b6f626e6502b2b3a2d60bb2b5e699d98f2
      range_to: e2b03772ef7f2dece45209f32825022718ee4008
      diff_sha: b3a0b42288f8c2fcb1edb503e112e285902ad592eacf5842d30e294870a2293c
      recorded_at: '2026-10-21T09:25:00+09:00'
  task_commits:
    - task: context-search/legacy-epic-merge/001
      sha: d6a85fc3
      intent_anchor: task-001
    - task: context-search/legacy-epic-merge/002
      sha: be55f8cc
      intent_anchor: task-002
    - task: context-search/legacy-epic-merge/003
      sha: 5dc03d68
      intent_anchor: task-003
    - task: context-search/legacy-epic-merge/004
      sha: e2b03772
      intent_anchor: task-004
---
# Explain

## Background

legacy epic 63개 아래에 흩어진 blueprint를 도메인 epic 8개 아래로 모으는 이관이 필요했다. 문제는 옮긴 뒤에도 과거 커밋 trailer(`EPIC-ddd/BP-ddd` 또는 legacy slug)로 설계 의도를 찾을 수 있어야 한다는 점이다. 이 변경은 등록부에 이동 표를 두고, 식별자 해석이 그 표를 따라가게 하고, 실제 이동을 하는 `bouncer migrate merge-legacy-epics` 명령을 더한다. 같은 PR에서 v2 등록부를 잘못 읽던 `plan inspect` 요약과 finalize의 trailer 조회도 바로잡는다.

## Code

- `scripts/src/lib/epic-registry.ts`: v2 legacy 항목에 선택 필드 `moved_to`(blueprint slug → 도메인 epic slug)를 더했다. 값은 같은 등록부의 `kind: domain` epic이어야 하고, v1이나 legacy가 아닌 항목에 있으면 S35로 거절한다. 대상 검사는 모든 항목을 읽은 뒤 해서 항목 순서와 무관하다.
- `scripts/src/lib/context-ids.ts`, `finalize.ts`: `normalizeStableId`가 `moved_to`를 따라 번호·legacy slug trailer를 `<domain>/<bp>[/<ddd>]`로 정규화하고, finalize의 trailer 조회가 등록부를 넘긴다.
- `scripts/src/lib/plan-inspect.ts`: v2에서 `epics[].dir`을 `.bouncer/context/epics/<slug>`로, `legacy[]`를 실제 legacy 디렉터리로 낸다. v2의 `nextEpicId`는 항상 `null`이다. v1 출력 바이트는 그대로다.
- `scripts/src/lib/context-migration-rewrite.ts`(신규): `migrate context-slugs`에서 뽑은 재작성 헬퍼다. 원래 값이 해시 공식의 결과와 같을 때만 해시를 다시 계산하는 규칙을 그대로 유지한다.
- `scripts/src/lib/migrate-merge-legacy-epics.ts`(신규): 도메인 epic `index.md`의 `## Legacy epic 귀속` 링크 목록과 예외 표에서 이동 계획을 순수하게 계산한다. 가드 검사, `git mv`, 문서 재작성, `moved_to` 기록, `validateBlueprint` 검증이 그 위에 얹힌다. 적용 도중 실패하면 자동 롤백 없이 복구 명령만 안내한다.
- 알려진 한계: 병합 재작성이 번호 형식 ID와 전체 경로만 다시 쓰므로, slug 형식 stable ID(`task_commits[].task`, 옮겨진 `explain.md`의 `### <legacy>/<bp>/<ddd>` 제목)는 옛 epic 이름을 그대로 가리킨다. 이관을 이 저장소에 적용하기 전에 고쳐야 한다.
- 이관의 실제 적용은 이 변경의 범위 밖이다. 병합 뒤 main에서 dry-run 결과를 보이고 승인을 받아 실행한다.

## Quiz

1. `bouncer migrate merge-legacy-epics`를 `--yes` 없이 실행하면 무슨 일이 일어나는가?
   - A) 등록부의 `moved_to`만 먼저 기록한다.
   - B) 디스크에 아무것도 쓰지 않고 이동·충돌·누락을 보고한다.
   - C) `git mv`만 수행하고 문서 재작성은 미룬다.
2. 어떤 legacy blueprint의 대상 도메인 epic이 0개이거나 2개 이상으로 계산되면?
   - A) 첫 번째 도메인 epic을 골라 이동한다.
   - B) `unresolved_rows`로 보고하고 나머지는 계속 적용한다.
   - C) `merge-mapping-invalid`로 거절하고 아무것도 쓰지 않는다.
3. 등록부 legacy 항목의 `moved_to` 값으로 허용되는 것은?
   - A) 같은 등록부에 있는 `kind: domain` epic의 slug이고, 아니면 S35다.
   - B) 등록부에 있는 아무 epic의 slug다.
   - C) 이동 전 legacy epic의 slug다.
4. 옮겨진 blueprint의 `order`는 어떻게 정해지는가?
   - A) 원래 order를 그대로 유지한다.
   - B) 대상 epic의 기존 최댓값 뒤에 (legacy_id 오름차순, 원래 order) 순서로 붙는다.
   - C) 대상 epic의 맨 앞에 끼워 넣고 기존 blueprint를 밀어낸다.

## Tasks

### context-search/legacy-epic-merge/001 · `d6a85fc3`

#### Goal & intent

v2 등록부(`version: 2`)에서 `bouncer plan inspect`가 도메인·공통 epic의 실제 디렉터리와 legacy epic 목록을 내게 한다. 지금은 v2 항목에 `id`가 없어 모든 epic이 `dir: null`이고 legacy 목록이 비어, `/bouncer-plan`이 "epic 디렉터리 없음 → scaffold epic"으로 잘못 안내한다. 수용 기준: 아래 Checklist의 v2 단언이 통과하고 v1 기존 단언이 그대로 통과한다. 검증 명령은 `node --test test/plan-inspect.test.js`.

#### Current behavior

- 입력: `.bouncer/epics.json` v2 항목은 `{ slug, kind, active, legacy_id?, blueprint_aliases? }`이고 `id`가 없다. 디렉터리는 `.bouncer/context/epics/<slug>`다.
- 상태: `summarizeRegistry`(`scripts/src/lib/plan-inspect.ts:188`)의 `dirOf`(`:211-213`)는 `${id}-${slug}` 이름만 찾는다. v2에서 `entry.id`가 `undefined`라 `undefined-<slug>`를 찾고 `null`을 낸다.
- 출력: legacy는 `dir !== null`일 때만 목록에 넣으므로(`:220-223`) v2 legacy 목록이 항상 비고, 도메인은 `pendingDomainIds.push(entry.id)`(`:226`)로 `undefined`가 들어가 `nextEpicId`가 `undefined`가 될 수 있다. payload의 `id: string`(`:97`, `:100`)도 빠진다.
- `features.dir`가 `null`이라 `countAreaPromotions`(`:151-175`)가 `[]`로 조기 반환한다(`:157`).
- I/O 관찰 지점: 등록부 읽기 `readEpicRegistry`(`scripts/src/lib/epic-registry.ts:209`), 디렉터리 목록은 호출부 `inspect`가 `listDirNames(EPICS_REL)`로 넘긴다(`plan-inspect.ts:644-650`).
- 재현: 이 저장소에서 `bouncer plan inspect | jq '.registry.epics[].dir, .registry.legacy'` → 모두 `null`, `[]`.
- 기존 테스트: `test/plan-inspect.test.js:180-244`는 v1 fixture만 다룬다. fixture 등록부는 `test/helpers/epic-registry.js`의 `writeEpicRegistry(repo, overrides)`로 쓰며 `version: 2`도 overrides로 줄 수 있다.

#### Target behavior

- 성공(v2): 항목 디렉터리는 `dirNames`에 `slug`가 있으면 `.bouncer/context/epics/<slug>`, 없으면 `null`이다. legacy 항목은 디렉터리가 있으면 `legacy[]`에 들어간다. payload `id`는 `legacy_id ?? null`이다. `nextEpicId`는 `null`이다(slug epic은 번호가 없다).
- 성공(v1): 판정·출력이 변경 전과 같다(`<id>-<slug>`, `nextEpicId`는 디렉터리 없는 도메인 중 가장 작은 id).
- 보존: 등록부 missing/invalid 결과와 `promotions` 계산 규칙은 그대로다. v2에서 `features` 디렉터리가 있으면 promotion 계산이 그 디렉터리를 읽는다.

#### Interface

- 제공: `InspectRegistry` ok 분기의 `epics[].id`와 `legacy[].id` 타입이 `string | null`이 된다. v1은 항상 문자열, v2는 `legacy_id`가 없으면 `null`이다.
- 거부: 이 task는 새 거절을 만들지 않는다. 등록부 형식 위반은 지금처럼 `status: 'invalid'`(S35)다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/plan-inspect.ts` | `summarizeRegistry`, `InspectRegistry` | Modify | v1 번호 디렉터리 이름으로만 epic 디렉터리를 판정 | `registry.version`으로 v1/v2 판정을 나누고 v2는 slug 디렉터리·`legacy_id`를 쓴다 | 상태 판정 진입점(`:188-254`)과 payload 타입(`:90-103`) |
| `test/plan-inspect.test.js` | v2 등록부 inspect 단언 | Modify | v1 fixture만 단언(`:180-244`) | v2 도메인 dir·legacy 목록·`nextEpicId: null`·`id` 단언 추가 | 검증 지점 |

#### Constraints

- v1 등록부의 출력 바이트(필드 순서·값)는 바뀌지 않는다. 기존 v1 테스트를 고치지 않는다.
- v2 판정은 `registry.version === 2`로만 분기한다. 디렉터리 이름 형식으로 버전을 추측하지 않는다.
- 이 저장소의 `.bouncer/epics.json`은 읽기만 하고 고치지 않는다.

### context-search/legacy-epic-merge/002 · `be55f8cc`

#### Goal & intent

legacy epic 등록부 항목에 blueprint별 이동 대상 `moved_to`를 두고, 옛 trailer(번호 `EPIC-ddd/BP-ddd[/TASK-ddd]`와 legacy slug `<legacy-epic>/<bp>[/<ddd>]`)를 도메인 epic 위치 `<domain>/<bp>[/<ddd>]`로 정규화한다. finalize의 trailer 조회도 등록부를 넘겨 같은 규칙을 쓴다. 수용 기준: blueprint 수용 기준 2. 검증 명령은 `node --test test/context-ids.test.js test/epic-registry.test.js test/finalize.test.js`.

#### Current behavior

- 등록부 타입 `RegistryEpic`(`scripts/src/lib/epic-registry.ts:18-21`)에는 `legacy_id?`, `blueprint_aliases?`만 있고 이동 대상 필드가 없다. 파서 `parseEpicRegistry`(`:121-173`)는 `aliasViolationOf`(`:100-109`)로 별칭만 검사한다.
- `normalizeStableId`(`scripts/src/lib/context-ids.ts:147-157`): slug 형식 ID는 등록부를 보지 않고 그대로 돌려준다(`:150`). 번호 형식은 `legacy_id`로 epic을, `blueprint_aliases`로 blueprint slug를 찾아 `<legacy-epic-slug>/<bp-slug>`를 낸다(`:153-156`). 구조적 입력 타입은 `RegistryLike`(`:18-22`)다.
- 따라서 blueprint를 도메인 epic 아래로 옮기면 두 형식 모두 legacy epic slug를 가리켜 새 위치와 어긋난다.
- `finalize.ts:731`의 `resolveTaskCommits` 호출은 `registry`를 넘기지 않아 묶음 키가 원래 문자열이다(`task-commits.ts:99`). `finalize-digest.ts:891-899`는 이미 `readEpicRegistry`로 읽어 넘긴다.
- `normalizeStableId` 사용처: `task-commits.ts:99`(묶음 키), `intent-provenance.ts:545-552`(Explain 매칭), `migrate-context-slugs.ts:547`(본문 치환). 다른 `parseStableId` 사용처(`intent-provenance.ts:520-531`, `finalize-collect.ts:30`, `intent-bundle.ts:44`)는 형식·키 비교나 task 번호만 읽고 경로를 만들지 않는다.
- 기존 테스트: `test/context-ids.test.js:78-94`(정규화), `test/epic-registry.test.js:96-121`(S35), `test/finalize.test.js:1727`(trailer SHA 우선).

#### Target behavior

- 성공: legacy 항목 `{ slug: 'old', legacy_id: '012', blueprint_aliases: { '003': 'bp-a' }, moved_to: { 'bp-a': 'dom' } }`가 있을 때
  - `EPIC-012/BP-003/TASK-001` → `dom/bp-a/001`, `EPIC-012/BP-003` → `dom/bp-a`
  - `old/bp-a/001` → `dom/bp-a/001`
  - `moved_to`에 없는 blueprint는 지금처럼 `old/<bp>`(번호)·그대로(slug)다.
- 성공: `finalize`의 trailer 조회가 `readEpicRegistry` 결과(ok일 때만)를 `registry`로 넘긴다. 등록부가 없거나 깨졌으면 `null`로 넘겨 이전과 같다.
- 실패: `moved_to`가 객체가 아니거나, 키가 slug가 아니거나, 값이 같은 등록부의 `kind: 'domain'` epic slug가 아니면 파서가 `moved_to is invalid: <slug>: <사유>`로 거절한다(S35).
- 보존: `moved_to`가 없는 등록부에서 모든 정규화 결과가 변경 전과 같다. slug ID에 등록부가 `null`이면 그대로 돌려준다.

#### Interface

- 제공:
  ```ts
  type RegistryEpic = { /* 기존 필드 */ moved_to?: Record<string, string> };
  // RegistryLike epics[]에도 moved_to?: Record<string, string>
  normalizeStableId(v: unknown, registry: RegistryLike | null): string | null
  ```
  - 용어 `moved_to`: legacy epic 항목의 "현재 blueprint slug → 그 blueprint가 지금 있는 도메인 epic slug" 표. 예: `{ "adaptive-quiz": "plan-workflow" }`.
- 거부 (S35): 형식 위반 `moved_to`(위 실패 경로). legacy가 아닌 항목의 `moved_to`도 `moved_to is only allowed on legacy epics: <slug>`로 거절한다.
- miss: 별칭·대상이 없는 ID는 지금처럼 `null`(번호) 또는 원래 값(slug)이다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/epic-registry.ts` | `RegistryEpic`, `parseEpicRegistry`, `신규 추출 지점: moved_to 검사` | Modify | 별칭만 검사(`:100-109`, `:155-157`) | `moved_to` 타입·검사 추가. 도메인 slug 검사는 모든 항목을 읽은 뒤 한다 | 등록부 계약 진입점 |
| `scripts/src/lib/context-ids.ts` | `RegistryLike`, `normalizeStableId` | Modify | 번호만 별칭으로 해석, slug는 통과(`:147-157`) | 두 형식 모두 `moved_to`로 epic slug를 바꾼다 | trailer 해석 상태 변경 지점 |
| `scripts/src/lib/finalize.ts` | trailer 조회(`resolveTaskCommits` 호출) | Modify | `registry` 미전달(`:731-736`) | `readEpicRegistry` 결과를 넘긴다(`finalize-digest.ts:891-899`와 같은 방식) | 알려진 약점 |
| `rules/commit-scope.md` | legacy trailer 읽기 문단 | Modify | `legacy_id`·`blueprint_aliases`로 매핑한다고 적음(`:28-30`) | `moved_to`로 도메인 epic 위치를 따른다는 한 문장 추가 | 규칙 문서 정합 |
| `test/context-ids.test.js` | `normalizeStableId` 이동 단언 | Modify | 이동 없는 정규화만(`:78-94`) | 번호·slug·미이동 케이스 추가 | 검증 지점 |
| `test/epic-registry.test.js` | `moved_to` S35 단언 | Modify | 별칭·중복 S35만 | 정상·형식 위반·비도메인 대상·비legacy 항목 케이스 추가 | 검증 지점 |
| `test/finalize.test.js` | 구형 trailer + 이동 등록부 단언 | Modify | 번호 trailer 정확 일치만(`:1727-1760`) | `moved_to` 등록부에서 slug 위치 task가 옛 trailer 커밋을 찾는지 단언 | 검증 지점 |

#### Constraints

- `RegistryEpic.id` 타입은 바꾸지 않는다(blueprint Out of scope).
- `context-ids.ts`는 `epic-registry.ts`를 import하지 않는다(순환, `:16-17` 주석). 필요한 필드는 `RegistryLike`에 구조적으로 추가한다.
- 등록부 v1에도 `moved_to`를 허용할지 묻지 않는다: v2에서만 검사·해석한다. v1 항목에 있으면 S35다.
- 정규화 결과 형식은 `formatStableIntentId`/`formatStableTaskId`(slug 형식)로만 만든다.

### context-search/legacy-epic-merge/003 · `5dc03d68`

#### Goal & intent

두 가지를 한다. (1) `migrate-context-slugs.ts`의 문서 재작성 헬퍼를 공용 모듈로 옮겨, 다른 epic으로 blueprint를 옮기는 이관도 같은 규칙(원래 공식과 일치한 값만 재계산)을 쓰게 한다. 기존 slug 이관 결과는 바이트 단위로 같아야 한다. (2) 도메인 epic `index.md`에서 legacy blueprint별 이동 계획을 결정적으로 계산하는 순수 함수 `planLegacyEpicMerge`를 만든다. 디스크 쓰기·CLI 연결은 TASKS-004 소관이다. 수용 기준: 기존 `test/migrate-context-slugs.test.js`가 수정 없이 통과하고, 새 계획 함수 단언이 통과한다. 검증 명령은 `node --test test/migrate-context-slugs.test.js test/migrate-merge-legacy-epics.test.js test/test-tiers.test.js`.

#### Current behavior

- 재작성 헬퍼는 모두 `scripts/src/lib/migrate-context-slugs.ts` 안의 비공개 함수다: `defaultRunGit`(`:107`), `listFilesUnder`(`:116`), `defaultListInProgress`(`:146`, 유일하게 export), `makePathMapper`(`:319`), `rewriteLinkTarget`(`:333`), `replaceAllOnce`(`:363`), `planDigestOf`(`:375`), `fingerprintFields`(`:400`), `restructure`(`:418-503`), `computeRewrites`(`:510-606`), `writeRegistryAtomically`(`:609`). export는 `{ planContextSlugMigration, migrateContextSlugs, defaultListInProgress }`(`:716`)뿐이다.
- `restructure`는 문서 맥락으로 `{ epic: EpicMove; blueprint: BlueprintMove | null }`(`:397`)을 받고 `epic.slug`·`blueprint.slug`·`blueprint.order`만 읽는다. `order`는 frontmatter에 없을 때만 넣는다(`:444-455`).
- `computeRewrites`는 `plan.epics[].blueprints[]`를 돌며 `planDigestOf(<epic.from>/index.md, bp.from, …)`와 `(<epic.to>/index.md, bp.to, …)`를 비교하고(`:590-591`) brief hash 쌍을 계산한다(`:577-581`). epic 이동과 blueprint 이동이 같은 epic 안에서 일어난다고 전제한다.
- `planContextSlugMigration`(`:202-316`)은 번호 형식 epic 디렉터리만 다룬다(`:215-217`). 이 저장소 legacy epic은 이미 slug 형식이라 병합에 재사용할 수 없다.
- 매핑 원천: 도메인 epic `index.md`의 `## Legacy epic 귀속` 아래 `- [<legacy-slug>](../<legacy-slug>/index.md)`(뒤에 ` △` 가능) 줄과, `### 다른 epic에서 이 영역으로 귀속되는 blueprint` 표의 `| <legacy 번호> | <blueprint 셀> | <이유> |` 행이다. 예: `.bouncer/context/epics/drive-execution/index.md:31-56`. 번호는 등록부 `legacy_id`·`blueprint_aliases`로 slug가 된다.
- 실제 blueprint 셀 형식은 여러 가지다: `003, 005, 006`, `001~003, 005~009`, `003 migrate-ids-removal`, `003 adaptive-quiz, 005 pr-single-confirm, 013 structured-pr-body`, `005~007, 016, 019, 020`, 그리고 번호가 없는 자유 서술 `finalize digest 부분`, `평가 후속`, `verify 출력 tail`(legacy 078·087·105 행).
- 테스트 fixture 방식: `test/migrate-context-slugs.test.js:57-201`(`buildFixture`, `createGitTemplate`). 새 테스트 파일은 `test/tiers.json` 등록이 필요하다(`migrate-context-slugs.test.js`는 `:94`).

#### Target behavior

- 성공(추출): 공용 모듈이 위 헬퍼를 export하고 `migrate-context-slugs.ts`가 그것을 import한다. 문서 맥락은 blueprint 하나의 이동 `{ fromEpicDir, toEpicDir, epicSlug, blueprint: { from, to, slug, order } | null }`로 일반화하고, `order` 처리 방식은 `orderMode: 'fill-missing' | 'overwrite'`로 고른다. slug 이관은 `fill-missing`이다. 기존 slug 이관 테스트가 수정 없이 통과한다.
- 성공(계획): `planLegacyEpicMerge({ repoRoot, registry, readFile, listDirs })`가 `{ ok: true, moves, legacyEpics, byDomain }`을 낸다.
  - 각 legacy epic의 blueprint는 그 legacy가 귀속 목록에 오른 도메인 epic으로 간다. 예외 표 행의 blueprint는 그 표가 있는 도메인 epic으로 간다(예외가 목록보다 우선).
  - `order`는 대상 epic의 기존 blueprint `order` 최댓값 다음부터, (legacy_id 오름차순, 원래 order 오름차순) 순으로 1씩 붙는다.
  - 같은 입력에 같은 `moves` 배열(순서 포함)이 나온다.
  - 이미 도메인 epic 아래 있는 blueprint는 이동 대상이 아니다. 이동할 것이 없으면 `moves: []`다.
  - 예외 표 셀은 쉼표로 나눈 항목 목록이다. 항목은 `NNN`, `NNN~MMM`(양끝 포함 범위. 범위 안 번호 중 `blueprint_aliases`에 없는 번호는 건너뛰지 않고 `merge-mapping-invalid`로 거절한다), `NNN <slug>`(slug는 `blueprint_aliases[NNN]`과 같아야 함) 세 형식이다.
  - 항목을 하나도 얻지 못한 행(자유 서술)은 실패가 아니라 `unresolved_rows`에 `{ domain, legacy_id, cell }`로 담고, 그 행의 blueprint는 귀속 목록 규칙으로 계획한다. 이 값이 비어 있지 않으면 TASKS-004의 적용이 거절한다.
- 실패: 아래 경우 `{ ok: false, code, details }`를 내고 계산을 멈춘다.
  - `merge-mapping-invalid`: legacy epic이 어느 귀속 목록에도 없거나 둘 이상에 있다. 예외 표의 legacy 번호나 blueprint 번호(범위 양끝 포함)를 등록부에서 찾을 수 없다. `NNN <slug>`의 slug가 `blueprint_aliases[NNN]`과 다르다. 한 blueprint가 두 예외 표에 있다.
  - `migrate-slug-conflict`: 대상 epic 안에 같은 blueprint slug가 이미 있거나 둘이 들어온다.
- 보존: 이 task는 디스크를 쓰지 않는다.

#### Interface

- 제공:
  ```ts
  // scripts/src/lib/context-migration-rewrite.ts (신규)
  export = { defaultRunGit, defaultListInProgress, makePathMapper, rewriteLinkTarget,
    replaceAllOnce, planDigestOf, restructure, computeRewrites, writeRegistryAtomically };
  // scripts/src/lib/migrate-merge-legacy-epics.ts (신규, 이 task는 계획만)
  // from·to는 저장소 상대 경로 `.bouncer/context/epics/<epic>/blueprints/<slug>`다.
  type MergeMove = { from: string; to: string; legacyEpic: string; domainEpic: string;
    slug: string; order: number };
  type UnresolvedRow = { domain: string; legacy_id: string; cell: string };
  planLegacyEpicMerge(opts):
    | { ok: true; moves: MergeMove[]; unresolved_rows: UnresolvedRow[] }
    | { ok: false; code: 'merge-mapping-invalid' | 'migrate-slug-conflict'; details: unknown[] }
  ```
  - `readFile(rel) → string | null`, `listDirs(rel) → string[]`는 테스트 seam이다. 생략하면 `node:fs`로 읽는다.
  - 공용 함수의 이름은 검색 힌트다. 완료 조건은 export 이름이 아니라 위 동작이다.
- 거부: `merge-mapping-invalid`, `migrate-slug-conflict`(details에 해당 legacy·blueprint·대상 epic을 담는다). 등록부가 v2가 아니면 `merge-mapping-invalid`다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/context-migration-rewrite.ts` | `신규 추출 지점: 문서 재작성 공용 모듈` | Create | 없음 | slug 이관의 재작성 헬퍼를 일반화한 맥락으로 옮겨 export | 두 이관이 같은 해시 규칙을 쓰는 지점 |
| `scripts/src/lib/migrate-context-slugs.ts` | `restructure`, `computeRewrites` 외 헬퍼 | Modify | 헬퍼를 비공개로 소유(`:107-614`) | 공용 모듈 import로 바꾸고 맥락을 새 모양으로 넘긴다. export 목록 유지 | 기존 동작 보존 지점 |
| `scripts/src/lib/migrate-merge-legacy-epics.ts` | `planLegacyEpicMerge` | Create | 없음 | 귀속 목록·예외 표 파싱과 이동 계획 계산 | 이관 계획 진입점 |
| `test/migrate-merge-legacy-epics.test.js` | 계획 함수 단언 | Create | 없음 | 정상·예외 우선·order·충돌·누락 단언 | 검증 지점 |
| `test/tiers.json` | `unit`/`integration` 목록 | Modify | 테스트 파일 계층 목록(`:94`) | 새 테스트 파일 등록 | `test/test-tiers.test.js`가 등록을 검사 |

#### Constraints

- 해시 재계산 규칙은 바꾸지 않는다: 원래 값이 그 공식의 결과와 같을 때만 새로 계산한다(`migrate-context-slugs.ts:405-417` 주석).
- 계획 함수는 순수하다: git·쓰기 없음, 같은 입력에 같은 출력.
- 귀속 목록 줄은 링크 형식 하나만 받는다. 목록 안 링크가 legacy가 아닌 epic을 가리키면 `merge-mapping-invalid`다. 예외 표 셀은 위 세 항목 형식만 받고, 항목이 하나도 없는 셀만 `unresolved_rows`로 보낸다. 항목 일부만 해석되는 셀(예: `003, 뭔가`)은 `merge-mapping-invalid`다.
- 자유 서술 행 3개를 정규화하는 문서 편집은 이 task 범위가 아니다(적용 전 main의 governance 편집).
- `.bouncer/` 실제 문서를 테스트 입력으로 쓰지 않는다. fixture를 만든다.

### context-search/legacy-epic-merge/004 · `e2b03772`

#### Goal & intent

`bouncer migrate merge-legacy-epics [--yes] [--repo <dir>]`를 완성한다. `--yes`가 없으면 TASKS-003의 계획과 재작성 결과를 쓰기 없이 보고하고, `--yes`면 가드를 통과한 뒤 blueprint를 `git mv`로 옮기고 문서를 다시 쓰고 등록부 legacy 항목에 `moved_to`를 기록한 다음 옮긴 blueprint를 검증한다. 수용 기준: blueprint 수용 기준 3·4. 검증 명령은 `node --test test/migrate-merge-legacy-epics.test.js test/cli-help.test.js test/migrate-context-slugs.test.js`.

#### Current behavior

- `migrate` 하위 명령은 `cmdMigrate`(`scripts/src/lib/cli-project-commands.ts:488-560`)가 kind별로 모듈을 지연 로드해 JSON을 출력한다. exit는 성공 0, 실패 1, 잘못된 인자 2다. `context-slugs`는 전용 엄격 파서 `parseContextSlugsMigrateArgs`(`:413-445`)로 알 수 없는·중복 option을 거절하고, 계산 단계 예외를 `migrate-failed` JSON으로 바꾼다(`:533-545`).
- 사용법 문구는 `scripts/src/lib/cli-usage.ts:27`의 `migrate` 항목, 규칙 문서는 `rules/cli.md:499-515` `## Controlled migrations`다. `test/cli-help.test.js:67-69`가 `migrate context-slugs [--yes]` 줄을 단언한다.
- 가드 선례(`scripts/src/lib/migrate-context-slugs.ts:627-709`) 순서: 등록부 S35 → 빈 계획이면 쓰기 없는 성공 → `migrate-registry-missing` → `migrate-dirty-tree`(`git status --porcelain`) → `migrate-in-progress`(`defaultListInProgress`: pointer·승인 파일·ledger·연결 worktree) → `migrate-slug-conflict`. `--yes`가 없으면 `{ ok: true, dryRun: true, moved, rewritten, … }`. 적용은 `git mv` → 문서 쓰기 → 등록부 원자 쓰기(tmp + rename)이고, 예외는 `migrate-failed` + `next: RESTORE_NEXT`(`:82`), 적용 뒤 `validateBlueprint` 실패는 `migrate-validate-failed`다.
- `readEpicRegistry`는 주입 fs가 아니라 실제 fs를 읽는다(`:634`).
- TASKS-003 이후 `migrate-merge-legacy-epics.ts`에는 계획 함수만 있고, 공용 재작성 모듈 `context-migration-rewrite.ts`가 있다.

#### Target behavior

- 성공(dry-run): `{ ok: true, dryRun: true, moved: [{from,to,order}], rewritten: <문서 수>, movedTo: { <legacy-slug>: { <bp>: <domain> } }, unresolved_rows: [...], validate: [] }`. `from`·`to`는 TASKS-003 `MergeMove`와 같은 `.bouncer/context/epics/...` 저장소 상대 경로다. `unresolved_rows`가 있어도 dry-run은 계획을 낸다. 디스크·git 쓰기 0회.
- 성공(적용): 위 순서로 쓰고 `{ ok: true, dryRun: false, moved, rewritten, movedTo, validate: [{ blueprint, ok: true, failures: [] }…] }`.
  - 등록부 legacy 항목에 `moved_to`를 병합해 쓴다. `kind`·`legacy_id`·`blueprint_aliases`는 그대로다.
  - legacy epic 디렉터리에는 `index.md`가 남고, 그 안 blueprint 링크는 새 경로를 가리킨다.
  - 옮긴 blueprint 문서의 `epic_id`·`resource`·`order`·파생 해시는 공용 재작성 규칙으로 바뀐다(`orderMode: 'overwrite'`).
  - 적용 뒤 옛 번호 trailer로 `resolveTaskCommits({ …, registry })`가 새 위치 task를 찾는다.
- 성공(멱등): 이미 옮겨진 저장소에서 다시 실행하면 쓰기 없이 `moved: []`다.
- 실패: `--yes`인데 계획의 `unresolved_rows`가 비어 있지 않으면 `merge-mapping-invalid`(details에 그 행들)로 쓰기 전에 거절한다. 계획 실패(`merge-mapping-invalid`, `migrate-slug-conflict`), `migrate-registry-missing`, S35, `migrate-dirty-tree`, `migrate-in-progress`(blockers 포함), `migrate-failed`(+`next`), `migrate-validate-failed`. 계획·가드 실패는 쓰기 0회다.
- 보존: `migrate context-slugs`의 동작·출력이 바뀌지 않는다.

#### Interface

- 제공: CLI `bouncer migrate merge-legacy-epics [--yes] [--repo <dir>]`. 사용법 한 줄과 `rules/cli.md` 코드 블록·설명 한 문단.
  ```ts
  migrateMergeLegacyEpics({ repoRoot, yes = false, deps }: { repoRoot: string; yes?: boolean;
    deps?: { runGit?: (args: string[]) => { stdout: string }; fs?: typeof import('node:fs');
      listInProgress?: (o: { repoRoot: string }) => { kind: string; path: string }[] } })
  ```
  `deps`는 테스트 seam이다(`migrate-context-slugs`와 같은 모양).
- 거부 (exit 2): 알 수 없는 option, 중복 `--yes`/`--repo`, 값 없는 `--repo`, 남는 인자.
- 거부 (exit 1, JSON): 위 실패 코드.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/migrate-merge-legacy-epics.ts` | `migrateMergeLegacyEpics` | Modify | 계획 계산만(TASKS-003) | 가드·dry-run·적용·등록부 `moved_to` 쓰기·검증 추가 | 명령 진입점 |
| `scripts/src/lib/cli-project-commands.ts` | `cmdMigrate`, `신규 추출 지점: merge-legacy-epics 인자 파서` | Modify | kind별 분기(`:488-560`) | `merge-legacy-epics` 분기와 엄격 인자 파서 추가 | CLI 진입점 |
| `scripts/src/lib/cli-usage.ts` | `'migrate'` 항목 | Modify | 하위 명령 사용법(`:27`) | 새 줄 추가 | 공개 사용법 |
| `rules/cli.md` | `## Controlled migrations` | Modify | 이관 명령 목록·설명(`:499-515`) | 명령 줄과 설명 한 문단 추가 | 규칙 문서 정합 |
| `test/migrate-merge-legacy-epics.test.js` | 적용·가드·CLI 단언 | Modify | 계획 단언만(TASKS-003) | git fixture로 dry-run 쓰기 0회·적용·멱등·가드·trailer 해석·CLI exit 단언 | 검증 지점 |
| `test/cli-help.test.js` | 사용법 단언 | Modify | `context-slugs` 줄 단언(`:67-69`) | `migrate\s+merge-legacy-epics \[--yes\]` 단언 추가 | 사용법 소유 테스트 |

#### Constraints

- 이 저장소의 `.bouncer/`에 명령을 실행하지 않는다(blueprint Out of scope). 테스트는 임시 git fixture에서만 적용한다.
- 자동 롤백을 만들지 않는다. 실패 시 `RESTORE_NEXT`와 같은 복구 명령을 `next`로 낸다.
- 가드는 쓰기 전에 모두 판정한다. 가드 실패에서 git·fs 쓰기 호출 수는 0이다(`instrument` 방식으로 센다, `test/migrate-context-slugs.test.js:204-231` 참고).
- 승인 파일·ledger·과거 verification 증적을 새로 만들지 않는다. 해시는 원래 공식과 일치한 값만 다시 계산한다.

### context-search/legacy-epic-merge/005

#### Goal & intent

TASKS-001~004가 모두 통합된 통합 브랜치에서 `npm run ci` 전체가 통과함을 증명한다. 태스크별 `node --test` 범위 밖의 회귀(타입 검사, lint, 문서 모양, 테스트 이름, coverage 기준)를 여기서 잡는다. 수용 기준은 blueprint 수용 기준 5다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.