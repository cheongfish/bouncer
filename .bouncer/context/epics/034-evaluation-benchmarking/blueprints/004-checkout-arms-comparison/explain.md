---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/034-evaluation-benchmarking/blueprints/004-checkout-arms-comparison/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-26T11:15:50.330+09:00'
bouncer:
  id: EXPLAIN-004
  epic_id: '034'
  blueprint_id: '004'
  status: published
  comprehension:
    - range_from: develop
      range_to: b34998eb334db8b6b283b90a6a618d520e58afcc
      diff_sha: b063466d6f2267d5b8161318f38a45a738184ef516d9e0016bd9584a5eb5cec0
      quiz_score: 1/4
      disposition: 4문항 중 1문항만 맞음. 점수는 마감을 막지 않음.
      recorded_at: '2026-08-26T12:37:42+09:00'
---
# Explain

## Background

001 스모크는 `pier run`이 0이어도 호스트 단위에 `.git`이 없으면
`metrics.json`을 건너뛰었다. `--arm`은 산출물 라벨이라 vanilla·superpowers·
bouncer를 러너 한 줄로 세울 수 없었고, 같은 태스크를 세 arm으로 나란히 본
표도 없었다. 이 브랜치는 패치와 태스크 `task.toml`의 프로젝트 URL·base로
측정 트리를 복원하고, `--arm`이 실행 조건을 고르게 한 뒤, 태스크 3개 ×
arm 3개의 명령줄과 산출물을 `comparison.md`와 `history.md` `## DeepSWE 원본`에
남긴다.

## Intuition

측정은 스위트 클론이 아니라 태스크가 가리키는 프로젝트 트리에서 하고, arm은
폴더 이름이 아니라 `pier`를 부르기 전에 러너가 고르는 조건이다.

## Code

- `skills/agentic-code-benchmark/scripts/run_deepswe.py` — `.git` 부재 시
  `task.toml`로 프로젝트 트리를 복원한 뒤 패치를 얹고 `collect_metrics.py`를
  돈다. `--arm vanilla`는 플러그인 없는 `pier run`. `--arm superpowers`는 그
  플러그인만 켜고 `.bouncer/`를 만들지 않는다. 호스트에 없으면 설치하지 않고
  비영 코드로 끝낸다. `--arm bouncer`는 `pier run` 전에 init, light 문서를
  plan 게이트가 통과할 만큼 채운 뒤 work path에서 `bouncer current --set`을
  한다. execute/commit CLI는 러너가 대신 부르지 않는다.
- `test/skill-agentic-code-benchmark.test.js` — 호스트 `.git` 없이
  `metrics.json`이 생기는 경로, 패치 없음 skip, arm별 argv·`.bouncer/` 유무,
  superpowers 부재 거절.
- `docs/benchmark/deepswe/protocol.md` — Arm 표, 측정 복원, 052 비교 9런
  명령줄과 종료.
- `docs/benchmark/deepswe/comparison.md`, `sample.md` 「052 비교 태스크 3개」,
  `docs/benchmark/history.md` `## DeepSWE 원본` — 통과율·usage. 없는 칸은
  비운다. 이번 회차 vanilla 세 런은 `reward` 0이고 패치가 비어
  `metrics.json`이 없다. superpowers·bouncer는 호스트 도구 부재로 종료 2다.

## Quiz

1. Pier가 단위에 `.git`을 안 남기고 패치만 있을 때 러너는 무엇을 `--repo`로
   넘기는가?
   - A) Harbor `task.toml`의 프로젝트 URL·base로 복원한 태스크 프로젝트 트리
     (패치 얹음)
   - B) DeepSWE 클론의 `tasks/` 디렉터리
   - C) 빈 디렉터리에 패치만 적용한 사본

2. `--arm superpowers`인데 호스트에 플러그인이 없으면 러너는?
   - A) 설치를 시도한 뒤 vanilla로 폴백한다
   - B) 합성 `merged.json`을 두고 종료 0이다
   - C) 설치하지 않고 비영 코드로 끝나며 결과 경로를 만들지 않는다

3. bouncer arm이 `pier run` 전에 `bouncer current --set`을 하는 이유는?
   - A) 러너가 execute/commit CLI를 대신 부르기 위해
   - B) light scaffold 문서를 채운 워크스페이스에 포인터를 남겨, plan 이후
     본문을 Pier 세션이 돌리게 하기 위해
   - C) `--no-verify`로 게이트를 건너뛰기 위해

4. 비교표에서 usage나 죽은 arm 칸에 값이 없으면?
   - A) 칸을 비운다
   - B) `0`을 넣어 합계가 깨지지 않게 한다
   - C) vanilla 숫자로 채운다

## 이해 상태

정답: 1A, 2C, 3B, 4A.
응답: 1A, 2B, 3A, 4B.
채점: 1 맞음 / 3 틀림. `quiz_score` 1/4.
disposition: 4문항 중 1문항만 맞음. 점수는 마감을 막지 않음.

## Tasks

### Task 001

#### Goal & intent

Pier가 단위 안에 `.git`을 안 남겨도 패치와 태스크 base가 있으면 태스크
프로젝트 트리에서 `metrics.json`을 낸다. 스위트 클론은 측정하지 않는다.

#### Interface

- 제공: 가짜 pier가 `reward.json`과 적용 가능한 패치만 남기고 단위 디렉터리에
  `git init`을 하지 않아도, 러너가 `docs/benchmark/deepswe/results/<run-id>/tasks/<task-id>/metrics.json`을
  만든다. `run.log`에 어떤 트리를 복원했는지가 남는다.
- 거부: 패치가 없으면 `metrics.json`을 만들지 않는다. 스위트 클론 안의
  `reward.json`·gold 패치를 이 런의 단위로 옮기지 않는다. 빈 diff로 measured를
  채우지 않는다. 이 태스크에서 `--arm` 의미와 브리지 인자 표면을 바꾸지 않는다.

#### Touch

- Modify `skills/agentic-code-benchmark/scripts/run_deepswe.py` — `.git` 부재를
  즉시 skip하지 않고 태스크 프로젝트 트리(base+패치)를 복원한다.
- Modify `test/skill-agentic-code-benchmark.test.js` — 패치만 있고 워크스페이스
  `.git`이 없는 스텁에서 `metrics.json`이 생기는 테스트와, 패치 없음 skip이
  유지되는 테스트를 둔다.
- Modify `docs/benchmark/deepswe/protocol.md` — 측정 사본이 호스트 체크아웃
  없이도 태스크 프로젝트 트리에서 나온다고 고친다. 2026-08-25 실패 원문은 유지한다.

#### Constraints

- 측정 대상은 DeepSWE 태스크가 가리키는 프로젝트 저장소다. `deep-swe` 클론의
  `tasks/` 트리를 `--repo`로 넘기지 않는다.
- 결과 레이아웃 `tasks/<task-id>/`와 `metrics.json` 스키마는 001과 같다.
- 실제 스모크를 다시 돌리지 않는다. 증적은 단위 테스트다.

### Task 002

#### Goal & intent

`--arm vanilla|superpowers|bouncer`가 라벨이 아니라 그 arm의 실행 조건을
러너 한 줄로 세우게 한다.

#### Interface

- 제공: 같은 인자 표면. vanilla는 플러그인 없이 `pier run --agent`.
  superpowers는 그 플러그인만 켠 세션이고 `.bouncer/`를 만들지 않는다.
  bouncer는 `pier run` 전에 `bouncer init`과 light scaffold·
  `bouncer current --set`까지 워크스페이스에 남긴다. 스텁이 확인하는 것은
  `.bouncer/` 존재와 vanilla/superpowers에 그것이 없음이다. plan 게이트
  이후 본문(execute/commit)은 Pier 에이전트가 돌리고 러너가 CLI로 대신
  부르지 않는다. `--help`의 `--arm` 설명이 라벨 전용이 아니다.
- 거부: superpowers가 호스트에 없으면 설치를 시도하지 않고 비영 코드와 이유
  한 줄을 내고 결과 JSON을 만들지 않는다. `--no-verify`나 게이트 우회로
  bouncer arm을 통과시키지 않는다. `--arm` 값 집합을 넷 이상으로 늘리지 않는다.

#### Touch

- Modify `skills/agentic-code-benchmark/scripts/run_deepswe.py` — `--arm`이
  호출·워크스페이스 준비를 고르게 한다.
- Modify `test/skill-agentic-code-benchmark.test.js` — arm별로 스텁이 본
  명령·파일이 갈라지는 단언, superpowers 부재 시 비영 코드 단언.
- Modify `docs/benchmark/deepswe/protocol.md` — Arm 표의 「러너가 직접 모는가」를
  세 arm 모두 예로 바꾸고, 사람 절차 절을 러너가 하는 일로 옮긴다.
- Modify `skills/agentic-code-benchmark/SKILL.md` — DeepSWE 절에서
  superpowers·bouncer가 손 절차라는 문장을 러너 `--arm`으로 고친다.

#### Constraints

- 판정은 세 arm 모두 Pier verifier다. 러너가 통과를 다시 매기지 않는다.
- bouncer arm의 `.bouncer/**`는 심사 diff(패치)에서 뺀다. 001 protocol과 같다.
- `SKILL.md`에 `BOUNCER_ROOT`와 `scripts/bouncer`를 적지 않는다.
  `test/skill-agentic-code-benchmark.test.js`가 요구하는 대로 본문에서
  `40`과 `60`이 80자 이내로 붙어 있어야 한다.
- 9런을 이 태스크에서 돌리지 않는다.

### Task 003

#### Goal & intent

같은 태스크 3개를 세 arm으로 돌려 통과율과 usage를 비교표와 history에 남긴다.

#### Interface

- 제공: 태스크 3개가 `sample.md` 「052 비교 태스크 3개」에 고정된다. id는
  DeepSWE 원본 클론 `tasks/`에서 README가 아닌 앞 세 디렉터리이고 스모크 id
  `abs-module-cache-flags`를 포함한다. 런 id는 `052-<arm>-<task-id>`. 각 런에
  `run.log`와 `reward.json`이 있다. `metrics.json`이 있는 런만 `merged.json`이
  있고, 패치가 없으면 metrics와 merged가 없다. `comparison.md`에 arm별
  통과율·`wall_s`·`tokens_in`·`tokens_out` 표가 있다. `history.md`의
  `## DeepSWE 원본` 절에 이 회차 행이 있다.
- 거부: 합성한 `merged.json`·공개 점수 날조. 실패한 칸을 0으로 채워 성공처럼
  보이게 하기. `--n-tasks 10` 전수 런. 050 `protocol.md` 수정.

#### Touch

- Modify `docs/benchmark/deepswe/sample.md` — 「052 비교 태스크 3개」절만
  채운다. 열 개 표본 표는 비워 둔다.
- Create `docs/benchmark/deepswe/comparison.md` — arm × 태스크 통과와 usage.
- Modify `docs/benchmark/history.md` — `## DeepSWE 원본` 절을 더한다. 1–3회차
  표는 그대로 둔다.
- Modify `docs/benchmark/deepswe/protocol.md` — 9런에 쓴 명령줄과 결과 경로를
  인용한다.
- Create `docs/benchmark/deepswe/results/` — 9런 산출물(`052-<arm>-<task-id>/`).
  `.gitkeep`은 유지하고 합성 JSON은 두지 않는다.
- Modify `test/public-name-regression.test.js` — `comparison.md`가 arm 이름
  스캔에 들어오면 허용 목록에 그 경로를 더한다. 깨지지 않으면 이 파일을
  스테이징하지 않는다.

#### Constraints

- 숫자는 실제 런 산출물에서 옮긴다. 없는 값은 칸을 비운다.
- 러너·브리지는 001·002가 세운 것을 쓰기만 한다.
- `comparison.md`를 커밋하는 커밋에 공개 이름 회귀가 깨지면 허용 목록을 같은
  커밋에서 고친다.
