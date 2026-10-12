# deepswe 채점 루브릭 v1

대상 요청은 과제별 `fixtures/deepswe/<card-id>/task/instruction.md`(영어 원문)이다. 채점은 DeepSWE
공식 채점기 `tests/test.sh`를 그대로 실행하는 [`verifiers/deepswe.cjs`](../verifiers/deepswe.cjs)가 한다.
출처와 고정 커밋은 [`deepswe/README.md`](../deepswe/README.md)에 적었다.

## 판정 방식

1. 제출 diff(`model.patch`)를 과제 이미지의 기준 상태에 적용한다. 적용이 안 되면 `apply_failed`로 `reward 0`이다.
2. 공식 `tests/test.sh`가 숨은 테스트를 돌려 `reward.json`을 쓴다. 채점 컨테이너는 네트워크가 없고 에이전트 작업 공간을 마운트하지 않는다.
3. `reward`는 0 또는 1이다. 숨은 fail-to-pass(f2p) 테스트가 모두 통과하고 pass-to-pass(p2p) 테스트가 깨지지 않을 때만 1이다.

## 점수

| 항목 | 값 |
|---|---|
| 주점수 | `score = reward * 100` |
| 성공 | `outcome_success = reward === 1` |
| 보조 기록 | `f2p_passed`/`f2p_total`, `p2p_passed`/`p2p_total`, `apply_failed`. 점수에 더하지 않는다 |

채점기 인프라 실패나 시간 초과는 `judge_status: unjudgeable`이고 점수 계열이 모두 null이다. 0점으로 섞지 않는다.

## 기대 점수

`check-deepswe-solution.cjs <card-id>`가 실행 전에 확인한다.

| 제출 | reward |
|---|---|
| 손대지 않은 작업 공간(빈 patch) | 0 (`apply_failed` 아님) |
| 정답 patch(`task/solution/solution.patch`) | 1 |

## 채점하지 않는 것

- f2p 부분 통과 비율. 보조 기록일 뿐 점수가 아니다.
- 코드 스타일과 문서. `success_checklist`는 공식 reward 하나다.
