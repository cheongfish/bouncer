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
      quiz_score: '2/3'
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
