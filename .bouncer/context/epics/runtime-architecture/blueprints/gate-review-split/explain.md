---
type: bouncer.explain
title: gate-review-split explain
description: Explain for gate-review-split
resource: .bouncer/context/epics/runtime-architecture/blueprints/gate-review-split/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-21T15:55:32.984+09:00'
bouncer:
  id: EXPLAIN-gate-review-split
  epic_id: runtime-architecture
  blueprint_id: gate-review-split
  status: published
  comprehension:
    - range_from: ad467b4a0cd2e14d010cdfffd7c10ba27bb287f8
      range_to: d512f5f36d33cf077bd2eb0fc927a75598b975b0
      diff_sha: e074db6cad0eeec5ad75f11693c75f35a2ca9dc03a29125e3c98d197b306a190
      recorded_at: '2026-10-21T16:00:00+09:00'
  task_commits:
    - task: runtime-architecture/gate-review-split/001
      sha: 353a0fea
      intent_anchor: task-001
    - task: runtime-architecture/gate-review-split/002
      sha: 22b496d6
      intent_anchor: task-002
    - task: runtime-architecture/gate-review-split/003
      sha: d512f5f3
      intent_anchor: task-003
---
# Explain

## Background

`runCheckGate()`가 plan·execute·finalize·commit·partial-close 판정을 한 함수에 모아 두고, `validate-gates.ts`가 그 본문까지 들고 있었다. 컨텍스트 리뷰는 `context-review-state.ts`가 `state.json` 경로와 쓰기 안전, cycle 전이를 같이 알고 있어 전이 함수가 디스크 위치를 직접 짚었다.

이번 변경은 그 경계를 나눈다. `checkGate` export와 G 코드·메시지·순서, 컨텍스트 리뷰 디스크 형식과 거절 reason은 그대로 두고, 단계 판정은 모듈로, 디스크 I/O는 저장 계층으로 옮긴다. 시리즈 전후 실측은 `source-boundaries.md`를 대체하지 않는 inventory로 남긴다.

## Code

`scripts/src/lib/validate-gates.ts`는 객체/위치 인자 `checkGate`와 `runCheckGate`의 단계 선택만 남긴다. `runCheckGate`는 `add`와 `GateStageCtx`를 만든 뒤 `partial-close`·`plan`·`execute`·`finalize`·`commit`에 맞춰 `validate-gates-finalize`/`plan`/`run`을 호출하고, 모르는 이름은 throw한다. `GateStageCtx`에 `failures` 배열을 넣어 execute·commit unit 경로와 G17 직접 push가 같은 누적본을 쓴다. finalize G24 기본 deps `defaultCoordinatorLedgerFor`는 `validate-gates-run`에서 import한다. `docs/architecture/rule-ownership.md`의 GOV-LIGHT-SCALE-READ-SITES consumers 표 행만 `validate-gates.js`에서 `validate-gates-plan.js`로 바꿨다.

`scripts/src/lib/context-review-store.ts`가 경로 안전, `loadState`/`saveState`, `readInputFile`(Buffer), `cycleStateExists`를 맡는다. `cycleStateExists`는 `loadState`의 `isPlainFile`이 아니라 `existsSync`로 존재만 본다. symlink나 손상 파일도 “있음”으로 남겨 전이 거절 순서를 유지한다. `readLegacy`의 `restart_count` 허용값은 store의 `MARKER_VALUES` `{0, 1}`이고, 재시작 한도 `RESTART_LIMIT`는 전이 모듈에 남긴다. `context-review-state.ts`는 store 타입을 import하지 않고 `Fail`·`State` 구조를 로컬로 둔다. `prepareMarker`는 store로 투영 텍스트를 읽은 뒤 `frontmatter.readDoc`으로 같은 파일을 다시 파싱한다.

`docs/architecture/source-boundaries-split.md`와 `docs/architecture/measurements/runtime-architecture-split.json`은 전(`d2af6719`)·후(`22b496d6`) snapshot이다. `runCheckGate()` 줄 수는 416에서 44다. 함수 줄 수는 `scripts/src/lib`를 정렬 순회해 첫 최상위 `function` 선언을 센다.

검증: 001 `1edd657e…`, 002 `2b622167…`, 003 `bf92a4a2…`. 종단 `npm run ci`는 evidence `7939144241…`이며 실패 원인은 승인 범위 밖(`coordinator-commands.ts` / `test/coordinator.test.js`)으로 분류했다. 최종 리뷰 `F-a1eb1d95`(must_fix, `prepareMarker`의 `readDoc`)와 `F-2e6895ee`(advisory, 중복 타입)는 deferred다.

## Quiz

1. `runCheckGate`가 알 수 없는 gate 이름을 받으면 어떻게 되나?
   - A) `failures`에 G 코드를 하나 넣고 반환한다
   - B) `Error`를 throw한다
   - C) `warnings`만 채우고 통과한다

2. `cycleStateExists`가 `state.json`을 어떤 기준으로 보나?
   - A) `loadState`와 같이 `isPlainFile`로 일반 파일만 true다
   - B) symlink면 항상 false다
   - C) `existsSync`로 존재만 보고, symlink·손상 파일도 “있음”이다

3. 컨텍스트 리뷰 `restart_count` 표식 허용값 `{0, 1}`은 어디에 있나?
   - A) 저장 계층 `MARKER_VALUES`
   - B) 전이 모듈 `RESTART_LIMIT`
   - C) `validate-gates-shared`

4. `source-boundaries-split.md`가 하는 일은?
   - A) `source-boundaries.md`를 대체하는 소스 규칙 정본이다
   - B) 시리즈 전후 snapshot inventory이며 정본을 대체하지 않는다
   - C) `scripts/measure-source-boundaries.js`를 이 변경에서 고친 기록이다

## Tasks

### runtime-architecture/gate-review-split/001 · `353a0fea`

#### Goal & intent

`scripts/src/lib/validate-gates.ts`의 `runCheckGate()`(계획 시점 `:1158-1574`)를 gate 단계 모듈로 나눈다. `validate-gates`는 `checkGate`·`runCheckGate`의 단계 선택과 기존 export만 남긴다. G 코드·메시지·순서는 바뀌지 않는다. 수용 기준은 epic 성공 기준 5(`runCheckGate()` 본체 위임·60줄 이하)·7이고, 검증 명령은 frontmatter `bouncer.verify`다.

#### Current behavior

- `runCheckGate`: 공유 클로저 `:1165-1169`(`add`가 `{code, message, file: rels[fileKey]}`를 쌓음, `repoRoot`·`blueprintDir`·`deps`), partial-close `:1171-1175`, plan `:1177-1310`, execute `:1311-1372`, finalize `:1377-1492`, commit `:1495-1571`, 알 수 없는 gate는 throw `:1573`. `checkGate`(`:1063-1089`)가 객체·위치 인자 두 호출 형태를 받아 `runCheckGate`로 넘긴다.
- helper 사용처: partial-close `checkPartialCloseEvidence` `:178`; plan 전용 `checkRegistryGates` `:1104`, `planScaleOf` `:1582`, `planTasksOf` `:1702`, `contextReviewFreshnessFailure` `:1746`(`currentPlanSnapshot` `:1719`), `checkTaskScope` `:1839`(`isSecurityPath` `:1820`, `SECURITY_PATH_TOKENS`), `checkTaskDependencyGraph` `:486`, `checkTaskDagShape` `:391`, `checkTouchPathsExist` `:1626`(`touchPathEscapesRepo` `:1608`), `checkVerificationTaskGraph` `:593`, `checkScopedTerminalPolicy` `:650`; `planScaleOf`·`planTasksOf`는 `checkPlanDraft` `:1932`도 쓴다; execute·commit 공용 `checkG13` `:829`, `checkG24` `:1028`; commit 전용 `checkG23` `:939`; finalize 전용 `checkG21` `:300`; 범용 `gitExec` `:244`(`checkG21`·`checkG23`), `asData` `:197`, `sameCanonical` `:816`, `lastReviewHead` `:268`, `firstStderrLine` `:285`, 기본 deps `:212,776,1002,1009`.
- export `:1961` `{ checkGate, checkPartialCloseEvidence, checkPlanDraft, SECURITY_PATH_TOKENS }`. 소비자는 `validate.ts:30`과 `test/coordinator.test.js:4026`(`checkPlanDraft`).
- I/O 관찰 지점: `gitExec`의 `spawnSync`(`:250`), `checkTouchPathsExist`의 `fs.existsSync`(`:1675`), `defaultReadCoordinatorLedger`의 `readFileSync`(`:216`), plan snapshot 읽기(`:1759,1795`). execute·finalize·commit의 I/O는 `deps`(`coordinatorLedgerFor`, `computeDiffSha`, `exec`, `stagedFiles`)로 주입된다.
- 의존: 상단 import `:2-39`는 하위 모듈뿐이다. `:16` 주석은 finalize가 validate를 require하므로 scope helper가 finalize를 거치지 않는다고 적는다.
- 규칙 소유 문서: `docs/architecture/rule-ownership.md:44` `GOV-LIGHT-SCALE-READ-SITES`의 consumers 열이 plan gate의 scale 읽기 위치로 `scripts/lib/validate-gates.js`를 적는다(owner는 `scaffold.ts`라 바뀌지 않는다).
- 테스트: `test/validate-gates.test.js`가 메시지(`:1284,1291,1740,3881,3932`)와 코드 집합(`:1568-1728`의 `failures.map(code)`)을 고정한다. 파일 경로·크기를 고정한 테스트는 없다.

#### Target behavior

- 성공: 신규 모듈 네 개 — plan gate와 그 전용 helper(+`checkPlanDraft`·`SECURITY_PATH_TOKENS`), execute·commit gate와 공용 `checkG13`·`checkG24`·`checkG23`, finalize·partial-close gate와 `checkG21`·`checkPartialCloseEvidence`, 범용 helper. `runCheckGate`는 `add` 클로저를 만들고 gate 이름으로 단계 함수를 고르며, TypeScript AST로 잰 함수 선언 줄 수가 60 이하다. 기본 deps는 쓰는 gate를 따라간다: `defaultReadVerifyLedger`(G13·G23)·`defaultReadApprovalSnapshot`(G24)·`defaultCoordinatorLedgerFor`(G24)는 execute·commit 모듈, `defaultReadCoordinatorLedger`(G21)는 finalize 모듈. `validate-gates`는 같은 네 이름을 export한다(이동한 것은 재export).
- 실패: 알 수 없는 gate는 지금처럼 throw한다.
- 보존: `test/validate-gates.test.js`의 모든 단언이 수정 없이 통과한다. `validate.ts`와 `coordinator.test.js:4026`의 import가 그대로 동작한다.

#### Interface

- 제공(내부): `신규 추출 지점: gate 단계 함수` — `(ctx: { add, docs, rels, repoRoot, blueprintDir, deps, taskUnit, parseErrors, partialClose, warnings }) => void`. `validate-gates` export는 변경 없음.
- 거부: 새 모듈은 `validate`·`validate-gates`·`finalize`·`review-dispatch`를 import하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/validate-gates.ts` | `runCheckGate`, `checkGate`, export | Modify | 다섯 gate 판정과 helper 전부 | 단계 선택과 재export만 | 진입점 |
| `scripts/src/lib/validate-gates-plan.ts` | 신규 추출 지점: plan gate | Create | 없음 | plan 판정·전용 helper·`checkPlanDraft` | 이동 대상 |
| `scripts/src/lib/validate-gates-run.ts` | 신규 추출 지점: execute·commit gate | Create | 없음 | execute·commit 판정, G13·G23·G24, 기본 deps `defaultReadVerifyLedger`·`defaultReadApprovalSnapshot`·`defaultCoordinatorLedgerFor` | 이동 대상 |
| `scripts/src/lib/validate-gates-finalize.ts` | 신규 추출 지점: finalize·partial-close gate | Create | 없음 | finalize·partial-close 판정, G21, 기본 deps `defaultReadCoordinatorLedger` | 이동 대상 |
| `scripts/src/lib/validate-gates-shared.ts` | 신규 추출 지점: gate 공용 helper | Create | 없음 | `gitExec`·`asData`·`sameCanonical`·`lastReviewHead`·`firstStderrLine` | 공용 |
| `docs/architecture/rule-ownership.md` | `GOV-LIGHT-SCALE-READ-SITES` 행 consumers | Modify | consumers에 `scripts/lib/validate-gates.js` | plan gate scale 읽기 위치인 `scripts/lib/validate-gates-plan.js`로 변경 | 규칙 소비자 기록 |

#### Constraints

- 동작 보존 리팩터다. G 코드·메시지 문자열을 바꾸지 않는다.
- `scripts/src/lib` 순환 0(`test/dependency-boundaries.test.js:16`).

### runtime-architecture/gate-review-split/002 · `22b496d6`

#### Goal & intent

`scripts/src/lib/context-review-state.ts`(1,713줄)에서 저장 계층을 신규 `context-review-store.ts`로 옮긴다. cycle 전이(`startCycle`·`recordReport`·`closeCycle`·`restartCycle`·`routeFollowUp`)와 `context-review.md` 투영 문자열 계산은 `context-review-state`에 남는다. 예외 없이 모든 디스크 읽기·쓰기(state·dispatch·report, 전이 입력 report 파일, `context-review.md` 투영 문서)는 저장 계층 함수로만 한다. 기존 export와 디스크 형식·거절 reason은 바뀌지 않는다. 수용 기준은 epic 성공 기준 5(`context-review-state.ts`의 `fs` 직접 사용 없음)·7이고, 검증 명령은 frontmatter `bouncer.verify`다.

#### Current behavior

- 저장 계층 함수(계획 시점 줄): `walkSafeDir` `:104-125`, `isPlainFile` `:126-147`, `writeAtomic` `:148-182`, `writeImmutable` `:183-197`, `guardWrites` `:198-215`, `resolveInsideRepo` `:216-236`, `loadDispatch` `:251-315`, `withLock` `:330-356`, `openContext` `:357-372`, `loadState` `:385-446`, `saveState` `:447-450`, `cyclePrefix` `:451-455`, `storeDispatch` `:456-465`, `readRef` `:466-493`, `readLegacy` `:526-564`, `readStoredLatest` `:1684-1700`, `readLegacyEvidence` `:1702-1708`. 공용 유틸 `fail` `:83`, `sha256` `:87`, `targetInvalid` `:237`, `isFail` `:316`, `corrupt` `:373`, `transitionKey` `:514`, `oneLine` `:617`. 공용 타입 `:41-81`, 상수 `CYCLE_ID_RE` `:38`, `SHA256_RE` `:39`.
- 전이·투영: `prepareMarker` `:565-608`, `findingLines` `:628`, `rewriteFindingsSection` `:647`, `prepareClosureDoc` `:677-725`, 전이 helper `:494-513,726-904,1308-1598`, 전이 `startCycle` `:813-866`, `recordReport` `:947-1128`, `closeCycle` `:1129-1307`, `restartCycle` `:1403-1549`, `routeFollowUp` `:1598-1683`.
- 전이·투영 쪽의 직접 디스크 접근: `state.json` 존재 확인 `:968`(`recordReport`), `:1161`(`closeCycle`), `:1418`(`restartCycle`); 전이 입력 읽기 `:963`, `:1141`, `:1411`; 투영 문서 읽기·존재 확인 `prepareMarker` `:569,578`, `prepareClosureDoc` `:683,688`; `readReportInput` `:871`.
- I/O 관찰 지점: 읽기 `:254,390,472,578,688,871,963,1141,1411`, symlink·경로 확인 `lstatSync` `:112,129`·`realpathSync` `:217,223,230`, 쓰기 `writeAtomic`의 `wx` 임시 파일 → rename → 실패 시 unlink(`:154-164`), `writeImmutable`의 `wx` 쓰기 후 재대조(`:186-191`), lock `mkdirSync`/`rmdirSync` `:333,344`, `randomBytes`는 `newCycleId` `:798`에서만. 모듈 상태 없음.
- export `:1709-1712`. 소비자: `cli-context-review-command.ts:281`(지연 require, 전이 5개), `review-dispatch.ts:28`(`readStoredLatest` `:460`, `readLegacyEvidence` `:470`), `test/context-review-state.test.js:13`(전체, `writeImmutable` `:981`, `writeAtomic` `:995` 직접 호출).
- 테스트: symlink 거절 `:720-724,960-1000`, `context-review-state-conflict` reason `:228,420,545,775,883,945`. 경로·크기 고정 테스트는 없다.

#### Target behavior

- 성공: `context-review-store`가 위 저장 계층 함수·공용 유틸·공용 타입·상수를 갖고, 위 직접 디스크 접근 지점마다 대응하는 저장 계층 함수(state 존재 확인, 입력 파일 읽기, 투영 문서 읽기·존재 확인)를 제공한다. `context-review-state`는 이를 import하고 같은 9개 이름을 export한다(`readStoredLatest`·`readLegacyEvidence`·`writeAtomic`·`writeImmutable`은 재export). `context-review-state.ts`에는 `node:fs` import와 `fs.` 호출이 하나도 없다.
- 실패: 저장 계층은 `context-review-state`를 import하지 않는다.
- 보존: `test/context-review-state.test.js`의 모든 단언이 수정 없이 통과한다. 디스크 형식, lock 동작, symlink 거절, 임시 파일 정리가 바뀌지 않는다.

#### Interface

- 제공: `context-review-store` — 저장 계층 함수와 `신규 추출 지점: cycle state 존재 확인`. `context-review-state` export는 변경 없음.
- 거부: 저장 계층에 cycle 규칙(재시작 한도, finding 판정)을 두지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/context-review-state.ts` | 저장 계층 함수, 전이·투영의 직접 디스크 접근 지점, export | Modify | 저장과 전이 전부 | 저장 계층 import, 전이·투영 계산만 유지, 재export | 이동 원점 |
| `scripts/src/lib/context-review-store.ts` | 신규 추출 지점: 컨텍스트 리뷰 저장 계층 | Create | 없음 | 저장 계층 정의와 입력·투영 문서 읽기 함수 | 이동 대상 |

#### Constraints

- 동작 보존 리팩터다. reason 문자열을 바꾸지 않는다.
- `cli-context-review-command`의 지연 require 계약을 유지한다(새 모듈을 CLI 정적 import 경로에 넣지 않는다).

### runtime-architecture/gate-review-split/003 · `d512f5f3`

#### Goal & intent

이 시리즈(`cli-help-and-hygiene` → `coordinator-command-split` → `gate-review-split`)의 전후를 실측한다. 전 = `cli-help-and-hygiene` TASKS-001이 `docs/architecture/measurements/source-restructuring.json`의 `after.revision`으로 기록한 커밋, 후 = 이 task worktree의 시작 HEAD(`TASKS-001`·`002` 통합 뒤). 새 inventory 문서에 기준선 표와 같은 행 이름으로 값을 쓰고 비교 JSON을 저장한다. 수용 기준은 epic 성공 기준 6이고 검증 명령은 frontmatter `bouncer.verify`다.

#### Current behavior

- 측정 도구 `scripts/measure-source-boundaries.js`는 `snapshot`(`:195-257`, Node 24 필수 `:197`)과 `check-report`(`:260-264`)를 제공한다. `validateInventory`(`:271-304`)는 문서의 표 행을 첫 칸 이름으로 찾아(`:274-277`) 둘째 칸을 before, 셋째 칸을 after로 대조하고, 같은 이름의 행이 둘 있으면 뒤의 것을 쓴다. 그래서 `docs/architecture/source-boundaries.md`에 표를 하나 더 두면 기존 보고서 검사가 깨진다.
- Node 24는 `~/.nvm/versions/node/v24.22.0/bin/node`에 있고 기본 `node`는 v22.19.0이다.
- 함수 크기·facade·help 적재는 도구가 재지 않는다. 계획 시점 값: `coordinate()` 946줄, `runCheckGate()` 416줄, `cmdCoordinate()` 371줄, `coordinator` export 22개, `finalize --help` 적재 모듈 54개.

#### Target behavior

- 성공: `docs/architecture/source-boundaries-split.md`에 `| 항목 | 전 | 후 | 측정 명령 |` 표가 있고, 기준선 표의 11개 행 이름(`scripts/src/lib/*.ts 모듈 수` … `npm test 소요 시간`)을 그대로 쓰며, 추가 행으로 `coordinate() 줄 수`, `runCheckGate() 줄 수`, `cmdCoordinate() 줄 수`, `coordinator export 키 수`, `finalize --help 적재 모듈 수`를 둔다. 두 전체 SHA와 비교 JSON 경로를 본문에 적는다. `check-report`가 exit 0이다.
- 실패: snapshot이 실패하면 값을 손으로 쓰지 않고 task를 `blocked`로 보고한다.
- 보존: `docs/architecture/source-boundaries.md`와 `source-restructuring.json`은 바꾸지 않는다.

#### Interface

- 제공: `docs/architecture/measurements/runtime-architecture-split.json` = `{ "before": Snapshot, "after": Snapshot }`, `docs/architecture/source-boundaries-split.md`.
- 거부: 두 snapshot의 Node 실행 파일·npm 버전이 다른 비교 JSON은 쓰지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `docs/architecture/source-boundaries-split.md` | 시리즈 전후 표 | Create | 없음 | 실측 표와 측정 커밋 설명 | `check-report --inventory` |
| `docs/architecture/measurements/runtime-architecture-split.json` | `before`·`after` | Create | 없음 | 비교 JSON | `check-report --report` |

#### Constraints

- 두 snapshot은 같은 Node 24 실행 파일과 PATH에서 잰다. 명령마다 PATH 앞에 `~/.nvm/versions/node/v24.22.0/bin`을 둔다.
- 측정 checkout은 task worktree 안의 gitignore 경로 `.bouncer/runtime/measure/`에 `git clone`으로 만든 독립 저장소다. 공유 `.git`에 worktree를 추가하지 않고 task worktree 밖에 쓰지 않으며, 끝나면 디렉터리를 지운다.
- 문서에 `미측정` 문자열을 쓰지 않는다.

### runtime-architecture/gate-review-split/004

#### Goal & intent

세 commit task가 모두 통합된 결과에서 `npm run ci`가 한 번에 통과함을 증명한다. emit 검사·coverage 임계값·unit tier·lint·문서 검사·typecheck·테스트 이름 검사·audit가 모두 통과해야 하며, 이것이 epic 성공 기준 7의 이 blueprint 몫이다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.
