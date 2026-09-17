---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/034-evaluation-benchmarking/blueprints/003-deepswe-run-plumbing/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-26T09:18:09.356+09:00'
bouncer:
  id: EXPLAIN-003
  epic_id: '034'
  blueprint_id: '003'
  status: published
  comprehension:
    - range_from: develop
      range_to: 013fa367f84be1e9b8699ea7cbbe3eefd24f802d
      diff_sha: 5d1dc10d0bcc8982d6a88e60cee3f794d89afe51c67ecfd492a589190ebebaab
      quiz_score: 2/3
      disposition: 2/3 — 안내만 하고 설치를 실행하지 않음을 놓침. 레이아웃·스모크 문서는 맞음.
      recorded_at: '2026-08-26T09:26:18+09:00'
---
# Explain

## Background

051 러너는 끝까지 돈 적이 없다. `pier`가 없을 때 안내하던 `pipx install pier-cli`는
PyPI의 다른 패키지라 `datacurve-pier`가 설치되지 않는다. 표본 런은 패치가 둘
이상이면 `metrics.json`을 통째로 건너뛰어 태스크별 측정이 없다. vanilla 1런은
Pier가 호스트에 워크스페이스 체크아웃을 남기지 않아 병합 JSON을 만들지 못했다.
이 PR은 안내를 `datacurve-pier`로 고치고 결과 레이아웃을 `tasks/<task-id>/`로
통일한 뒤, 그 실패를 `protocol.md`·`sample.md`에 남긴다. 체크아웃 구멍 수정과
9런 비교표는 다음 blueprint다.

## Intuition

배관은 태스크마다 한 칸을 만들고, 칸이 비면 합성 JSON으로 채우지 않는다.

## Code

- `skills/agentic-code-benchmark/scripts/run_deepswe.py` — `INSTALL_HINT["pier"]`가
  `uv tool install datacurve-pier` → `pipx` → `pip` 순. 설치는 안내만 하고 러너가
  호출하지 않는다. 산출물은 `docs/benchmark/deepswe/results/<run-id>/run.log`와
  `tasks/<task-id>/{reward,ctrf,test-stdout,metrics}.json`. 패치가 없으면 그
  태스크만 skip하고 나머지는 계속한다. 호스트 체크아웃이 없으면
  `metrics.json`을 만들지 않는다.
- `test/skill-agentic-code-benchmark.test.js` — 안내 문구에 `datacurve-pier`가
  있고 `pier-cli`가 없음. 태스크 둘인 가짜 pier 런에서 단위별로
  `metrics.json`이 생김.
- `docs/benchmark/deepswe/protocol.md` — 레이아웃·브리지 경로, 2026-08-25
  `pier-cli` 실패, 설치 후 `claude-code` / `abs-module-cache-flags` 실패 출력.
- `docs/benchmark/deepswe/sample.md` — 스모크 id `abs-module-cache-flags`, 열 개
  표는 `--n-tasks 10` 이후.
- `docs/benchmark/deepswe/results/` — `.gitkeep`만. 실패한 JSON 없음.

## Quiz

1. `pier`가 PATH에 없을 때 러너가 안내하는 패키지는?
   - A) `pipx install pier-cli`만
   - B) `uv tool install datacurve-pier`를 먼저, 이어서 pipx·pip의 `datacurve-pier`
   - C) 러너가 `uv tool install`을 직접 실행한 뒤 클론을 진행

2. 패치가 둘 이상인 표본 런의 결과 경로는?
   - A) 런 루트에 `metrics.json` 한 장
   - B) `"patches found; skipping"`으로 런 전체를 건너뜀
   - C) `tasks/<task-id>/metrics.json`이 태스크마다 한 장 (`run.log`만 런 루트)

3. 이 PR이 vanilla 스모크에 대해 한 일은?
   - A) 호스트 체크아웃 없음을 protocol에 남기고 `results/`에 합성 JSON을 두지 않음
   - B) `merged.json`을 손으로 채워 비교표를 만듦
   - C) `run_deepswe.py`에서 체크아웃 구멍을 고침

## 이해 상태

- 점수: 2/3
- 정답: 1B · 2C · 3A
- 응답: 1C · 2C · 3A
- 채점: 1✗ 2✓ 3✓
- disposition: 2/3 — 안내만 하고 설치를 실행하지 않음을 놓침. 레이아웃·스모크 문서는 맞음.
- range: develop..013fa367f84be1e9b8699ea7cbbe3eefd24f802d
- diff_sha: 5d1dc10d0bcc8982d6a88e60cee3f794d89afe51c67ecfd492a589190ebebaab

## Tasks

### Task 001

#### Goal & intent

`pier`가 PATH에 없는 호스트에서 러너가 내는 안내를 따라가면 실제로 `pier`가
설치된다. 지금은 `pipx install pier-cli`를 안내하는데, PyPI의 `pier-cli`
0.0.3은 로컬 이미지 배포 도구로 DeepSWE와 무관하다. DeepSWE가 쓰는 배포물은
`datacurve-pier`(현재 0.3.1)이고, 에픽 051도 본문에서 그 이름을 지목했다.
안내가 가리키는 곳과 실제로 필요한 것이 갈린 상태를 닫는다.

#### Interface

- 제공: `run_deepswe.py`의 선행 조건 실패 stderr가 `datacurve-pier`와 세 설치
  경로를 담는다. 우선순위는 `uv tool install datacurve-pier` →
  `pipx install datacurve-pier` → `pip install datacurve-pier`. 종료 코드 2와
  "클론 전에 멈춘다"는 기존 동작은 그대로다.
- 거부: 러너는 설치를 대신 시도하지 않는다. `uv`나 `pipx`가 있어도 호출하지
  않고, 안내만 하고 비영 코드로 끝난다. 러너가 호스트에 도구를 깔기 시작하면
  측정 환경이 런마다 달라진다.

#### Touch

- Modify `skills/agentic-code-benchmark/scripts/run_deepswe.py` — `INSTALL_HINT`의
  `pier` 항목을 `datacurve-pier`와 세 설치 경로로 바꾼다. `docker` 항목과
  선행 조건 검사 루프는 그대로 둔다.
- Modify `test/skill-agentic-code-benchmark.test.js` — 기존
  `run_deepswe.py refuses before cloning when pier is missing from PATH`
  테스트의 stderr 단언을 좁혀, `datacurve-pier`가 있고 `pier-cli`가 없음을
  함께 고정한다.

#### Constraints

- 러너는 python3 표준 라이브러리만 쓴다. 새 의존성을 들이지 않는다.
- 안내 문자열은 영어를 유지한다. 이 스크립트의 다른 stderr 문구와 같은 계열이다.
- 설치 명령을 실제로 실행하는 코드를 넣지 않는다.
- 패키지 이름은 `datacurve-pier`로 고정한다. PyPI의 `pier`(도커 API 래퍼)와
  `pier-cli`(이미지 배포 도구)는 둘 다 다른 프로젝트다.

### Task 002

#### Goal & intent

태스크를 둘 이상 도는 표본 런에서도 태스크마다 measured JSON 한 장이 남는다.
지금 `build_measured_copy`는 패치가 둘 이상이면
`"metrics.json covers one task only, skipping"`을 적고 통째로 건너뛴다. 런
하나의 산출물이 결과 경로 루트에 평평하게 앉는 구조라 태스크별로 담을 이름이
없기 때문이다. 결과 레이아웃을 태스크 단위로 바꿔 그 이름을 만든다.

이 태스크가 끝나면 태스크가 하나인 런과 여럿인 런이 **같은** 레이아웃을 낸다.
비교표를 만드는 다음 blueprint가 분기를 안지 않게 하려는 것이다.

#### Interface

- 제공: 결과 경로가 아래 한 가지 모양이다.
  ```
  docs/benchmark/deepswe/results/<run-id>/
    run.log
    tasks/<task-id>/reward.json
    tasks/<task-id>/ctrf.json
    tasks/<task-id>/test-stdout.txt
    tasks/<task-id>/metrics.json
  ```
  `run.log`는 런 하나에 한 장이다. 나머지는 태스크마다 한 벌이고, Pier가 남기지
  않은 파일은 키가 아니라 파일 자체가 없다.
- 제공: 태스크 단위는 "Pier 산출물이나 패치를 담은 작업 경로 안 디렉터리"로
  잡고, 태스크 id는 그 디렉터리 이름이 아니라 그 안 산출물·패치에서 유도한다
  (기존 `resolve_task_id`를 그 디렉터리 범위로 재사용한다).
- 거부: 태스크 id를 유도하지 못한 단위는 결과로 옮기지 않는다. 새 레이아웃에는
  태스크 id 없는 산출물이 앉을 자리가 없으므로 `metrics.json`뿐 아니라
  `reward.json`·`ctrf.json`·`test-stdout.txt`도 남기지 않고, 무엇을 버렸는지를
  `run.log`에 적는다. 러너는 나머지 태스크를 계속 처리한다. 순번으로 이름을
  지어내지 않는다 — 나중에 어느 태스크였는지 복구할 수 없는 이름은 없는 것만
  못하다.
- 거부: 클론(`deep-swe`) 안의 파일은 태스크 단위 수집에서도 제외한다. 스위트가
  실어 온 `reward.json`과 gold 패치를 이 런의 산출물로 옮기면 거짓 수용이 된다.

#### Touch

- Modify `skills/agentic-code-benchmark/scripts/run_deepswe.py` — 런 단위로
  묶여 있는 네 곳을 태스크 단위로 내린다.
  1. `find_files`/`find_patches` — 이름 하나만 집어 오는 구조를 디렉터리별 묶음으로.
  2. `find_workspace` — 지금은 작업 경로 전체에서 `.git`이 있는 **첫** 디렉터리
     하나를 돌려준다. 태스크 단위 안에서 찾도록 범위를 좁힌다. 이걸 두면 태스크가
     여럿일 때 모든 태스크가 같은 워크스페이스를 잰다.
  3. `build_measured_copy`의 `copy_dir = os.path.join(work, "measured")` — 런에
     하나뿐인 이름이라 태스크별 사본을 만들 수 없다. 태스크마다 갈리는 이름으로
     바꾼다. 같은 함수의 "패치 둘 이상이면 skip" 분기는 태스크별 반복으로 대체한다.
  4. 결과 이동 — `tasks/<task-id>/` 아래로 보낸다.
- Modify `test/skill-agentic-code-benchmark.test.js` — 가짜 pier가 태스크
  디렉터리 둘을 남기는 케이스를 더하고, 단일 태스크 런의 결과 경로 단언을
  새 레이아웃으로 옮긴다.
- Modify `skills/agentic-code-benchmark/SKILL.md` — 「DeepSWE original suite」 절의
  `<results>/metrics.json` 계열 경로가 새 레이아웃을 가리키게 한다. 이 문서는
  세 스크립트를 잇는 순서를 적으므로, 경로가 어긋나면 스킬을 읽고 따라 하는
  쪽이 없는 파일을 찾게 된다.
- Modify `docs/benchmark/deepswe/protocol.md` — 「arm별 절차」의 `bridge_pier.py`
  명령줄 경로와 결과 레이아웃 서술을 새 경로로 바꾼다. 「스모크 시도」 절은
  003이 갱신하므로 여기서는 건드리지 않는다.

#### Constraints

- `metrics.json`의 `schema` 값 `agentic-code-benchmark/metrics/1`은 그대로다.
  나뉘는 것은 파일이 앉는 경로지 스키마가 아니다.
- 작업 경로 정리 보증(`try/finally` + SIGINT·SIGTERM)과 미완성 결과 경로 되돌림
  (`staged`/`cleanup_results`)은 그대로 선다. 태스크 여럿을 옮기는 중에 끊겨도
  반쪽짜리 결과 경로가 남지 않아야 한다.
- 러너는 python3 표준 라이브러리만 쓴다.
- 태스크 하나짜리 런에도 같은 레이아웃을 적용한다. 단일 런만 평평하게 두는
  하위 호환 분기를 남기지 않는다.
- 태스크 id는 경로 한 조각으로 쓰이므로, `/`나 `..`을 담은 값은 디렉터리
  이름으로 쓰지 않고 그 태스크를 id 유도 실패와 같게 처리한다(산출물을 옮기지
  않고 `run.log`에 적는다).

### Task 003

#### Goal & intent

배관 001–002까지는 섰고, vanilla 1런은 Pier 산출물이 호스트에 없어 병합 JSON을
못 남긴 상태를 문서에 고정한다. 워크트리에 이미 있는 protocol·sample 초안을
이 브리프에 맞춘다. 스모크를 다시 돌리지 않는다.

#### Interface

- 제공: `docs/benchmark/deepswe/protocol.md`에 실패 스모크의 명령·출력·원인
  한 줄이 있다. 2026-08-25 `pier-cli` 실패는 유지한다. Pier 설치 후 시도
  (`claude-code`, `abs-module-cache-flags`, 종료 0,
  `NonZeroAgentExitCodeError`, `no host-side workspace checkout`)는 실제
  출력으로 남긴다. `pipx`·결과 비어 있음 서술은 이미 과거형이다.
- 제공: `docs/benchmark/deepswe/sample.md`에 스모크 id
  `abs-module-cache-flags`가 있다. 열 개 표는 비어 있고 `--n-tasks 10` 이후에
  채운다고 적는다.
- 거부: `merged.json`을 손으로 만들지 않는다. 스크립트를 고치지 않는다.
  스모크를 다시 돌리지 않는다. `docs/benchmark/deepswe/results/`에 실패한
  JSON을 두지 않는다.

#### Touch

- Modify `docs/benchmark/deepswe/protocol.md` — 설치 후 실패 시도 절의 실제
  출력을 유지하고, 「003에서 우회하지 않는다」를 이 BP가 실패를 문서로 닫고
  체크아웃 구멍은 다음 blueprint가 고친다는 문장으로 바꾼다.
- Modify `docs/benchmark/deepswe/sample.md` — 스모크 id와 빈 열 개 표를 현재
  상태에 맞게 둔다.

#### Constraints

- protocol·sample에 적는 출력은 이미 나온 것을 옮긴다. 요약하거나 다듬지 않는다.
- `.gitkeep`만 있는 results 레이아웃을 유지한다.
- 호스트 체크아웃 구멍은 다음 blueprint가 고친다.
