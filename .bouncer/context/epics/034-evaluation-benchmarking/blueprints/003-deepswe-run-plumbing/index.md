---
type: bouncer.blueprint
title: DeepSWE 실행 배관을 실제로 도는 상태로 만듦
description: 설치 안내를 실제 패키지로 고치고 태스크별 measured 레이아웃을 세운 뒤 vanilla 스모크 실패를 문서에 고정한다
resource: .bouncer/context/epics/034-evaluation-benchmarking/blueprints/003-deepswe-run-plumbing/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-25T21:30:51.744+09:00'
bouncer:
  id: '003'
  epic_id: '034'
  blueprint_id: '003'
  status: closed
  commit_type: feat
  scale: full
  supersedes: []
---
# 003 deepswe-run-plumbing

Epic: [034](../../index.md)

## Intent
- 문제: 051의 러너는 한 번도 끝까지 돈 적이 없다. 선행 조건 검사에서 안내하는
  `pipx install pier-cli`는 DeepSWE와 무관한 패키지고(PyPI `pier-cli` 0.0.3은
  로컬 이미지 배포 도구다), 실제로 필요한 것은 `datacurve-pier`다. 표본 런은
  패치가 둘 이상이면 measured를 통째로 건너뛰어 태스크별 측정이 없다. 그래서
  결과 디렉터리에는 `.gitkeep`뿐이다.
- 완료 조건: 러너가 안내한 명령으로 `pier`를 실제로 놓을 수 있고, 태스크가
  하나든 여럿이든 태스크마다 measured 한 장이 정해진 자리에 앉으며, vanilla
  스모크 1런의 실패 원인(호스트 체크아웃 없음)이 protocol에 실제 출력으로
  남고 결과 디렉터리에 합성 JSON이 없다. arm 자동화와 9런 실행, 체크아웃
  구멍 수정은 이 blueprint 밖이다.

## Contract
- 인터페이스:
  - `skills/agentic-code-benchmark/scripts/run_deepswe.py` — 인자 표면은
    그대로다(`--run-id`, `--arm`, `--agent`, `--model`, `--sample-seed`,
    `--n-tasks`, `--task`). 바뀌는 것은 둘이다.
    1. `INSTALL_HINT["pier"]`가 `datacurve-pier`를 가리키고, 이 호스트 계열에
       실제로 있는 설치 경로(`uv tool install` → `pipx install` → `pip install`)를
       순서대로 제시한다.
    2. 결과 레이아웃이 태스크 단위로 바뀐다.
  - 결과 레이아웃 (단일·표본 공통):
    ```
    docs/benchmark/deepswe/results/<run-id>/
      run.log
      tasks/<task-id>/reward.json ctrf.json test-stdout.txt metrics.json
    ```
    `run.log`는 런 하나에 한 장이고, 나머지는 태스크마다 한 벌이다. 태스크가
    하나인 런도 `tasks/<task-id>/` 아래로 들어간다 — 레이아웃을 둘로 두면
    비교표를 만드는 쪽이 분기를 안게 된다.
  - `bridge_pier.py`는 인자 표면·동작 모두 그대로다. 병합 명령이 받는 경로만
    위 레이아웃을 따른다.
- 데이터·상태:
  - `metrics.json`의 `schema`는 `agentic-code-benchmark/metrics/1` 그대로다.
    태스크별로 나뉘는 것은 파일이 앉는 경로지 스키마가 아니다.
  - 태스크 id는 그 태스크의 Pier 산출물과 패치에서 유도한다. 유도에 실패한
    태스크는 measured를 만들지 않고 그 사실을 `run.log`에 적는다. 임의의
    순번(`task-1`)으로 이름을 채우지 않는다 — 나중에 어느 태스크였는지
    복구할 수 없는 이름은 없는 것만 못하다.
  - `docs/benchmark/deepswe/results/`는 커밋되는 착지점, `.benchmarks/deepswe/`는
    커밋되지 않는 작업 경로다. 051이 세운 이 구분은 그대로다.
- 수용 기준:
  1. `pier`가 PATH에 없을 때 러너가 내는 stderr가 `datacurve-pier`를 담고,
     `pier-cli`를 담지 않는다.
  2. 가짜 pier가 태스크 디렉터리 둘에 각각 산출물과 패치를 남기는 런에서,
     결과 경로에 `tasks/<task-id>/` 두 벌이 생기고 각 벌에 `metrics.json`이
     있다. "patches found; skipping"으로 통째로 건너뛰지 않는다.
  3. 태스크 하나짜리 런의 결과도 `tasks/<task-id>/` 아래에 앉는다.
  4. 태스크 id를 유도하지 못한 태스크는 `metrics.json` 없이 `run.log`에
     사실이 남고, 러너는 나머지 태스크를 계속 처리한다.
  5. vanilla arm 스모크의 실패 원인(Pier가 호스트에 워크스페이스 체크아웃을
     남기지 않음)이 `docs/benchmark/deepswe/protocol.md`에 있고,
     `docs/benchmark/deepswe/results/`에 합성 JSON이 없다.
  6. `docs/benchmark/deepswe/protocol.md`의 명령줄과 결과 레이아웃 서술이
     위 레이아웃과 일치하고, 「스모크 시도」 절이 Pier 설치 후 실패 시도를
     실제 출력으로 남긴다. 2026-08-25 `pier-cli` 실패 기록은 유지한다.
  7. `docs/benchmark/deepswe/sample.md`에 스모크가 고른 id
     `abs-module-cache-flags`가 있고, 열 개 표는 `--n-tasks 10` 이후에
     채운다고 적혀 있다.
  8. `npm run ci` 통과.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - 측정 호스트에 `uv`·`pipx`·`pip`이 모두 없으면 러너는 세 경로를 다 적고
    비영 코드로 끝난다. 설치를 대신 시도하지 않는다 — 러너가 호스트에 도구를
    깔기 시작하면 측정 환경이 런마다 달라진다.
  - Pier가 태스크 디렉터리를 어떤 이름으로 남기는지는 실제 실행 전에는
    확정되지 않는다. 러너는 "산출물이나 패치를 담은 디렉터리"를 태스크 단위로
    보고, 그 디렉터리 이름이 아니라 산출물에서 태스크 id를 유도한다.
  - 클론(`deep-swe`) 안에 스위트가 실어 온 `reward.json`·gold 패치가 이 런의
    산출물로 오인되면 안 된다. 051이 세운 clone skip은 태스크 단위 수집에도
    그대로 걸린다.
  - 같은 `<run-id>`가 결과 디렉터리에 이미 있으면 덮어쓰지 않고 거부한다.
  - 스모크가 호스트 체크아웃 없이 끝나면 성공했다고 적지 않는다. 실패한
    명령줄과 출력을 protocol에 남기고 합성 JSON을 결과 디렉터리에 두지 않는다.
    그 구멍을 003에서 고치거나 같은 스모크를 다시 돌리는 것이 위반이다.
  - 스모크가 실제 에이전트 세션을 돌리므로 토큰과 시간이 든다. 이 태스크는
    이미 돈 실패를 문서에 고정하고 재실행하지 않는다.

## Out of scope
- `--arm superpowers` / `--arm bouncer` 자동화. 이 blueprint에서 두 값은 051이
  적은 대로 라벨이고, 자동화는 다음 blueprint다.
- 9런 실행과 arm 비교표 생성. 다음 blueprint다.
- `scorecard.py`·`collect_metrics.py`의 계산 로직. 이 blueprint는 그 산출물이
  앉는 경로만 바꾼다.
- 050이 만든 이 저장소 스위트 문서와 `docs/benchmark/tasks/*.json`.
- Pier가 호스트에 워크스페이스 체크아웃을 남기지 않는 구멍. 003은 그 실패를
  문서에 남기고, 수정은 다음 blueprint다.

## One-commit justification
- 이 blueprint는 태스크 세 개짜리 번들이고, 각 태스크가 한 커밋이다. 설치
  안내 정정, 태스크별 레이아웃, 스모크 실패 증적은 서로 다른 실패 모드를 닫고
  따로 되돌릴 수 있어야 한다. 리뷰·PR 단위는 blueprint 하나로 유지한다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 설치 안내를 실제 패키지로 고침
* [Verification 001](tasks/001/verification.md) - 검증 명령과 증적
* [Review 001](tasks/001/review.md) - 리뷰 발견사항
* [Tasks 002](tasks/002/tasks.md) - 태스크별 measured 레이아웃
* [Verification 002](tasks/002/verification.md) - 검증 명령과 증적
* [Review 002](tasks/002/review.md) - 리뷰 발견사항
* [Tasks 003](tasks/003/tasks.md) - vanilla 스모크 실패 증적과 문서 고정
* [Verification 003](tasks/003/verification.md) - 검증 명령과 증적
* [Review 003](tasks/003/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
