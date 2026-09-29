# 벤치마크 작업 카드와 결과 구조

[실험 계획](../benchmark-plan.md)의 첫 비교는 `vanilla`와 `bouncer-full`이다.
이 디렉터리는 과제 정의와 실행 증거를 분리한다. 현재는 첫 과제의 기준
프로젝트·PRD·채점 루브릭과 Cursor CLI용 파일럿 실행기가 있다. 실험 결과는 없다.

```text
benchmarks/
  README.md
  fixtures/ledger-cli.bundle
  fixtures/README.md
  schemas/task-card.schema.json
  tasks/task-card.template.yaml
  tasks/ledger-001.prd.md
  rubrics/ledger-001.md
  rubrics/ledger-001/entries.json
  rubrics/ledger-001/month-boundary.json
  verifiers/ledger-001.cjs
  verifiers/README.md
  configs/README.md
  runs/README.md
  aggregate/README.md
  docker/compose.cursor.yaml
  docker/Dockerfile.cursor
  run-cursor.cjs
```

## 과제 카드 계약

실제 카드는 `tasks/<task-id>.yaml`에 둔다. `id`는 파일명과 같아야 한다.
`tasks/ledger-001.prd.md`는 첫 과제의 공통 요청 초안이며, 채점 기준은
`rubrics/ledger-001.md`에 둔다. 실행용 작업 카드는 아직 작성하지 않았다.
기준 프로젝트는 `fixtures/`에 보관한다.
`base_commit`은 변경되지 않는 40자리 Git SHA이며, 해당 과제를 실행할 저장소는
실험 설정에서 지정한다. 모든 경로는 그 저장소 루트에 상대적이다.

카드는 두 영역을 가진다.

- **에이전트 입력:** `user_request`만 모든 조건에 동일하게 전달한다. 조건별
  시작 지시와 플러그인 호출은 실험 설정에서 별도로 관리하고 비용에 포함한다.
- **평가 전용:** 나머지 필드는 실행기와 평가자만 읽는다. `allowed_paths`는
  최종 변경 허용 범위, `forbidden_paths`는 그보다 우선하는 금지 범위다.
  `external_verifiers`는 실행이 끝난 뒤 깨끗한 평가 환경에서 실행한다.
  `success_checklist`와 `manual_rubric`은 조건명을 가린 평가에 쓴다.
  `evaluator_facts`는 실제 질문이 왔을 때 답할 수 있는 사실이며 사전 승인이나
  문제 해결 힌트로 전송하지 않는다.

`set: boundary`는 사전에 정한 `failure_opportunities`가 하나 이상 필요하고,
`set: general`은 빈 배열을 사용한다. 경계 과제의 위반 시도, 게이트 차단,
최종 위반은 각각 별도로 기록한다. 카드와 채점 규칙을 바꾸면
`benchmark_version`을 새로 부여하고 이전 결과와 합치지 않는다.

자동 검사는 `schemas/task-card.schema.json`의 필드 형식에 더해 다음 의미 검사를
수행해야 한다: SHA의 저장소 내 존재, 카드 ID와 파일명 일치, glob의 저장소 상대
경로 여부, 허용·금지 경로 충돌, verifier 실행 가능 여부, 정답 테스트가 여러
올바른 구현을 받아들이는지 확인. 마지막 항목은 과제 제작자가 검토한다.

## 실행과 결과의 경계

`configs/`에는 고정한 모델·CLI·플러그인 버전, 저장소, 조건, 시간 제한,
샌드박스·승인 정책, 무작위화 seed를 둔다. `runs/<run-id>/`는 실행 원본 증거를
보존한다. `aggregate/`는 그 원본에서 재생성 가능한 CSV·요약·보고서를 둔다.
각 경로의 상세 계약은 해당 디렉터리의 README를 따른다.

Cursor 실행기는 작업 디렉터리를 `.benchmarks/work/<run-id>/`에 만들고,
조건별 Cursor 설정은 일회용 컨테이너의 홈 디렉터리에 둔다. 실행 방법은
[`docker/README.md`](docker/README.md)를 참조한다. 로그에
인증 정보가 들어갈 수 있으므로 원본 결과를 공개 저장소에 올리기 전에 검토한다.
