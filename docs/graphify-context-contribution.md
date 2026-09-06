# Graphify context 기여 측정

## 목적

Context 검색은 새 초안을 만든 뒤 범위를 정당화하는 수단이 아니라, scaffold 전의
discovery 입력이다. 과거 결정, 선행 Blueprint, 기존 제약을 `Overlap` 판단에
보태되 Graphify 결과는 계속 advisory이며 `affected_paths`는 사용자가 확정한다.

## 고정 corpus와 기준선

`test/fixtures/graph-search-quality.json`의 `light-plan`,
`verification-ledger`, `graphify-bootstrap` 세 사례를 사용한다. 같은 source/test
그래프에 대해 context 그래프를 비운 실행을 기준선으로, 원래 context 그래프를
포함한 실행을 비교한다. 각 실행은 top-k=3으로 다음을 계산한다.

- 추가 발견 경로 수: context 포함 추천 집합에만 있는 경로 수
- top-k recall: gold implementation/test 경로 중 상위 3개 추천에 포함된 비율
- 오추천 수: 상위 3개 추천 중 gold 밖 경로 수
- self-hit 비율: context 후보 중 현재 draft 경로의 비율

현재 고정 corpus 결과는 세 사례 모두 추가 발견 경로 `0`, baseline/context top-k
recall `1/3`, baseline/context 오추천 `0`이다. 별도 draft 사례는 context 후보 두
개 중 현재 draft 하나를 포함해 self-hit 비율 `1/2`를 고정한다. 이 결과는 context가
현 점수 정책에서 후보 수를 늘리기보다 순위를 바꾼다는 측정값이며, 품질 통과나
승인 근거가 아니다.

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

점수와 confidence 계산은 이 측정에서 바꾸지 않는다. 정책 판정은 다음 고정 corpus
재실행에서 명시적으로 비교한다: context의 오추천 수는 같은 top-k의 source/test
기준선보다 많아서는 안 되며(허용 증가 `0`), pre-scaffold context 결과의 현재 draft
self-hit 비율은 `0`이어야 한다. 추가 발견 경로가 하나 이상이거나 top-k recall이
기준선보다 증가할 때만 context의 발견 기여가 확인된다. 이 세 조건을 모두 충족하면
현 advisory 정책을 유지한다. 하나라도 어기면 context 결과는 계속 advisory로만
보이고, 별도 계획에서 context 점수·필터 또는 실행 순서 변경을 검토한다.

고정 fixture의 `1/2` self-hit는 사후 검색이 현재 draft를 되찾는 실패 모델이다. 이는
허용 가능한 결과가 아니며, pre-scaffold 정책을 통과한 측정값으로 합산하지 않는다.
어느 경우에도 context 성공만으로 G4 계획 품질이나 `affected_paths` 승인을 주장하지
않는다.
