---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/052-deepswe-arm-comparison/blueprints/002-checkout-arms-comparison/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-26T11:15:50.330+09:00'
bouncer:
  id: EXPLAIN-002
  epic_id: '052'
  blueprint_id: '002'
  status: published
  comprehension:
    - range_from: develop
      range_to: b34998eb334db8b6b283b90a6a618d520e58afcc
      diff_sha: b063466d6f2267d5b8161318f38a45a738184ef516d9e0016bd9584a5eb5cec0
      quiz_score: '1/4'
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

