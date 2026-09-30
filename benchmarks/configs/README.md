# 실행 설정

여기에는 벤치마크 버전별 실행 설정을 둔다. 실행기는 설정에서 과제 저장소의
위치, 사용할 카드 ID, 비교 조건, 모델 설정, Cursor CLI와 Bouncer 버전,
샌드박스·승인·네트워크 정책, 실행 시간 제한, 반복 횟수, 무작위화 seed를 읽는다.

인증 정보는 설정 파일에 저장하지 않는다. 실제 실행 전에는 고정 버전과 설치
상태를 점검한다. `vanilla`와 `bouncer-full`의 공통 작업 요청은 카드의
`user_request`를 그대로 사용하고, 조건별 시작 지시를 별도 필드로 기록한다.

평가자 정책은 과제마다 `<task-id>-evaluator-policy.json`으로 두며, bouncer-full 실행기는
`--task`에 해당하는 정책이 없으면 시작하지 않는다. 정책의 `task_id`와 `base_commit`은
과제 카드와 같아야 한다.
`ledger-001-evaluator-policy.json`은 첫 과제의 승인된 질문 응답 정책이다.
질문이 실제로 도착했을 때만 해당 규칙을 평가하고, 조건이 맞지 않거나 규칙이
없으면 실험을 중단한다. 승인 기록은 정책의 `approval_record`에 있다. 특히
계획 승인에는 그때 작성된 문서와 범위 검토가 필요하다. 최종화 퀴즈의 첫
선택지 응답은 합성 실험 응답이며 사람의 이해도로 해석하지 않는다. 단계
응답기는 `benchmarks/run-print-stage.cjs`(기본)와 `benchmarks/run-acp-stage.cjs`에 연결된다. 지원하지 않는 결정은
`awaiting_user_decision`으로 기록한다.
