---
type: bouncer.explain
title: composite-gate-output explain
description: Explain for composite-gate-output
resource: .bouncer/context/epics/gates-review/blueprints/composite-gate-output/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-22T16:47:52.269+09:00'
bouncer:
  id: EXPLAIN-composite-gate-output
  epic_id: gates-review
  blueprint_id: composite-gate-output
  status: published
  comprehension:
    - range_from: 67e490da42d8283fba62b8db51c6a12a2c8f835b
      range_to: 61c5e476afd0ff50c4410c71c3d1154137f28972
      diff_sha: fad8d01a50354699f4f7a30cad63808e131ddfb930470ae373c2d7701dea0f3a
      recorded_at: '2026-10-22T16:55:00+09:00'
  task_commits:
    - task: gates-review/composite-gate-output/001
      sha: 01fcfec9
      intent_anchor: task-001
    - task: gates-review/composite-gate-output/002
      sha: 218bbc2a
      intent_anchor: task-002
    - task: gates-review/composite-gate-output/003
      sha: 61c5e476
      intent_anchor: task-003
---
# Explain

## Background

`bouncer validate`가 실패하면 G-code 목록이 그대로 나왔다. 사용자는 코드 16개를 읽고 어느 단계가 막혔는지 직접 추려야 했다. commit, coordinator, commit hook이 경계를 거절할 때도 reason 문자열만 달라서, 같은 종류의 실패가 서로 다른 말로 보였다.

이 변경은 실패를 복합 gate 7개(계획 활성화, 범위 선언, 실행 토폴로지, 검증 증적, 커밋 범위, 신선도·승인, 마감 완결성)로 묶어 먼저 보여 준다. 사용자는 gate 이름, 대상 파일, 복구 행동 하나를 먼저 읽고, 세부 G-code는 `failures[]`에서 확인한다.

## Code

- `scripts/src/lib/composite-gates.ts`: 매핑 표의 단일 출처다. 각 행이 gate id, 한국어 label, G-code 목록, 경계 거절 reason 목록, 기본 `next`를 가진다. 표는 `Object.freeze`로 고정하고, 행 순서가 출력 순서다. `summarizeCompositeGates`는 실패한 gate만 표 순서대로 돌려주고, `codes`와 `targets`는 첫 등장 순서로 중복과 빈 값을 뺀다.
- `scripts/src/lib/validate.ts`: 실패 payload에 `gates[]`를 더한다. S 코드와 표에 없는 코드는 `gates[]`에 들어가지 않고 `failures[]`에만 남는다. `GATE_FAILURE_HINTS`는 그대로다.
- `scripts/src/lib/commit.ts`, `coordinator-commands.ts`, `cli-current-command.ts`, `finalize.ts`: 공개 경계 payload에 `gate` 필드를 붙인다. reason 문자열과 기존 hint 문구는 바꾸지 않는다.
- `scripts/src/lib/commit-hook.ts`: 거절 메시지 맨 앞에 `[<label>] `을 붙인다. `commit blocked: <code>:` 연속 문자열은 기존 정규식이 읽으므로 쪼개지 않는다.
- `rules/output.md`, `rules/cli.md`, `CHANGELOG.md`: 표시 계약과 변경 이력을 적었다.

설계 선택과 한계:
- 새 모듈은 `export =` 대신 named `export {}`를 쓴다. `export type`과 함께 쓰면 tsc TS2309가 나기 때문이다. `require()` 쪽에서는 같은 객체로 보인다.
- gate의 `next`는 그 gate에서 `next`가 비어 있지 않은 첫 실패 항목의 값이다. 그런 항목이 없을 때만 표의 기본 문장을 쓴다. 엄밀한 "첫 실패"와 다르고, 이 차이는 후속 작업으로 남아 있다.
- 매핑하지 않은 운영성 reason(`ledger-locked`, `lease-invalid`, `no-git` 등)과 `finalize`의 `out-of-scope`에는 gate를 붙이지 않는다.
- 미해결 항목: `rules/output.md`의 S10 예시 줄이 G7 문구를 그대로 가져왔다. hook 테스트에는 매핑 없는 code의 무라벨 assertion과 줄 맨 앞 검사가 빠져 있다.

## Quiz

1. `validate`가 G7과 S10 두 개로 실패하면 `gates[]`에는 무엇이 들어가는가?
   - A) 검증 증적 gate와 S10용 gate 두 개
   - B) 검증 증적 gate 하나. S10은 `failures[]`에만 남는다
   - C) `gates[]`는 비고 `failures[]`만 나온다
2. commit hook이 `out-of-scope` 거절 메시지에 gate 라벨을 붙이는 위치는 어디인가?
   - A) 메시지 끝의 `| next:` 뒤
   - B) `commit blocked:`와 code 사이
   - C) 줄 맨 앞
3. 한 gate에 속한 실패가 여러 개인데 첫 번째 실패에는 `next`가 없고 두 번째에는 있다. 그 gate의 `next`는 무엇이 되는가?
   - A) 두 번째 실패의 `next`
   - B) 표의 기본 문장
   - C) 빈 문자열
4. `ledger-locked` 같은 운영성 reason이 거절될 때 `gate` 필드는 어떻게 되는가?
   - A) 가장 가까운 gate가 붙는다
   - B) 붙지 않는다
   - C) `"unknown"`이 붙는다

## Tasks

### gates-review/composite-gate-output/001 · `01fcfec9`

#### Goal & intent

복합 gate 7개의 매핑 표와 요약 함수를 새 모듈 `scripts/src/lib/composite-gates.ts`에 둔다. `validateBlueprint` 결과에는 G-code 실패가 하나 이상일 때만 최상위 `gates[]`를 싣는다. 수용 기준은 epic Success criteria 9·10이고, 검증 명령은 frontmatter `verify`다.

#### Current behavior

- 결과 타입은 `FailureEntry = {code,message,file,next?}`, `ValidateResult = {ok, failures, warnings?}`다(`scripts/src/lib/validate.ts:46-48`).
- `GATE_FAILURE_HINTS`(`validate.ts:54`)는 G13·G20·G23·G24·S32–S37에만 `next`를 둔다. 코드 집합은 `test/validate-hints.test.js:8-11`이 고정한다.
- `withGateFailureHints`(`validate.ts:121-131`)는 `failures`에만 `next`를 병합하고 `ok`·순서·`warnings`는 그대로 둔다.
- `validateBlueprint`의 반환 지점은 모두 `withGateFailureHints`를 거친다(`validate.ts:187,192,204,216,426,434,450,452`). 따라서 한 곳에서 요약을 붙이면 모든 경로에 적용된다.
- `warnings` 키는 배열이 비어 있지 않을 때만 싣는다(`validate.ts:448-450`).
- CLI `cmdValidate`는 결과 전체를 `JSON.stringify`로 출력한다(`scripts/src/lib/cli-doc-commands.ts:31`). 새 키는 CLI 변경 없이 그대로 나온다.
- 성공 결과 전체를 고정하는 테스트가 있다: `deepStrictEqual(res, { ok: true, failures: [] })`(`test/validate-structural.test.js:172,438,636,913,1252,1355`, `test/validate-gates.test.js:1284`). 그래서 `gates`를 항상 실으면 이 테스트들이 깨진다.
- I/O: `validateBlueprint`는 fs를 읽는다(`validate.ts:4-5,286`). 반면 `withGateFailureHints`와 새 요약 함수는 failures 배열만 받는 순수 함수라 직접 단위 테스트할 수 있다(`test/validate-hints.test.js:13` 방식).
- 재현: `npm run build` 뒤 `node --test test/validate-hints.test.js test/cli-validate.test.js`가 현재 통과한다.

#### Target behavior

- 성공: 실패에 G-code가 있으면 결과에 `gates: CompositeGateSummary[]`가 생긴다.
  - 항목 순서는 표 순서를 따른다: `plan-activation` → `scope-declaration` → `execution-topology` → `verification-evidence` → `commit-scope` → `freshness-approval` → `closeout-completeness`.
  - 실패한 gate만 담는다.
  - `next`는 그 gate에 속한 첫 실패 항목의 `next`(hint 적용 뒤)다. 없으면 gate 기본 문장이다.
- 보존:
  - `ok`·`failures[]`(각 항목의 `code`·`message`·`file`·`next`)·`warnings`는 바뀌지 않는다.
  - G 실패가 없으면(S 실패뿐이거나 `ok: true`) `gates` 키 자체가 없다. `warnings`와 같은 방식이다.
- 실패 경로: 표에 없는 G-code는 `gates`에 들어가지 않고 `failures[]`에만 남는다.

#### Interface

- 제공 (`scripts/src/lib/composite-gates.ts`):
  - `COMPOSITE_GATES: ReadonlyArray<{ gate: CompositeGateId; label: string; codes: string[]; reasons: string[]; next: string }>`: frozen 표 7행. `codes`·`reasons`는 blueprint Contract 표와 같다.
  - `compositeGateForCode(code: string): CompositeGateId | null`
  - `compositeGateForReason(reason: string): CompositeGateId | null`
  - `compositeGateLabel(gate: CompositeGateId): string`
  - `summarizeCompositeGates(failures: FailureEntry[]): CompositeGateSummary[]`
- 제공 (`validate.ts`):
  - `withGateFailureHints`가 hint 병합 뒤 `summarizeCompositeGates` 결과가 비어 있지 않을 때만 `gates`를 싣는다.
  - `ValidateResult`에 `gates?: CompositeGateSummary[]`를 추가한다.
- 거부:
  - `compositeGateForCode('S10')`, `compositeGateForCode('G99')`는 `null`이다.
  - `compositeGateForReason('ledger-locked')`는 `null`이다.
  - `summarizeCompositeGates([])`와 S 실패만 담은 배열은 `[]`다.
  - throw 입력은 없다. 문자열이 아닌 `code`는 매핑 없음으로 본다.
- 용어: `CompositeGateSummary`의 shape는 blueprint Contract를 따른다. 예: `{ gate: 'verification-evidence', label: '검증 증적', codes: ['G7','G13'], targets: ['…/tasks/001/verification.md'], next: 'Rerun this checkout's …' }`.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/composite-gates.ts` | `신규 추출 지점: 복합 gate 표·요약` | Create | 없음 | 표 7행, 코드·reason 조회, 요약 함수 | 소비자 3곳(validate·commit·coordinator)이 같은 표를 쓰도록 단일 출처를 둠 |
| `scripts/src/lib/validate.ts` | `withGateFailureHints`, `ValidateResult` | Modify | hint `next` 병합 | 병합 뒤 비어 있지 않은 `gates` 부착, 타입 확장 | 모든 반환 지점이 이 함수를 거침(`validate.ts:187-452`) |
| `test/composite-gates.test.js` | 신규 | Create | 없음 | 표·조회·요약 단위 테스트 | 순수 함수 검증 |
| `test/validate-hints.test.js` | `withGateFailureHints` 테스트 | Modify | hint 병합 검증 | `gates` 부착·생략 검증 추가 | 기존 hint 테스트 파일이 이 함수의 계약을 소유함 |
| `test/cli-validate.test.js` | CLI 출력 테스트 | Modify | `parsed.failures` 검증 | G 실패 fixture에서 `parsed.gates` 검증 추가 | CLI가 새 키를 그대로 내보내는지 확인(`cli-doc-commands.ts:31`) |
| `test/tiers.json` | `unit` 배열 | Modify | 테스트 계층 등록 | `composite-gates.test.js`를 `unit`에 등록 | 미등록 시 CI가 실패함(SESSION-BLOCKERS §3) |

#### Constraints

- `GATE_FAILURE_HINTS`의 행과 `match`는 바꾸지 않는다. hint 코드 집합 테스트(`validate-hints.test.js:8-11`)를 유지한다.
- `summarizeCompositeGates` 안에서 `codes`와 `targets`는 첫 등장 순서를 지키고 중복을 없앤다. `targets`에서 빈 문자열은 뺀다.
- 표는 `Object.freeze`로 고정하고 label은 한국어로 쓴다. 기본 `next`는 기존 hint와 같이 영어 한 문장으로 쓴다.
- 새 모듈은 `validate.ts`를 require하지 않는다(순환 금지, `validate.ts:39-43` 주석). `FailureEntry` 타입은 `import type`이나 지역 타입으로 받는다.
- 테스트는 `../scripts/lib/*`를 읽으므로 focused 테스트 전에 `npm run build`를 실행한다.

### gates-review/composite-gate-output/002 · `218bbc2a`

#### Goal & intent

validate 실패를 다시 내보내는 진입점 3곳(`current --set`·`bouncer commit`·`finalize`)이 `failures`와 함께 `gates`를 싣게 한다. 경계 거절 reason 7종은 `bouncer commit` JSON·coordinate 실패 payload에 `gate` 필드를 갖고, commit hook 거절 줄 맨 앞에는 `[<label>] `가 붙는다. 수용 기준은 epic Success criteria 11·12이고, 검증 명령은 frontmatter `verify`다.

#### Current behavior

- `current --set`은 plan gate가 실패하면 `{ ok:false, failures }`만 다시 출력한다(`scripts/src/lib/cli-current-command.ts:287`). 이때 `gates`가 빠진다.
- `bouncer commit`
  - validate 실패 payload는 `{ok:false, reason:'validate', failures, recovery}`다(`scripts/src/lib/commit.ts:403-409`).
  - 경계 실패 payload는 `{ok:false, reason, violations, conflicts?, ledgerFile?, recovery}`다(`commit.ts:445-458`).
  - verification task 거절은 `commit.ts:376-380`에서 나간다.
  - `recoveryFor`(`commit.ts:256-314`)는 reason 값을 바꾸지 않는다.
- `finalize`의 validate 실패는 `{ok:false, reason:'validate', failures}`다(`scripts/src/lib/finalize.ts:501-502`). CLI는 결과를 그대로 출력한다(`scripts/src/lib/cli-git-commands.ts:110-119,143-152`).
- commit hook `evaluateIndex`의 거절 문자열(`scripts/src/lib/commit-hook.ts`)
  - `cross-drive-conflict`: `:438`
  - `cross-drive-ledger-unreadable`: `:445`
  - 그 밖의 code(`main-worktree-source-write`·`unassigned-worktree`·`stale-revision` 등): `commit blocked: ${code}: …`(`:459`)
  - out-of-scope: `commit blocked: files outside affected_paths: …`(`:463`)
  - lease 해석 실패의 `effective.reason`(`:404`)은 이번 범위 밖이다.
- `stale-revision`은 `scripts/src/lib/scope.ts:628`의 coordinator context reason이다. hook에서는 `checkCommitSafety` code를 거쳐 `:459`로 나간다.
- coordinate 실패 payload: `withCoordinateFailureHints`(`scripts/src/lib/coordinator-commands.ts:1762-1773`)가 `{...body, cause, next}`를 붙인다. `coordinate next`의 `fail(reason)`(`scripts/src/lib/coordinate-next.ts:160`)은 매핑된 reason을 한 번도 받지 않으므로(`:203,547-559,842-845`) 이번 범위에서 뺀다.
- I/O와 테스트 seam
  - `commit.ts:365`는 `git` 주입을 받는다. ledger와 fs는 실제 I/O라 테스트는 임시 저장소 fixture를 쓴다.
  - hook `evaluateIndex`는 `deps`로 `coordinatorContext`·`otherDriveTasks`를 주입받는다(`test/commit-hook.test.js:596,649`).
  - `withCoordinateFailureHints`는 순수 함수다(`test/coordinator.test.js:211-245`).
- 기존 테스트 제약
  - hook 정규식 `/commit blocked: cross-drive-conflict: …/`(`test/commit-hook.test.js:620`), `:637`, `/main-worktree-source-write: no staged path in \/r/`(`:653`)는 라벨을 맨 앞에 붙이면 그대로 통과한다.
  - `test/commit-task.test.js:596,1013,1030,1079,1121,1163,1211,1291`의 `deepStrictEqual`은 매핑하지 않는 reason(`ledger-locked` 등)이라 영향이 없다.
  - `test/commit-task.test.js:680-688`은 공개 경계 밖 내부 함수 `reviseTaskScope`의 결과라 바꾸지 않는다.

#### Target behavior

- 성공 경로
  - `current --set`·`commit`·`finalize` validate 실패 payload에 `gates`가 있다. `validateBlueprint` 결과에 `gates`가 있을 때만 싣는다.
  - `bouncer commit`이 매핑된 reason으로 실패하면 payload 최상위에 `gate`가 있다(예: `main-worktree-source-write` → `commit-scope`, `stale-revision` → `freshness-approval`, `verification-task-no-commit` → `commit-scope`).
  - `withCoordinateFailureHints`는 매핑된 reason에 `gate`를 붙인다.
  - hook 거절 줄은 매핑된 code일 때 `[커밋 범위] commit blocked: …` 또는 `[신선도·승인] commit blocked: …`로 시작한다. 라벨은 out-of-scope 줄(`:463`)에도 붙는다.
- 보존
  - `reason` 값, `failures[]`, `recovery`, `cause`, `next`, 라벨 뒤의 hook 문자열은 바뀌지 않는다.
  - 매핑하지 않은 reason(`validate`·`ledger-locked`·`no-git`·`commit-exception`·`lease-*` 등)은 payload에 `gate` 키가 없고 hook 줄에 라벨이 없다.
- 실패 경로: 없음. 표시 필드만 더하고 판정과 종료 코드는 그대로다.

#### Interface

- 제공:
  - payload 필드 `gate?: CompositeGateId`. TASKS-001의 `compositeGateForReason`로 계산하고, 값이 `null`이면 키를 넣지 않는다.
  - payload 필드 `gates?: CompositeGateSummary[]`. validate 결과의 값을 그대로 복사한다.
  - hook 라벨 `[<compositeGateLabel(gate)>] ` 접두.
- 거부:
  - `compositeGateForReason`가 `null`인 reason에는 `gate`도 라벨도 붙이지 않는다.
  - `body.ok !== false`이거나 `reason`이 문자열이 아닌 coordinate 결과는 지금처럼 원본을 그대로 돌려준다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/cli-current-command.ts` | `--set` 실패 출력 | Modify | `failures`만 출력(`:287`) | `gates` 동반 출력 | Success criteria 11 |
| `scripts/src/lib/commit.ts` | commit 실패 payload | Modify | validate·경계·verification 거절 payload(`:376-380,403-409,445-458`) | `gates`·`gate` 추가 | Success criteria 11·12 |
| `scripts/src/lib/finalize.ts` | validate 실패 반환 | Modify | `failures`만 반환(`:501-502`) | `gates` 동반 | Success criteria 11. CLI는 그대로 출력함 |
| `scripts/src/lib/commit-hook.ts` | `evaluateIndex` | Modify | 거절 문자열 생성(`:438,445,459,463`) | 매핑된 code에 라벨 접두 | Success criteria 12 |
| `scripts/src/lib/coordinator-commands.ts` | `withCoordinateFailureHints` | Modify | `cause`·`next` 병합(`:1762-1773`) | `gate` 병합 | coordinate 공개 경계 한 곳 |
| `test/commit-task.test.js` | commit 테스트 | Modify | payload 검증 | `gate`·`gates` assertion 추가 | 경계·validate 실패 fixture가 이미 있음 |
| `test/commit-hook.test.js` | hook 테스트 | Modify | 거절 문자열 검증 | 라벨 접두·비매핑 무라벨 assertion | `:596-653` fixture 재사용 |
| `test/cli-current.test.js` | `--set` 테스트 | Modify | plan gate 실패 출력 검증 | `gates` assertion | 진입점 계약 |
| `test/finalize.test.js` | finalize 테스트 | Modify | `reason:'validate'` 검증(`:294,500,886`) | `gates` assertion | 진입점 계약 |
| `test/coordinator.test.js` | 힌트 테스트 | Modify | `withCoordinateFailureHints` 검증(`:211-245`) | `gate` 유무 assertion | 순수 함수 seam |

#### Constraints

- reason 문자열, `COORDINATE_FAILURE_HINTS`의 `cause`·`next`, `recoveryFor`의 `action`·`detail`·`next`는 바꾸지 않는다.
- `gate`는 공개 경계(commit payload 반환, `withCoordinateFailureHints`)에서만 붙인다. 내부 함수(`reviseTaskScope`, `checkCommitSafety`, `otherDriveTasks`) 결과 shape는 그대로다.
- hook 라벨은 반드시 줄 맨 앞에 둔다. `commit blocked: <code>:` 연속 문자열을 쪼개면 기존 정규식이 깨진다.
- 매핑 reason 목록을 이 task에 복제하지 않고 `compositeGateForReason`만 호출한다.

### gates-review/composite-gate-output/003 · `61c5e476`

#### Goal & intent

`rules/output.md`의 compact 실패 표시를 복합 gate 이름, 대상, 복구 행동 1개 순서로 바꾸고 G/S code는 세부로 내린다. `rules/cli.md` 결과 처리 절에는 `validate`의 `gates[]`와 commit·coordinate 실패의 `gate` 필드를 소비하는 규칙을 적는다. 마지막으로 CHANGELOG `[Unreleased]`에 `### Added` 항목을 넣는다. 수용 기준은 epic Success criteria 13이고, 검증 명령은 frontmatter `verify`다.

#### Current behavior

- `rules/output.md:12`: "실패에는 실패 **code**, 원인, 관련 경로, 복구 행동을 모두 표시한다."
- `rules/output.md:21-23`의 "compact 실패 예시":
  `실패 G7: 검증 명령이 종료 코드 1로 끝남 · 관련 경로: test/skill-output-contract.test.js · 복구: 실패한 테스트를 수정한 뒤 execute gate를 다시 실행`
- `rules/output.md:68`은 "gate 실패"를 숨길 수 없는 항목에 둔다.
- `rules/cli.md:533-540` "Result handling"은 `validate` 실패 항목의 `next`를 복구 행동으로 따르라고만 적는다. `gates[]`나 `gate`는 언급하지 않는다.
- `CHANGELOG.md:8`의 `## [Unreleased]` 아래에는 `### Fixed`(`:10`)만 있다. 형식을 검사하는 테스트는 없다.
- 형식 제약
  - `scripts/check-doc-shape.js:889-891`은 `rules/output.md`에 `compact`·`coordinator 실행`·`debug`·`숨길 수 없는 항목` 제목이 있어야 한다고 본다. 예시 문구는 고정하지 않는다.
  - `test/plugin-doc-cites.test.js:12`는 `${BOUNCER_ROOT}/` 접두 없는 `rules/…md` 같은 인용을 거부한다.
  - `test/skill-bouncer-surface.test.js:153-169`는 skill Master rules 블록이 `rules/output.md`를 인용하지 않는지 본다.
- 런타임에 이 문서를 읽는 코드는 없다.

#### Target behavior

- `rules/output.md` compact 실패 규칙
  - 복합 gate가 있는 실패: 복합 gate 이름, 원인, 대상(`targets`), 복구 행동 1개(`next`)를 먼저 쓰고, G-code나 reason은 `세부:`로 붙인다.
  - 복합 gate가 없는 실패(S 코드, 매핑하지 않은 reason): 지금처럼 code를 앞에 쓴다.
- 예시 두 줄
  - `실패 검증 증적: 검증 명령이 종료 코드 1로 끝남 · 대상: …/tasks/001/verification.md · 복구: <next> · 세부: G7`
  - `실패 S10: …`
- `rules/cli.md` Result handling
  - `validate` 결과의 `gates[]`(G 실패가 있을 때만)를 먼저 렌더링한다.
  - 복구 행동은 gate의 `next` 하나다.
  - 개별 실패 항목은 `failures[]`의 `code`·`next`로 확인한다.
  - `current --set`·`commit`·`finalize` 실패 payload도 같은 `gates`를 싣는다.
  - commit·coordinate 실패의 `gate`는 표시용이며 `reason`이 판정 기준이다.
- 보존: 4개 필수 제목, coordinator 실행 형식, 숨길 수 없는 항목 목록은 그대로다.

#### Interface

- 제공: 문서 계약만 바뀐다. 사용하는 필드 이름은 blueprint Contract의 `gates`·`gate`·`label`·`codes`·`targets`·`next`와 같다.
- 거부: 복합 gate 7개 밖의 이름, `strict`·warning 강등 서술, `${BOUNCER_ROOT}/` 없는 doc 인용은 넣지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `rules/output.md` | `## compact`, `### compact 실패 예시` | Modify | compact 실패 표시 규칙(`:12,21-23`) | 복합 gate 우선 규칙과 예시 두 줄 | AC1 사용자 표시 |
| `rules/cli.md` | `## Result handling` | Modify | `next` 소비 규칙(`:533-540`) | `gates[]`·`gate` 소비 규칙 추가 | 에이전트가 읽는 CLI 계약 |
| `CHANGELOG.md` | `## [Unreleased]` | Modify | 미출시 변경 기록 | `### Added` 항목 추가 | Success criteria 13 |

#### Constraints

- 사용자 표시 예시는 한국어로 쓴다. code·경로·필드 이름은 원문을 유지한다.
- 4개 필수 제목(`compact`·`coordinator 실행`·`debug`·`숨길 수 없는 항목`)은 이름을 바꾸지 않는다.
- 다른 플러그인 문서를 인용할 때는 `${BOUNCER_ROOT}/` 접두를 쓴다.
- CHANGELOG 항목은 기존 `[Unreleased]` 항목처럼 굵은 제목 한 줄과 설명 1–3줄로 쓴다.

### gates-review/composite-gate-output/004

#### Goal & intent

TASKS-001–003이 모두 통합된 뒤 `npm run ci`가 통과해 epic Success criteria 9–13의 구현·문서·테스트 계층 등록이 함께 성립함을 증명한다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.