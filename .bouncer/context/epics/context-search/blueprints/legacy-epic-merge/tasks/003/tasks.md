---
type: bouncer.tasks
title: 컨텍스트 이관 재작성 헬퍼 추출과 legacy epic 병합 계획 계산
description: Extract shared context-migration rewrite helpers and compute a deterministic legacy-to-domain merge plan.
resource: .bouncer/context/epics/context-search/blueprints/legacy-epic-merge/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
  - migration
  - epic-registry
  - refactor
timestamp: '2026-10-20T21:02:17.860+09:00'
bouncer:
  id: TASKS-003
  epic_id: context-search
  blueprint_id: legacy-epic-merge
  status: ready
  execution_kind: commit
  depends_on: []
  parallel_safe: true
  dependency_gate: integrated
  verify: node --test test/migrate-context-slugs.test.js test/migrate-merge-legacy-epics.test.js test/test-tiers.test.js
  review_risk: []
  affected_paths:
    - scripts/src/lib/context-migration-rewrite.ts
    - scripts/src/lib/migrate-context-slugs.ts
    - scripts/src/lib/migrate-merge-legacy-epics.ts
    - test/migrate-merge-legacy-epics.test.js
    - test/tiers.json
  commit_intent:
    - legacy epic blueprint를 도메인 epic으로 옮기기 전에 이동 대상과 충돌을 같은 입력에 같은 결과로 계산함.
    - slug 이관의 재작성 규칙을 두 이관 명령이 함께 쓰게 함.
  commit_summary:
    - 경로 매핑·링크 재작성·해시 재계산을 공용 모듈로 옮김.
    - 도메인 epic 귀속 목록과 예외 표에서 blueprint별 이동 계획을 만듦.
---
# Tasks

Blueprint: [legacy-epic-merge](../../index.md)

## Goal & intent
두 가지를 한다. (1) `migrate-context-slugs.ts`의 문서 재작성 헬퍼를 공용 모듈로 옮겨, 다른 epic으로 blueprint를 옮기는 이관도 같은 규칙(원래 공식과 일치한 값만 재계산)을 쓰게 한다. 기존 slug 이관 결과는 바이트 단위로 같아야 한다. (2) 도메인 epic `index.md`에서 legacy blueprint별 이동 계획을 결정적으로 계산하는 순수 함수 `planLegacyEpicMerge`를 만든다. 디스크 쓰기·CLI 연결은 TASKS-004 소관이다. 수용 기준: 기존 `test/migrate-context-slugs.test.js`가 수정 없이 통과하고, 새 계획 함수 단언이 통과한다. 검증 명령은 `node --test test/migrate-context-slugs.test.js test/migrate-merge-legacy-epics.test.js test/test-tiers.test.js`.

## Current behavior
- 재작성 헬퍼는 모두 `scripts/src/lib/migrate-context-slugs.ts` 안의 비공개 함수다: `defaultRunGit`(`:107`), `listFilesUnder`(`:116`), `defaultListInProgress`(`:146`, 유일하게 export), `makePathMapper`(`:319`), `rewriteLinkTarget`(`:333`), `replaceAllOnce`(`:363`), `planDigestOf`(`:375`), `fingerprintFields`(`:400`), `restructure`(`:418-503`), `computeRewrites`(`:510-606`), `writeRegistryAtomically`(`:609`). export는 `{ planContextSlugMigration, migrateContextSlugs, defaultListInProgress }`(`:716`)뿐이다.
- `restructure`는 문서 맥락으로 `{ epic: EpicMove; blueprint: BlueprintMove | null }`(`:397`)을 받고 `epic.slug`·`blueprint.slug`·`blueprint.order`만 읽는다. `order`는 frontmatter에 없을 때만 넣는다(`:444-455`).
- `computeRewrites`는 `plan.epics[].blueprints[]`를 돌며 `planDigestOf(<epic.from>/index.md, bp.from, …)`와 `(<epic.to>/index.md, bp.to, …)`를 비교하고(`:590-591`) brief hash 쌍을 계산한다(`:577-581`). epic 이동과 blueprint 이동이 같은 epic 안에서 일어난다고 전제한다.
- `planContextSlugMigration`(`:202-316`)은 번호 형식 epic 디렉터리만 다룬다(`:215-217`). 이 저장소 legacy epic은 이미 slug 형식이라 병합에 재사용할 수 없다.
- 매핑 원천: 도메인 epic `index.md`의 `## Legacy epic 귀속` 아래 `- [<legacy-slug>](../<legacy-slug>/index.md)`(뒤에 ` △` 가능) 줄과, `### 다른 epic에서 이 영역으로 귀속되는 blueprint` 표의 `| <legacy 번호> | <blueprint 셀> | <이유> |` 행이다. 예: `.bouncer/context/epics/drive-execution/index.md:31-56`. 번호는 등록부 `legacy_id`·`blueprint_aliases`로 slug가 된다.
- 실제 blueprint 셀 형식은 여러 가지다: `003, 005, 006`, `001~003, 005~009`, `003 migrate-ids-removal`, `003 adaptive-quiz, 005 pr-single-confirm, 013 structured-pr-body`, `005~007, 016, 019, 020`, 그리고 번호가 없는 자유 서술 `finalize digest 부분`, `평가 후속`, `verify 출력 tail`(legacy 078·087·105 행).
- 테스트 fixture 방식: `test/migrate-context-slugs.test.js:57-201`(`buildFixture`, `createGitTemplate`). 새 테스트 파일은 `test/tiers.json` 등록이 필요하다(`migrate-context-slugs.test.js`는 `:94`).

## Target behavior
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

## Interface
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

## Touch
| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/context-migration-rewrite.ts` | `신규 추출 지점: 문서 재작성 공용 모듈` | Create | 없음 | slug 이관의 재작성 헬퍼를 일반화한 맥락으로 옮겨 export | 두 이관이 같은 해시 규칙을 쓰는 지점 |
| `scripts/src/lib/migrate-context-slugs.ts` | `restructure`, `computeRewrites` 외 헬퍼 | Modify | 헬퍼를 비공개로 소유(`:107-614`) | 공용 모듈 import로 바꾸고 맥락을 새 모양으로 넘긴다. export 목록 유지 | 기존 동작 보존 지점 |
| `scripts/src/lib/migrate-merge-legacy-epics.ts` | `planLegacyEpicMerge` | Create | 없음 | 귀속 목록·예외 표 파싱과 이동 계획 계산 | 이관 계획 진입점 |
| `test/migrate-merge-legacy-epics.test.js` | 계획 함수 단언 | Create | 없음 | 정상·예외 우선·order·충돌·누락 단언 | 검증 지점 |
| `test/tiers.json` | `unit`/`integration` 목록 | Modify | 테스트 파일 계층 목록(`:94`) | 새 테스트 파일 등록 | `test/test-tiers.test.js`가 등록을 검사 |

## Do not touch
- `scripts/src/lib/cli-project-commands.ts` — CLI 연결은 TASKS-004.
- `scripts/src/lib/epic-registry.ts` — TASKS-002 소관.
- `scripts/src/lib/context-ids.ts` — TASKS-002 소관.
- `test/migrate-context-slugs.test.js` — 추출이 동작을 바꾸지 않았다는 증거라 고치지 않는다.

## Constraints
- 해시 재계산 규칙은 바꾸지 않는다: 원래 값이 그 공식의 결과와 같을 때만 새로 계산한다(`migrate-context-slugs.ts:405-417` 주석).
- 계획 함수는 순수하다: git·쓰기 없음, 같은 입력에 같은 출력.
- 귀속 목록 줄은 링크 형식 하나만 받는다. 목록 안 링크가 legacy가 아닌 epic을 가리키면 `merge-mapping-invalid`다. 예외 표 셀은 위 세 항목 형식만 받고, 항목이 하나도 없는 셀만 `unresolved_rows`로 보낸다. 항목 일부만 해석되는 셀(예: `003, 뭔가`)은 `merge-mapping-invalid`다.
- 자유 서술 행 3개를 정규화하는 문서 편집은 이 task 범위가 아니다(적용 전 main의 governance 편집).
- `.bouncer/` 실제 문서를 테스트 입력으로 쓰지 않는다. fixture를 만든다.

## Checklist
- [ ] `test/migrate-merge-legacy-epics.test.js`를 만들고 `test/tiers.json`에 등록한다. 계획 단언을 먼저 쓴다. 기대 red: `planLegacyEpicMerge`가 없어 require 대상 export가 `undefined`라 호출에서 실패한다.
  ```js
  // fixture: legacy a(legacy_id 001, bp x(order1), y(order2)), legacy b(002, bp z),
  // domain d1 목록 [a], domain d2 목록 [b] + 예외 표 | 001 | 002 |  (a의 y → d2)
  assert.deepStrictEqual(plan.moves.map((m) => [m.from, m.to, m.order]), [
    ['.bouncer/context/epics/a/blueprints/x', '.bouncer/context/epics/d1/blueprints/x', 1],
    ['.bouncer/context/epics/a/blueprints/y', '.bouncer/context/epics/d2/blueprints/y', 1],
    ['.bouncer/context/epics/b/blueprints/z', '.bouncer/context/epics/d2/blueprints/z', 2],
  ]);
  assert.deepStrictEqual(plan.unresolved_rows, []);
  ```
  추가 단언(각각 기대 red는 해당 export 부재로 인한 호출 실패):
  - 범위 `| 001 | 001~002 |` → x·y 모두 예외 대상 epic으로 간다.
  - 번호+slug `| 001 | 002 y |` → y가 간다. `| 001 | 002 w |`(slug 불일치) → `merge-mapping-invalid`.
  - 범위 끝이 별칭에 없음 `| 001 | 001~004 |` → `merge-mapping-invalid`.
  - 자유 서술 `| 002 | 평가 후속 |` → `ok: true`, `unresolved_rows: [{ domain: 'd1', legacy_id: '002', cell: '평가 후속' }]`, z는 목록 규칙대로 d2.
  - 목록 누락·중복 legacy → `merge-mapping-invalid`, 예외 표의 모르는 legacy 번호 → `merge-mapping-invalid`, 같은 slug 두 개가 d2로 → `migrate-slug-conflict`, 이미 옮겨진 상태 → `moves: []`, 두 번 호출 결과 `deepStrictEqual`.
- [ ] `npm run build && node --test test/migrate-merge-legacy-epics.test.js`로 red 확인.
- [ ] 공용 모듈을 만들고 `migrate-context-slugs.ts`가 그것을 쓰게 한다. `npm run build && node --test test/migrate-context-slugs.test.js`가 수정 없이 통과하는지 확인한다.
- [ ] `planLegacyEpicMerge`를 구현한다.
- [ ] `npm run build` 뒤 `node --test test/migrate-context-slugs.test.js test/migrate-merge-legacy-epics.test.js test/test-tiers.test.js`가 통과한다.
