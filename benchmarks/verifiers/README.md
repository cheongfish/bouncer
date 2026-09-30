# ledger-001 외부 검증기

`ledger-001.cjs`는 제출된 Git patch를 [기준 bundle](../fixtures/README.md)의
새 checkout에 적용하고 [루브릭](../rubrics/ledger-001.md)의 기능 검사 14개를
실행한다. 점수 0–100, 과제 성공 여부, 검사별 결과, 각 명령의 원본 출력을
JSON으로 반환한다. 범위 위반·보고 정확도·비용은 별도 평가에서 기록한다.

```sh
node benchmarks/verifiers/ledger-001.cjs \
  --patch <제출.patch> \
  --work-dir <존재하지-않는-평가-checkout-경로> \
  --output <결과.json>
```

`--patch`는 기준 SHA에서 최종 작업 결과까지의 **전체** 변경을 담아야 한다.
커밋된 변경과 미커밋 변경, 새 파일을 빠뜨리지 않도록 제출을 수집하는 것은
실행기의 책임이다. 검증기는 patch가 적용되지 않거나 평가 환경이 고장 나면
`judge_status: unjudgeable`을 기록하고 종료 코드 1로 끝난다. 정상 채점은
과제가 0점이어도 종료 코드 0이다. `outcome_success`는 100점일 때만 참이다.

이 검증기는 제출 코드와 `npm test`를 실행한다. 실제 실험에서는 네트워크가
차단된 별도 평가 컨테이너에서 권한이 낮은 사용자로 실행하고, 호스트 홈
디렉터리·Docker 소켓·인증 정보는 마운트하지 않는다. `rubrics/`는 평가 환경에만
있어야 하며 에이전트 작업 환경에 제공하지 않는다. 두 조건 모두 같은 평가
이미지와 제한 시간을 사용한다.

## ledger-v2 검증기

`ledger-002`–`ledger-004` 검증기는 공통 부분을 `lib.cjs`에 둔다. 컨테이너에는 `benchmarks/`만
마운트되므로 Node 내장 모듈만 쓴다. `ledger-001.cjs`는 기존 결과와 같은 채점을 유지하려고
바꾸지 않는다. 결과 JSON 형식은 `ledger-001`과 같다.

각 검증기는 `testdata/<task-id>/`의 정답·오답 구현 patch와 `<task-id>.test.cjs`로 자체 검증한다.
기준 커밋이 성공으로 채점되지 않는지, 서로 다른 정답 구현이 모두 100점인지, 대표 오답이 의도한
검사에서만 감점되는지 확인한다. `testdata/`는 에이전트 이미지에 들어가지 않는다
(`docker/Dockerfile.cursor.dockerignore`가 `benchmarks/verifiers`를 제외).

검증기는 채점 대상 프로젝트의 `npm test`를 실행할 때 `NODE_TEST_CONTEXT`를 넘기지 않는다.
상위 `node --test` 안에서 실행해도 대상 테스트가 독립적으로 종료 코드를 내게 하기 위해서다.
