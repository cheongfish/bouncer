# 소스 경계 inventory

이 문서는 소스 재구성 epic(106)의 후속 blueprint가 같은 근거로 공개 경계와 테스트 전환 범위를 정하도록 기준선, 소비자 현황, 경계 초안, 테스트 inventory를 한곳에 남긴다. 소스 규칙의 정본이 아니며 후속 blueprint의 `Touch`·`affected_paths`를 대신하지 않는다. 규칙의 소유 위치는 [rule-ownership.md](rule-ownership.md)가 정한다.

## 기준선

기준 커밋은 `c94947e7`이다. 수치는 작업 트리가 아니라 이 커밋에서 직접 측정했으며 같은 blueprint의 다른 task 결과를 포함하지 않는다. 적재 수·coverage·소요 시간은 `git worktree add --detach <임시경로> c94947e7`로 만든 임시 작업 트리에서 `npm ci && npm run build` 뒤 측정하고 측정 후 `git worktree remove`로 지웠다.

| 항목 | 전 (`c94947e7`) | 후 | 측정 명령 |
| --- | --- | --- | --- |
| `scripts/src/lib/*.ts` 모듈 수 | 92 | 118 | `git ls-tree -r --name-only c94947e7 scripts/src/lib`로 목록을 얻어 최상위 `.ts`만 센다 |
| `scripts/src/lib/*.ts` 합계 줄 수 | 41956 | 50514 | 같은 목록에 `git show c94947e7:<경로> \| wc -l`을 합산한다 |
| `test/*.test.js` 파일 수 | 103 | 117 | `git ls-tree -r --name-only c94947e7 test`에서 `test/*.test.js`만 센다 |
| `test/*.test.js` 합계 줄 수 | 54583 | 66029 | 같은 목록에 `git show c94947e7:<경로> \| wc -l`을 합산한다 |
| `../scripts/lib/*`를 직접 require하는 테스트 파일 | 82개 파일, 대상 모듈 70종 | 96개 파일, 대상 모듈 87종 | 각 테스트 소스에서 `require('../scripts/lib/<모듈>')`를 추출해 파일·모듈을 중복 없이 센다 |
| `require('./scripts/lib/cli')` 적재 모듈 수 | 77 (help 실행 후에도 77) | 3 (help 실행 전후 모두 같은 측정 명령, 기준선 77) | `node -e "require('./scripts/lib/cli'); console.log(Object.keys(require.cache).filter(k=>k.includes('/scripts/lib/')).length)"` (빌드 후) |
| export 키 수 | `coordinator` 19, `scope` 13, `finalize` 12, `verification` 11, `validate` 10 | `coordinator` 22, `scope` 16, `finalize` 1, `verification` 11, `validate` 10 | `node -e "console.log(Object.keys(require('./scripts/lib/<모듈>')).length)"` (빌드 후) |
| coverage lines | 95.25% | 95.49% | `npm run test:coverage`의 `all files` 행 |
| coverage branches | 85.02% | 86.64% | 같은 행 |
| coverage functions | 98.11% | 98.23% | 같은 행 |
| `npm test` 소요 시간 | 약 52초 (참고값: 환경 의존, 2443개 테스트 통과) | 약 69초 (참고값: 환경 의존, snapshot의 `npm test` 69,032ms) | `time npm test` (같은 환경의 `npm run test:coverage`는 약 49초) |

"후" 열은 기준선 `c94947e7737074e58ca882b59b9215c192051e6b`와 측정 시작 커밋 `d2af67192ec335d8d287b28a22e8f3b3ab2c290a`를 같은 Node 24.22.0·npm 11.19.1·linux x64에서 `scripts/measure-source-boundaries.js snapshot`으로 잰 값이며, 원본은 [measurements/source-restructuring.json](measurements/source-restructuring.json)이다. coverage "전" 값은 같은 도구로 다시 잰 값으로 바로잡았다. `require('./scripts/lib/cli')` 적재 수는 snapshot이 담지 않아 표의 측정 명령을 두 checkout에서 직접 실행했다. 적재 수는 목표값으로 고정하지 않고 허용 의존성과 기준선 대비 결과를 기록하는 방식으로 쓴다.

## 소비자 inventory

### 외부 진입점

| 진입점 | 위치 | 연결하는 모듈 |
| --- | --- | --- |
| `bouncer` 래퍼 | `scripts/bouncer:81` | `./lib/cli` |
| `bouncer-root` 래퍼 | `scripts/bouncer-root:27` | `./lib/bouncer-root` |
| commit 훅 | `hooks/commit-safety.js:6`, `hooks/cursor-commit-safety.js:9` | `lib/commit-hook` |
| 세션 그래프 훅 | `hooks/session-graph.js:8` | `lib/session-graph` |
| `package.json` `bin` | `bouncer`→`scripts/bouncer`, `bouncer-root`→`scripts/bouncer-root` | 위 두 래퍼 |
| 매니페스트 | `plugin.json`과 호스트 매니페스트 | `scripts/lib` 참조 없음 |

훅은 상대 `require`를 쓰고, stale-build 검사는 두 bin 래퍼만 한다.

### 내부 helper export

외부 진입점 밖의 `scripts/lib/*` export는 내부 helper다. 기준선에서 82개 테스트 파일이 70종의 모듈을 직접 require하므로 사실상 테스트가 가장 큰 소비자다. export가 많은 모듈은 위 기준선 표의 export 키 수를 따른다. 모듈별 소비자 전수 표는 미분류 — 해당 영역을 수정하는 blueprint에서 채운다.

### 한계

저장소 밖에서 `scripts/lib/*`를 `require`하는지는 저장소 안에서 알 수 없다. `package.json`의 `files`가 `scripts/lib/`를 배포하므로 기술적으로는 가능하다. 따라서 공개 경계를 좁히는 blueprint는 외부 사용이 없다고 가정하지 말고 호환 영향을 따로 기록한다.

이번 경계 이동으로 제거한 export와 대체 위치는 다음과 같다. 저장소 밖 소비자는 대체 모듈에서 함수를 가져오도록 바꿔야 하므로 호환성이 깨질 수 있다.

| 제거한 export | 대체 위치 |
| --- | --- |
| `verification.entriesForVerify` | `verification.selectVerificationEntries`·`verification-target.resolveVerificationTarget` |
| `verification.readVerifyCommand` | `verification-target.readVerifyCommand` |
| `finalize.buildCommitMessage`·`buildFinalizeCommitMessage` | `commit-message` |
| `finalize.realGit`·`resolveCheckoutBranch` | `git-ops` |
| `finalize.collectTransientRels`·`collectTaskCommits`·`buildCoordinatorProvenance`·`collectCoordinatorProvenance` | `finalize-collect` |
| `finalize.buildTaskContext`·`writeExplainTaskCommits`·`writeExplainTaskContext` | `finalize-explain` |

## 기능별 공개 경계 초안

영역별 경계의 함수 이름은 이 blueprint에서 확정했다. planning·execution은 이 blueprint의 이동 대상이 아니므로 기존 초안 표기를 유지한다.

| 영역 | 책임 | 외부로 노출할 경계 | 비고 |
| --- | --- | --- | --- |
| planning | epic·blueprint·tasks 문서 작성, scope, 계획 gate 입력 | 영역 진입 함수 한 묶음 (이름은 후속 blueprint가 확정) | 나머지 helper는 내부로 둔다 |
| execution | coordinator 판단, worker 배정, ledger 기록 | 영역 진입 함수 한 묶음 (이름은 후속 blueprint가 확정) | export 키가 가장 많은 `coordinator`가 우선 대상이다 |
| verification | verify 실행, 증거 기록, gate 판정 | `verification-target.resolveVerificationTarget`·`runSelectedVerification`·`readVerifyCommand`, `verification.runVerification` | execute gate만 성공 증거를 쓴다는 규칙을 유지한다 |
| delivery | finalize, commit 안전, PR 인계 | `git-ops.realGit`·`resolveCheckoutBranch`, `commit-message.buildCommitMessage`·`buildFinalizeCommitMessage`, `finalize.finalize` | `retention-migration`은 delivery 소비자로 단계 모듈을 직접 쓴다. 훅이 쓰는 `commit-hook`은 외부 진입점이므로 유지한다 |
| CLI | 명령 dispatch, usage 제공, 명령별 실행기 적재 | `cli.runCli` | 명령별 구현은 지연 적재한다. `cli-usage`는 정적 usage만 제공한다 |

영역별 모듈 배치는 TASKS-001~003 통합 결과와 빌드된 export를 기준으로 기록한다.

| 영역 | 모듈 | 책임 | 공개 경계 여부 |
| --- | --- | --- | --- |
| verification | `verification-target` | 대상 확인, 선택된 대상 실행, verify 명령 조회 | 예: `resolveVerificationTarget`, `runSelectedVerification`, `readVerifyCommand` |
| verification | `verification` | 대상 목록 선택, verify 실행 및 결과 기록 | 예: `selectVerificationEntries`, `runVerification` |
| delivery | `git-ops` | Git 실행과 checkout branch 결정 | 예: `realGit`, `resolveCheckoutBranch` |
| delivery | `commit-message` | commit/finalize commit 메시지 구성 | 예: `buildCommitMessage`, `buildFinalizeCommitMessage` |
| delivery | `finalize` | finalize 절차 오케스트레이션 | 예: `finalize` |
| delivery | `finalize-collect` | task commit, provenance, transient relation 수집 | 아니요: 내부 단계 helper |
| delivery | `finalize-checks` | integration과 coordinator evidence 검사 | 아니요: 내부 단계 helper |
| delivery | `finalize-explain` | explain용 task context와 commit 설명 구성 | 아니요: 내부 단계 helper |
| delivery | `retention-migration` | 보존 정책 migration; 단계 모듈을 직접 소비 | 예: `auditRetention`, `migrateRetention`, 조회 helper |
| CLI | `cli` | CLI 진입점, dispatch 및 flags 처리 | 예: `runCli`, `parseFlags` |
| CLI | `cli-usage` | 공통 명령 usage 정본 | 아니요: 상수 모듈 |
| CLI | `cli-git-commands` | coordinate 및 Git 명령 handler | 아니요: CLI 내부 handler |
| CLI | `cli-doc-commands` | 문서·검증 명령 handler | 아니요: CLI 내부 handler |
| CLI | `cli-project-commands` | 프로젝트 명령 handler | 아니요: CLI 내부 handler |
| CLI | `cli-commit-guard-command` | commit guard 명령 handler | 아니요: CLI 내부 handler |
| CLI | `cli-config-command` | config 명령 handler | 아니요: CLI 내부 handler |
| CLI | `cli-context-review-command` | context review 명령 handler | 아니요: CLI 내부 handler |
| CLI | `cli-current-command` | current 명령 handler | 아니요: CLI 내부 handler |
| CLI | `cli-dispatch-command` | dispatch 명령 handler | 아니요: CLI 내부 handler |
| CLI | `cli-intent-command` | intent 명령 handler | 아니요: CLI 내부 handler |
| CLI | `cli-metrics-command` | metrics 명령 handler | 아니요: CLI 내부 handler |
| CLI | `cli-retro-command` | retro 명령 handler | 아니요: CLI 내부 handler |
| CLI | `cli-review-command` | review 명령 handler | 아니요: CLI 내부 handler |
| CLI | `cli-review-dispatch-command` | review dispatch handler | 아니요: CLI 내부 handler |

CLI 적재는 빌드 후 아래 두 명령으로 측정했다. `require('./scripts/lib/cli')` 직후와 `--help` 실행 후 모두 `scripts/lib` 모듈 3개가 적재되어 기준선 77보다 74개 적다. help를 출력하기 위해 명령별 업무 모듈을 추가 적재하지 않으므로 영역별 지연 적재 판정은 통과한다.

```bash
node -e "require('./scripts/lib/cli'); console.log(Object.keys(require.cache).filter(k=>k.includes('/scripts/lib/')).length)" # 3
node -e "require('./scripts/lib/cli').runCli(['--help'],{out(){},err(){}}); console.log(Object.keys(require.cache).filter(k=>k.includes('/scripts/lib/')).length)" # 3
```

## 구현 고정 테스트 inventory

현재 고정 대상이 구현 세부(내부 문자열, 파일 구조, 적재 방식)에 묶인 테스트와 전환 판단이다. 담당 task는 같은 blueprint(001)의 task 번호다.

| 파일 | 현재 고정 대상 | 보호 동작 | 판단 | 담당 task/blueprint |
| --- | --- | --- | --- | --- |
| `test/coordinator.test.js` | `coordinator.ts` 한 파일 소스의 `reason` 리터럴 | `coordinator.ts`와 정적으로 닿는 `coordinator-*` 모듈의 모든 `reason`이 `COORDINATE_FAILURE_HINTS`에 전용 힌트를 가져, 거절 응답이 일반 폴백 힌트로 떨어지지 않는 동작 | 전환함: 단일 파일 대신 도달 가능한 소스 파일 집합을 훑고, 실제 거절 응답의 `cause !== reason`으로 폴백 여부를 확인하며, 힌트 없는 reason을 주입해 검사 유효성을 확인 | TASKS-003 |
| `test/tasks-docs.test.js` | 공유 `require.cache`를 지운 단독 로드 | `tasks-docs`가 CLI·coordinator·gate 같은 상위 계층 모듈을 전이적으로 끌어오지 않는 계층 경계 | 전환함: 캐시 삭제 대신 소스 의존 그래프의 전이 도달 집합으로 금지 모듈 도달을 검사하고, 가짜 그래프로 검사 유효성을 확인 | TASKS-003 |
| `test/master-rules.test.js` | init 소스 문자열 | `init`이 플러그인 마스터 규칙을 프로젝트 루트(`AGENTS.md`·`CLAUDE.md`)에 설치하지 않고, 기존 프로젝트 `AGENTS.md`를 바이트 그대로 둔다 | 전환함: 소스 문자열 대신 임시 git 저장소에서 실제 `init`을 실행해 산출물을 검사하고, 가짜 `initFn`으로 설치 실패 모드를 되살려 단언 유효성을 확인. git·init 실행이 필요해 `integration` 계층으로 옮김 | TASKS-005 |
| `test/ci-contract.test.js` | `ci` 스크립트 전체 문자열과 check-emit 소스 문구 | `ci`의 단계 순서(emit 검사가 coverage보다 앞, `lint:test-names`는 typecheck 뒤·audit 앞), check-emit이 shell 없이 실행되는 것, 관련 없는 수정 파일이 있어도 깨끗한 emit이면 종료 코드 0 | 전환함: `&&` 단계 토큰의 존재와 순서만 고정하고 Git 인자·상태 판정은 동작 fixture로 검사. shell 미사용 한 건만 실행 경계 속성이라 소스 텍스트를 의도적으로 유지 | TASKS-005 |
| `test/public-name-regression.test.js` | 허용 목록 | 폐기한 제품 이름이 소스에 남지 않는 동작 | 유지함(전환 안 함): 목록 위치가 아니라 내용 표식으로 판단해야 하므로 후속으로 미룸 | 후속(내용 표식 필요) |
| `test/typescript-module-contract.test.js` | 모듈 두 개를 이름으로 고정한 정상 경계 fixture | 최상위 `export =`를 가진 모든 `scripts/src/lib/*.ts` 모듈이 `typeof import()`로 타입 검사를 통과하는 경계 계약 | 전환함: 모듈 이름 대신 디렉터리 스캔으로 대상을 모아 이름 변경·분리에 거짓 실패하지 않고 새 `export =` 모듈도 자동 포함. 스캔이 비면 먼저 실패 | TASKS-005 |
| `test/cli-project-commands.test.js` | intent 모듈 네 개의 파일명 정규식 | 프로젝트 명령 실행 시 intent 기능 영역을 적재하지 않는 지연 로딩 | 전환함: 파일명 나열 대신 `test/helpers/feature-areas.js` 표로 적재된 영역을 판정(`loadedAreas`). 의도 모듈을 먼저 적재한 자식 프로세스로 검사 유효성을 확인 | TASKS-003 |
| `test/symbol-index.test.js` | 배포된 symbol-index 소스의 `typescript` 의존 여부 | 배포된 `symbol-index`가 `typescript` 패키지 없이 `.ts` 심볼을 해석하는 동작 | 전환함: `typescript` 해석을 막은 자식 프로세스에서 `resolveSymbol`을 실행하고, `typescript`를 요구하는 lib 사본이 막힌 모듈로 실패하는지로 probe 유효성을 확인. 자식 프로세스를 띄우므로 `integration` 계층으로 옮김 | TASKS-003 |
| `test/skill-bouncer-run.test.js` | 4단계 제목으로 자른 구간 | run 스킬이 dispatch 전에 coordinator 모델 확인 명령을 안내하고, metrics end 시점을 task-notification usage 기준으로 안내하는 문서 계약 | 전환함: 단계 번호·제목 대신 문장이 속한 빈 줄 구분 문단을 찾아 같은 문단 안의 명령 순서를 검사 | TASKS-005 |

나머지 94개 테스트 파일의 분류는 미분류 — 해당 영역을 수정하는 blueprint에서 채운다.
