---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/084-drive-plan-copy-hygiene/blueprints/001-finalize-main-release/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-02T14:08:10.549+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '084'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: ba6c9caca26068a9fe5e5ee53de5723a6b2222c8
      range_to: 0105235d864fcf6886ae0c4d7521c0a8827d6f8b
      diff_sha: 5849f9d8dc9666ffb77a6538c8cae6799ed68a16376936956cf5a8aaba6ccba8
      quiz_score: 4/5
      disposition: Q4를 제외하고 드라이브 사실(메인 사본 삭제, coordinate release 제거, eslint 005, 006 경로)을 맞춤. 마감은 점수와 무관하게 진행한다.
      recorded_at: '2026-10-02T14:20:00+09:00'
  task_commits:
    - task: EPIC-084/BP-001/TASK-001
      sha: 552fbf50
      intent_anchor: task-001
    - task: EPIC-084/BP-001/TASK-002
      sha: fed8cc2f
      intent_anchor: task-002
    - task: EPIC-084/BP-001/TASK-003
      sha: f79ea8e2
      intent_anchor: task-003
    - task: EPIC-084/BP-001/TASK-005
      sha: 4ea4c12d
      intent_anchor: task-005
    - task: EPIC-084/BP-001/TASK-006
      sha: 0105235d
      intent_anchor: task-006
  coordinator:
    integration_branch: feat/084-001-finalize-main-release
    tasks:
      - id: '001'
        branch: bouncer/084-001-001
        scope_revision: null
        actual_paths:
          - scripts/src/lib/cli-git-commands.ts
          - test/cli-help.test.js
          - test/coordinator-e2e.test.js
          - scripts/src/lib/finalize-release-main.ts
          - test/finalize-release-main.test.js
      - id: '002'
        branch: bouncer/084-001-002
        scope_revision: null
        actual_paths:
          - rules/cli.md
          - scripts/src/lib/cli-git-commands.ts
          - scripts/src/lib/coordinator.ts
          - test/cli-coordinate.test.js
          - test/coordinator-e2e.test.js
      - id: '003'
        branch: bouncer/084-001-003
        scope_revision: null
        actual_paths:
          - CHANGELOG.md
          - docs/workflow.md
          - rules/current-pointer.md
          - skills/bouncer-finalize/SKILL.md
          - skills/bouncer-finalize/references/cleanup-handoff.md
          - test/acq-gate-ids.test.js
          - test/skill-bouncer-finalize.test.js
      - id: '004'
        branch: null
        scope_revision: null
        actual_paths: []
      - id: '005'
        branch: bouncer/084-001-005
        scope_revision: r1
        actual_paths:
          - scripts/src/lib/finalize-release-main.ts
          - test/finalize-release-main.test.js
      - id: '006'
        branch: bouncer/084-001-006
        scope_revision: r2
        actual_paths:
          - scripts/src/lib/finalize-release-main.ts
          - test/finalize-release-main.test.js
---
# Explain

## Background

닫힌 blueprint 사본이 메인 checkout에 남으면 이후 병합이 그 파일을 덮어쓴다. 드라이브는 `finalize --yes`가 메인에서 그 사본을 지운 뒤 worktree를 강제 제거하고, 같은 epic의 다음 blueprint가 메인에 있으면 pointer를 묻지 않고 옮기게 했다.

실측 순서는 계획 DAG `001→002→003→004`에서 시작했다. `bouncer-implementer`가 001에서 `releaseMain` CLI와 `cmdFinalize` 분기를 넣었고, 002에서 `coordinate release`를 CLI·fence·coordinator·규칙·테스트에서 뺐고, 003에서 finalize 마감을 release-main 후 강제 제거와 다음 blueprint 자동 설정으로 바꿨다. 004 `npm run ci`가 eslint로 실패해 005를 붙였다. 005는 003에 의존하고 004는 005에 의존한다. 통합 뒤 discovery must_fix(CT-001~005, SEC-001)로 006을 붙였고 006은 004에 의존한다. integration head는 `0105235d864fcf6886ae0c4d7521c0a8827d6f8b`이다.

## Intuition

마감은 메인 사본을 먼저 치우고, 그다음에 worktree와 pointer를 정리한다.

## Code

읽기 순서:

- `scripts/src/lib/finalize-release-main.ts` — 메인 사본 삭제, HEAD 바이트 복원, git 오류 식별, symlink-safe `walkFiles`. 001 경로에 eslint 수리(005)와 review 수리(006)가 겹친다.
- `scripts/src/lib/cli-git-commands.ts` — `cmdFinalize`가 release-main을 타고, `coordinate release` 진입은 사라진다.
- `scripts/src/lib/coordinator.ts` — `LEDGER_FENCED_COMMANDS`에서 release를 뺀다.
- `skills/bouncer-finalize/SKILL.md`, `skills/bouncer-finalize/references/cleanup-handoff.md`, `rules/current-pointer.md`, `docs/workflow.md` — 강제 제거와 다음 pointer 자동 설정.
- 테스트: `test/finalize-release-main.test.js`, `test/cli-help.test.js`, `test/cli-coordinate.test.js`, `test/coordinator-e2e.test.js`, `test/skill-bouncer-finalize.test.js`, `test/acq-gate-ids.test.js`.

워커 브랜치: `bouncer/084-001-001` `0fbb7169`, `bouncer/084-001-002` `cdc2a8a5`, `bouncer/084-001-003` `01c0da47`, `bouncer/084-001-005` `9d9da859`, `bouncer/084-001-006` `01489e2a`. 004는 커밋 SHA가 없다.

001~003은 `scopeRevision` 없이 `actualPaths`가 초기 brief 경로와 같다. 005·006은 r1/r2이며 경로는 `scripts/src/lib/finalize-release-main.ts`와 `test/finalize-release-main.test.js`뿐이다.

## Quiz

1. `finalize --yes` 뒤 메인 checkout의 닫힌 blueprint 사본은 어떻게 되나?
   - A) 사본은 두고 worktree만 제거한다
   - B) 메인 사본을 지운 뒤 worktree를 강제 제거한다
   - C) 사본마다 삭제 여부를 다시 묻는다

2. 드라이브가 `coordinate release`에 한 일은?
   - A) CLI·fence·coordinator·규칙·테스트에서 명령을 제거했다
   - B) `release-main`의 별칭으로 남겼다
   - C) `--legacy` 뒤에만 열어 두었다

3. TASKS-005가 DAG에 들어간 직접 이유는?
   - A) 새 public CLI 플래그가 필요해서
   - B) Graphify 인덱스를 다시 만들려고
   - C) `npm run ci` eslint가 unused `soloStatus`와 unused `fx`로 실패해서

4. repair wave 1 이후 004·005 의존은?
   - A) 005는 003에, 004는 005에 의존한다
   - B) 004는 여전히 001·002·003에만 의존한다
   - C) 005가 003을 대체하고 004는 001에만 의존한다

5. TASKS-006(review must_fix)이 고친 파일은?
   - A) `skills/bouncer-finalize/SKILL.md`만
   - B) `scripts/src/lib/coordinator.ts`만
   - C) `scripts/src/lib/finalize-release-main.ts`와 `test/finalize-release-main.test.js`

## 이해 상태

`quiz_score` 4/5. range `ba6c9caca26068a9fe5e5ee53de5723a6b2222c8`..`0105235d864fcf6886ae0c4d7521c0a8827d6f8b`, `diff_sha` `5849f9d8dc9666ffb77a6538c8cae6799ed68a16376936956cf5a8aaba6ccba8`.

정답: 1B, 2A, 3C, 4A, 5C. 응답: 1B 맞음, 2A 맞음, 3C 맞음, 4C 틀림, 5C 맞음. Q4 정답은 005→003, 004→005이다. 점수는 기록만 하고 마감을 막지 않는다.

## Tasks

### EPIC-084/BP-001/TASK-001 · `552fbf50`

#### Goal & intent

메인 checkout에서 `bouncer finalize release-main --blueprint <bp>`를 실행하면 닫힌 blueprint 트리의 메인 사본이 정리되고, 그 뒤 integration 브랜치를 `git merge`해도 overwrite가 나지 않는다. 결과 JSON은 메인 기준 같은 epic의 다음 ready blueprint를 `next`로 돌려준다. 수용 기준은 epic 성공 기준 1–4와 7의 CLI 부분이다. task 검증은 `npm test`, 전체 CI는 TASKS-004가 맡는다.

#### Current behavior

- 메인 사본을 만지는 명령은 `coordinate release` 하나다(`scripts/src/lib/coordinator.ts:1966-1973` 메인 cwd 판정, `:2023-2037` 판정과 `releaseSeedManifest` 호출). fence 명령이라 `--ledger-path`/`--ledger-hash`가 없으면 core에 닿기 전에 `ledger-checkpoint-invalid`로 거절된다(`scripts/src/lib/cli-git-commands.ts:298-305`).
- finalize 스킬은 fence 없이 `bouncer coordinate release --blueprint <bp> --repo <main>`을 호출한다(`skills/bouncer-finalize/references/cleanup-handoff.md:12`). 그래서 083-002 마감 때 메인 파일이 하나도 지워지지 않았고, 이어진 worktree 제거로 원장과 `seedManifest`가 사라져 재시도도 못 했다.
- `releaseSeedManifest`(`scripts/src/lib/seed-worktree.ts:384-439`)는 메인 사본이 manifest와 해시가 같을 때만 되돌린다.
  - 메인 사본이 시드 이후 그대로면 지우거나 `HEAD`로 복원한다. integration 쪽에서만 문서를 고친 경우가 여기에 해당한다.
  - 메인 사본을 drive 중에 고쳤으면 `preserved`로 남긴다.
- `finalize --yes` payload의 `next`는 `nextBlueprint({ repoRoot })`(`scripts/src/lib/current.ts:1085-1169`)가 finalize를 실행한 checkout, 즉 integration worktree의 context 트리만 읽어 만든다(`scripts/src/lib/finalize.ts:1064-1070`, `:1272`). 메인에만 있는 sibling(083-003)은 보이지 않았다.
- `cmdFinalize`(`scripts/src/lib/cli-git-commands.ts:56-104`)는 `prepare`·`links`·기본(`--yes`) 세 갈래만 안다.
- 재현: `test/coordinator-e2e.test.js:549` "release after a drive finalize lets main merge the integration branch without a plan conflict"가 fence를 자동으로 붙이는 래퍼로 release를 부른다.

#### Target behavior

- 성공:
  - 메인 cwd(`--repo` 생략 또는 메인 루트)에서 닫힌 blueprint에 대해 실행하면, `<bp>/` 아래 미추적 파일과 staged 신규 파일(HEAD에 없음)을 unstage 후 지우고 `removed`에 담는다. 비워진 하위 디렉터리와 blueprint 디렉터리도 지운다. 상한은 부모 `blueprints/`다.
  - `<bp>/` 아래 tracked 파일 중 작업 트리가 `HEAD`와 다른 것은 `HEAD`로 복원해 `restored`에 담는다. `HEAD`와 같은 tracked 파일은 그대로 둔다.
  - 원장이 있으면 `seedManifest` 중 epic `index.md`·`.bouncer/context/index.md` 항목만 골라 `releaseSeedManifest`에 넘기고, 그 결과의 `restored`·`released`(→ `removed`)·`preserved`를 합친다. `seedManifest`가 배열이 아니면 두 index 경로를 `preserved`에 담고 파일은 건드리지 않는다.
  - 원장이 없고 메인에 blueprint 디렉터리도 없으면 닫힘 판정을 건너뛰고 `removed: []`로 성공한다. worktree 제거 뒤 재실행이 이 경우다.
  - 정리 뒤 메인 checkout을 `repoRoot`로 `nextBlueprint`를 불러 `sameEpic`인 첫 후보를 `next: { blueprint }`로, 없으면 `null`로 돌려준다.
- 실패: 아래 거절은 모두 JSON `{ ok: false, reason }`과 exit 1이며 파일을 바꾸지 않는다.
  - 실제 cwd나 `--repo`의 realpath가 메인 루트(`runtimePaths().projectRoot`)와 다르면 `release-main-requires-main-checkout`.
  - blueprint 인자가 `.bouncer/context/epics/<epic>/blueprints/<bp>` 정규형이 아니면 `invalid-blueprint-path`.
  - 원장 조회가 `unreadable-ledger`면 `coordinator-ledger`. `no-ledger`·`no-git`·`no-coordinator-paths`는 원장 없음으로 본다. 원장이 `awaiting_confirmation`·`partial_closed`이거나 `integrated`가 아닌 task가 있으면 `drive-not-closed`.
  - 닫힘 근거가 없으면 `blueprint-not-closed`. 근거는 원장이 있으면 integration 사본, 없으면 `worktreePathFor` 단독 worktree 사본, 그것도 없으면 메인 `HEAD:<bp>/index.md`의 `status: closed`다.
- 보존: sibling blueprint 디렉터리, 수정되지 않은 tracked 파일, epic·context `index.md` 외 공유 파일, source, 원장은 바뀌지 않는다. worktree가 남아 있는 동안 다시 실행하면 같은 결과로 수렴한다. `--blueprint` 누락은 exit 2다.

#### Interface

- 제공:
  - CLI `bouncer finalize release-main --blueprint <dir> [--repo <main>]`. stdout은 JSON 한 덩어리다(`finalize prepare`와 같은 `JSON.stringify(result, null, 2)`).
  - 성공 payload `{ ok: true, blueprint, removed: string[], restored: string[], preserved: string[], next: { blueprint: string } | null }`. 배열은 저장소 상대 POSIX 경로이고 정렬돼 있다.
  - 모듈 함수 `releaseMain({ repoRoot, cwd, blueprintDir, deps? })`. `deps`는 테스트 seam이고 기본값은 기존 함수다.
    - `deps.runtimePaths({ repoRoot }) → { projectRoot: string }` — 메인 루트 판정 (`runtime-state.ts`)
    - `deps.readCoordinatorLedger({ repoRoot, blueprint }) → { ok: true, ledger, integrationPath } | { ok: false, reason: 'no-ledger' | 'unreadable-ledger' | 'no-git' | 'no-coordinator-paths' }` — `scope.ts`의 기존 함수. 원장 경로는 Git common dir 기준 `coordinatorPathsFor`로 정해지므로 메인 cwd에서도 integration 원장을 찾는다
    - `deps.nextBlueprint({ repoRoot, blueprintDir }) → { next: { blueprint, sameEpic } | null, remaining: Array<{ blueprint, sameEpic }> }` — `current.ts`. `next`가 `sameEpic`이 아니면 `remaining`에서 첫 `sameEpic` 항목을 고른다
    - `deps.worktreePathFor({ repoRoot, blueprint }) → string` — 단독 execute worktree 경로 (`runtime-state.ts`). `GIT_REQUIRED` throw는 잡아서 단독 worktree 없음으로 본다
    - `deps.git(args: string[]) → string` — 메인 루트 cwd의 git argv 호출
  - finalize usage에 `finalize   release-main --blueprint <dir>` 줄과 "Run from the main checkout after finalize --yes; removes the closed blueprint's main plan copies." 설명을 추가한다.
- 거부:
  - `releaseMain`은 즉시 throw하지 않는다. 모든 입력 오류는 위 `reason` 목록 중 하나의 JSON으로 돌려준다.
  - `--blueprint` 누락은 `releaseMain`에 닿기 전 CLI 사용법 오류(exit 2)다. 이것만 JSON이 아니다.
  - `--repo`가 문자열이 아니면(boolean `true`) cwd를 쓴다. `finalize prepare`와 같은 규칙이다.
  - 정의: "정규형 blueprint 경로" = `path.posix.normalize`한 값이 자기 자신과 같고 `..`·절대 경로가 없으며 `/^\.bouncer\/context\/epics\/[^/]+\/blueprints\/[^/]+$/`에 맞는 값. 예: `.bouncer/context/epics/084-drive-plan-copy-hygiene/blueprints/001-finalize-main-release`.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/finalize-release-main.ts` | `releaseMain` | Create | 없음 | 메인 cwd 판정, 닫힘 판정, blueprint 트리 정리, index manifest 판정, 같은 epic `next` 계산 | 새 계약의 진입점. finalize.ts는 integration checkout 전용이라 섞지 않는다 |
| `scripts/src/lib/cli-git-commands.ts` | `cmdFinalize`, `finalize.usage` | Modify | finalize 세 갈래 분기와 usage | `release-main` 갈래와 usage 줄 추가 | CLI 진입 |
| `test/finalize-release-main.test.js` | 신규 추출 지점: release-main 단위 테스트 | Create | 없음 | 성공·거절·보존·멱등·`next` 케이스 | 수용 기준 2–4, 7 |
| `test/coordinator-e2e.test.js` | 신규 추출 지점: release-main merge e2e | Modify | release 후 merge e2e(:549) | 같은 시나리오를 `finalize release-main`으로 실행하는 e2e 추가. 기존 release 테스트는 TASKS-002가 지운다 | 수용 기준 1 |
| `test/cli-help.test.js` | `usage lists finalize prepare --blueprint` | Modify | finalize usage 줄 고정 | `finalize\s+release-main --blueprint <dir>` 단언 추가 | usage 계약 |

#### Constraints

- 메인 쓰기는 모든 판정이 끝난 뒤 한 번에 한다. 어떤 거절도 파일·index·원장을 바꾸지 않는다.
- git 호출은 `execFileSync` argv 배열로만 한다. 셸 문자열을 쓰지 않는다.
- 원장은 읽기만 한다. fence(`--ledger-path`/`--ledger-hash`)를 요구하지 않는다.
- 공개 문자열(usage, reason)은 영어 기존 형식을 따르고 코드 주석은 한국어다.

### EPIC-084/BP-001/TASK-002 · `fed8cc2f`

#### Goal & intent

`bouncer coordinate release`를 없애 메인 사본 정리 경로를 `finalize release-main` 하나로 만든다. 호출하면 기존 unknown command 경로로 exit 2가 나고, usage·`rules/cli.md`에 이름이 남지 않는다. 수용 기준은 epic 성공 기준 5의 CLI·규칙 부분이다. task 검증은 `npm test`, 전체 CI는 TASKS-004가 맡는다.

#### Current behavior

- `cmdCoordinate`(`scripts/src/lib/cli-git-commands.ts:237`)의 `commands`(275-278)와 `fencedCommands`(281-284), unknown command 메시지(285-290), usage(502-505)에 `release`가 있다.
- `scripts/src/lib/coordinator.ts`의 `LEDGER_FENCED_COMMANDS`(42-45)에 `release`가 있다. `coordinate()`는 1966-1973에서 메인 cwd를 판정하고 2023-2037에서 `releaseSeedManifest`를 부른다. import는 12행이다.
- 실패 힌트 `blueprint-not-closed`(2596), `drive-not-closed`(2654), `missing-seed-manifest`(2719), `release-requires-main-checkout`(2769)는 release 분기만 돌려준다.
- `test/coordinator.test.js:72` "COORDINATE_FAILURE_HINTS covers every coordinator reason literal"은 `coordinator.ts`의 reason 리터럴마다 힌트가 있는지 본다. 리터럴과 힌트를 함께 지워야 통과한다.
- `rules/cli.md:50`의 coordinate 명령 목록과 `:59` 설명에 `release`가 있다.
- 테스트: `test/cli-coordinate.test.js:472`(release payload·거절), `:510`(usage에 release), `test/coordinator-e2e.test.js:549`(release 후 merge).

#### Target behavior

- 성공: `coordinate release --blueprint <bp>`는 `coordinate: command must be bootstrap, prepare, ready, dispatch, report, record, rerecord, integrate, status, revise, repair, partial-close, critical-recovery, or revoke`를 stderr에 쓰고 exit 2로 끝난다. usage에 `coordinate release` 줄이 없다.
- 실패: 없음. 다른 coordinate 명령의 동작·reason·exit code는 그대로다.
- 보존: 원장 `seedManifest` 필드와 `validateCoordinatorLedger`의 shape 검사(`scripts/src/lib/runtime-state.ts:272-277`), `releaseSeedManifest` export는 남는다. TASKS-001의 `release-main`이 쓴다. bootstrap은 계속 `seedManifest`를 기록한다.

#### Interface

- 제공: `coordinate` 허용 명령은 `bootstrap, prepare, ready, dispatch, report, record, rerecord, integrate, status, revise, repair, partial-close, critical-recovery, revoke`다.
- 거부: `coordinate release`는 usage 오류(exit 2)다. JSON 거절은 없다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinator.ts` | `LEDGER_FENCED_COMMANDS`, `coordinate`, `COORDINATE_FAILURE_HINTS` | Modify | release 판정·실행과 전용 힌트 | release 분기 두 곳, fence 목록 항목, 전용 힌트 4개, `releaseSeedManifest` import 제거 | 명령 제거의 본체 |
| `scripts/src/lib/cli-git-commands.ts` | `cmdCoordinate`, `coordinate.usage` | Modify | release 허용·fence·usage | 목록·메시지·usage에서 release 제거 | CLI 표면 |
| `rules/cli.md` | coordinate 명령 목록 | Modify | release 나열 | release 제거, `finalize release-main`을 finalize 명령 줄에 추가 | 규칙 문서와 CLI 일치 |
| `test/cli-coordinate.test.js` | `coordinate release prints its payload…`, `coordinate usage lists release…` | Modify | release 계약 고정 | 두 테스트를 "release는 exit 2, usage에 없음" 단언으로 교체 | 수용 기준 5 |
| `test/coordinator-e2e.test.js` | `release after a drive finalize lets main merge…` | Modify | release e2e | 이 테스트 삭제(같은 시나리오는 TASKS-001의 release-main e2e가 덮음) | 죽은 명령 테스트 제거 |

#### Constraints

- 테스트 헬퍼의 `__FENCED` 복제 목록(`test/commit-hook.test.js:460` 등 12곳)은 건드리지 않는다. 명령이 없어지면 쓰이지 않는 이름일 뿐이고 epic Out of scope다.
- 남는 coordinate 명령의 순서·메시지 문구는 release만 빼고 그대로 둔다.

### EPIC-084/BP-001/TASK-003 · `f79ea8e2`

#### Goal & intent

`/bouncer-finalize`는 `finalize --yes`를 하면 worktree를 항상 지운다. cleanup은 메인에서 `finalize release-main`을 먼저 실행하고, 성공해야 `git worktree remove --force`로 넘어간다. 그 결과의 `next`로 질문 없이 `bouncer current --set`을 실행한다. 수용 기준은 epic 성공 기준 5의 스킬 부분, 6, 7이다. task 검증은 `npm test`, 전체 CI는 TASKS-004가 맡는다.

#### Current behavior

- `skills/bouncer-finalize/SKILL.md:65-81`의 `finalize.remainder`는 A) 커밋+worktree 제거, B) 커밋만·worktree 유지, C) 수정, D) 취소다. 4단계(:91)는 A/B 선택을 따른다.
- 5단계(:93-99)와 ACQ 색인(:111-114)에 `finalize.next_blueprint`가 있고, "confirm-then-`current --set`, never automatic"이라고 적혀 있다.
- `skills/bouncer-finalize/references/cleanup-handoff.md`:
  - :10 — dirty-tree 경고 ACQ 뒤에만 `--force`를 붙인다.
  - :12 — fence 없는 `bouncer coordinate release`를 worktree 제거 전에 실행한다. 이 호출은 늘 `ledger-checkpoint-invalid`로 거절됐다.
  - :23-25 — `next.next`·`sameEpicPending`을 보고 `finalize.next_blueprint` ACQ를 연다.
- `rules/current-pointer.md:46-49`는 "every next-blueprint handoff require[s] their own user confirmation … never automatic"이라고 하고, :61-66은 drive 예외가 "never authorize a next-blueprint move"라고 한다.
- `docs/workflow.md:22`는 main checkout 아래를 바꾸는 명령이 `coordinate bootstrap`과 `prepare`뿐이라고 적는다.
- 테스트 고정:
  - `test/acq-gate-ids.test.js:13-21` CATALOG에 `'bouncer-finalize': ['finalize.remainder', 'finalize.pr', 'finalize.next_blueprint']`가 있다.
  - `test/skill-bouncer-finalize.test.js`:
    - :105-150 — confirm 후 `--set`, `next.next`, `sameEpicPending`, never automatic을 고정한다.
    - :263-292 — `bouncer coordinate release`가 `git worktree remove`보다 앞서는지와 관련 문구를 고정한다.
  - `test/master-rules.test.js:555`, `:824`와 `test/workflow-safety-canon.test.js:133`은 `rules/current-pointer.md`에 `confirm-then-set`이 남아 있기를 요구한다.

#### Target behavior

- 성공:
  - `finalize.remainder`는 A) `finalize --yes` 커밋 후 worktree 제거(Recommended), C) 수정·재확인, D) 취소 세 개다. 기존 C·D 글자는 유지하고 B만 없앤다. worktree 유지는 고를 수 없다.
  - 4단계 cleanup은 메인 worktree에서 `bouncer finalize release-main --blueprint <pointer.blueprint>`를 먼저 실행한다. `ok: true`이면 `removed`·`restored`·`preserved`를 보고한다. 그다음 payload `worktrees`의 worker부터 integration 순으로 `git worktree remove --force`를 실행한다. dirty-tree 경고 질문은 없다.
  - 5단계는 `release-main`의 `next`가 non-null이면 메인 worktree cwd에서 `bouncer current --set <next.blueprint>`를 질문 없이 실행하고 결과를 알린다. pointer key는 위치 기준이라 base checkout인 메인에서 설정해야 다음 `/bouncer-run`이 그대로 읽는다.
- 실패:
  - `release-main`이 `ok: false`이면 `reason`을 보고한다. 그 경우 worktree·원장을 지우지 않고, 5단계 `--set`도 하지 않는다.
  - `--set`이 plan gate로 거절되면 pointer는 빈 채로 두고 실패 코드를 알린다. 다른 후보는 시도하지 않는다.
  - `next`가 `null`이면 pointer를 비웠다고 알리고 `/bouncer-plan`을 안내한다.
- 보존:
  - `partial_closed`·blocked·열린 task·검증 안 된 head일 때 inventory 전체를 보존하는 규칙은 그대로다. `release-main`이 `drive-not-closed`로 거절하므로 같은 결과가 된다.
  - 계획 승인 뒤 최초 `--set`과 `/bouncer-commit` 다음 task의 confirm-then-set은 그대로다.

#### Interface

- 제공:
  - ACQ 색인은 `finalize.remainder`, `finalize.pr` 두 개다.
  - `rules/current-pointer.md`에 영어로 예외를 적는다: "The finalize next-blueprint handoff runs `--set` without asking, only for the same-epic `next` returned by `bouncer finalize release-main`; a plan-gate refusal leaves the pointer cleared and is reported."
  - `docs/workflow.md`에 `finalize release-main`을 메인 checkout을 바꾸는 명령으로 추가한다.
- 거부: 스킬은 `release-main` 거절 뒤 worktree 제거, `next` 외 blueprint로의 `--set`, `next.next`·`sameEpicPending` 기반 ACQ를 하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-finalize/SKILL.md` | cwd contract, Step 2 `finalize.remainder`, Step 4, Step 5, ACQ index | Modify | 유지 선택지·다음 blueprint ACQ | B 제거, release-main→강제 제거, 자동 `--set`, 색인에서 `finalize.next_blueprint` 제거 | 스킬 진입 문서 |
| `skills/bouncer-finalize/references/cleanup-handoff.md` | Drive release 절, 제거 절, next handoff 절 | Modify | fence 없는 release, dirty-tree ACQ, next ACQ | release-main 절차와 거절 시 보존, `--force` 고정, 자동 `--set` | cleanup 정본 |
| `rules/current-pointer.md` | `## Moves and clears`, 다음 task 절 | Modify | 모든 next-blueprint handoff에 확인 요구 | :49-50 "every next-blueprint handoff require their own user confirmation … never automatic"를 "initial setup after plan approval requires confirmation; the finalize next-blueprint handoff follows the exception below"로 바꾸고, :66 "These exceptions never authorize a next-blueprint move"는 coordinator 예외에 한정해 finalize 예외를 가리킨다. `confirm-then-set` 문구는 다른 경로용으로 유지 | pointer 규칙이 스스로 모순되지 않게 |
| `docs/workflow.md` | main worktree 행 | Modify | main 변경 명령 두 개 나열 | `finalize release-main` 추가 | 사용자 문서 일치 |
| `test/skill-bouncer-finalize.test.js` | :105-150 next handoff 테스트, :263 `cleanup-handoff releases main plan copies…` | Modify | confirm 후 `--set`·coordinate release 문구 고정 | 자동 `--set`·release-main 선행·`--force`·거절 시 보존 단언으로 교체 | 수용 기준 6–7 |
| `test/acq-gate-ids.test.js` | `CATALOG`, `the benchmark evaluator policy answers only catalogued gate IDs`의 `legacy` | Modify | finalize ACQ 세 개, legacy 허용 두 개 | CATALOG에서 `finalize.next_blueprint` 제거, `legacy`에 추가(벤치마크 정책 `benchmarks/configs/ledger-00{1..4}-evaluator-policy.json`이 아직 답한다) | 색인 계약과 벤치마크 호환 |
| `CHANGELOG.md` | `## [Unreleased]` | Modify | 미출시 변경 목록 | `release-main` 추가, `coordinate release` 제거, finalize 강제 제거·자동 `--set` 항목 | 프로젝트 규칙 |

#### Constraints

- SKILL.md는 번호 단계 5개를 유지한다(`test/skill-bouncer-finalize.test.js:233-245`).
- `rules/current-pointer.md`에서 `confirm-then-set` 문구를 지우지 않는다.
- 스킬 본문은 영어 기존 문체를 따르고 CHANGELOG는 한국어 굵은 제목 bullet 형식을 따른다.
- 문서 구조는 `npm run lint:docs`(`scripts/check-doc-shape.js`)를 통과해야 한다.

### EPIC-084/BP-001/TASK-004

#### Goal & intent

release-main 추가, coordinate release 제거, finalize 스킬 개정이 모두 통합된 head에서 전체 CI(테스트 커버리지, lint, 문서 형태, context 주석 lint, typecheck, audit)가 통과함을 증명한다. epic 성공 기준 11의 BP-001 몫이다.

#### Interface

- 제공: 선행 task가 모두 통합된 상태에서 verify 명령이 남기는 종단 검증 증적.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.

### EPIC-084/BP-001/TASK-005 · `4ea4c12d`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `scripts/src/lib/finalize-release-main.ts` — 기록된 CI 실패를 복구한다.
- Modify `test/finalize-release-main.test.js` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.

### EPIC-084/BP-001/TASK-006 · `0105235d`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `scripts/src/lib/finalize-release-main.ts` — 기록된 CI 실패를 복구한다.
- Modify `test/finalize-release-main.test.js` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.