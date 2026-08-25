---
type: bouncer.epic
title: 051 DeepSWE 원본 3 arm 측정
description: DeepSWE 원본 태스크 10개를 임시 클론으로 돌려 Pier 판정과 이 저장소 채점을 잇는다
resource: .bouncer/context/epics/051-deepswe-original-benchmark/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-25T16:24:29.329+09:00'
bouncer:
  id: '051'
  epic_id: '051'
  status: approved
  supersedes: []
---
# 051 DeepSWE 원본 3 arm 측정

## Intent
- 문제: 050이 남긴 벤치마크는 이 저장소 안의 버그·리팩터를 각색한 스위트다.
  "Bouncer가 자기 코드를 얼마나 잘 고치는가"는 재지만, 처음 보는 남의 저장소에서
  사이클이 값을 하는지는 재지 못한다. DeepSWE 원본은 고정 커밋·숨은 verifier로
  그 질문에 답할 수 있는데, 그 원본을 돌릴 경로가 저장소에 없다.
- 목표: DeepSWE 원본 태스크 10개를 임시 클론 안에서 Pier로 돌리고, 통과 판정은
  Pier verifier가 내고 코드 품질 0–100과 `usage`는 이 저장소 하네스가 내며,
  결과만 저장소에 남고 클론은 사라진다.

## Success criteria
1. `--n-tasks 10 --sample-seed <값>`으로 고정할 seed 값과 그 명령줄이
   `docs/benchmark/deepswe/sample.md`에 정본으로 남고, 뽑힌 태스크 id 목록이
   어느 산출물에서 어떻게 채워지는지가 같은 문서에 적힌다. 샘플링은
   `pier run` 안에서 일어나므로 이 에픽은 목록을 손으로 만들지 않는다.
2. 벤치마크 실행이 `deep-swe`를 저장소 바깥이 아니라 현재 디렉터리 아래
   무시되는 작업 경로에 클론하고, 실행이 끝나면 결과 산출물만 저장소 안 결과
   디렉터리로 옮긴 뒤 그 클론 디렉터리를 지운다. 성공·실패·중단 어느 경우에도
   클론이 남지 않는다.
3. 러너가 Pier 산출물과 함께 `collect_metrics.py`를 돌려 `metrics.json`을
   내고, Pier verifier의 `reward.json`이 통과/실패를 정하며, 그 둘이 런 하나의
   JSON 한 장으로 합쳐진다. `scorecard.py`의 루브릭·가중치·합성 점수 계산은
   그대로다.
4. vanilla · superpowers · bouncer 세 arm이 모두 같은 DeepSWE 태스크·같은 base
   커밋에서 시작하는 절차로 적히고, bouncer arm 절차가 그 외국 저장소에
   `bouncer init`을 깐 뒤 사이클을 강제하는 방법을 실행 가능한 수준으로 담는다.
5. 태스크 1개 × arm 1개 스모크 실행을 시도하고, 그 명령줄과 결과가
   `docs/benchmark/deepswe/protocol.md`에 남는다. 성공이면 합쳐진 결과 JSON
   한 장이 결과 디렉터리에 있고, 환경 문제로 끝나지 못했으면 실패한 명령줄과
   로그 위치가 그 자리에 있다. 어느 쪽이든 실행 뒤 클론 디렉터리는 없다.
6. 050이 만든 `docs/benchmark/{history,protocol,task-selection}.md`와
   `docs/benchmark/tasks/*.json`이 이 에픽에서 바뀌지 않는다.

## Out of scope
- 태스크 10 × arm 3 = 30런 전수 실행과 arm 비교표 — 경로가 선 뒤의 다음 에픽이다.
- `scorecard.py`의 루브릭 차원·가중치·40/60 구성 변경.
- 050 blueprint 003이 만든 이 저장소 스위트의 수정·삭제·대체.
- superpowers 플러그인 설치 자체와 그 설정.
- Pier 자체 포크·패치. 배포된 `datacurve-pier`를 그대로 쓴다.
- `.benchmarks/`를 `.gitignore`에서 빼는 일.
- Modal 등 원격 샌드박스(`--env modal`) 경로.

## Blueprints
* [001 DeepSWE 실행 경로](blueprints/001-deepswe-run-path/index.md) - 임시 클론 수명주기와 seed 정본, Pier 판정→이 저장소 채점 브리지, 3 arm 절차 — `skills/agentic-code-benchmark/scripts/`, `docs/benchmark/deepswe/`
