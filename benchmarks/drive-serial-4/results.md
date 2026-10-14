# 직렬 4-task 측정 결과

[`README.md`](README.md)의 절차로 측정한 값을 이 문서에 적는다. 아직 측정하지 않았으므로 모든 칸은 `미측정`이다.

## 잠정값

| 값 | 현재 | 상태 |
| --- | --- | --- |
| `waves_per_session` 상한(`auto`) | 4 | 잠정값 |
| `direct_max_commit_tasks` 기본 | 3 | 잠정값 |

## 드라이브 방식별 결과

| 항목 | baseline | auto | direct |
| --- | --- | --- | --- |
| 총 토큰 | 미측정 | 미측정 | 미측정 |
| coordinator 기동 수 | 미측정 | 미측정 | 미측정 |
| root-direct 세션 수 | 미측정 | 미측정 | 미측정 |
| 벽시계 시간 | 미측정 | 미측정 | 미측정 |
| root 컨텍스트 증가 | 미측정 | 미측정 | 미측정 |
| 판단 결과 동일성 | 미측정 | 미측정 | 미측정 |

## plan context review 변경 전후 (BP 003)

입력은 [`../plan-review/`](../plan-review/README.md) fixture(결함 D1–D5를 심은 small·large 계획)이고 측정 절차도 그곳에 있다.

| 항목 | 변경 전 | 변경 후 |
| --- | --- | --- |
| 호출 수 | 미측정 | 미측정 |
| 토큰 | 미측정 | 미측정 |
| 유효 finding | 미측정 | 미측정 |
| 놓친 blocker/major | 미측정 | 미측정 |

## 미확인 사항

- 위 표의 수치는 merge 뒤 사용자가 fixture를 실행해 기록한다. 측정하지 못한 값은 사유와 함께 이 절에 남긴다.
- 최종 `waves_per_session` 상한과 `direct_max_commit_tasks` 기본값은 측정 전까지 확정하지 않는다.
