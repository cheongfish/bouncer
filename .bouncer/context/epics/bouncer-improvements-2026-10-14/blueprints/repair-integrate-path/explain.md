---
type: bouncer.explain
title: 003 explain
description: Explain for 003
resource: .bouncer/context/epics/bouncer-improvements-2026-10-14/blueprints/repair-integrate-path/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-14T14:04:53.998+09:00'
bouncer:
  id: EXPLAIN-repair-integrate-path
  epic_id: bouncer-improvements-2026-10-14
  blueprint_id: repair-integrate-path
  status: published
  comprehension:
    - range_from: b5636f6ffb2e9694b44d63d2c2464028ba8218a2
      range_to: 375254cef76506f06637facb71bfed90607f3105
      diff_sha: db037315a738ade6c63486271bdb51f87a22008de180c976fb9994ce49d5d7d0
      recorded_at: '2026-10-14T14:10:00.000+09:00'
  task_commits:
    - task: bouncer-improvements-2026-10-14/repair-integrate-path/001
      sha: d67d5722
      intent_anchor: task-001
    - task: bouncer-improvements-2026-10-14/repair-integrate-path/002
      sha: 375254ce
      intent_anchor: task-002
---
# Explain

## Background

검증이 실패하면 `coordinate repair`가 수리용 task 문서를 만든다. 이 문서는 통합 checkout에 untracked로 쓰이고, 수리 wave를 `coordinate integrate`로 합칠 때 비로소 worker 증적으로 덮어써진다. 그런데 integrate는 미커밋 경로를 "seed manifest + 이미 integrated된 task 증적"으로만 허용했다. 그래서 수리 task 문서 자체가 `integration-source-mutated`로 거절되어, 수리 wave가 CLI 안에서 끝나지 않았다.

`run preflight`는 `--blueprint` 값과 포인터의 blueprint를 비교할 때 원본 문자열에서 epic/blueprint id만 뽑아 비교했다. `<포인터 bp>/../<다른 bp>`처럼 id는 같지만 실제로는 다른 문서를 가리키는 입력이 통과할 수 있었고, repo 안 symlink가 repo 밖 blueprint를 가리키는 경우도 걸러내지 못했다.

## Intuition

출입 명부에 "수리팀이 놓고 간 서류"를 적어 두는 일이다. 수리팀 서류는 들어올 때부터 허용하되, 그 밖의 파일은 여전히 막는다. 포인터 비교는 주소를 글자 그대로 읽던 것을 실제로 도착하는 곳까지 따라가 확인하는 것으로 바꿨다.

## Code

- `scripts/src/lib/coordinator.ts` — `disallowedDirtyPaths`: `task.status`가 `integrated`가 아니어도 `task.dynamic === true`이면 그 task의 증적 파일 경로를 허용한다. 허용은 파일 단위이며 `tasks/<id>/` 디렉터리 prefix는 허용하지 않는다. coordinator가 직접 고친 소스가 섞여 들어와도 통과하는 것을 막기 위해서다. `integration-source-mutated` 힌트 문구도 repair task 증적을 포함하도록 바꿨다.
- `scripts/src/lib/run-preflight.ts` — `normalizeBlueprintPath`가 요청과 포인터를 같은 규칙(repoRoot 기준 해석, `./`·`..`·끝 슬래시 제거)으로 정규화해 문자열로 비교한다. `isOutsideRepo`는 정규화 결과가 repo 밖이면 거절하고, `resolvesOutsideRepo`는 요청 경로가 실재할 때 realpath로 symlink를 풀어 repo 밖으로 나가는지 본다.
- 설계 선택·한계: realpath 오류 중 ENOENT·ENOTDIR만 "실재하지 않음"으로 보고 나머지(ELOOP, EACCES)는 다시 던져 fail-closed로 둔다. repo 안에서 다른 blueprint로 향하는 symlink는 경계만 보므로 통과한다.
- 검증은 `npm run ci`이며 증적은 digest의 `evidence.verification`, 리뷰는 `evidence.review`를 따른다. 문서화는 `rules/cli.md`, `CHANGELOG.md`에 있다.

## Quiz

1. `coordinate repair`가 만든 수리 task의 증적 문서가 통합 checkout에 untracked로 있을 때 `coordinate integrate`는 어떻게 동작하는가?
   - A) 여전히 `integration-source-mutated`로 거절한다
   - B) 해당 증적 파일은 허용하고 통합을 진행한다
   - C) 수리 task 디렉터리 전체를 허용한다
2. integrate 시점에 통합 checkout에 coordinator가 직접 고친 소스 파일(허용 목록 밖)이 미커밋으로 남아 있으면?
   - A) 수리 task가 있으면 함께 통과한다
   - B) 경고만 남기고 통과한다
   - C) 여전히 `integration-source-mutated`로 거절한다
3. `run preflight --blueprint <포인터 bp>/../<다른 bp>`처럼 id는 같아 보이지만 정규화하면 다른 경로가 되는 입력은?
   - A) `pointer-mismatch`로 거절한다
   - B) 포인터의 blueprint로 보고 진행한다
   - C) 다른 blueprint를 읽어 위임 가능 여부를 판정한다

## Tasks

### bouncer-improvements-2026-10-14/repair-integrate-path/001 · `d67d5722`

#### Goal & intent

`coordinate repair`로 생긴 task가 다른 task와 같은 경로로 `coordinate integrate`를 통과하고, integration의 `tasks.md`가 `verified`가 되게 한다. 수용 기준은 epic 성공 기준 14–16이고 검증 명령은 `npm run ci`이다.

#### Current behavior

- `writeRepairDocuments`(`scripts/src/lib/coordinator.ts:1159`)가 integration checkout에 `tasks/<id>/tasks.md`·`verification.md`(구형 리뷰 모드면 `review.md`도)를 untracked로 쓴다. repair task는 원장에 `dynamic: true`로 들어간다(`:3517`, `:3575`; 타입 `:102`).
- `disallowedDirtyPaths`(`:2573-2600`)는 `git status --porcelain --untracked-files=all`의 경로 중 `ledger.seedManifest` 경로와 `status === 'integrated'` task의 `evidenceFiles(reviewMode)` 경로(`:2581-2586`)만 허용한다. 유일한 호출부는 integrate phase 1(`:2806-2807`)이고, 아직 integrated가 아닌 repair task 문서가 남아 `integration-source-mutated`로 거절된다.
- fan-in seed(`seedCoordinatorWorker`, `scripts/src/lib/seed-worktree.ts:388`)는 integration의 blueprint 트리 전체를 복사하므로 repair 문서는 후보 worktree로 넘어간다. 통합 직전 `copyEvidenceBundle`(`:1593`, 호출 `:3073`)이 worker 증적을 integration에 덮어써 `tasks.md`가 `verified`가 된다. worker 커밋은 소스 경로만 담아 cherry-pick이 untracked 문서와 충돌하지 않는다(099/002의 repair 커밋은 소스 2파일만 바꿨다).
- 재현: 099/002 drive에서 repair task 004의 integrate가 `integration-source-mutated`(경로 `tasks/004/tasks.md`, `tasks/004/verification.md`)로 거절되었다.
- 테스트 현황: `test/coordinator.test.js:466-469`·`:483-486`은 repair task를 원장 직접 수정으로 `integrated`로 만들어 이 경로를 거치지 않는다. `integration-source-mutated` 거절은 `:1226-1236`이 단언한다. `test/coordinator-e2e.test.js:510-570`이 uncommitted-plan → integrate → finalize dry-run 템플릿이다(`commitInWorker` `:151`, `writeTerminalEvidence` `:169`, `acceptDispatchAndRecord` `:205`, `writePlanDoc` `:501`).

#### Target behavior

- 성공: 원장 task 중 `dynamic === true`인 task의 `evidenceFiles(reviewMode)` 경로는 status와 관계없이 허용된다. repair 문서가 integration에 있는 상태로 integrate가 성공하고, 원장 task status가 `integrated`, integration의 `tasks/<id>/tasks.md`가 `status: verified`가 된다. 이어지는 finalize dry-run의 `reason`은 `coordinator-evidence-mismatch`가 아니다.
- 실패: dynamic task 증적 밖 경로(소스 파일, 다른 task 디렉터리, dynamic task 디렉터리 안의 증적 외 파일)의 미커밋 변경은 지금처럼 `integration-source-mutated`이고 원장 바이트가 바뀌지 않는다.
- 보존: seed manifest·원장 schema·`release-main` 동작과 기존 `integrated` task 허용은 그대로다. 오류 카탈로그의 `cause` 문구만 dynamic task 증적을 포함하도록 고친다.

#### Interface

- 제공: `disallowedDirtyPaths`가 허용하는 경로 = seed manifest 경로 ∪ `integrated` task 증적 ∪ `dynamic` task 증적. 증적 경로 shape는 `<blueprint>/tasks/<id>/<name>`, 예 `.bouncer/context/epics/099-x/blueprints/002-y/tasks/004/verification.md`.
- 거부: 위 집합 밖 dirty 경로가 하나라도 있으면 `{ ok: false, reason: 'integration-source-mutated', paths }`를 돌려준다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinator.ts` | `disallowedDirtyPaths`, 오류 카탈로그 `integration-source-mutated` | Modify | integration 미커밋 경로 허용 판정 | dynamic task 증적 허용과 `cause` 문구 갱신 | 거절 지점 `:2581`, 문구 `:4144` |
| `test/coordinator-e2e.test.js` | 신규 추출 지점: repair → integrate → finalize 회귀 테스트 | Modify | uncommitted-plan drive e2e | repair task를 실제 integrate하는 회귀 테스트 추가 | 재사용 helper가 이 파일에 있음 |
| `test/coordinator.test.js` | `integration-source-mutated` 테스트(`:1226`) 인근 | Modify | 거절·원장 불변 단언 | dynamic task 디렉터리의 증적 외 파일은 계속 거절됨을 단언 | 실패 경로 보존 확인 |

#### Constraints

- 코드 주석·docstring은 `references/coding-standards/index.md`의 한국어 계약을 따른다.
- 새 테스트 파일을 만들지 않는다. 기존 파일에 추가해 `test/tiers.json`을 건드리지 않는다.
- 허용은 파일 단위로만 넓힌다. `tasks/<id>/` 디렉터리 prefix 허용은 하지 않는다(코드 주석 `:2562`의 이유).
- `scripts/lib`(빌드 산출물)는 커밋 대상이 아니다. 테스트 전 `npm run build`로 재생성한다.

### bouncer-improvements-2026-10-14/repair-integrate-path/002 · `375254ce`

#### Goal & intent

`bouncer run preflight`가 요청 경로를 먼저 정규화하고 그 결과로 포인터와 비교해, 해석 결과가 다른 blueprint이거나 repo 밖이면 위임하지 않게 한다. 수용 기준은 epic 성공 기준 17이고 검증 명령은 `npm run ci`이다.

#### Current behavior

- `runPreflight`(`scripts/src/lib/run-preflight.ts`)는 `requested = toPosix(blueprintDir)`(`:318`) 뒤 `parsePathIds(requested)`와 `parsePathIds(pointer.blueprint)`의 epic·blueprint id를 비교한다(`:336-345`). 원본 문자열에서 id를 뽑으므로 `<pointer bp>/../003-other`는 id 비교를 통과하고, 정규화하면 다른 blueprint가 된다.
- 그다음 `relative = toPosix(path.relative(repoRoot, path.resolve(repoRoot, requested)))`(`:350`)로 문자열 기준 repo 경계만 본다(`:355-359`). realpath를 쓰지 않아 repo 안 symlink가 밖을 가리켜도 통과한다. `blueprint = path.posix.normalize(relative).replace(/\/$/, '')`(`:360`)가 이후 `readBlueprintMeta`(`:362`), `collectTasks`(`:363`), `coordinatorPathsFor`(`:370`), 출력 `blueprint.dir`(`:400`)에 쓰인다.
- 포인터는 repo 상대 POSIX 문자열이다(`Pointer` `:33-37`, 저장 `scripts/src/lib/current.ts:463`의 `toPosix`). 끝 슬래시 제거는 확인되지 않았다.
- `loadLedger`(`scripts/src/lib/coordinator.ts:530`)는 파일 부재면 null, 손상 JSON이면 throw한다. preflight는 try/catch로 miss 처리하고 문서 status로 판정한다(`:368-381`). 이 경로를 단언하는 테스트는 없다.
- `rules/cli.md:31-34`은 pointer-mismatch 조건을 "the epic or blueprint ids differ or cannot be parsed"로 적고 repo 밖 거절은 적지 않는다. 호출부는 `scripts/src/lib/cli-project-commands.ts:336` 하나다.
- 테스트(`test/run-preflight.test.js`): helper `preflightFor` `:442`, `setBpStatus` `:446`, `writeLedger` `:452`, 상수 `BP_REL` `:13`. pointer-mismatch `:461`·`:477`·`:493`, 경로 형식 `:606`(끝 슬래시·`./`·절대 경로 통과), `:619`(repo 밖 절대), `:633`(`../`), `:646`(repo 안 절대). symlink 테스트는 `test/coordinator.test.js:677` 등에서 `fs.symlinkSync(target, link, 'dir')`를 조건 없이 쓴다.

#### Target behavior

- 성공: 요청 경로와 포인터를 같은 규칙(repo 상대 → `path.posix.normalize` → 끝 슬래시 제거)으로 정규화해 문자열이 같으면 통과한다. 끝 슬래시·`./`·repo 안 절대 경로는 계속 통과한다(`:606`, `:646`).
- 실패:
  - 정규화 결과가 포인터와 다르면 `pointer-mismatch`다. `<pointer bp>/../<같은 epic의 다른 bp>`와 id를 뽑을 수 없는 경로가 여기에 든다.
  - 정규화 결과가 `..`로 시작하거나 절대 경로면 `pointer-mismatch`다(기존 `:619`, `:633` 유지).
  - 요청 경로가 실재하면 `fs.realpathSync`로 요청 경로와 `repoRoot`를 해석해, 요청 realpath가 repo realpath 밖이면 `pointer-mismatch`다. repo 안 symlink가 밖의 같은 id blueprint를 가리키는 경우가 여기에 든다.
- 폴백(miss): 요청 경로가 실재하지 않으면 realpath 검사를 건너뛰고 정규화 비교만 쓴다. 손상된 원장 JSON은 miss로 보고 문서 status로 판정한다(새 테스트로 고정).
- 보존: `pointer-mismatch` payload의 `expected`(포인터 blueprint)·`actual`(요청 원문, `toPosix`만 적용) 의미, 이후 판정 순서와 다른 reason, `parsePathIds` 자체는 그대로다.

#### Interface

- 제공: `pointer-mismatch` 조건 = `normalize(requested) !== normalize(pointer.blueprint)` 또는 정규화 결과가 repo 밖 또는 (요청 경로 실재 시) realpath가 repo realpath 밖. `normalize(p)` shape: repo 상대 POSIX, 끝 슬래시 없음. 예 `./.bouncer/context/epics/001-auth/blueprints/001-login/` → `.bouncer/context/epics/001-auth/blueprints/001-login`.
- 거부: 위 조건이면 `{ ok: false, reason: 'pointer-mismatch', expected: pointer.blueprint, actual: requested }`.
- miss(throw 아님): `realpathSync` 실패(경로 부재 등)는 문자열 판정으로 폴백한다. 원장 파싱 실패는 문서 status 판정으로 폴백한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/run-preflight.ts` | `runPreflight` | Modify | 포인터 비교와 repo 경계 판정 | 정규화 후 문자열 비교, realpath 경계 검사 | 판정 지점 `:336-360` |
| `test/run-preflight.test.js` | 신규 추출 지점: 경로 비교·symlink·손상 원장 테스트 | Modify | preflight 단위 테스트 | `../` 다른 bp, symlink 밖, 손상 원장 테스트 추가 | 기존 helper 재사용 |
| `rules/cli.md` | `run preflight` 거절 순서 문단 | Modify | 거절 순서와 reason 설명 | pointer-mismatch 조건을 정규화·realpath 기준으로 고침 | `:31-34` |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 변경 내역 | 이 blueprint 두 task의 변경 항목 한 개 추가 | 프로젝트 관례 |

#### Constraints

- 코드 주석·docstring은 `references/coding-standards/index.md`의 한국어 계약을 따른다.
- 새 테스트 파일을 만들지 않는다(`test/tiers.json` 등록 불필요).
- 정규화 helper가 필요하면 `run-preflight.ts` 안에 둔다. 새 모듈을 만들지 않는다.
- `rules/cli.md` 본문은 영어, CHANGELOG 항목은 한국어로 쓴다. CHANGELOG 항목은 TASKS-001의 integrate 변경도 함께 적는다.
- `scripts/lib`(빌드 산출물)는 커밋 대상이 아니다.