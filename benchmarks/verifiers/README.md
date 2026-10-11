# 외부 검증기

`upstream-tests.cjs`는 상류 커밋 과제(`fastify-001` 등)의 검증기다. 제출된 Git patch를 기준
스냅샷의 새 checkout에 적용하고, 상류 커밋이 추가·수정한 숨은 테스트를 실행해 점수와 검사별
결과를 JSON으로 반환한다. 채점 설정은 [`../upstream/`](../upstream/README.md)의 과제별 JSON이고
[루브릭](../rubrics/fastify-001.md)이 해석 기준이다. 범위 위반·보고 정확도·비용은 별도 평가에서
기록한다.

```sh
node benchmarks/verifiers/upstream-tests.cjs \
  --config benchmarks/upstream/fastify-001.json \
  --patch <제출.patch> \
  --work-dir <존재하지-않는-평가-checkout-경로> \
  --output <결과.json>
```

`--patch`는 기준 SHA에서 최종 작업 결과까지의 **전체** 변경을 담아야 한다.
커밋된 변경과 미커밋 변경, 새 파일을 빠뜨리지 않도록 제출을 수집하는 것은
실행기의 책임이다. 검증기는 patch가 적용되지 않거나 평가 환경이 고장 나면
`judge_status: unjudgeable`을 기록하고 종료 코드 1로 끝난다. 정상 채점은
과제가 0점이어도 종료 코드 0이다.

이 검증기는 제출 코드와 테스트를 실행한다. 실제 실험에서는 네트워크가
차단된 별도 평가 컨테이너에서 권한이 낮은 사용자로 실행하고, 호스트 홈
디렉터리·Docker 소켓·인증 정보는 마운트하지 않는다. `rubrics/`는 평가 환경에만
있어야 하며 에이전트 작업 환경에 제공하지 않는다. 두 조건 모두 같은 평가
이미지와 제한 시간을 사용한다.

`lib.cjs`는 검증기가 함께 쓰는 checkout·patch 적용 도우미다. 컨테이너에는 `benchmarks/`만
마운트되므로 Node 내장 모듈만 쓴다. `testdata/`는 에이전트 이미지에 들어가지 않는다
(`docker/Dockerfile.cursor.dockerignore`가 `benchmarks/verifiers`를 제외).

검증기는 채점 대상 프로젝트의 테스트를 실행할 때 `NODE_TEST_CONTEXT`를 넘기지 않는다.
상위 `node --test` 안에서 실행해도 대상 테스트가 독립적으로 종료 코드를 내게 하기 위해서다.
