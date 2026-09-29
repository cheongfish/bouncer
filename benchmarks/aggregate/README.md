# 집계 산출물

`runs.csv`, `summary.json`, `report.md`는 `runs/` 원본과 고정한 채점 규칙에서
재생성한다. `runs.csv`에는 [실험 계획](../../benchmark-plan.md)의 필수 열을
포함한다. 조건·과제 유형별 성공률, 유해 결과율, 비용과 불확실성을 함께 보고한다.
실험 결과가 없는 동안 효과를 입증했다는 문구를 쓰지 않는다.

집계 대상은 `run.json`의 `sample_eligibility.eligible`이 `true`인 run뿐이다. 커밋되지 않은
코드로 돌린 run, 토큰이 빠진 run, 외부 채점이 없는 run은 표본에서 제외하고 그 수와 이유를
보고서에 따로 적는다.

