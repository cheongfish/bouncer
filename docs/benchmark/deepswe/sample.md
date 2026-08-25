# DeepSWE 표본

이 회차가 도는 태스크는 DeepSWE 원본 스위트(https://github.com/datacurve-ai/deep-swe)의
`tasks/`다. 이 저장소는 태스크 본문을 복사하지 않는다. 대신 어떤 seed로 열 개를
뽑았는지만 여기에 고정한다. 같은 seed와 같은 `--n-tasks`면 같은 열 개가 나온다.

## seed

| 값 | 내용 |
| --- | --- |
| `--sample-seed` | `20260825` |
| `--n-tasks` | `10` |

## 샘플링 명령줄

```bash
python3 skills/agentic-code-benchmark/scripts/run_deepswe.py \
  --run-id <run-id> --arm vanilla --agent <agent> \
  --n-tasks 10 --sample-seed 20260825
```

러너는 이 인자를 그대로 `pier run -p <clone>/tasks --agent <agent> --n-tasks 10
--sample-seed 20260825`으로 넘긴다. 표본을 고르는 주체는 Pier이고, 이 저장소는
seed만 정본으로 들고 있다.

## 뽑힌 태스크 id

아직 비어 있다. 이 태스크는 스위트를 실제로 돌리지 않는다.

<!-- 채우는 시점: 위 명령줄로 첫 샘플 런을 돌린 직후.
     채우는 출처: 그 런의 결과 경로 docs/benchmark/deepswe/results/<run-id>/ 안
     `run.log`에 남은 `pier run` 실행 매니페스트(선택된 태스크 나열)다.
     손으로 고른 목록을 정본이라 적지 않는다. -->

| # | 태스크 id |
| --- | --- |
| 1 | |
| 2 | |
| 3 | |
| 4 | |
| 5 | |
| 6 | |
| 7 | |
| 8 | |
| 9 | |
| 10 | |
