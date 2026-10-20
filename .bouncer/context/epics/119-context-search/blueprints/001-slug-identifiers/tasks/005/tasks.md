---
type: bouncer.tasks
title: 번호 문서를 slug로 옮기는 이관 명령 추가
description: Add bouncer migrate context-slugs that moves numeric epic and blueprint directories to slugs, rewrites ids and hashes, and records aliases
resource: .bouncer/context/epics/119-context-search/blueprints/001-slug-identifiers/tasks/005/tasks.md
tags:
  - bouncer
  - tasks
  - migration
  - epic-registry
  - aliases
timestamp: '2026-10-20T17:07:45.483+09:00'
bouncer:
  id: TASKS-005
  epic_id: '119'
  blueprint_id: '001'
  status: ready
  execution_kind: commit
  depends_on:
    - TASKS-002
    - TASKS-003
    - TASKS-004
  parallel_safe: false
  dependency_gate: integrated
  review_risk:
    - public_interface
  verify: node --test test/migrate-context-slugs.test.js test/cli-help.test.js test/test-tiers.test.js
  affected_paths:
    - scripts/src/lib/migrate-context-slugs.ts
    - scripts/src/lib/cli-project-commands.ts
    - scripts/src/lib/cli-usage.ts
    - test/migrate-context-slugs.test.js
    - test/cli-help.test.js
    - test/tiers.json
  commit_intent:
    - 새 형식 쓰기와 legacy 이관을 한 번에 켜려면 번호 디렉터리와 문서 안 ID·해시를 일괄로 옮기는 도구가 필요함.
  commit_summary:
    - migrate context-slugs가 기본은 계획만 보여 주고 --yes일 때 디렉터리 이동·ID 재작성·해시 재계산·별칭 기록을 함.
    - 작업 트리가 더럽거나 진행 중인 drive가 있으면 아무것도 바꾸지 않고 거절함.
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`bouncer migrate context-slugs`가 번호 형식 epic·blueprint 디렉터리를 slug 형식으로 옮긴다. 옮기면서 문서 안 ID·경로를 새 형식으로 다시 쓰고, 파생 해시를 다시 계산하고, 등록부를 v2로 바꾸며 별칭을 기록한다. 실행하는 순간 경로 형식이 바뀌므로 모든 epic이 한 번에 새 형식으로 전환된다(결정 10). 이 blueprint는 도구만 만들고 이 저장소에서 실행하지 않는다. 완료 명령은 `bouncer.verify`다.

## Current behavior
- `bouncer migrate`는 `scripts/src/lib/cli-project-commands.ts:416-419`가 하위 명령별로 lazy-require해 분기한다(`task-layout`, `retention`). 인자 파싱은 :306-325, 사용법은 `scripts/src/lib/cli-usage.ts:27`이다.
- 선례 `scripts/src/lib/migrate-task-layout.ts:180-224`의 흐름은 다음과 같다.
  - 계획(:73) → 검증(:96) → `dryRun || !ok`이면 쓰기 없이 반환한다.
  - 그다음 `git mv`(:198-204), 문서 재작성(:121), runtime pointer 갱신(:213-222)을 한다.
  - 롤백은 없다. `migrate-review-scope.ts:87-92`는 선행 이관이 필요하면 거절하고 안내한다.
- 파생 해시:
  - `evidence_id`: `verification.ts:901-909`의 `sha256Canonical(identity)`(`canonical-json.ts:37`)이고, identity는 `{head, dirty_digest, command, cwd, environment_hash, scope}`다. G13이 `validate-gates.ts:868`에서 다시 계산해 비교한다.
  - finding: `validate-sections.ts:279-304` `findingFingerprint`가 `${file}#${symbol}`(선택 namespace, :78)을 만들고, id는 접두 + `sha256(fp).slice(0,8)`이다.
  - frontmatter digest: `target_digest`(`finalize-digest.ts:417-431`가 읽음), `closure_target_digest`(`context-review-state.ts:60`, 64자 소문자 hex, `validate-gates.ts:1262,1734-1750`).
- 진행 중 상태의 위치:
  - pointer·승인 루트: `runtime-state.ts:515-518`, pointer 목록: :704.
  - coordinator 원장: `coordinatorPathsFor`(:1033-1055)와 `coordinator-ledger.ts:29`.
  - worktree 목록: `git worktree list --porcelain` 파싱(:158-167).
  - 원자적 쓰기: `atomicWrite`(`coordinator-ledger.ts:10`).
- 저장소 규모: legacy blueprint 디렉터리 223개, `explain.md` 200개, `verification.md` 64개, `review.md` 58개.

## Target behavior
- 성공(`--yes`, 깨끗한 작업 트리, 진행 중 상태 없음):
  - **디렉터리 이동:** `epics/<ddd>-<slug>/` → `epics/<slug>/`, `blueprints/<ddd>-<slug>/` → `blueprints/<slug>/`. `git mv`로 옮기므로 변경이 index에 올라간다.
  - **frontmatter:**
    - `resource`를 새 경로로 바꾼다.
    - epic은 `bouncer.id`를 slug로 바꾼다.
    - blueprint·task·verification·review 문서는 `id`/`epic_id`/`blueprint_id`를 slug로 바꾼다. task `TASKS-NNN`은 그대로 둔다.
    - blueprint에 `order: <int(ddd)>`를 넣는다(답변 9).
  - **문서 안 참조:**
    - 대상은 저장소가 추적하는 모든 `*.md`다.
    - 상대 링크가 옮겨진 디렉터리를 가리키면 새 경로로 바꾼다.
    - `verification.md`의 `scope.key`, `explain.md`의 `task_commits[].task`와 `### EPIC-…` 제목, finding `file`을 새 형식으로 바꾼다.
  - **파생 해시:**
    - `evidence_id`는 바뀐 identity로 다시 계산한다. `head`와 `dirty_digest`는 그대로 둔다.
    - finding fingerprint와 `F-`/`CR-` id를 다시 계산하고, 같은 문서 안의 id 참조도 바꾼다(답변 18).
    - frontmatter `target_digest`·`closure_target_digest`·`task_brief_hash`는 그 값을 만든 기존 함수로 다시 계산한다.
  - **등록부:**
    - `.bouncer/epics.json`을 v2로 쓴다(`atomicWrite`).
    - 번호 디렉터리를 가졌던 epic은 `legacy` 여부와 관계없이 `legacy_id`와 `blueprint_aliases{ddd: slug}`를 갖는다.
  - **색인:** `.bouncer/context/index.md`의 epic 행을 새 경로로 다시 만든다(S13).
  - **결과:**
    - 출력 JSON `{ ok: true, moved: [...], rewritten: [...], aliases: {...}, validate: [...] }`을 낸다.
    - `validate`는 이관한 blueprint마다 기본 `bouncer validate --blueprint <dir>`(gate 인자 없음)와 같은 함수를 돌린 결과다. 실패가 있으면 `ok: false`, exit 1이고 이미 옮긴 변경은 남긴다.
- 기본(`--yes` 없음, dry-run):
  - 같은 계획을 JSON으로 출력하고 파일·index·등록부는 바꾸지 않는다.
- 재실행:
  - 이미 slug인 디렉터리와 이미 기록된 별칭은 건너뛴다. 두 번째 실행은 `moved: []`인 성공이다.
- 실패(아무것도 바꾸지 않음, exit 1):
  - `migrate-dirty-tree`: `git status --porcelain`이 비어 있지 않다.
  - `migrate-in-progress`:
    - 거절 사유는 다음 넷이다: pointer 파일(namespace 또는 legacy `current`), `approvals/` 아래 파일, `.worktrees/` 아래 coordinator 원장, `git worktree list`의 `.worktrees/` 하위 worktree.
    - 거절할 때 어느 것 때문인지 `blockers[]`에 경로와 함께 담는다.
    - `.bouncer/runtime/plan-*`와 context-review 캐시는 무시한다(답변 17).
  - `migrate-slug-conflict`: 옮긴 뒤 같은 epic 안 slug가 겹치거나, epic slug가 이미 있는 디렉터리와 겹치거나, `validateSlug`에 실패한다.
- 중간 실패:
  - 예외로 멈추면 `next`에 `git restore --staged --worktree .bouncer && git clean -fd .bouncer/context`를 담아 되돌리는 방법을 안내한다.
  - 자동 롤백은 하지 않는다(답변 16).

## Interface
- 제공 CLI: `bouncer migrate context-slugs [--yes]`. 기본은 dry-run이다. 결과는 stdout JSON 한 개이고, 거절은 `{ ok:false, code, message, next, blockers? }`다.
- 제공 모듈 `scripts/src/lib/migrate-context-slugs.ts`:
  ```ts
  function planContextSlugMigration({ repoRoot, registry, deps }): MigrationPlan;      // 순수 계획
  function migrateContextSlugs({ repoRoot, yes, deps }): MigrationResult;
  type Deps = { runGit(args: string[]): { stdout: string }; fs?: InjectedFs;
    listInProgress(): Array<{ kind: 'pointer'|'approval'|'ledger'|'worktree'; path: string }> };
  ```
  - test seam: `deps.runGit`(`status --porcelain`, `mv`, `worktree list --porcelain` 호출 검사), `deps.listInProgress`(기본값은 `runtime-state.ts` 함수 조합)를 쓴다.
- 거부(아무 변경 없음): `migrate-dirty-tree`, `migrate-in-progress`, `migrate-slug-conflict`, 등록부 S35.
- miss(실패 아님): 옮길 번호 디렉터리가 없으면 `moved: []`로 성공한다.

## Touch
| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/migrate-context-slugs.ts` | `신규 추출 지점: 이관 계획·적용` | Create | 없음 | 이관 명령 본체 | 수용 기준 6·7 |
| `scripts/src/lib/cli-project-commands.ts` | `migrate` 분기, 인자 파싱 | Modify | `task-layout`·`retention` 분기 | `context-slugs`·`--yes` 추가 | `cli-project-commands.ts:306-325,416-419` |
| `scripts/src/lib/cli-usage.ts` | migrate 사용법 | Modify | 하위 명령 안내 | `context-slugs` 줄 추가 | `cli-usage.ts:27` |
| `test/migrate-context-slugs.test.js` | — | Create | 없음 | 이관·거절·재실행·provenance 사례 | 수용 기준 6·7 |
| `test/cli-help.test.js` | — | Modify | 사용법 테스트 | `context-slugs` 문구 | `cli-usage.ts` 변경 |
| `test/tiers.json` | — | Modify | tier 목록 | 새 테스트를 integration에 등록 | `test-tiers.test.js:30-59` |

## Do not touch
- `.bouncer/context/epics/`, `.bouncer/epics.json` — 이 저장소에서 이관을 실행하지 않는다(blueprint Out of scope).
- `scripts/src/lib/migrate-review-scope.ts` — 기존 이관 도구는 정리하지 않는다(`migrate-task-layout.ts`·`retention-migration.ts`의 정규식 교체는 TASKS-002 소관).
- `scripts/src/lib/context-ids.ts`, `scripts/src/lib/runtime-state.ts`, `scripts/src/lib/validate-sections.ts`, `scripts/src/lib/verification.ts`, `scripts/src/lib/canonical-json.ts`, `scripts/src/lib/plan-snapshot-contract.ts`, `scripts/src/lib/task-brief-hash.ts` — 소비만 한다. 필요한 함수는 모두 이미 export되어 있다.

## Constraints
- 해시는 직접 구현하지 않고 기존 export를 쓴다: `sha256Canonical`(`canonical-json.ts:41`), `findingFingerprint`·`findingAutoId`(`validate-sections.ts:706`), `digestPlanContent`(`plan-snapshot-contract.ts:98`), `taskBriefHash`(`task-brief-hash.ts:38`).
- 과거 커밋은 다시 쓰지 않는다. 구형 trailer 연결은 TASKS-004의 별칭 정규화가 맡는다.
- dry-run과 거절 경로에서는 fs 쓰기, `git mv`, 등록부 쓰기가 한 번도 일어나지 않는다(테스트로 호출 0회 확인).
- fixture는 테스트가 임시 git 저장소에 만든다. 실제 `.bouncer/context`를 읽지 않는다.

## Checklist
- [ ] `test/migrate-context-slugs.test.js`에 임시 저장소 fixture를 만든다.
  - epic 2개(legacy·domain), blueprint 3개를 둔다. 그중 하나는 `verification.md`(`evidence_id` 포함)·`review.md`(finding 포함)·`context-review.md`(`closure_target_digest` 포함)·`explain.md`(`task_commits` 포함)와 `target_digest`·`task_brief_hash` 필드를 갖고, 구형 trailer 커밋 1개가 있다.
- [ ] 다음 사례를 먼저 쓰고 실패를 확인한다. 기대 red: `bouncer migrate: unknown subcommand context-slugs`.
  - dry-run 무변경(`runGit('mv')` 0회).
  - `--yes` 이관 뒤 경로·frontmatter·`order`·링크·`scope.key`·`evidence_id`·finding id·등록부 v2 별칭.
  - 재실행 `moved: []`.
  - dirty·pointer·approval·worktree 각각의 거절과 무변경.
  - slug 충돌 거절.
  - 이관 뒤 구형 trailer 커밋이 `explain.md`에 연결되는 provenance 확인.
  ```js
  assert.equal(registry.epics.find((e) => e.slug === 'consumer-epic-registry').blueprint_aliases['003'], 'registry-gates');
  ```
- [ ] 이관한 각 blueprint에 기본 `bouncer validate --blueprint` 함수 결과가 `ok`임을 단언한다.
- [ ] 다시 계산한 해시를 원래 함수로 직접 대조한다. `evidence_id === sha256Canonical(identity)`, finding id `=== findingAutoId(findingFingerprint(...), ns)`, `closure_target_digest`·`target_digest`가 이관된 문서로 계산한 `digestPlanContent` 결과와 같고, `task_brief_hash === taskBriefHash(이관된 tasks.md)`다.
- [ ] 종단 연결(blueprint 수용 기준 3): 이관한 fixture(v2 등록부) 위에서 `scaffold blueprint --order` → `plan approve` → `current --set` → `branchNamesFor`·`coordinatorPathsFor`·pointer 키 → `buildStableProvenance` trailer로 커밋 → `finalize` 수집(`resolveTaskCommits`)까지 한 테스트에서 이어 실행한다. 각 단계 키가 `plan-workflow/registry-gates` 계열 같은 slug 값으로 이어지는지 단언한다.
- [ ] `migrate-context-slugs.ts`를 구현하고 CLI 분기·사용법을 추가한다.
- [ ] `test/tiers.json` integration 목록에 새 테스트를 넣는다.
- [ ] `npm run build` 뒤 `node --test test/migrate-context-slugs.test.js test/cli-help.test.js test/test-tiers.test.js`가 통과한다.
