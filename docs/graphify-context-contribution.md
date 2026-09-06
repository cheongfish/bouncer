# Graphify context 기여 측정

## 목적

Context 검색은 새 초안을 만든 뒤 범위를 정당화하는 수단이 아니라, scaffold 전의
discovery 입력이다. 과거 결정, 선행 Blueprint, 기존 제약을 `Overlap` 판단에
보태되 Graphify 결과는 계속 advisory이며 `affected_paths`는 사용자가 확정한다.

## 고정 corpus와 재실행

`test/fixtures/graph-search-quality.json`의 `light-plan`,
`verification-ledger`, `graphify-bootstrap` 세 사례와 별도 `draft_self_hit`
사례만 사용한다. 같은 source/test 그래프에 대해 context 그래프를 비운 실행을
기준선으로, 원래 context 그래프를 포함한 실행을 비교한다. 각 실행은 top-k=3으로
다음을 계산한다.

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
self-hit 비율은 `1/2`이다. 정책 임계치(pre-scaffold current-draft 허용 비율)는
`0`이므로 `1/2 > 0`이다.

이 `1/2`는 사후 검색이 현재 draft를 되찾는 실패 모델이다. 세 사례의 pre-scaffold
측정과 합산하지 않으며, 허용 가능한 결과로 보지 않는다. 경로 추천
`suggested_paths`에는 현재 draft가 들어가지 않는다. self-hit는 context 후보
집합에서만 센다.

## 실행 순서

1. scaffold 전에 context graph를 sync한 뒤, `graphify-out/context/graph.json`을
   Graphify의 직접 query로 검색해 discovery의 `Overlap`에 전달한다. 이 단계는
   source가 없어도 실행하며 `graph-suggest`를 쓰지 않는다. `graph-suggest`는 역할
   필터 없이 source·context를 함께 읽고 source 부재를 `unavailable`로 처리한다.
2. authoring 뒤 source가 있을 때만 `graph-suggest`로 파일 경로를 순위화하고, 앞
   단계의 context graph와 결과만 재사용한다. source가 없으면 context discovery는
   남기되 경로 추천은 비우고 사용자가 `affected_paths`를 수동 확정한다.
3. authoring 뒤 context를 다시 sync하거나 직접 query하지 않는다. 그러면 현재 draft의
   Touch/태그가 context seed로 되돌아오는 순환을 막을 수 있다.
4. 후보, confidence, basis와 self-hit를 보여 준 뒤에도 사용자가 `affected_paths`를
   확인·수정한다. G4 evidence와 그 확인 순서는 변하지 않는다.

## 정책 판정

정책 임계치는 context 오추천 허용 증가 `0`, pre-scaffold current-draft self-hit
허용 비율 `0`이다. 점수·필터·실행 순서는 이 측정에서 바꾸지 않는다.

| 조건 | 판정 | 근거 |
| --- | --- | --- |
| 오추천 증가 | 허용치 충족 | 세 사례 모두 기준선 `0` → context `0`, 증가 `0` |
| self-hit | pre-scaffold 실패 아님 | 세 사례와 합산하지 않음. 별도 draft `1/2`는 사후 실패 모델이며 이 분기 조건이 아님 |
| 발견 기여 | 없음 | extra_paths `0`, top-k recall이 기준선보다 높지 않음 |

**권고: 현 advisory 역할을 유지한다.** context 결과만으로 G4 품질이나
`affected_paths`를 승인하지 않는다. 오추천이 늘지 않았고 pre-scaffold
self-hit도 실패가 아니며, 발견 기여도 없어 context를 승인 근거로 격상할
측정값이 없다.
