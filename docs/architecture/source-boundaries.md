# 소스 경계 inventory

이 문서는 소스 재구성 epic(106)의 후속 blueprint가 같은 근거로 공개 경계와 테스트 전환 범위를 정하도록 기준선, 소비자 현황, 경계 초안, 테스트 inventory를 한곳에 남긴다. 소스 규칙의 정본이 아니며 후속 blueprint의 `Touch`·`affected_paths`를 대신하지 않는다. 규칙의 소유 위치는 [rule-ownership.md](rule-ownership.md)가 정한다.

## 기준선

기준 커밋은 `c94947e7`이다. 수치는 작업 트리가 아니라 이 커밋에서 직접 측정했으며 같은 blueprint의 다른 task 결과를 포함하지 않는다. 적재 수·coverage·소요 시간은 `git worktree add --detach <임시경로> c94947e7`로 만든 임시 작업 트리에서 `npm ci && npm run build` 뒤 측정하고 측정 후 `git worktree remove`로 지웠다.

| 항목 | 전 (`c94947e7`) | 후 | 측정 명령 |
| --- | --- | --- | --- |
| `scripts/src/lib/*.ts` 모듈 수 | 92 | 미측정(후속 blueprint가 채움) | `git ls-tree -r --name-only c94947e7 scripts/src/lib`로 목록을 얻어 최상위 `.ts`만 센다 |
| `scripts/src/lib/*.ts` 합계 줄 수 | 41,956 | 미측정(후속 blueprint가 채움) | 같은 목록에 `git show c94947e7:<경로> \| wc -l`을 합산한다 |
| `test/*.test.js` 파일 수 | 103 | 미측정(후속 blueprint가 채움) | `git ls-tree -r --name-only c94947e7 test`에서 `test/*.test.js`만 센다 |
| `test/*.test.js` 합계 줄 수 | 54,583 | 미측정(후속 blueprint가 채움) | 같은 목록에 `git show c94947e7:<경로> \| wc -l`을 합산한다 |
| `../scripts/lib/*`를 직접 require하는 테스트 파일 | 82개 파일, 대상 모듈 70종 | 미측정(후속 blueprint가 채움) | 각 테스트 소스에서 `require('../scripts/lib/<모듈>')`를 추출해 파일·모듈을 중복 없이 센다 |
| `require('./scripts/lib/cli')` 적재 모듈 수 | 77 (help 실행 후에도 77) | 미측정(후속 blueprint가 채움) | `node -e "require('./scripts/lib/cli'); console.log(Object.keys(require.cache).filter(k=>k.includes('/scripts/lib/')).length)"` (빌드 후) |
| export 키 수 | `coordinator` 19, `scope` 13, `finalize` 12, `verification` 11, `validate` 10 | 미측정(후속 blueprint가 채움) | `node -e "console.log(Object.keys(require('./scripts/lib/<모듈>')).length)"` (빌드 후) |
| coverage lines | 95.35% | 미측정(후속 blueprint가 채움) | `npm run test:coverage`의 `all files` 행 |
| coverage branches | 85.17% | 미측정(후속 blueprint가 채움) | 같은 행 |
| coverage functions | 98.11% | 미측정(후속 blueprint가 채움) | 같은 행 |
| `npm test` 소요 시간 | 약 52초 (참고값: 환경 의존, 2443개 테스트 통과) | 미측정(후속 blueprint가 채움) | `time npm test` (같은 환경의 `npm run test:coverage`는 약 49초) |

"후" 열은 이 blueprint가 채우지 않는다. 전후 비교는 마지막 blueprint가 같은 표에 값을 채워 닫는다. 적재 수는 목표값으로 고정하지 않고 허용 의존성과 기준선 대비 결과를 기록하는 방식으로 쓴다.

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

## 기능별 공개 경계 초안

영역별 경계의 함수 이름은 후속 blueprint가 확정한다. 아래는 책임의 구분만 적은 초안이다.

| 영역 | 책임 | 외부로 노출할 경계 | 비고 |
| --- | --- | --- | --- |
| planning | epic·blueprint·tasks 문서 작성, scope, 계획 gate 입력 | 영역 진입 함수 한 묶음 (이름은 후속 blueprint가 확정) | 나머지 helper는 내부로 둔다 |
| execution | coordinator 판단, worker 배정, ledger 기록 | 영역 진입 함수 한 묶음 (이름은 후속 blueprint가 확정) | export 키가 가장 많은 `coordinator`가 우선 대상이다 |
| verification | verify 실행, 증거 기록, gate 판정 | 영역 진입 함수 한 묶음 (이름은 후속 blueprint가 확정) | execute gate만 성공 증거를 쓴다는 규칙을 유지한다 |
| delivery | finalize, commit 안전, PR 인계 | 영역 진입 함수 한 묶음 (이름은 후속 blueprint가 확정) | 훅이 쓰는 `commit-hook`은 외부 진입점이므로 유지한다 |

영역별 모듈 배치 표는 미분류 — 해당 영역을 수정하는 blueprint에서 채운다.

## 구현 고정 테스트 inventory

현재 고정 대상이 구현 세부(내부 문자열, 파일 구조, 적재 방식)에 묶인 테스트와 전환 판단이다. 담당 task는 같은 blueprint(001)의 task 번호다.

| 파일 | 현재 고정 대상 | 보호 동작 | 판단 | 담당 task/blueprint |
| --- | --- | --- | --- | --- |
| `test/coordinator.test.js` | reason 검사 | 판단 사유 코드가 기록되는 동작 | 사유 문자열 대신 관찰 가능한 판정 결과로 전환 | TASKS-003 |
| `test/tasks-docs.test.js` | 단독 로드 | tasks 문서 구조 검증 | 모듈을 따로 적재하는 방식을 공개 경계 호출로 전환 | TASKS-003 |
| `test/master-rules.test.js` | init 검사 | master rules가 init 결과에 반영되는 동작 | 문구 일치 대신 init 산출물의 동작 검사로 전환 | TASKS-005 |
| `test/ci-contract.test.js` | emit·CI 순서 검사 | CI가 요구하는 emit과 단계 순서 | 순서 자체가 계약인 부분만 남기고 나머지는 동작 검사로 전환 | TASKS-005 |
| `test/public-name-regression.test.js` | 허용 목록 | 폐기한 제품 이름이 소스에 남지 않는 동작 | 목록 위치가 아니라 내용 표식으로 판단해야 하므로 지금은 유지 | 후속(내용 표식 필요) |
| `test/typescript-module-contract.test.js` | 정상 경계 fixture | TypeScript 모듈 경계 계약 | fixture를 공개 경계 기준으로 갱신 | TASKS-005 |
| `test/cli-project-commands.test.js` | 지연 로딩 | 명령이 필요한 시점에만 모듈을 적재하는 동작 | 적재 개수 대신 허용 의존성 기준으로 전환 | TASKS-003 |
| `test/symbol-index.test.js` | 배포 의존성 | symbol index가 배포 의존성으로 동작하는지 | 의존성 선언 확인을 동작 검사로 전환 | TASKS-003 |
| `test/skill-bouncer-run.test.js` | 단계 제목 구간 | run 스킬의 단계 흐름 | 제목 구간 위치 대신 단계 계약 기준으로 전환 | TASKS-005 |

나머지 94개 테스트 파일의 분류는 미분류 — 해당 영역을 수정하는 blueprint에서 채운다.
