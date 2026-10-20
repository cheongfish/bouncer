---
type: bouncer.tasks
title: 번호 식별자 정적 검사와 규칙 문서 갱신
description: Guard scripts/src against numeric epic and blueprint id parsing outside the resolver and update rules, skills, and changelog for slug identifiers
resource: .bouncer/context/epics/119-context-search/blueprints/001-slug-identifiers/tasks/006/tasks.md
tags:
  - bouncer
  - tasks
  - static-guard
  - rules
  - changelog
timestamp: '2026-10-20T17:07:45.584+09:00'
bouncer:
  id: TASKS-006
  epic_id: '119'
  blueprint_id: '001'
  status: ready
  execution_kind: commit
  depends_on:
    - TASKS-005
  parallel_safe: false
  dependency_gate: integrated
  review_risk: []
  verify: node --test test/context-id-guard.test.js test/test-tiers.test.js test/doc-shape-cli.test.js test/skill-bouncer-plan.test.js test/skill-spec-authoring.test.js
  affected_paths:
    - test/tiers.json
    - rules/planning.md
    - rules/document-schema.md
    - rules/commit-scope.md
    - rules/cli.md
    - rules/current-pointer.md
    - rules/output.md
    - skills/bouncer-plan/SKILL.md
    - references/spec-authoring/index.md
    - references/explain-diff/index.md
    - CHANGELOG.md
    - scripts/src/lib/context-ids.ts
    - scripts/src/lib/context-ontology.ts
    - scripts/src/lib/epic-registry.ts
    - scripts/src/lib/finalize-digest.ts
    - scripts/src/lib/migrate-context-slugs.ts
    - test/context-ids.test.js
    - test/context-id-guard.test.js
  commit_intent:
    - 번호 정규식이 resolver 밖에 다시 생기면 slug 전환이 조용히 깨지므로 정적 검사로 막고, 규칙 문서를 새 형식에 맞춰야 함.
  commit_summary:
    - scripts/src에서 resolver 밖의 epic·blueprint 번호 정규식과 구형 ID 조립을 찾으면 실패하는 테스트를 추가함.
    - 계획·CLI·pointer 규칙과 계획 스킬, 변경 기록을 slug·order 형식으로 갱신함.
  scope_revision: r2
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`scripts/src`에서 `context-ids.ts` 밖에 epic·blueprint 번호 정규식이나 구형 stable ID 조립이 남아 있으면 실패하는 정적 테스트를 추가한다. 규칙·reference·스킬 문서와 `CHANGELOG.md`를 새 식별자 형식, `--order`, `nextBlueprintOrder`, S37, `migrate context-slugs`에 맞춘다. 완료 명령은 `bouncer.verify`다.

## Current behavior
- 앞선 task들이 끝나면 번호 정규식은 `context-ids.ts`에만 남아야 한다. 이를 기계적으로 확인하는 검사는 없다.
- 정적 검사 선례: `test/typescript-module-contract.test.js:44-58`이 `readdirSync(scripts/src/lib)` 뒤 파일마다 정규식으로 검사한다.
- 테스트 등록 규칙:
  - 모든 `test/*.test.js`는 `test/tiers.json`의 unit 또는 integration 목록에 정확히 한 번 있어야 한다(`test/test-tiers.test.js:30-59`).
  - 테스트 이름은 ` → `를 포함한 정적 문자열이어야 한다(`scripts/check-test-names.js:157-167`).
- 번호 형식을 적은 문서:
  - `rules/planning.md:154-155`(`ddd-slug` 디렉터리 예시).
  - `rules/document-schema.md:184`와 `rules/commit-scope.md:25`(`EPIC-<ddd>/BP-<ddd>/TASK-<ddd>`). `rules/document-schema.md`에는 S-코드 표도 있다(S36까지).
  - `rules/cli.md:121-122`(`scaffold epic|blueprint --id <ddd>`), :505(`--epic-id <ddd>`), :501(`migrate task-layout`).
  - `rules/current-pointer.md:13-14`(`.worktrees/<epic-id>/<blueprint-id>`), `rules/output.md:48`(`.worktrees/001/001/integration`).
  - `skills/bouncer-plan/SKILL.md:106,110,112,123,126,200-201`(`--id`, `epic.nextBlueprintId`, "scaffold accepts `\d{3}` only", 브랜치 형식).
  - `references/spec-authoring/index.md:40`(브랜치 형식), `references/explain-diff/index.md:126-127`(`### EPIC-ddd/BP-ddd/TASK-ddd`).
- 문서 모양 제약:
  - `scripts/check-doc-shape.js:820-825`는 `rules/current-pointer.md`의 heading 순서를, :827은 `rules/planning.md`의 `Lightweight cycle`를 고정한다.
  - :857-877은 `skills/bouncer-plan/SKILL.md`의 단계 1–8과 ACQ 단계, 링크를 고정한다.
- `CHANGELOG.md:8`이 `## [Unreleased]`이고, 항목은 `### Added|Changed|Fixed` 아래 굵은 제목 + 설명 형식이다.

## Target behavior
- 성공:
  - `test/context-id-guard.test.js`가 `scripts/src/**/*.ts` 중 `scripts/src/lib/context-ids.ts`를 뺀 파일에 다음 패턴이 없음을 단언한다(주석 줄 포함).
    ```js
    // source 텍스트에 substring으로 들어 있으면 위반이다(정규식 리터럴 원문 기준).
    const FORBIDDEN = [
      'epics\\/(\\d{3})', 'epics\\/\\d{3}',
      'blueprints\\/(\\d{3})', 'blueprints\\/\\d{3}',
      '^(\\d{3})-', '^\\d{3}-', '(\\d{3})-[^/]', '\\d{3}-[^/]',
      'EPIC-(\\d{3})', 'EPIC-\\d{3}', '`EPIC-${',
      '^(\\d{3})\\/(\\d{3})$',
    ];
    ```
  - 위반 시 실패 메시지에 `파일:줄`과 패턴을 담는다.
  - `tasks/(\d{3})`, `TASKS-(\d{3})`, `^\d{3}$` task 번호 검사는 금지 목록에 없다.
  - 문서가 slug 디렉터리·stable ID·브랜치·worktree 형식, `scaffold blueprint --order`, `epic.nextBlueprintOrder`, S37, `bouncer migrate context-slugs [--yes]`, 등록부 v2(`legacy_id`, `blueprint_aliases`, slug 40자·숫자 금지)를 설명한다.
  - 구형 형식은 "이관 전 저장소와 구형 trailer 읽기"로만 언급한다.
  - `CHANGELOG.md` `[Unreleased]`의 `### Added`에 slug 식별자 전환과 이관 명령 항목을 한 개 추가한다.
- 실패: 금지 패턴이 남아 있으면 테스트가 실패한다. 이 task는 source를 고치지 않는다. 남은 위반은 해당 소유 task의 결함으로 보고하고 수정을 요청한다.
- 보존: `check-doc-shape.js`가 고정한 heading·단계·링크 모양은 유지한다.

## Interface
- 제공: `test/context-id-guard.test.js`(unit tier). 테스트 이름 예: `'scripts/src outside context-ids → has no numeric epic or blueprint id parsing'`.
- 제공 문서 계약:
  - `rules/cli.md`의 scaffold·plan inspect·migrate 사용법.
  - `rules/document-schema.md`의 S37 행과 `bouncer.order`.
  - `rules/planning.md`의 디렉터리 형식.
- 거부: 금지 패턴이 있는 source 파일(테스트 실패).

## Touch
| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `test/context-id-guard.test.js` | — | Create | 없음 | 정적 검사 | 수용 기준 2 |
| `test/tiers.json` | — | Modify | tier 목록 | 새 테스트를 unit에 등록 | `test-tiers.test.js:30-59` |
| `rules/planning.md` | 디렉터리 형식 | Modify | `ddd-slug` 예시 | slug·`order` 설명 | `rules/planning.md:154-155` |
| `rules/document-schema.md` | stable ID, S-코드 표 | Modify | 구형 ID, S36까지 | 새 ID·S37·`order` | `rules/document-schema.md:184` |
| `rules/commit-scope.md` | trailer 형식 | Modify | 구형 trailer | 새 trailer·구형 읽기 | `rules/commit-scope.md:25` |
| `rules/cli.md` | scaffold·migrate 사용법 | Modify | `--id <ddd>` | `--order`·`context-slugs` | `rules/cli.md:121-122,501,505` |
| `rules/current-pointer.md` | worktree 경로 | Modify | 번호 경로 | slug 경로 | `rules/current-pointer.md:13-14` |
| `rules/output.md` | 예시 경로 | Modify | `.worktrees/001/001` | slug 예시 | `rules/output.md:48` |
| `skills/bouncer-plan/SKILL.md` | 단계 2·3 문구 | Modify | `--id`·`nextBlueprintId`·번호 브랜치 | `--order`·`nextBlueprintOrder`·slug 브랜치 | `skills/bouncer-plan/SKILL.md:106-126,200-201` |
| `references/spec-authoring/index.md` | 브랜치 형식 | Modify | 번호 브랜치 | slug 브랜치 | `references/spec-authoring/index.md:40` |
| `references/explain-diff/index.md` | explain 제목 | Modify | 구형 제목 | 새 제목·구형 읽기 | `references/explain-diff/index.md:126-127` |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 미출시 변경 목록 | Added 항목 | `CHANGELOG.md:8` |

## Do not touch
- `scripts/src/` — 이 task는 source를 바꾸지 않는다. 위반은 소유 task로 돌려보낸다.
- `scripts/check-doc-shape.js` — 문서 모양 계약은 바꾸지 않는다.
- `.bouncer/context/epics/` — legacy 문서는 이관 명령이 바꾼다.
- `DOCUMENT-SLUG-IDENTIFIER-PROPOSAL.md` — 요구사항 원본이다.

## Constraints
- 문서 본문은 한국어 규칙(`AGENTS.md` 규칙 5)이 있는 곳은 한국어, 영어 문서는 영어로 둔다. 각 파일의 기존 언어를 따른다.
- `skills/bouncer-plan/SKILL.md`의 번호 단계·ACQ 색인·링크는 `check-doc-shape.js:857-877` 계약대로 유지한다.
- 금지 패턴 목록은 테스트 파일 안에만 둔다. 다른 스크립트나 lint 규칙으로 옮기지 않는다.

## Checklist
- [ ] `test/context-id-guard.test.js`를 쓰고 `test/tiers.json` unit에 등록한다.
  - 앞선 task가 모두 통합된 상태라면 바로 통과해야 한다.
  - 패턴이 실제로 잡는지 확인하려고 임시 fixture 문자열 배열로 각 패턴의 양성 사례를 같은 테스트 파일에서 단언한다. 예: 문자열 `const X = /epics\/(\d{3})/;`가 첫 항목에 걸린다.
- [ ] 위 Touch의 규칙·reference·스킬 문서를 고친다. 바꾸기 전에 `rg -n "\\d\{3\}|EPIC-|nextBlueprintId|--id <ddd>" rules references skills`로 남은 번호 표현을 다시 확인한다.
- [ ] `CHANGELOG.md` `[Unreleased]` `### Added`에 항목을 추가한다(없으면 `### Added` 소제목을 만든다).
- [ ] `npm run lint:docs`로 문서 모양을 확인한다.
- [ ] `npm run build` 뒤 `node --test test/context-id-guard.test.js test/test-tiers.test.js test/doc-shape-cli.test.js test/skill-bouncer-plan.test.js test/skill-spec-authoring.test.js`가 통과한다.
