---
type: bouncer.blueprint
title: 호스트 체크아웃 없이 measured를 내고 세 arm 비교표를 남김
description: 'Pier가 호스트 체크아웃을 안 남겨도 패치로 metrics.json을 내고, --arm이 실행 조건을 만들며, 3×3런 비교표를 남긴다'
resource: .bouncer/context/epics/052-deepswe-arm-comparison/blueprints/002-checkout-arms-comparison/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-26T09:47:03.243+09:00'
bouncer:
  id: '002'
  epic_id: '052'
  blueprint_id: '002'
  status: approved
  commit_type: feat
  scale: full
  supersedes: []
---
# 002 checkout-arms-comparison

Epic: [052](../../index.md)

## Intent
- 문제: 001 스모크는 `pier run`이 0인데도 호스트에 `.git` 워크스페이스가 없어
  `metrics.json`을 건너뛰었다. `--arm`은 라벨이라 superpowers·bouncer를 러너
  한 줄로 세울 수 없고, 비교표에 넣을 9런도 없다.
- 완료 조건: 패치가 있으면 호스트 체크아웃 없이도 태스크 프로젝트 트리에서
  measured가 나오고, 러너 한 줄이 arm 조건을 만들며, 같은 태스크 3개 × arm
  3개 런의 통과율과 `usage`가 비교표 한 장과 `history.md`에 남는다.

## Contract
- 인터페이스:
  - `run_deepswe.py` 인자 표면은 그대로다. 바뀌는 동작은 둘이다.
    1. `build_measured_copy`: Pier가 단위 디렉터리에 `.git`을 안 남겨도,
       패치와 태스크 base가 있으면 그 **태스크 프로젝트** 트리를 복원해
       `collect_metrics.py`를 돌린다. 스위트 클론(`deep-swe/tasks/`)은
       측정 대상이 아니다.
    2. `--arm vanilla|superpowers|bouncer`가 실행 조건을 고른다. vanilla는
       플러그인 없이 `pier run --agent`. superpowers는 그 플러그인만 켠다.
       bouncer는 `pier run` 전에 워크스페이스에 `bouncer init`과 light
       scaffold·포인터를 남긴다. plan/execute/commit 본문은 Pier 에이전트
       세션이 돌리고, 러너가 그 CLI를 대신 호출하지 않는다.
  - 결과 레이아웃·`bridge_pier.py` 인자 표면은 001과 같다. 9런도
    `tasks/<task-id>/` 한 벌이다. `metrics.json`이 있는 런만
    `bridge_pier.py`로 `merged.json`을 만든다.
- 데이터·상태:
  - `metrics.json` 스키마는 `agentic-code-benchmark/metrics/1` 그대로다.
  - 비교표는 arm별 통과율(Pier `verdict.passed`)과 `usage.wall_s`·
    `tokens_in`·`tokens_out`을 나란히 놓는다. 값이 없는 칸은 비운다. 0으로
    채우지 않는다.
  - 태스크 3개는 `sample.md`의 「052 비교 태스크 3개」절에 고정한다. 열 개
    표본 표는 비워 둔다.
- 수용 기준:
  1. 가짜 pier가 패치와 `reward.json`만 남기고 단위 안에 `.git`이 없으면,
     러너가 태스크 프로젝트 트리(base+패치)에서 `tasks/<id>/metrics.json`을
     낸다. `pier left no host-side workspace checkout`으로 skip하지 않는다.
  2. 패치가 없으면 지금처럼 `metrics.json`을 만들지 않고 `run.log`에 skip
     사실을 적는다. 스위트 클론 픽스처는 태스크 단위가 되지 않는다.
  3. `--arm superpowers`로 부른 러너가 남긴 호출·워크스페이스가 superpowers만
     켜고 `.bouncer/`를 만들지 않는다. `--arm bouncer`는 `pier run` 전에
     `.bouncer/`(init + light blueprint)가 있고 vanilla·superpowers에는 없다.
     `--help`의 `--arm` 설명이 라벨 전용이 아니다.
  4. 호스트에 superpowers가 없으면 그 arm은 설치를 시도하지 않고 비영 코드와
     한 줄 이유로 끝낸다. 합성 JSON을 두지 않는다.
  5. 같은 태스크 3개 × 세 arm = 9런을 시도한다. 산출물이 있는 런의 판정은 Pier
     `reward.json`(있으면 `merged.json`의 `verdict`)이다. 죽은 런은 결과
     디렉터리나 비교표 칸이 비고, 통과로 적지 않는다.
  6. `docs/benchmark/deepswe/comparison.md`에 arm별 통과율과 usage 표가 있다.
     `docs/benchmark/history.md`에 `## DeepSWE 원본` 절을 새로 두고, 열은
     회차·측정일·태스크 세 id·arm별 통과율·`wall_s`/`tokens_in`/`tokens_out`
     합이다. 기존 1–3회차 표의 열·숫자는 그대로다.
  7. `npm run ci` 통과.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - 태스크 base 커밋을 태스크 메타데이터에서 못 읽거나 그 트리에 닿지 못하면
    `metrics.json`을 만들지 않고 `run.log`에 적는다. 빈 트리로 재지 않는다.
  - 에이전트 `NonZeroAgentExitCodeError`로 패치가 없으면 001과 같이 skip이다.
    비교표 그 칸은 비운다.
  - 같은 `--run-id`가 결과 경로에 있으면 덮어쓰지 않고 거부한다.
  - 9런은 토큰과 시간이 든다. 한 arm·한 태스크가 환경으로 죽으면 그 칸을
    성공으로 채우지 않고 나머지 런은 계속한다.

## Out of scope
- 태스크 10개 전수(30런). `sample.md`의 `--n-tasks 10` 줄은 그대로 두고
  열 개 표를 이번에 채우지 않는다.
- `scorecard.py` 루브릭·가중치·40/60 합성 점수.
- 050 스위트 문서 `docs/benchmark/{protocol,task-selection}.md`와
  `docs/benchmark/tasks/*.json`.
- Pier 포크·패치. superpowers 플러그인 설치·개발.
- `--env modal`. `.benchmarks/`를 `.gitignore`에서 빼는 일.

## One-commit justification
- 태스크 세 개다. 체크아웃 복원, arm 실행 조건, 9런·비교표는 실패 모드가
  다르고 따로 되돌릴 수 있어야 한다. 리뷰·PR 단위는 이 blueprint 하나다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 호스트 체크아웃 없이 measured를 냄
* [Verification 001](tasks/001/verification.md) - 검증 명령과 증적
* [Review 001](tasks/001/review.md) - 리뷰 발견사항
* [Tasks 002](tasks/002/tasks.md) - `--arm`이 실행 조건을 만들게 함
* [Verification 002](tasks/002/verification.md) - 검증 명령과 증적
* [Review 002](tasks/002/review.md) - 리뷰 발견사항
* [Tasks 003](tasks/003/tasks.md) - 9런과 비교표를 남김
* [Verification 003](tasks/003/verification.md) - 검증 명령과 증적
* [Review 003](tasks/003/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
