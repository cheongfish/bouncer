---
type: bouncer.explain
title: complexity-signals explain
description: Explain for complexity-signals
resource: .bouncer/context/epics/plugin-surface-slimming/blueprints/complexity-signals/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-31T16:24:47.314+09:00'
bouncer:
  id: EXPLAIN-complexity-signals
  epic_id: plugin-surface-slimming
  blueprint_id: complexity-signals
  status: published
  comprehension:
    - range_from: a900d1b3d3ea9d7a98e08a8a016acee05c5123cb
      range_to: 1fd050996e52d6ecd91f6049c4345e8e8f77731c
      diff_sha: dc96d82617433ea4cbfe885e376cf9dd90faa4267b856941d584687191c0f528
      recorded_at: '2026-10-31T16:25:25.202+09:00'
  task_commits:
    - task: plugin-surface-slimming/complexity-signals/001
      sha: 6953a0e8
      intent_anchor: task-001
    - task: plugin-surface-slimming/complexity-signals/002
      sha: 3f056254
      intent_anchor: task-002
    - task: plugin-surface-slimming/complexity-signals/003
      sha: 69f34a2f
      intent_anchor: task-003
    - task: plugin-surface-slimming/complexity-signals/004
      sha: 7976c93e
      intent_anchor: task-004
    - task: plugin-surface-slimming/complexity-signals/005
      sha: 78da0103
      intent_anchor: task-005
    - task: plugin-surface-slimming/complexity-signals/006
      sha: 0d1e0c39
      intent_anchor: task-006
    - task: plugin-surface-slimming/complexity-signals/008
      sha: 1fd05099
      intent_anchor: task-008
---
# Explain

## Background

리뷰 강도(리뷰어 등급과 single/parallel 전략)와 plan routing은 변경이 작은지 큰지, 위험한지를 따로따로 판정했다.
`plan inspect`와 `review-dispatch`가 각자 경로 규칙과 문턱 상수를 들고 있어서, 한쪽만 고치면 두 판정이 어긋났다.
이 변경은 그 계산을 공용 모듈 하나로 모으고, 문턱을 `complexity.*` 설정으로 옮긴다.
문턱은 테스트·문서를 뺀 소스 파일 기준이다.
리뷰에 쓴 전략과 등급은 `drive_record`에 남겨, 이후 문턱을 조정할 근거로 쓴다.

## Code

- `packages/cli/src/complexity-signals.ts` — 새 순수 모듈. 위험 경로 분류, 소스 판별(`isSourcePath`), 접촉 모듈 계산(`collectModules`), `computeComplexitySignals`, `singleVerdict`, `strongCauses`가 있다. 런타임 의존은 `node:path` 하나뿐이고, `config.ts`는 이 모듈을 import하지 않는다.
- `packages/cli/src/config.ts` — `readComplexityPolicy`와 기본 정책. 일곱 키(`single_max_source_files`, `single_max_source_lines`, `strong_min_source_files`, `strong_min_modules`, `strong_min_total_files`, `risk_paths`, `generated_paths`)만 허용하고, 값이 잘못되면 기본값으로 접지 않고 설정 오류로 거절한다.
- `packages/cli/src/plan-inspect.ts` — 위험 경로 규칙을 지우고 공용 모듈 신호로 routing 추천을 낸다. 설정이 깨지면 `complexity-config-invalid`다.
- `packages/cli/src/review-dispatch.ts` — 리뷰어 등급(`computeReviewerTier`)과 리뷰 전략을 같은 신호로 정한다. 적용된 정책이 기본과 다르면 payload에 non-default 줄을 붙인다. plan 단계는 파일 줄 수를 모르므로 같은 변경이 plan에서는 standard, execute에서는 strong이 될 수 있다. 이는 설계다.
- `packages/cli/src/review-snapshot.ts` — snapshot에 파일별 변경 줄 수(`file_lines`)를 더했다. 줄 수가 없는 옛 snapshot은 stale로 본다.
- `packages/cli/src/coordinator-commands.ts` — `coordinate worker-model`에 `--strategy`와 `--reviewer-tier`를 더했다. reviewer 역할에만 쓸 수 있고 대소문자를 구분한다.
- `packages/cli/src/drive-record.ts`, `scripts/measure-drive-records.js` — `drive_record`가 리뷰 전략과 등급을 읽는다. 같은 판독 규칙이 두 곳에 복제돼 있어 한쪽만 바뀌면 어긋날 수 있다.

## Quiz

(finalize 때 사용자에게 제시한다. 정답과 응답은 파일에 적지 않는다.)

## Tasks

### plugin-surface-slimming/complexity-signals/001 · `6953a0e8`

#### Goal & intent

위험·모듈 폭·소스 크기·직렬 여부 신호를 계산하는 공용 모듈 `complexity-signals.ts`를 만들고, 문턱·저장소 고유 위험 경로·생성물 경로를 `.bouncer/config.json`의 `complexity.*` 일곱 키로 조정하게 한다. 정책 타입·기본값·판독기는 `config.ts`가 갖고 `complexity-signals.ts`는 그 타입을 `import type`으로만 가져와 정책을 인자로 받는 순수 모듈로 둔다. `plan-inspect.ts`가 들고 있던 위험 경로 분류를 이 모듈로 옮기되 `plan-inspect`의 기존 export와 출력(모듈 계산 포함)은 이 task에서 바꾸지 않는다. 수용 기준은 아래 Target behavior의 단언이 모두 통과하는 것이고 검증 명령은 `node scripts/verify-complexity-signals-core.js`다.

#### Current behavior

- 위험 경로 분류(`classifyOnePath`)와 모듈 계산(`collectModules`, `MODULE_EXCLUDED`)이 `plan-inspect.ts`에만 있다(`:463`, `:521`, `:56`). `review-dispatch.ts`는 경로를 보지 않는다. `matchStar`·`pathSegments`는 `classifyOnePath`만 쓴다.
- 모듈은 첫 경로 조각이라 `packages/cli`와 `packages/web`이 모두 `packages` 하나다. 소스/비소스 구분과 생성물 제외 규칙은 어디에도 없다.
- `config.ts`에는 `complexity` 키를 읽는 함수가 없다. 비슷한 패턴은 `readCoordinatorPolicy`(`config.ts:169`)이며 파일 부재만 기본값이고 파손은 `invalid`다.
- 재현: `node --test test/plan-inspect.test.js`가 `classifyRoutingPaths`·`summarizeRouting` 단언을 이미 통과한다(변경 전 기준선). 공용 모듈 테스트 파일은 없다.

#### Target behavior

- 성공 경로:
  - `computeComplexitySignals({ files, driveShape, policy })`가 `ComplexitySignals`를 낸다. `policy`는 `ComplexityPolicy`이고 이 함수는 `policy.riskPaths`(저장소 고유 위험 패턴)와 `policy.generatedPaths`(생성물 접두)만 읽는다. 문턱 필드는 `singleVerdict`·`strongCauses`가 읽는다. 호출부는 `riskPatterns`처럼 정책의 일부만 따로 넘기지 않는다.
  - `serial`은 `driveShape`가 `serial`/`parallel`/`mixed`이면 불리언, 없거나 `unknown`·`null`이면 `null`이다.
  - 입력 경로는 역슬래시를 `/`로 바꾸고 앞의 `./`를 모두 제거해 정규화한 뒤 판정한다. 문자열이 아니거나 빈 문자열인 `path`는 무시하고, 출력 `riskPaths[].path`는 정규화된 경로다.
  - 생성물 판정: 정규화한 경로가 `policy.generatedPaths`의 어느 접두(저장소 루트 기준 디렉터리, 예 `scripts/lib/`)로 시작하면 생성물이다. 생성물은 크기 수치(`totalFiles`, `sourceFiles`, `sourceLines`, `modules`)에서만 빠지고 위험 경로 평가에는 들어간다. 기본 접두는 `scripts/lib/`, `.codex/agents/`, `packages/cli/dist/`이고 `generated_paths: []`면 생성물이 없다.
  - 소스 판정 `isSourcePath(path)`는 확장자를 보지 않는다. 비소스는 다음뿐이다. (1) 저장소 루트 또는 `packages/<name>/` 바로 아래의 `test/`·`tests/`·`docs/` 디렉터리 안의 파일, (2) `.bouncer/context/` 아래 파일, (3) 파일명이 `<이름>.test.<확장자>`·`<이름>.spec.<확장자>` 꼴(`a.test.js`, `a.spec.ts`, `a.test.d.ts`), (4) 파일명이 대소문자 무관하게 `README` 또는 `CHANGELOG`이거나 `README.`·`CHANGELOG.`로 시작. 디렉터리 이름은 대소문자를 구분한다.
  - 기대값 표(`isSourcePath`): 소스는 `src/a.ts`, `packages/cli/src/a.ts`, `rules/cli.md`, `package.json`, `config.example.json`, `.bouncer/config.json`, `packages/cli/src/test/a.ts`, `src/docs/a.ts`, `Test/a.ts`, `src/test.js`, `src/latest.js`, `src/readme-parser.ts`. 비소스는 `test/helpers/x.js`, `tests/a.js`, `docs/x.md`, `packages/cli/test/a.js`, `packages/cli/docs/x.md`, `.bouncer/context/epics/e/index.md`, `a.test.js`, `src/a.spec.ts`, `src/a.test.d.ts`, `README.md`, `readme.txt`, `packages/cli/README`, `CHANGELOG.md`, `changelog.md`.
  - 모듈 판정 `collectModules(files)`는 소스이고 생성물이 아닌 파일만 본다. `packages/<name>/…`는 `packages/<name>`, `packages/foo.ts`처럼 패키지 디렉터리가 없으면 `packages`, 그 밖에는 첫 경로 조각이다. 루트 파일(슬래시 없음)과 첫 조각이 `.bouncer`인 파일은 모듈이 아니다. 결과는 정렬·중복 제거한다. 예: `packages/cli/src/a.ts`→`packages/cli`, `packages/foo.ts`→`packages`, `src/a.ts`+`src/b.ts`→`['src']`, `.bouncer/config.json`·`package.json`→없음, `.github/workflows/ci.yml`→`.github`.
  - 줄 수 판정: 항목 `lines`는 추적 파일이면 추가+삭제 줄 합이다(002). `sourceLines`는 소스이고 생성물이 아닌 파일의 `lines` 합이며, 그런 파일 중 하나라도 `lines`가 없으면(키 없음·`undefined`) `null`이다(일부만 있어도 부분합을 내지 않는다). 소스 파일이 하나도 없으면 `lines` 유무와 무관하게 `0`이다. `lines`가 음수·비정수·`NaN`이면 "없음"이 아니라 0줄로 센다. 기대값: `files: []`→`sourceLines 0`; `[src/a.ts]`(lines 없음)→`null`; `[test/a.test.js]`(lines 없음)→`0`; `[src/a.ts(5), src/b.ts(lines 없음)]`→`null`; `[src/a.ts(5), src/b.ts(-3), src/c.ts(1.5)]`→`5`.
  - 입력 `[packages/cli/src/a.ts(10), packages/web/src/b.ts(5), test/a.test.js(40), docs/x.md(3), scripts/lib/a.js(99)]`는 `totalFiles 4`, `sourceFiles 2`, `sourceLines 15`, `modules ['packages/cli','packages/web']`, `riskPaths []`다. `.bouncer/context/epics/e/tasks/001/tasks.md` 하나는 `totalFiles 1`, `sourceFiles 0`, `sourceLines 0`, `modules []`다.
  - 위험 경로: `packages/cli/src/commit-guard.ts`, `test/commit-guard.test.js`, `AGENTS.md`, `docs/AGENTS.md`, `hooks/hooks.json`, `plugins/x/hooks/run.sh`, `rules/acq-gates.json`은 기본 목록으로 `kind 'repo'`다. `rules/other.json`·`my-commit-guard.ts`는 걸리지 않고 `src/auth/session.ts`는 `security`가 우선한다. 생성물 `scripts/lib/commit-guard.js`는 `kind 'repo'`로 위험 경로에 잡히지만 `totalFiles`에는 들어가지 않는다. 정규화: `src\\commit-guard.ts`는 `riskPaths[0].path === 'src/commit-guard.ts'`, `./AGENTS.md`는 `'AGENTS.md'`다.
  - 경계값 판정(기본 정책): 소스 파일 2개·소스 줄 200은 single이고 3개 또는 201줄은 single이 아니다. strong 크기 근거는 소스 파일 7개에는 없고 8개에 있으며, 모듈 3개에는 없고 4개에 있고, 전체 파일 10개에는 없고 11개에 있다(테스트 파일만 11개여도 `total files 11 >= 11`이다).
  - `singleVerdict`·`strongCauses`가 문턱 판정을 낸다. 기본값은 `sourceFiles 2·sourceLines 200` 이하이고 위험 신호 없음이면 single, `sourceFiles 8`·`modules 4`·`totalFiles 11` 이상 또는 위험 신호가 있으면 strong 근거를 낸다. `sourceLines`가 `null`이면 single이 아니며 근거는 `source lines unknown`이다. `complexity low`는 strong의 크기 세 조건을 평가하지 않는다. 생성물만 있는 입력(`.codex/agents/a.toml` 하나)은 `totalFiles 0`, `sourceFiles 0`, `sourceLines 0`이라 `singleVerdict`가 `{ single: true, reasons: ['source files 0 <= 2, source lines 0 <= 200, no risk signal'] }`, `strongCauses`가 `[]`다.
  - `readComplexityPolicy(repoRoot)`는 파일 부재(`ENOENT`)와 `complexity` 키 부재에 기본 정책을, 유효한 값에 그 값을 낸다. `risk_paths: []`는 저장소 고유 목록을 비우고 `generated_paths: []`는 생성물 제외를 끈다. 문턱 값에는 상한이 없다(범위 안이면 `1000000`도 받는다). 적용된 값이 기본값과 다른지는 소비자(004)가 `DEFAULT_COMPLEXITY_POLICY`와 비교해 드러낸다.
- 실패 경로: `readComplexityPolicy`는 다음 중 하나면 `{ ok: false, reason: 'invalid' }`다. 파일 부재 외의 읽기 오류(JSON 오류, 또는 `.bouncer/config.json`이 디렉터리라 읽기가 `EISDIR`로 실패하는 경우), `complexity`가 객체가 아님, 문턱이 정수가 아니거나 범위 밖, `complexity` 안에 일곱 키 밖의 키(오타 방지), `risk_paths`·`generated_paths`가 배열이 아니거나 아래 패턴 규칙을 어긴 항목을 가짐. 소비자의 처리는 003(`plan inspect`는 기본값으로 계속)과 004(`review-dispatch`는 거절)가 정한다.
- 보존: `plan-inspect`의 `classifyRoutingPaths(pathList)` 단일 인자 호출 결과(저장소 패턴을 넘기지 않으면 기본 목록도 적용하지 않는다), `summarizeRouting`의 출력(`modules` 계산 포함), 기존 `plan-inspect` 테스트 단언은 그대로다. 새 공용 모듈의 `collectModules`와 `plan-inspect.ts`의 기존 `collectModules`·`MODULE_EXCLUDED`는 이 task에서 공존하고, 003이 `summarizeRouting`을 공용 신호로 바꾸며 기존 것을 지운다.

#### Interface

- 제공:
  - `complexity-signals.ts` export: `computeComplexitySignals({ files, driveShape?, policy })`, `classifyRoutingPaths(pathList, repoPatterns?)`, `collectModules`, `isSourcePath`, `singleVerdict`, `strongCauses`와 타입 `SignalFile`, `ComplexitySignals`, `RiskKind`(`'repo'` 추가). 런타임에는 `node:path` 외의 모듈을 `require`하지 않고, 정책 타입은 `import type { ComplexityPolicy } from './config'`로만 가져온다(컴파일 때 지워진다). 정책 모양의 사본 타입(`SignalPolicy` 등)을 따로 만들지 않는다.
  - `singleVerdict(signals, policy, riskFlags) -> { single: boolean; reasons: string[] }`, `strongCauses(signals, policy, { riskFlags, complexity }) -> string[]`. `strongCauses`의 근거 문자열은 `review_risk <flags>`, `risk path <path>`, `source files <n> >= <m>`, `modules <n> >= <m>`, `total files <n> >= <m>` 형식이다. `singleVerdict.reasons`는 single이면 `source files <n> <= <m>, source lines <l> <= <k>, no risk signal` 한 줄, 아니면 어긋난 원인을 이 순서로 담은 목록이다(`source files 3 > 2`, `source lines 201 > 200` 또는 `source lines unknown`, `review_risk <flags>`, `risk path <path>`). `strongCauses`의 순서는 `review_risk`, `risk path`, `source files`, `modules`, `total files`다. `risk path` 근거는 입력 순서대로 최대 3개를 각각 한 항목으로 싣고 더 있으면 `risk path +<n> more` 한 항목을 더한다.
  - `config.ts` export 추가: `readComplexityPolicy(repoRoot) -> { ok: true; policy: ComplexityPolicy } | { ok: false; reason: 'invalid' }`, 상수 `DEFAULT_COMPLEXITY_POLICY`, `DEFAULT_RISK_PATHS`, `DEFAULT_GENERATED_PATHS`, 타입 `ComplexityPolicy = { singleMaxSourceFiles, singleMaxSourceLines, strongMinSourceFiles, strongMinModules, strongMinTotalFiles: number; riskPaths: string[]; generatedPaths: string[] }`. `config.ts`는 `complexity-signals.ts`를 import하지 않는다(타입 포함).
  - 설정 키 일곱 개: `complexity.single_max_source_files`(정수 `>= 0`, 2), `single_max_source_lines`(정수 `>= 0`, 200), `strong_min_source_files`(정수 `>= 1`, 8), `strong_min_modules`(정수 `>= 1`, 4), `strong_min_total_files`(정수 `>= 1`, 11), `risk_paths`(문자열 배열, 기본은 `DEFAULT_RISK_PATHS`: `commit-guard*`, `commit-hook*`, `hooks/`, `AGENTS.md`, `rules/acq-gates.json`, `validate-gates*`, `coordinator-ledger*`, `guards.ts`), `generated_paths`(문자열 배열, 기본은 `DEFAULT_GENERATED_PATHS`: `scripts/lib/`, `.codex/agents/`, `packages/cli/dist/`).
- 위험 경로 패턴(domain term): 세 꼴이 있고 대소문자를 구분한다. (a) `/`가 없으면 basename 비교이고 `*`는 임의 문자열이다(`commit-guard*`는 `commit-guard.ts`·`commit-guard.test.js`에 맞고 `my-commit-guard.ts`에는 맞지 않는다. `AGENTS.md`는 `docs/AGENTS.md`에도 맞는다. `*.pem`은 `certs/a.pem`에 맞는다). (b) `/`로 끝나면 디렉터리 패턴이다. 패턴의 조각 열이 경로의 디렉터리 조각(파일명 제외) 안에 연속으로 있으면 맞는다(`hooks/`는 `hooks/a.sh`·`x/hooks/a.sh`에 맞고 `hooks.md`·`src/hooks`(파일)·`src/hooksx/a.sh`에는 맞지 않는다. `src/payments/`는 `src/payments/a.ts`·`app/src/payments/a.ts`에 맞고 `src/payments.ts`·`src/a/payments/b.ts`에는 맞지 않는다). (c) 그 밖에 `/`가 있으면 저장소 상대 경로 정확 일치다(`rules/acq-gates.json`). `/`가 들어간 패턴에서 `*`는 쓸 수 없다.
- 패턴 검증(설정 오류로 거절, 조용히 안 맞는 패턴으로 두지 않는다): 문자열이 아님, 빈 문자열, 200자 초과, `*` 4개 이상, 절대 경로(`/` 시작), `..` 조각, 역슬래시, `./` 시작, 앞뒤 공백, `*`와 `/`만으로 이루어진 값(`*`, `**`, `/`), 빈 조각(`a//b`), `/`가 있는 패턴 안의 `*`(`src/*.ts`). `generated_paths` 항목은 위 규칙에 더해 반드시 `/`로 끝나고 `*`를 쓸 수 없으며 저장소 루트 기준 접두로만 쓰인다.
- 거부: 위 실패 경로의 입력은 `invalid`로 거절하고 기본값으로 접지 않는다. `computeComplexitySignals`는 `lines`가 음수·비정수인 파일을 0줄로 세고, 문자열이 아닌 `path`는 무시한다. 위험 경로 패턴 매칭은 정규식을 만들지 않고 단순 글롭 비교로 한다(패턴 길이·`*` 개수 제한과 함께 최악 비용을 묶는다).
- 시험 seam: 이 task의 새 함수는 모두 순수 함수이고 파일을 읽지 않는다. 판독기만 `repoRoot`의 `.bouncer/config.json`을 읽으며 테스트는 임시 디렉터리를 쓴다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/complexity-signals.ts` | 신규 추출 지점: 신호 계산·문턱 판정 | Create | 없음 | 위험 경로·소스 판정·모듈 계산과 `computeComplexitySignals`·`singleVerdict`·`strongCauses`를 둔다 | `plan-inspect.ts:463`, `:521`에 흩어진 규칙을 한곳으로 모은다 |
| `packages/cli/src/plan-inspect.ts` | `classifyOnePath`, `classifyRoutingPaths`, `matchStar`, `pathSegments`, `SECURITY_SEGMENTS`, `MANIFEST_EXACT`, `RiskKind`, `RiskPath` | Modify | 위험 경로 규칙을 직접 가진다 | 옮긴 코드와 상수를 지우고 새 모듈을 import하며 `classifyRoutingPaths`를 다시 export한다. `collectModules`·`MODULE_EXCLUDED`·`summarizeRouting`은 건드리지 않는다 | 수용 기준 1의 분류 규칙 복사본 제거. `test/plan-inspect.test.js:339`가 export를 쓴다. 모듈 계산 전환은 003이 한다(그때까지 `summarizeRouting` 출력 불변) |
| `packages/cli/src/config.ts` | `readComplexityPolicy`, `DEFAULT_COMPLEXITY_POLICY`, `DEFAULT_RISK_PATHS`, `DEFAULT_GENERATED_PATHS`, `ComplexityPolicy` | Modify | 정책별 config 판독기와 기본값을 둔다 | `complexity` 블록 판독기와 기본 정책 상수·타입을 추가하고 export한다 | `readCoordinatorPolicy`가 같은 패턴(부재는 기본, 파손은 invalid)이다 |
| `packages/cli/src/cli-config-command.ts` | `HELP` | Modify | config 키 도움말을 낸다 | `complexity.*` 일곱 키와 기본값·거절 사유·패턴 규칙 절을 추가한다 | `test/cli-help.test.js:428`이 키별 도움말 문구를 단언한다 |
| `config.example.json` | `complexity` | Modify | 설정 예제를 보인다 | 기본값을 담은 `complexity` 블록(일곱 키)을 추가한다 | `test/init.test.js:134`가 예제를 파싱한다 |
| `docs/configuration.md` | 키 표 | Modify | 설정 키 표를 둔다 | `complexity.*` 일곱 행을 추가한다 | `test/skill-bouncer-surface.test.js:557`이 이 문서를 읽는다 |
| `test/complexity-signals.test.js` | 신호·판정·판독기 단언 | Create | 없음 | Target behavior의 입력·기대값을 단언한다 | 새 모듈의 유일한 직접 시험 |
| `test/cli-help.test.js` | `complexity` 키 도움말 단언 | Modify | config 도움말 단언을 둔다 | 새 키 문구 단언을 추가한다 | `test/cli-help.test.js:428` 인접 블록 |
| `test/skill-bouncer-surface.test.js` | `docs/configuration.md` 단언 | Modify | 설정 문서가 읽히는지 단언한다 | `docs/configuration.md`가 `complexity.*` 일곱 키를 모두 적었다는 단언을 추가한다 | `:557`이 이 문서를 읽는 목록에 있다 |
| `test/init.test.js` | `config.example.json` 단언 | Modify | 예제 파싱과 신규 config 모양을 단언한다 | 예제 `complexity` 블록의 키 일곱 개와 값이 기본 정책과 같다는 단언을 추가한다 | `:134`가 예제를 파싱한다 |
| `test/tiers.json` | `unit` 목록 | Modify | 테스트 파일의 계층을 정한다 | `complexity-signals.test.js`를 `unit`에 추가한다 | `test/test-tiers.test.js:30`이 미분류 파일을 거절한다 |
| `scripts/verify-complexity-signals-core.js` | 단계 목록 | Create | 없음 | 빌드 → typecheck → 테스트 → eslint → 테스트 이름 규칙 → context-comments 래퍼 | `scripts/verify-drive-records.js`와 같은 convention |

#### Constraints

- `complexity-signals.ts`는 런타임 `require`로 `node:path`만 쓰고, `config.ts`는 `complexity-signals.ts`를 import하지 않는다(타입 포함). 이 경계는 `test/complexity-signals.test.js`가 컴파일 산출물로 고정한다: `dist/complexity-signals.js`의 `require(...)` 대상 집합이 `['node:path']`이고 `dist/config.js` 본문에 `complexity-signals`가 없다. `test/dependency-boundaries.test.js`의 사이클 검사가 통과해야 한다. 정책 모양은 `config.ts`의 `ComplexityPolicy` 하나뿐이며 `test/complexity-signals.test.js`가 `DEFAULT_COMPLEXITY_POLICY`를 `computeComplexitySignals`·`singleVerdict`·`strongCauses`에 그대로 넘겨 확인한다.
- `computeComplexitySignals`의 정책 인자는 `policy` 하나다. 이 task, 003, 004의 모든 호출부가 같은 인자 이름과 모양을 쓴다.
- `classifyRoutingPaths(pathList)`의 단일 인자 호출 결과는 이 task 전후로 같다. 기존 `test/plan-inspect.test.js` 단언은 한 줄도 바꾸지 않고, `summarizeRouting`의 `modules`·`reasons`·`recommendation`은 그대로다.
- `test/skill-bouncer-surface.test.js`와 `test/init.test.js`는 단언 추가만 허용하고 기존 단언은 바꾸지 않는다.
- 일반 위험 규칙(security·manifest·build·migration)의 목록과 우선순위는 바꾸지 않는다. 저장소 고유 규칙은 마지막에 평가한다.
- 위험 경로는 소스 여부와 무관하게 모든 입력 파일에 적용하고, 생성물 경로도 위험 평가에는 포함한다(크기 수치에서만 뺀다).
- 위험 경로 패턴 판독은 정규식 생성 없이 글롭 비교로 하고, 설정 오류 입력은 기본값으로 접지 않는다.
- 주석과 JSDoc은 저장소 관례(한국어, 이유 중심)를 따르고 `lint:context-comments`를 통과해야 한다.

### plugin-surface-slimming/complexity-signals/002 · `3f056254`

#### Goal & intent

`captureReviewSnapshot`이 만드는 `ReviewSnapshot`에 `file_lines: { path, lines }[]`를 추가한다. `changed_lines`는 파일 전체의 합이라 테스트·문서 줄이 섞여 있고, 004의 소스 줄 문턱(200줄)은 파일별 값이 있어야 계산된다. 수용 기준은 아래 단언 통과이고 검증 명령은 `node scripts/verify-complexity-signals-snapshot.js`다.

#### Current behavior

- `captureReviewSnapshot`은 추적 파일의 줄 수를 `parseNumstat`으로 `trackedLines`(path → 줄 수|binary는 null) Map에 모으고 untracked 텍스트는 `countLines`로 `untrackedLines`에 모은 뒤 합계 `changed_lines`만 낸다(`review-snapshot.ts:568`, `:570`~`:571`, `:601`~`:602`). 파일별 값은 반환 전에 버려진다.
- `isSnapshotShape`(`:695`)는 `changed_files`·`changed_lines` 정수만 확인한다. 저장된 snapshot은 `sha256Canonical`로 id를 정하고 판독 때 같은 해시를 대조한다.
- 재현·확인: `node --test test/review-snapshot.test.js`가 `changed_lines`가 8·500·5·1인 케이스(`:83`, `:106`, `:160`, `:183`)를 통과한다.

#### Target behavior

- 성공 경로: snapshot에 `file_lines`가 `files`와 같은 순서(경로 사전순)로 실린다. 항목 `lines`는 추적 파일은 numstat의 추가+삭제 줄 합(수정한 한 줄은 2줄, binary는 0, 삭제 파일은 삭제 줄 수), untracked 텍스트 파일은 `countLines` 값, 그 밖(untracked binary·untracked symlink)은 0이다. 모든 `lines`의 합은 `changed_lines`와 같다.
- 기대값(기존 fixture `test/review-snapshot.test.js:83`의 주석 `committed 2 + staged 1 + keep.txt 2 + untracked 3`에서 유도): `file_lines`는 `[{ path: 'committed.txt', lines: 2 }, { path: 'keep.txt', lines: 2 }, { path: 'staged.txt', lines: 1 }, { path: 'untracked.txt', lines: 3 }]`이고 합 8이 `changed_lines`와 같다. 삭제·symlink fixture: 추적 파일 `d.txt`(4줄)를 지우고 `a.txt`를 가리키는 untracked symlink `e.lnk`를 만들면 `[{ path: 'd.txt', lines: 4 }, { path: 'e.lnk', lines: 0 }]`이고 합 4가 `changed_lines`와 같다. untracked binary `b.bin`은 `lines: 0`이다.
- 실패 경로: 수집 실패 사유와 코드는 그대로다. `file_lines` 때문에 새 실패 사유는 생기지 않는다.
- 보존: `changed_files`, `changed_lines`, `diff`, `files`, `index_entries` 값과 `isSnapshotShape` 판정은 같다. `file_lines`가 없는 옛 저장 snapshot은 계속 판독된다(해시 대조는 저장된 내용 그대로다).

#### Interface

- 제공: `ReviewSnapshot.file_lines: Array<{ path: string; lines: number }>`. 타입은 선택 필드(`file_lines?`)다. 새로 수집한 snapshot에는 항상 있고, 필드가 생기기 전에 저장된 artifact를 읽은 값에는 없을 수 있다.
- 거부: 판독 계약(`isSnapshotShape`)은 `file_lines`를 요구하지 않는다. `file_lines`의 합과 `changed_lines`를 판독 때 대조하지 않는다.
- 시험 seam: 기존 `deps.runGit`·`deps.readFile` 주입으로 충분하다. 새 주입 파라미터는 없다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/review-snapshot.ts` | `ReviewSnapshot`, `captureReviewSnapshot`의 반환부 | Modify | 전체 줄 수만 낸다 | `file_lines`를 만들어 반환 객체에 싣는다 | `trackedLines`·`untrackedLines`가 이미 파일별 값을 갖는다(`:568`, `:570`) |
| `test/review-snapshot.test.js` | 신규 케이스 | Modify | snapshot 수집을 시험한다 | `file_lines` 순서·값·합계 단언을 추가한다 | `:83`, `:106`이 `changed_lines`를 단언하는 같은 fixture를 쓴다 |
| `scripts/verify-complexity-signals-snapshot.js` | 단계 목록 | Create | 없음 | 빌드 → typecheck → 테스트 → eslint → 테스트 이름 규칙 래퍼 | 같은 convention의 `scripts/verify-drive-records.js` |

#### Constraints

- `test/review-snapshot.test.js`의 기존 단언(`changed_lines` 8·500·5·1, `Object.keys(byPath(result))` 목록)은 바꾸지 않는다. `:271`의 `deepStrictEqual(loaded.snapshot, result.snapshot)`는 새 필드가 양쪽에 같이 있어 그대로 통과해야 한다.
- 새 필드는 `files.sort`와 같은 정렬 기준을 쓴다. 다른 정렬을 쓰면 snapshot 해시가 호출마다 갈린다.
- `changed_lines`를 `file_lines` 합으로 다시 계산하지 않는다. 기존 계산을 그대로 두고 두 값이 같음을 시험으로 지킨다.

### plugin-surface-slimming/complexity-signals/003 · `69f34a2f`

#### Goal & intent

`bouncer plan inspect --blueprint`의 `routing`이 commit task의 `affected_paths`를 `computeComplexitySignals`에 넣어 얻은 `modules`와 `riskPaths`만으로 `standard-candidate`를 정하게 한다. `tasks >= 2`와 `dependencies > 0` 트리거를 없애고, 모듈 문턱은 `complexity.strong_min_modules`(기본 4)로 바꾼다. 001이 남겨 둔 `plan-inspect.ts`의 모듈 계산(`collectModules`, `MODULE_EXCLUDED`)을 이 task가 공용 신호로 갈아 끼우며 지운다. 라우팅 출력 `modules` 값이 바뀌는 지점은 이 task뿐이다(001은 출력을 바꾸지 않았다). `/bouncer-plan`의 추천 문구와 `rules/cli.md`의 routing 서술이 같은 기준을 말하게 한다. 검증 명령은 `node scripts/verify-complexity-signals-plan.js`다.

#### Current behavior

- `summarizeRouting`(`plan-inspect.ts:892`)은 `tasks >= 2`, `dependencies > 0`, `modules.length >= 3`, `riskPaths.length > 0` 중 하나라도 맞으면 `standard-candidate`이고 `reasons`에 해당 조건 이름을 싣는다(`:909`~`:921`).
- `planInspect`는 `loadRoutingTasks`가 읽은 commit task로 `summarizeRouting(commitTasks)`를 부른다(`:1038`). config를 읽지 않는다.
- `skills/bouncer-plan/SKILL.md:154`~`:158`은 공개 인터페이스·보호 경로·모듈 간 상태 변경이 없고 변경이 좁을 때만 `low`를 추천하라고 쓴다. 숫자 기준이 없다.
- 확인한 명령: `node --test test/plan-inspect.test.js`, `node --test test/skill-bouncer-surface.test.js` (변경 전 통과).

#### Target behavior

- 성공 경로:
  - `summarizeRouting(taskList, opts?)`의 `opts`는 `{ policy?: ComplexityPolicy; driveShape?: DriveShape; configInvalid?: boolean }`다. 인자 하나만 주는 기존 호출은 기본 정책이다.
  - 추천은 `modules.length >= policy.strongMinModules` 또는 `riskPaths.length > 0`일 때만 `standard-candidate`다. `reasons`는 `modules`, `riskPaths`, `affected-paths-empty`만 싣는다(`tasks`·`dependencies`는 빠진다). 출력의 `tasks`·`dependencies` 숫자 필드는 남는다.
  - `modules`는 `computeComplexitySignals`가 내는 값을 그대로 쓴다. 소스이고 생성물이 아닌 파일만 세고 `packages/<name>`을 별도 모듈로 센다(`test`·`docs`·`.bouncer`와 루트 파일은 모듈이 아니다). `riskPaths`는 일반 규칙과 `policy.riskPaths` 저장소 고유 패턴(`kind 'repo'`)을 합친 값이고 생성물 경로도 포함한다. 정책은 `config.ts`의 `readComplexityPolicy`로 읽고 신호는 `computeComplexitySignals({ files, driveShape, policy })`에 정책 전체를 `policy` 인자로 넘겨 얻는다(`files`는 `affected_paths` 합집합을 `{ path }`로 만든 것이고 `lines`는 없다).
  - 출력에 `serial: boolean | null`이 생긴다. `planInspect`가 commit task들을 `analyzeDriveShape`에 열린 task로 넣어 얻은 `drive_shape`에서 `serial`/`parallel`/`mixed`는 불리언, 없거나 `unknown`이면 `null`이다. 추천 판정에는 쓰지 않는다.
  - 직렬 의존이 있는 두 task만 있고 모듈이 3개 이하이며 위험 경로가 없으면 `low-candidate`다.
- 실패·경계 경로: `config.ts`의 `readComplexityPolicy`(001)가 `invalid`이면 `planInspect`는 실패하지 않고 기본 정책으로 계산하며 `reasons`에 `complexity-config-invalid`를 더한다. 이 사유만 있는 `reasons`는 추천을 `standard-candidate`로 바꾸지 않는다.
- 문서: SKILL.md 추천 문단이 `standard`는 routing이 `standard-candidate`(모듈이 `complexity.strong_min_modules`개 이상이거나 위험 경로가 있음)이거나 discovery가 공개 인터페이스·모듈 간 상태 변경을 확인했을 때, 그 밖에는 `low`라고 쓰고 task 수와 `depends_on`은 근거가 아니라고 적는다. 두 `Recommend-why` 줄이 같은 기준을 말한다.
- 보존: `routing.advisory`, `recommendation` 값 어휘, `coupledPaths` 계산, `classifyRoutingPaths(pathList)` 단일 인자 결과, ACQ id `plan.complexity`와 선택지.

#### Interface

- 제공: `summarizeRouting(taskList, opts?)`, 출력 `Routing`에 `serial: boolean | null`, `riskPaths[].kind`에 `'repo'`.
- 거부·분리: config 오류는 throw나 `ok: false` 없이 `reasons`의 `complexity-config-invalid`로만 드러난다(advisory 명령이 막히지 않는다). 던지는 입력 오류는 없다.
- 시험 seam: `summarizeRouting`은 순수 함수이고 정책·shape는 `opts`로 주입한다. `planInspect` 쪽은 임시 저장소와 `.bouncer/config.json` 파일로 시험한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/plan-inspect.ts` | `summarizeRouting`, `loadRoutingTasks`, `planInspect`, `Routing`, `CommitTask`, `collectModules`, `MODULE_EXCLUDED` | Modify | task 수·의존성·모듈 3·위험 경로로 추천하고 첫 경로 조각 모듈 계산을 직접 가진다 | 새 판정과 `serial`, config 오류 사유를 넣고 DAG 입력 필드를 읽으며, `collectModules`·`MODULE_EXCLUDED`를 지우고 공용 신호의 `modules`를 쓴다 | `:892`, `:940`, `:1038`, `:521`, `:56`. `rg summarizeRouting`: 호출은 `plan-inspect.ts:1038`과 `test/plan-inspect.test.js:340` 직접 호출뿐 |
| `test/plan-inspect.test.js` | 라우팅 단언 | Modify | routing 단언을 둔다 | 새 기준 단언으로 바꾸고 설정·serial 케이스를 더한다 | `:380`~`:410`, `:456`~`:491`이 `tasks`·`dependencies` 사유와 추천을 단언한다 |
| `skills/bouncer-plan/SKILL.md` | `ACQ — Complexity` 문단 | Modify | 추천 기준을 서술한다 | 숫자 기준 문장과 두 Recommend-why 줄을 바꾼다 | `:154`~`:170`. `test/skill-bouncer-surface.test.js:532`가 이 문서를 읽는다 |
| `test/skill-bouncer-surface.test.js` | plan 문서 단언 | Modify | plan 문서가 complexity를 선언하는지 단언한다 | SKILL.md 추천 문단이 모듈 문턱을 `complexity.strong_min_modules`로 말하고 task 수·`depends_on`을 근거로 쓰지 않는다는 단언을 추가한다 | `:532`~`:536`이 같은 문서를 읽는다 |
| `rules/cli.md` | `plan inspect` routing 서술 | Modify | routing 필드를 설명한다 | 추천 기준이 모듈·위험 경로뿐이고 `serial`이 참고용임을 쓴다 | `:135`~`:137` |
| `scripts/verify-complexity-signals-plan.js` | 단계 목록 | Create | 없음 | 빌드 → typecheck → 문서 형태 → 테스트 → eslint → 테스트 이름 규칙 래퍼 | `scripts/verify-complexity-plan-docs.js`와 같은 convention |

#### Constraints

- `test/plan-inspect.test.js`에서 바꿀 수 있는 기존 내용은 다음뿐이다. `summarizeRouting with test/docs/root files…` 테스트의 `full` 블록: `reasons.includes('tasks')`, `reasons.includes('dependencies')`, `reasons.includes('modules')`를 각각 `!includes`로 바꾸고(모듈이 `a`·`b`·`c` 셋이라 4 미만) `recommendation`은 `package.json` 위험 경로 때문에 `standard-candidate`로 유지한다. `plan inspect --blueprint with drafted tasks…`는 `security` 위험 경로가 남아 `standard-candidate`가 유지되므로 단언을 바꾸지 않는다. 같은 테스트의 `light` 블록은 입력 경로 `scripts/lib/a.ts`를 `scripts/a.ts`로 바꾸고(공용 모듈이 `scripts/lib/` 생성물을 세지 않기 때문이다) `modules ['scripts']` 단언은 그대로 둔다. 나머지 단언은 그대로다.
- `summarizeRouting`이 내는 `modules`는 이 task부터 공용 신호 값이다. 기존 테스트에서 이 값이 달라지는 입력은 `scripts/lib/a.ts`(생성물이라 제외)뿐이고, 위 `light` 블록 입력 변경이 그 하나다. 그 밖의 `modules` 기대값(`['a','b','c']`, `[]`)은 그대로다.
- `rules/cli.md`의 거절 표(`final-review-single-round` 등)와 헤딩을 바꾸지 않는다(`doc-shape-contracts.ts:136`).
- SKILL.md는 `**AskUserQuestion — plan.complexity**` 블록의 `acq` 주석과 `--complexity … CLI is outdated` 문장을 바꾸지 않는다(`test/skill-bouncer-surface.test.js:532`~`:536`). 이 테스트의 기존 단언은 바꾸지 않고 추가만 한다.
- SKILL.md 본문은 영어 지시문 관례를 따르고 사용자 노출 문구(Re-ground, Recommend-why)만 한국어다.

### plugin-surface-slimming/complexity-signals/004 · `7976c93e`

#### Goal & intent

`review-dispatch`의 execute 전략은 `EXECUTE_SMALL_MAX_FILES = 3`·`EXECUTE_SMALL_MAX_LINES = 200`을 전체 변경에 적용하고 리뷰어 등급은 `REVIEWER_STRONG_MIN_TASKS = 3`을 쓴다. 이를 snapshot의 실제 diff(execute)와 commit task `affected_paths`(plan)에서 계산한 공용 신호로 바꾼다. standard의 single 조건은 소스 파일 2개 이하·소스 줄 200 이하·위험 신호 없음이고, strong은 `review_risk`·위험 경로·소스 파일 8개 이상·모듈 4개 이상·전체 파일 11개 이상·`review.min_reviewer_tier: strong` 중 하나다. 검증 명령은 `node scripts/verify-complexity-signals-review.js`다.

#### Current behavior

- 상수는 `review-dispatch.ts:44`~`:53`이고 execute 판정은 `:966`~`:967`(`small`), `:975`~`:988`(perspectives·reasons)이다. 위험(`risk.flags`)이 있으면 single이어도 `security`만 덧붙는다.
- 등급은 `computeReviewerTier`(`:1039`)가 task 수와 `riskFlags`, `min`으로 정하고 `decideReviewerTier`(`:1126`)가 `review.min_reviewer_tier` 검증과 계산·적용을 한 번에 한다. plan(`:716`)은 `countCommitTasks`, execute(`:903`)는 task 범위 1·blueprint 범위 commit task 수를 넘기며, plan에서는 S/G·index·`computePlanSnapshot`·previous 검사·task 적재·`unionCommitReviewRisk` 뒤에, execute에서는 risk 읽기 뒤 git ref 해석·snapshot 수집(`:918` 근방) 앞에 돈다. `computePlanSnapshot`은 읽기 전용이고 저장하지 않는다. execute의 `captureReviewSnapshot`만 `.bouncer/runtime/review-snapshots/`에 쓴다.
- `review.min_reviewer_tier`가 잘못되면 `review-min-reviewer-tier-invalid`로 거절한다. `complexity: low`는 크기와 task 수 문턱을 건너뛴다.
- 도움말은 `cli-config-command.ts:48`이 "등급은 commit task 수와 review_risk를 따른다"고 쓰고, `rules/cli.md:549`·`:618`~`:624`, `rules/planning.md:58`~`:61`, `docs/configuration.md:33`, `docs/workflow.md:145`~`:148`이 task 수 문턱과 small-diff 규칙을 서술한다.
- 테스트 중 `execute <complexity>/<contract>/<scope>/<mode>` matrix(`test/review-dispatch.test.js:2391`~`:2440`)는 첫 사유를 `diff exceeds small thresholds (files=4, lines=4)`로 단언한다(`:2437`).
- 확인한 명령: `node --test test/review-dispatch.test.js test/cli-help.test.js test/reviewer-tier-docs.test.js` (변경 전 통과).

#### Target behavior

- 성공 경로:
  - execute는 snapshot 수집 뒤에 신호를 만든다. `SignalFile`은 `snapshot.files`의 경로에 `snapshot.file_lines`의 줄 수를 맞춰 만들고, 항목이 없으면 `lines`를 생략한다(줄 수를 모르면 single이 아니다). `--task`가 있으면 그 task 범위로 수집된 snapshot을, 없으면 blueprint 범위 snapshot과 모든 commit task의 `review_risk` 합집합을 쓴다. 신호는 `computeComplexitySignals({ files, policy })`(`policy`는 읽은 `ComplexityPolicy` 전체)로 만든다. brief 최종 리뷰와 delta의 관점 규칙은 그대로다.
  - `complexity: standard`의 비-brief 리뷰는 `singleVerdict`가 single이면 `single`/`['combined']`, 아니면 `parallel`/`['spec_scope','correctness_tests','minimality_maintainability']`다. `security`는 뒤에 붙는다. 붙는 조건은 `risk.flags`가 있거나 `kind 'security'`인 위험 경로(`src/auth/x.ts` 등)가 있을 때다. `manifest`·`build`·`migration`·`repo` 경로는 parallel과 strong은 만들지만 `security`를 붙이지 않는다. `complexity: low`는 크기·위험과 무관하게 `single`/`['combined']`(+같은 조건에서 `security`)다.
  - 사유 두 줄은 `[전략 사유, security 사유, …등급 사유]` 순서다. single 전략 사유는 `source files <n> <= <m>, source lines <l> <= <k>, no risk signal`, parallel은 `diff exceeds single thresholds: <원인을 '; '로 연결>`이다. 원인은 001의 `singleVerdict.reasons` 순서(소스 파일, 소스 줄, `review_risk`, 위험 경로)대로 `source files 3 > 2`, `source lines 201 > 200`, `source lines unknown`, `review_risk <flags>`, `risk path <path>` 형식이다. 예: 소스 파일 4개와 `credential` 위험이면 `diff exceeds single thresholds: source files 4 > 2; review_risk credential`이다. low 사유 `blueprint complexity is low — single combined reviewer regardless of diff size`는 그대로다. security 사유는 `review_risk <flags> adds security reviewer`(그대로), flags가 없고 security 경로만 있으면 `risk path <첫 security 경로> adds security reviewer`, 둘 다 없으면 `review_risk empty — no security reviewer`(그대로)다.
  - 등급은 `strongCauses`와 `review.min_reviewer_tier`로 정한다. strong 사유는 `reviewer tier strong — <원인 '; '>`(원인에 `review.min_reviewer_tier strong` 포함)이고 기존 `reviewer tier strong — review_risk credential` 형태가 유지된다. standard 사유는 `reviewer tier standard — no review_risk, risk path, or size trigger`, low는 `reviewer tier standard — complexity low (size thresholds skipped) and no risk signal`이다. low도 `review_risk`와 위험 경로가 있으면 strong이다.
  - 생성물만 바꾼 diff(`.codex/agents/a.toml` 한 줄 추가)는 `totalFiles 0`, `sourceFiles 0`, `sourceLines 0`이라 `single`/`['combined']`, `reasons[0]`은 `source files 0 <= 2, source lines 0 <= 200, no risk signal`, 등급은 `standard`이며, payload의 `changed_files`는 snapshot 총합 1이다. `scripts/lib/commit-guard.js` 하나만 바꾼 diff는 `sourceFiles 0`이지만 위험 경로라 `parallel`, `reasons[0]`은 `diff exceeds single thresholds: risk path scripts/lib/commit-guard.js`, 등급은 `strong`이다(`security` 없음: `kind 'repo'`).
  - plan 단계의 등급은 commit task `affected_paths` 합집합(줄 수 없음, 중복 제거)과 `review_risk` 합집합으로 계산한다. `affected_paths`는 task frontmatter `bouncer.affected_paths`에서 읽고 문자열 항목만 쓴다. 빈 `affected_paths`는 구조 검증(S7)이 먼저 거절하므로 plan 등급 계산까지 오지 않는다. plan 전략(`single`/`perspectives`)과 `task_count` 필드는 바뀌지 않는다.
  - 정책은 `config.ts`의 `readComplexityPolicy(repoRoot)`로 읽고 신호는 `complexity-signals.ts`가 낸다. 문턱 상수는 이 파일에서 없어진다. 문턱 값에는 상한이 없다.
  - 적용된 정책이 `DEFAULT_COMPLEXITY_POLICY`와 다르면 plan·execute payload `reasons`의 등급 사유(미적용 사유가 있으면 그 뒤) 바로 뒤에 `complexity policy non-default: <config 키 순서대로 키=값을 '; '로 연결>`을 한 줄 싣는다. 위치: execute는 `[…, ...등급 사유, 이 줄]`이고 delta이면 이 줄 뒤에 `delta review — single combined reviewer after discovery`가 마지막으로 온다. plan은 `[…, ...등급 사유, 이 줄, ...migration 사유]`다. `risk_paths`·`generated_paths`는 `risk_paths=custom(<개수>)`·`generated_paths=custom(<개수>)`이고, 두 배열은 정렬한 목록이 기본값과 같으면 기본값으로 본다. 기본값이면 줄이 없다. 예: `complexity policy non-default: single_max_source_files=5; risk_paths=custom(2)`.
- 실패 경로: `readComplexityPolicy`가 `{ ok: false }`이면 plan·execute 모두 `{ ok: false, error: 'complexity config invalid', reason: 'complexity-config-invalid', next: 'complexity' }`로 거절한다. 거절 순서: plan은 기존 거절(S/G, index, `computePlanSnapshot`, previous 검사, task 적재, S30) 뒤에 `review-min-reviewer-tier-invalid`, 그 뒤에 `complexity-config-invalid`다. execute는 canonical·index·risk 읽기 거절 뒤에 `review-min-reviewer-tier-invalid`, 그 뒤에 `complexity-config-invalid`, 그 뒤에 git ref 해석(`git ref resolve failed`)과 snapshot 수집이다. 따라서 두 설정이 모두 틀리면 `review-min-reviewer-tier-invalid`가 이기고, 정책 거절은 git을 호출하지 않으며 `.bouncer/runtime/review-snapshots/`를 만들지 않는다. 기존 `review-min-reviewer-tier-invalid`·`git ref resolve failed` 사유와 필드는 그대로다.
- 보존: plan·execute payload의 키 집합(`changed_files`·`changed_lines` 총합 포함), delta의 `single`/`['combined']` 접기, `REVIEW_CONTRACT_INVALID` 거절, 브리프 최종 리뷰 관점, `review_risk` enum 검사(S30), 리뷰어 모델 매핑 규칙.

#### Interface

- 제공: 검증 seam을 둘로 나눈다. `readReviewMinTier(repoRoot) -> { ok: true; min: ReviewerTier | null } | DispatchFail`은 기존 `decideReviewerTier`의 `review.min_reviewer_tier` 검증(거절 모양 그대로)만 떼어 낸 함수로, plan·execute 모두 신호 계산·snapshot 수집보다 먼저 부른다. `computeReviewerTier({ causes, min, complexity }) -> { tier, reason }`로 바뀐다(`causes`는 `strongCauses` 결과). `decideReviewerTier({ repoRoot, agentName, baseDispatch, causes, min, complexity })`는 검증을 하지 않고 `computeReviewerTier`와 `applyReviewerTier`만 부르며 반환 모양은 같다. 내부 함수 `describeNonDefaultPolicy(policy) -> string | null`이 위 사유 줄을 만든다. 내부 함수 `loadCommitTaskSignals`가 task별 `affectedPaths`를 더 싣는다. export `EXECUTE_SMALL_MAX_FILES`·`EXECUTE_SMALL_MAX_LINES`와 상수 `REVIEWER_STRONG_MIN_TASKS`는 제거한다.
- 거부: 위 `complexity-config-invalid`. 신호 때문에 새로 생기는 다른 거절은 없다.
- 시험 seam: 기존 `exec`·임시 저장소 주입을 쓴다. 정책 값은 `.bouncer/config.json`을 임시 저장소에 써서 바꾸되 execute fixture에서는 `commitBaseline` 이전에 쓴다(뒤에 쓰면 `.bouncer/config.json`이 diff의 소스 파일로 세어진다). 정책 거절이 snapshot·git보다 먼저임은 `exec` 호출 기록(0회)과 `.bouncer/runtime/review-snapshots` 부재로 확인한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/review-dispatch.ts` | `classifyExecuteReview`, `classifyPlanReview`, `computeReviewerTier`, `decideReviewerTier`, `readReviewMinTier`(신규), `describeNonDefaultPolicy`(신규), `loadCommitTaskSignals`, 상수 | Modify | 전체 파일·줄 수와 task 수로 판정한다 | 신호·정책 기반 판정으로 바꾸고 min 검증을 분리하며 옛 상수와 그 JSDoc 언급을 지운다 | `:44`~`:53`, `:716`, `:903`, `:966`, `:1029`, `:1039`. `rg EXECUTE_SMALL`: `test/review-dispatch.test.js`, `:1418` export뿐 |
| `packages/cli/src/cli-config-command.ts` | `HELP`의 `review.min_reviewer_tier` 절 | Modify | 기본 등급이 task 수를 따른다고 쓴다 | 신호 기준 서술로 바꾼다 | `:47`~`:51`. `test/cli-help.test.js:428`이 이 절을 읽는다 |
| `test/review-dispatch.test.js` | 상수 import, 전략·등급 단언 | Modify | 옛 문턱을 단언한다 | Constraints의 목록대로 단언과 fixture를 바꾸고 새 케이스를 더한다 | `:14`~`:15`, `:326`, `:944`~`:995`, `:1052`, `:1207`, `:1431`~`:1446`, `:2485`, `:2513`~`:2598`, `:2671`, `:2772` |
| `test/cli-help.test.js` | `review.min_reviewer_tier` 도움말 단언 | Modify | 도움말 문구를 단언한다 | 바뀐 서술에 맞춘다 | `:428` 인접 |
| `test/skill-bouncer-surface.test.js` | 설정·규칙 문서 단언 | Modify | 설정 문서와 규칙 문서를 읽어 단언한다 | `docs/configuration.md`·`rules/planning.md`·`docs/workflow.md`에 task 수 문턱 서술이 없다는 단언을 추가한다 | `:557`이 `docs/configuration.md`를, `:456`이 `rules/planning.md`를 읽는다 |
| `rules/cli.md` | `review-dispatch` 서술 | Modify | small-diff 규칙과 task 수 문턱을 쓴다 | 새 single·strong 규칙, security 경로 규칙, non-default 사유 줄, 거절 순서를 쓴다 | `:549`, `:618`~`:624` |
| `rules/planning.md` | `## Complexity declaration` | Modify | low가 task 수 문턱을 끈다고 쓴다 | 크기 문턱을 끄고 위험 신호는 유지한다고 쓴다 | `:58`~`:61`. `doc-shape-contracts.ts:152`가 이 제목을 요구한다 |
| `docs/configuration.md` | `review.min_reviewer_tier` 행 | Modify | task 3개 이상이면 strong이라고 쓴다 | 신호 기준으로 바꾼다 | `:33` |
| `docs/workflow.md` | 복잡도 선언 항목 | Modify | `low`가 리뷰어 등급의 task 수 문턱을 바꾼다고 쓴다 | `low`가 크기 문턱을 건너뛰고 위험 신호는 유지한다고 쓴다 | `:145`~`:148` (`rg "task 수 문턱" docs`의 유일한 추가 hit) |
| `scripts/verify-complexity-signals-review.js` | 단계 목록 | Create | 없음 | 빌드 → typecheck → 문서 형태 → 테스트 → eslint → 테스트 이름 규칙 → context-comments 래퍼 | 같은 convention의 `scripts/verify-complexity-declaration.js` |

#### Constraints

- 바꿀 수 있는 기존 단언은 `test/review-dispatch.test.js`의 아래 항목뿐이고 그 밖의 단언은 그대로 통과해야 한다. 행마다 현재 이름, 바뀌는 점, 새 기대값이다. 줄 번호는 현재 파일 기준이다.
  - `size constants → are exported from one module`(`:325`): 이름을 `size policy defaults → come from config DEFAULT_COMPLEXITY_POLICY only`로 바꾼다. `:14`~`:15`의 `EXECUTE_SMALL_MAX_*` import는 `const { DEFAULT_COMPLEXITY_POLICY } = require('../packages/cli/dist/config')`로 바꾼다. 기대값은 `singleMaxSourceFiles === 2`, `singleMaxSourceLines === 200`이고, `review-dispatch` 모듈 export에 `EXECUTE_SMALL_MAX_FILES`·`EXECUTE_SMALL_MAX_LINES`가 `undefined`다(3 → 2).
  - `execute with a small diff → returns single combined`(`:944`~`:945`): 비교를 `changed_files <= DEFAULT_COMPLEXITY_POLICY.singleMaxSourceFiles`(2), `changed_lines <= …singleMaxSourceLines`(200)로 바꾸고(소스 2개·2줄 fixture라 그대로 참), `reasons[0] === 'source files 2 <= 2, source lines 2 <= 200, no risk signal'` 단언을 더한다.
  - `execute over the file threshold → returns parallel`(`:972`): `changed_files > …singleMaxSourceFiles`(4 > 2)로 바꾸고 `reasons[0] === 'diff exceeds single thresholds: source files 4 > 2'`를 더한다.
  - `execute with complexity low and a large diff via --blueprint → returns single combined`(`:995`): `changed_files > …singleMaxSourceFiles`(4 > 2)만 바꾼다. 나머지 단언은 그대로다.
  - `execute with a lines-only breach → returns parallel`(`:1431`~`:1446`): 줄 수를 `singleMaxSourceLines + 1`(201줄 파일 + 1줄 파일)로 만들고 `changed_files <= 2`, `changed_lines > 200`으로 바꾸며 `reasons[0] === 'diff exceeds single thresholds: source lines 202 > 200'`를 더한다.
  - `execute with risk flags → appends security on single and parallel`(`:1052`): 이름을 `execute with risk flags → appends security on parallel for one source file and for many`로 바꾼다. standard + `public_interface` + 소스 1개 케이스(`small`)의 기대값을 `strategy 'parallel'`, `perspectives ['spec_scope','correctness_tests','minimality_maintainability','security']`로 바꾸고(single → parallel), 소스 4개 케이스는 그대로다. single+security 조합은 low 케이스(`execute with complexity low and review_risk → yields combined and security`, `:1032` 인접)가 계속 덮는다.
  - `review_contract brief with a task-scoped review → keeps the legacy perspective rules`(`:1207`): 이름을 `… → uses the size-and-risk rule (review_risk forces parallel)`로 바꾸고 기대 `perspectives`를 `['combined','security']`에서 `['spec_scope','correctness_tests','minimality_maintainability','security']`로 바꾼다(소스 1개 + `public_interface`는 parallel).
  - `plan with three commit tasks → reviewer_tier strong`(`:2485`): 이름을 `plan with three commit tasks and empty review_risk → reviewer_tier standard`로, 기대를 `standard`로 바꾼다.
  - 모델 매핑 plan 테스트 다섯 개 — `plan with strong tier and model_tiers.claude.strong → agent_dispatch.model is the mapped slug`(`:2513`), `plan with strong tier mapped to inherit → keeps the slot dispatch with a tier-inherit reason`(`:2524`), `plan with strong tier mapped to inherit and no slot → keeps the null model dispatch with the reason`(`:2541`), `plan with strong tier and no strong mapping → keeps the old agent_dispatch with a not-applied reason`(`:2557`), `plan with strong tier and an unknown provider → not applied with a not-applied reason`(`:2598`): 이 다섯은 task 3개 규칙으로만 strong이 되던 fixture(`tierPlanRepo(['001','002','003'])`)를 쓴다. fixture만 `tierPlanRepo(['001'], [['public_interface']])`로 바꾸고 기대값(`reviewer_tier 'strong'`, `reviewer_tier_applied`, `agent_dispatch`, 미적용 사유 문자열)은 한 글자도 바꾸지 않는다. `plan with no model_tiers → agent_dispatch equals the slot-only resolution`(`:2589`)은 등급과 무관해 그대로다.
  - `execute blueprint scope with three commit tasks and empty review_risk → reviewer_tier strong`(`:2671`): 이름의 "strong"을 "standard"로, 기대를 `standard`로 바꾼다.
  - `plan three empty-risk tasks → low is standard tier and standard is strong`(`:2772`): 이름을 `plan three empty-risk tasks → low and standard are both standard tier`로 바꾸고, standard 기대를 `standard`로, low 사유 단언 `complexity low (no task-count threshold)`를 `complexity low (size thresholds skipped)`로 바꾼다.
  - matrix 테스트(`:2437`): 첫 사유 단언을 `diff exceeds small thresholds (files=4, lines=4)`에서 `diff exceeds single thresholds: source files 4 > 2; review_risk credential`로 바꾼다. 같은 matrix의 `reviewer tier strong — review_risk credential` 단언(`:2423`, `:2431`)은 소스 4개·모듈 1개·전체 4개로 크기 근거가 없으므로 그대로 통과해야 한다.
  - 소스 파일이 3개 이상인 기존 large diff fixture(`largeDiff`)는 그대로 쓰고 `parallel` 기대를 유지한다.
  - 위에 적지 않은 기존 단언(delta 접기 `:1127`, brief 관점 `:1172`~`:1195`, 모델 매핑 `:2536`~`:2723`)은 바꾸지 않는다. 기본 정책에서는 `non-default` 줄이 없으므로 `reasons` 길이도 같다. 구현 뒤 `node --test test/review-dispatch.test.js`에서 이 목록 밖의 단언이 실패하면 그 단언을 고치지 않고 원인을 worker 보고에 적는다.
- `test/skill-bouncer-surface.test.js`는 단언 추가만 허용하고 기존 단언은 바꾸지 않는다.
- `cli-help.test.js`는 `review.min_reviewer_tier`의 값 어휘(`standard | strong`)와 `review-min-reviewer-tier-invalid` 단언을 유지한다.
- `rules/cli.md`의 거절 표 헤딩·행과 `rules/planning.md`의 `## Complexity declaration` 제목은 유지한다.
- 신호 계산은 `complexity-signals`의 함수만 쓰고 정책 기본값은 `config.ts`의 `DEFAULT_COMPLEXITY_POLICY`만 쓴다. 이 파일에 위험 경로·소스 판정·모듈 규칙을 복사하지 않는다.
- `review.min_reviewer_tier` 검증은 `readReviewMinTier` 한 곳에서만 하고 plan·execute가 같은 함수를 부른다. `decideReviewerTier`에 검증을 다시 넣지 않는다.

### plugin-surface-slimming/complexity-signals/005 · `78da0103`

#### Goal & intent

`bouncer coordinate worker-model`이 reviewer 기록에 `--strategy <single|parallel>`와 `--reviewer-tier <standard|strong>`를 받아 원장 결정의 선택 키 `strategy`·`reviewer_tier`로 남기게 한다. 값은 coordinator가 execute `review-dispatch` payload의 `strategy`·`reviewer_tier`를 그대로 넘긴다. 006의 `drive_record` 집계가 이 키를 읽는다. 검증 명령은 `node scripts/verify-complexity-signals-worker-flags.js`다.

#### Current behavior

- `coordinateWorkerRecord`(`coordinator-commands.ts:877` 근방)는 `role`·`model`·`task`·`perspective`·`tokens`만 받아 `{kind: 'worker-model', role, model, task?, perspective?, tokens?}`를 원장과 task decisions에 덧붙인다(`:918` 근방).
- CLI는 `COORDINATE_STRING_FLAG_FIELDS`(`cli-git-commands.ts:535` 근방)로 플래그를 인자로 옮기고 `checkWorkerFlags`(`:644`)가 값 없는 `--task`·`--perspective`·`--tokens`를 usage(2)로 막는다. 모르는 플래그는 무시된다.
- 거절 사유 `worker-model-role-invalid`·`worker-model-perspective-invalid`·`tokens-invalid`·`model-invalid`는 hint 표(`:2133`~`:2148`)에 있고 `rules/cli.md:309`~`:330`, `skills/bouncer-run/references/agent-dispatch.md:332`~`:343`이 서술한다.
- 확인한 명령: `node --test test/coordinator.test.js test/cli-coordinate.test.js` (변경 전 통과).

#### Target behavior

- 성공 경로:
  - `worker-model --role reviewer --model m --strategy parallel --reviewer-tier strong`은 결정 `{kind: 'worker-model', role: 'reviewer', model: 'm', strategy: 'parallel', reviewer_tier: 'strong'}`를 원장과(`--task`가 있으면) task decisions에 덧붙인다. 두 플래그는 서로 독립이라 하나만 줘도 된다. 플래그가 없으면 해당 키를 쓰지 않는다.
  - 결과 JSON의 `decision`에 같은 키가 실린다.
- 실패 경로(원장 미기록, 기존 거절과 같은 채널):
  - `--strategy`가 `single`·`parallel` 밖(대소문자 구분: `Single`·`serial`·빈 문자열 포함)이거나 role이 reviewer가 아니면 `worker-model-strategy-invalid`다. role이 reviewer가 아니면 값이 유효해도 거절한다(`--role debugger --strategy single`).
  - `--reviewer-tier`가 `standard`·`strong` 밖(`high`·`Strong`·빈 문자열 포함)이거나 role이 reviewer가 아니면 `worker-model-reviewer-tier-invalid`다(`--role implementer --reviewer-tier strong`도 거절).
  - 두 플래그를 `worker-tokens`에 주면 `coordinate worker-tokens: --strategy is worker-model only`(또는 `--reviewer-tier`) usage(2)이고, 값 없이 주면 `coordinate worker-model: --strategy requires a value` usage(2)다.
  - 검증 순서는 role → model → perspective → strategy → reviewer-tier → tokens → task 소속(`task-outside-blueprint`)이며 첫 실패에서 멈추고 원장(과 task decisions)에는 아무것도 쓰지 않는다. 기존 코드는 role → model → perspective → tokens → task 소속 순서라 strategy·reviewer-tier를 perspective 뒤, tokens 앞에 끼운다.
- 기록 의미: `strategy`·`reviewer_tier`는 coordinator가 `review-dispatch` payload에서 옮긴 계산 결과이고 모델 매핑 적용 여부(`reviewer_tier_applied`)와 별개다. strong이 계산됐지만 매핑이 없어 `reviewer_tier_applied: false`여도 `reviewer_tier`는 payload 값 `strong`으로 기록되고, 적용 여부는 이 기록에 남지 않는다. 006의 집계도 같은 의미(계산된 등급)로 읽는다.
- 보존: 기존 거절 사유와 우선순위, `tokens` 처리, `worker-tokens-missing` 키 체계(task, role, perspective), 두 플래그가 없는 호출의 결정 모양.

#### Interface

- 제공: CLI `coordinate worker-model … [--strategy <single|parallel>] [--reviewer-tier <standard|strong>]`, 결정 선택 키 `strategy`·`reviewer_tier`, hint 표의 새 두 사유.
- 거부: 위 두 사유와 usage(2). 새 사유마다 `cause`와 `next`가 hint 표에 있어야 한다.
- 시험 seam: 기존 `coordinate` 호출과 `runCli` 주입을 쓴다. 새 주입 파라미터는 없다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/coordinator-commands.ts` | `coordinateWorkerRecord`, `WorkerModelDecision`, hint 표 | Modify | worker 기록을 덧붙이고 거절 hint를 둔다 | 선택 키 두 개의 검증·기록과 새 두 hint를 넣는다 | `:94`~`:99`, `:877`, `:2143` |
| `packages/cli/src/coordinator-command-contracts.ts` | 인자 타입 | Modify | coordinate 인자 모양을 정한다 | `strategy`·`reviewerTier` 필드를 추가한다 | `:12`가 `perspective`·`tokens`를 정의한다 |
| `packages/cli/src/cli-git-commands.ts` | `COORDINATE_STRING_FLAG_FIELDS`, `checkWorkerFlags` | Modify | 플래그를 인자로 옮기고 형식을 검사한다 | 두 플래그를 옮기고 값 없음·`worker-tokens` 사용을 usage로 막는다 | `:535`, `:644`~`:658` |
| `packages/cli/src/cli-usage.ts` | `worker-model` usage 문자열 | Modify | 명령 도움말을 둔다 | 새 플래그를 도움말에 적는다 | `:59`. `test/cli-help.test.js`가 도움말을 읽는다 |
| `rules/cli.md` | worker-model 서술 | Modify | 기록 모양과 거절 목록을 쓴다 | 새 키와 두 사유를 적는다 | `:309`~`:330` |
| `skills/bouncer-run/references/agent-dispatch.md` | `Reviewer, per task`·`Reviewer, final review` 항목 | Modify | reviewer 기록 절차를 쓴다 | payload의 `strategy`·`reviewer_tier`를 새 플래그로 넘기라고 쓴다 | `:332`~`:343`. 헤딩은 바꾸지 않는다(`doc-shape-contracts.ts:114`) |
| `test/coordinator.test.js` | worker-model 케이스 | Modify | 기록과 거절을 단언한다 | 기록·거절·hint 단언을 추가한다 | `:5282`~`:5287`, `:5559` |
| `test/cli-coordinate.test.js` | worker-model CLI 케이스 | Modify | 플래그 형식을 단언한다 | 두 플래그의 usage·기록 단언을 추가한다 | worker-model 플래그 검사 케이스 인접 |
| `test/reviewer-tier-docs.test.js` | agent-dispatch 단언 | Modify | reviewer_tier 문서 연결을 단언한다 | agent-dispatch.md의 reviewer 두 항목이 `--strategy`와 `--reviewer-tier`를 적었다는 단언을 추가한다 | `:12`의 `DOCS` 목록이 agent-dispatch.md를 읽는다 |
| `test/cli-help.test.js` | worker-model usage 단언 | Modify | 도움말 문구를 단언한다 | 새 플래그 문구 단언을 추가한다 | `rg worker-model test/cli-help.test.js` |
| `scripts/verify-complexity-signals-worker-flags.js` | 단계 목록 | Create | 없음 | 빌드 → typecheck → 문서 형태 → 테스트 → eslint → 테스트 이름 규칙 → context-comments 래퍼 | 같은 convention의 `scripts/verify-complexity-declaration.js` |

#### Constraints

- 기존 `test/coordinator.test.js`·`test/cli-coordinate.test.js`·`test/reviewer-tier-docs.test.js` 단언은 바꾸지 않는다. 추가만 한다.
- hint 표의 새 사유 두 개는 같은 파일의 모든 사유가 `cause`·`next`를 갖는다는 기존 검사를 통과해야 한다.
- agent-dispatch.md의 두 항목은 값을 "payload에서 그대로 옮기라"고만 쓴다. 값을 coordinator가 다시 계산하라는 문장을 두지 않는다. delta 리뷰도 그 호출 payload의 값을 쓴다.
- 이 task는 문서가 호출하는 플래그를 추가한다. 플래그 없이 호출하는 기존 문서·옛 coordinator 호출은 계속 유효하다.

### plugin-surface-slimming/complexity-signals/006 · `0d1e0c39`

#### Goal & intent

`summarizeDriveRecord`가 reviewer `worker-model` 결정의 `strategy`·`reviewer_tier`를 모아 `drive_record.reviewer.strategies`·`tiers`로 낸다. 키가 없는 옛 snapshot은 계속 유효한 `DriveRecord`로 읽힌다. 검증 명령은 `node scripts/verify-complexity-signals-drive-record.js`다.

#### Current behavior

- `summarizeDriveRecord`는 reviewer 결정(`kind 'worker-model'`, `role 'reviewer'`)에서 `dispatches`·`perspectives`·`models`만 낸다(`drive-record.ts:89`, `:103`~`:107`). 정렬·중복 제거는 `sortedUnique`다.
- `isDriveRecord`(`:165` 근방)는 `reviewer`가 `dispatches` 정수와 `perspectives`·`models` 문자열 배열을 갖는지 검사한다. `scripts/measure-drive-records.js:60`~`:70`이 같은 검사를 따로 복제한다.
- `rules/cli.md:451`~`:454`가 `drive_record`의 `mode`·`promotion` 키를 서술한다.
- 확인한 명령: `node --test test/drive-record.test.js test/measure-drive-records.test.js` (변경 전 통과).

#### Target behavior

- 성공 경로:
  - `summarizeDriveRecord(ledger, review).reviewer`는 `{ dispatches, perspectives, models, strategies, tiers }`다. `strategies`는 reviewer 결정의 문자열 `strategy` 값을, `tiers`는 문자열 `reviewer_tier` 값을 정렬·중복 제거해 낸다. 키가 있는 결정이 없으면 `[]`다. 결정 입력의 `strategy`·`reviewer_tier`가 문자열이 아니면 무시한다.
  - 입력: reviewer 결정 `{strategy: 'parallel', reviewer_tier: 'strong'}`, `{strategy: 'single', reviewer_tier: 'standard'}`, `{strategy: 'parallel', reviewer_tier: 'strong'}` → `strategies ['parallel','single']`, `tiers ['standard','strong']`, `dispatches 3`.
  - implementer·debugger 결정의 두 키는 세지 않는다.
  - `tiers`는 payload의 계산된 등급을 기록한 값이다. 모델 매핑 적용 여부(`reviewer_tier_applied`)는 기록·집계하지 않으므로, 계산은 `strong`이지만 매핑이 없어 미적용인 dispatch도 `tiers`에 `strong`으로 나타난다. `rules/cli.md` 서술이 이 의미를 적는다.
- 판독: `isDriveRecord`는 `reviewer.strategies`·`tiers`가 없어도 true이고, 있으면 문자열 배열이어야 한다(숫자 원소나 비배열이면 false). `scripts/measure-drive-records.js`의 복제 검증도 같은 규칙이다.
- 보존: 다른 `drive_record` 키와 `mode`·`promotion` 규칙, `reviewer.dispatches`·`perspectives`·`models` 값, 입력 원장 불변.

#### Interface

- 제공: `DriveRecord.reviewer`에 선택 필드 `strategies?: string[]`, `tiers?: string[]`(새 계산은 항상 채우고, 선택인 이유는 옛 snapshot 판독이다). `rules/cli.md` 서술에 두 키가 추가된다.
- 거부: `isDriveRecord`는 위 배열 규칙을 어긴 `reviewer`를 false로 거절한다(snapshot 판독에서 `metrics-snapshot-invalid`). `strategy`·`reviewer_tier` 값 어휘(`single|parallel`, `standard|strong`)는 이 집계가 검증하지 않는다. 어휘는 005의 기록 단계가 지킨다.
- 시험 seam: 순수 함수라 주입 파라미터가 없다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/drive-record.ts` | `DriveRecord`, `summarizeDriveRecord`, `isDriveRecord` | Modify | reviewer 요약과 판독을 맡는다 | 두 배열을 계산하고 선택 키 검증을 더한다 | `:20`, `:89`, `:103`, `:165`. `rg isDriveRecord`: `scripts/measure-drive-records.js`는 복제 검증 |
| `scripts/measure-drive-records.js` | 복제 `isDriveRecord` | Modify | snapshot 모양을 검증한다 | 같은 선택 배열 규칙을 반영한다 | `:60`~`:70`. 복제가 갈라지면 집계가 새 snapshot을 `not-snapshot`으로 건너뛴다 |
| `test/drive-record.test.js` | `ZERO`, reviewer 케이스, 판독 케이스 | Modify | 요약·판독을 단언한다 | 새 키 기대값과 판독 케이스를 추가한다 | `:11`, `:71`~`:81`, `:130`~`:149` |
| `test/measure-drive-records.test.js` | snapshot fixture | Modify | 집계 스크립트를 단언한다 | 새 키가 있는 snapshot과 없는 snapshot이 모두 집계되는 단언을 추가한다 | `:18` |
| `rules/cli.md` | `drive_record` 서술 | Modify | 기록 키를 설명한다 | `reviewer.strategies`·`tiers`와 기록 출처, `tiers`가 계산된 등급이며 적용 여부와 별개임을 쓴다 | `:451`~`:454` |
| `scripts/verify-complexity-signals-drive-record.js` | 단계 목록 | Create | 없음 | 빌드 → typecheck → 문서 형태 → 테스트 → eslint → 테스트 이름 규칙 래퍼 | 같은 convention의 `scripts/verify-drive-records.js` |

#### Constraints

- `test/drive-record.test.js`의 `ZERO` 상수와 `reviewer worker-model 결정 → 횟수와 고유 perspective·model을 사전순으로 낸다`의 기대 객체는 `strategies: []`, `tiers: []`를 더하는 변경만 허용한다. `키 하나가 빠졌거나 타입이 틀린 객체` 테스트는 `ZERO`의 모든 키를 하나씩 지우는데, 새 두 키는 `reviewer` 안에 있어 반복 대상이 아니므로 그 테스트 본문은 바꾸지 않는다.
- `isDriveRecord`는 `strategies`·`tiers`의 부재를 허용한다. 필수로 만들면 `measure-drive-records.js`가 읽는 과거 snapshot이 모두 거절된다.
- 집계 스크립트의 출력 모양(`by_mode`, `promotions` 등)은 바꾸지 않는다.

### plugin-surface-slimming/complexity-signals/007

#### Goal & intent

여섯 commit task가 모두 통합된 뒤 공용 신호 모듈, routing, review-dispatch, worker-model 기록, drive_record 집계가 전체 테스트를 함께 통과하는지 확인한다. 실행 명령은 frontmatter `verify`(`npm test`, `pretest`가 빌드를 먼저 돌린다)를 정본으로 삼는다.

#### Current behavior

구현 task의 전용 검증은 각자 닿는 테스트와 정적 검사만 돈다. 이 node는 여섯 task가 integrated가 된 뒤 열린다.

#### Target behavior

검증 성공 시 CLI가 verification 증적과 통합 상태를 기록한다. 실패 시 원문 실패와 원인을 보고하며 source를 직접 고치거나 성공을 기록하지 않는다.

#### Interface

- 제공: 전체 구현 통합 후 종단 검증 증적.
- 거부: source 변경, task review 문서, task commit, 검증 실패의 임의 성공 처리.

#### Touch

Source 변경 경로 없음.

#### Constraints

전용 검증을 전체 테스트 증적으로 대체하지 않는다. 미커밋 사용자 파일(`PLUGIN-SURFACE-SLIMMING-PROPOSAL.md` 등)을 보존한다. 실패 복구는 coordinator의 기존 repair·reverify 계약을 따른다.

### plugin-surface-slimming/complexity-signals/008 · `1fd05099`

#### Goal & intent

최종 리뷰 finding을 수정한다.

- F-498ca609 (minor, correctness_tests, must_fix) — test/cli-help.test.js#coordinate worker-model --help → lists both review flags and says reviewer-only — tasks/005 checklist

#### Interface

- 제공: 기록된 리뷰 finding을 해소하는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `test/cli-help.test.js` — 기록된 리뷰 finding을 수정한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.
