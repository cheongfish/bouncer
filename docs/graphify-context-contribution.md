# Graphify context 기여 측정

## 제거 메모

context graph sync·직접 query 절차와 그 결과를 discovery 입력으로 쓰는 안내는
제거되었다. discovery는 계획 문서와 `bouncer intent` 등 남은 입력을 쓰고,
Graphify는 source·test 순위화만 담당한다. 아래 표·수치는 제거 전 고정 corpus
재실행(2026-09-06)의 역사 기록이며, 현재 절차나 승인 정책이 아니다.

## 고정 corpus와 재실행

`test/fixtures/graph-search-quality.json`의 `light-plan`,
`verification-ledger`, `graphify-bootstrap` 세 사례와 별도 `draft_self_hit`
사례만 사용했다. 같은 source/test 그래프에 대해 context 그래프를 비운 실행을
기준선으로, 원래 context 그래프를 포함한 실행을 비교했다. 각 실행은 top-k=3으로
다음을 계산했다.

- 추가 발견 경로 수 (`extra_paths`): context 포함 추천 집합에만 있는 경로 수
- top-k recall (`top_k_recall`): gold implementation/test 경로 중 상위 3개
  추천에 포함된 비율
- 오추천 수 (`false_positives`): 상위 3개 추천 중 gold 밖 경로 수
- self-hit 비율: context 후보 중 현재 draft 경로의 비율

2026-09-06에 `node --test test/graph-search.test.js`로 고정 corpus의
기준선·context 비교와 self-hit 실패 모델을 재실행했다. 아래 값은 그 재실행의
측정값이다. fixture 기대치에 맞춰 점수·필터·실행 순서를 바꾸지 않았다.

## 세 사례 기준선 비교

세 사례의 gold는 구현 7 + 테스트 2 = 9개 경로다. top-k=3에서 상위 3개가 모두
gold이면 recall은 `3/9`이다.

| 사례 | 구분 | extra_paths | top_k_recall | false_positives |
| --- | --- | ---: | ---: | ---: |
| light-plan | source·test 기준선 | — | 3/9 | 0 |
| light-plan | context 보강 | 0 | 3/9 | 0 |
| verification-ledger | source·test 기준선 | — | 3/9 | 0 |
| verification-ledger | context 보강 | 0 | 3/9 | 0 |
| graphify-bootstrap | source·test 기준선 | — | 3/9 | 0 |
| graphify-bootstrap | context 보강 | 0 | 3/9 | 0 |

추가 발견 경로가 하나 이상이거나 top-k recall이 기준선보다 높을 때만 발견
기여가 있다고 기록한다. 세 사례 모두 extra_paths `0`이고 recall도 기준선과
같아, 이 재실행에서는 발견 기여를 기록하지 않는다. context는 추천 집합 크기를
9로 유지한 채 top-3 순서만 바꿨고, 상위 3개는 기준선과 보강 모두 gold 안이다.

## 별도 draft self-hit

별도 draft 사례의 context 후보는 2개다. 그중 현재 draft 경로는 1개라
self-hit 비율은 `1/2`이다. 당시 정책 임계치(pre-scaffold current-draft 허용
비율)는 `0`이므로 `1/2 > 0`이었다.

이 `1/2`는 사후 검색이 현재 draft를 되찾는 실패 모델이다. 세 사례의
pre-scaffold 측정과 합산하지 않으며, 허용 가능한 결과로 보지 않았다. 경로
추천 `suggested_paths`에는 현재 draft가 들어가지 않는다. self-hit는 context
후보 집합에서만 센다.

## 현재 절차

1. authoring 뒤 source가 있을 때만 `graph-suggest`로 파일 경로를 순위화한다.
   source가 없으면 경로 추천은 비우고 사용자가 `affected_paths`를 수동 확정한다.
2. 후보, confidence, basis를 보여 준 뒤에도 사용자가 `affected_paths`를
   확인·수정한다.
