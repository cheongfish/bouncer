# 정기 ablation과 진입 표면 전후 비교 절차

플러그인 지시와 진입 표면을 줄여도 결과가 나빠지지 않는지 같은 과제로 되풀이해 확인하는 절차다.
실행 기록 집계는 [`scripts/measure-drive-records.js`](../../scripts/measure-drive-records.js)가 맡는다.
이 스크립트는 `<git common dir>/bouncer/metrics-snapshots/`의 snapshot(`drive_record` 포함)과
`.bouncer/runtime/drive-metrics.json` 세션 기록을 읽고, 같은 입력과 문턱이면 같은 바이트를 낸다.

## 정기 ablation

모델 세대가 바뀔 때 지시 하나만 뺀 조건과 기준 조건을 같은 과제로 각각 3회 돌린다.

1. 기준 조건과 "지시 하나를 뺀" 조건을 정한다. 한 번에 하나만 뺀다.
2. 두 조건을 같은 과제 카드로 각 3회 실행한다. 실행 방법은 [`../README.md`](../README.md)를 따른다.
3. 점수와 gate 통과 여부는 `benchmarks/aggregate`로, 토큰과 범위·충돌·CI repair wave는
   `node scripts/measure-drive-records.js --input <조건별 snapshot 디렉터리> --sessions <세션 파일>`로 모은다.
4. 조건마다 출력 JSON을 보관하고 `totals`를 나란히 비교한다. 문턱을 바꿨을 때의 효과는
   `--threshold k=n`(고정)이나 `--sweep k=n,n...`(한 키를 훑기)으로 같은 snapshot에서 다시 계산한다.

채택 조건은 점수가 기준 이상이고 토큰이 늘지 않는 것이다. 한 조건이라도 어긋나면 뺀 지시를 되돌린다.

## 진입 표면 전후 비교

retro를 finalize 쪽으로 옮기기 전과 후의 비용만 비교한다.

1. 이관 전 drive와 이관 후 drive의 finalize 세션 토큰을 `bouncer metrics summary --blueprint <dir>`로 각각 읽는다.
2. 자동 retro 출력이 있는지 없는지만 기록한다.

회고 내용의 품질 비교는 하지 않는다(epic의 Out of scope).

## 결과 기록

실행마다 아래를 한 행으로 남긴다. 기록 위치는 `benchmarks/runs/` 아래 해당 실행 디렉터리이고,
집계 JSON은 그대로 함께 둔다.

- 날짜, 모델 세대, 기준 조건, 뺀 지시
- 조건별 점수·gate 통과·토큰(`totals.worker_tokens`, `totals.session_tokens`, `totals.cost`)
- 사용한 문턱(`thresholds`)과 `inputs[].sha256`(입력 snapshot을 다시 찾기 위한 값)
- 채택 여부와 이유
