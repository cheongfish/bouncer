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

## 스모크 태스크 id

2026-08-25 vanilla 1태스크 스모크는 원본 스위트 `tasks/` 트리의 첫 태스크
디렉터리 `abs-module-cache-flags`를 골랐다. 이 칸은 그 선택만 고정한다. 열 개
표본 표와는 별개다. 그 스모크는 호스트 쪽 워크스페이스 체크아웃이 없어 병합
JSON을 남기지 못했고, 아래 표는 그대로 비어 있다.

## 052 비교 태스크 3개

이 절은 052 블루프린트 비교표가 도는 태스크 id만 고정한다. 출처는 원본 클론
`tasks/`에서 README가 아닌 앞 세 디렉터리이고, 스모크 id
`abs-module-cache-flags`가 그 안에 들어 있다. 열 개 표본 표(`--n-tasks 10`)와는
다른 집합이다.

```bash
git clone --depth 1 --filter=blob:none --no-checkout \
  https://github.com/datacurve-ai/deep-swe /tmp/deep-swe-052-task003
git -C /tmp/deep-swe-052-task003 ls-tree -d --name-only HEAD tasks/ | head -3
```

| # | 태스크 id |
| --- | --- |
| 1 | `abs-module-cache-flags` |
| 2 | `abs-stepped-slices` |
| 3 | `actionlint-action-pinning-lint` |

런 id는 `052-<arm>-<task-id>`다. 표본 seed로 다시 뽑지 않는다.

## 뽑힌 태스크 id

아직 비어 있다. 열 개 표는 `--n-tasks 10 --sample-seed 20260825`로 첫 샘플 런을
돌린 직후에 채운다. 출처는 그 런 `docs/benchmark/deepswe/results/<run-id>/run.log`에
남은 `pier run` 실행 매니페스트(선택된 태스크 나열)다. 손으로 고른 목록을
정본이라 적지 않는다.

<!-- 채우는 시점: 위 샘플링 명령줄로 첫 샘플 런을 돌린 직후.
     채우는 출처: 그 런의 run.log 매니페스트.
     스모크 1태스크 선택(abs-module-cache-flags)으로 이 표를 채우지 않는다. -->

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
