# fastify-001 채점 루브릭 v1

대상 요청은 [handlerTimeout PRD](../tasks/fastify-001.prd.md)이다. 상류 커밋
`fastify/fastify@f376f608`(#6521)을 정답으로 삼고, 그 커밋의 테스트를 숨은 채점 기준으로 쓴다.
설정은 [`upstream/fastify-001.json`](../upstream/fastify-001.json), 검증기는
[`verifiers/upstream-tests.cjs`](../verifiers/upstream-tests.cjs)다.

## 판정 방식

1. 스냅샷 `42fe25fd2a151def098ef6b59dee18ec8ccac632`(상류 부모 `c970ed48`의 트리, 부모 없는 커밋)을
   새로 checkout하고 제출 diff를 적용한다.
2. 숨은 테스트 파일 5개를 상류 커밋 버전으로 덮어쓴다. 제출이 같은 파일을 고쳤어도 상류 버전으로
   채점한다.
3. 고정 lockfile로 설치한 `node_modules`를 연결한다(네트워크 없음).
4. 아래 항목을 채점한다. `outcome_success`는 100점일 때만 참이다.

| ID | 배점 | 방식 | 내용 |
|---|---|---|---|
| F1 | 50 | 비례 | `test/handler-timeout.test.js`의 최상위 테스트 18개 중 통과 수. 내부 심볼(`lib/symbols`)을 읽는 1개(`timer is cleaned up after fast response`)는 공개 계약이 아니라 건너뛴다 |
| F2 | 10 | 전부 | `test/internals/errors.test.js` 통과: 오류 코드 2개 등록과 문구 |
| F3 | 10 | 전부 | `test/internals/initial-config.test.js` 통과: `initialConfig.handlerTimeout` 기본값 0. 설정 검증기(`lib/config-validator.js`) 재생성이 필요하다 |
| T1 | 10 | 전부 | `tsc test/types/import.ts …`와 `tsd` 통과(숨은 `fastify.test-d.ts`, `request.test-d.ts` 포함) |
| R1 | 20 | 비례 | 기준 스냅샷에서 통과한 회귀 테스트 파일(숨은 테스트 제외 184개) 중 여전히 통과하는 비율 |

## 기대 점수

`build-upstream-task.cjs fastify-001 --check-solution`이 실행 전에 확인한다(2026-10-06 측정).

| 제출 | 점수 | 항목 |
|---|---|---|
| 상류 정답(커밋의 테스트 외 변경) | 100 | F1 50, F2 10, F3 10, T1 10, R1 20 |
| 손대지 않은 스냅샷 | 31.1 | F1 11.1(18개 중 4개), R1 20 |

F1의 4개(빠른 핸들러 200, 경계 시점 단일 응답 등)는 기능이 없어도 통과한다. 두 조건에 같게
주어지므로 비교에는 영향이 없지만, 기능 구현 여부는 31.1점 초과분으로 읽는다. 채점은 한 번에 약 1분이다.

## 채점하지 않는 것

- 린트와 문서 문구. 문서 반영은 `success_checklist`로 수동 확인한다.
- 숨은 테스트가 다루지 않는 구현 방식(내부 심볼 이름, 파일 구성).
