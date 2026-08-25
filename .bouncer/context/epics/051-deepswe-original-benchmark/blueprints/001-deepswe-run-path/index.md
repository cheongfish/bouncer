---
type: bouncer.blueprint
title: DeepSWE 원본을 임시 클론으로 돌리는 경로를 세움
description: seed 샘플 정본과 클론 수명주기 러너, Pier 판정을 metrics JSON에 싣는 브리지, 3 arm 절차를 세운다
resource: .bouncer/context/epics/051-deepswe-original-benchmark/blueprints/001-deepswe-run-path/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-25T16:24:29.361+09:00'
bouncer:
  id: '001'
  epic_id: '051'
  blueprint_id: '001'
  status: approved
  commit_type: feat
  scale: full
  supersedes: []
---
# 001 deepswe-run-path

Epic: [051](../../index.md)

## Intent
- 문제: DeepSWE 원본을 돌리려면 `deep-swe` 저장소가 있어야 하는데, 그걸 이
  저장소에 커밋할 수도 없고 사용자 홈 어딘가에 남겨 둘 수도 없다. 돌린 뒤에도
  Pier가 내는 `reward.json`과 이 저장소가 내는 measured 필드가 서로 다른 파일에
  흩어져 런 하나를 한 장으로 볼 수 없다. arm별 절차도 이 저장소 스위트 기준이라
  남의 저장소에서는 그대로 못 쓴다.
- 완료 조건: 러너 한 번 호출로 클론이 뜨고 돌고 결과만 남고 클론이 사라지며,
  Pier 판정이 실린 metrics JSON 한 장이 기존 `scorecard.py`에 그대로 들어가고,
  세 arm 절차가 DeepSWE 태스크 기준으로 적힌다. 30런 전수 실행은 밖이다.

## Contract
- 인터페이스:
  - `skills/agentic-code-benchmark/scripts/run_deepswe.py` (신규, python3
    stdlib만). 필수 `--run-id`, `--arm`, `--agent`. 선택 `--sample-seed`,
    `--n-tasks`, `--task <task-id>`, `--model`. 저장소 루트에서 부른다.
    `--arm`은 이 blueprint에서 **라벨 전용**이다 — 산출물 경로와 `verdict.arm`에만
    쓰이고 실행 방식을 바꾸지 않는다. 러너가 `pier run --agent`로 직접 몰 수
    있는 것은 vanilla arm뿐이고, superpowers와 bouncer arm은 이번에는
    `protocol.md`의 절차로만 선다. 셸이 아니라
    파이썬인 이유는 하네스의 다른 두 스크립트와 같은 런타임을 쓰고, 정리
    보장을 `try/finally` + 시그널 핸들러로 두기 위해서다 — 이 저장소에는
    아직 `.sh`가 하나도 없다.
  - 러너 수명주기: 작업 경로는 `.benchmarks/deepswe/<run-id>/`(이미
    `.gitignore` 대상). 그 아래로 `deep-swe`를 클론하고, `pier run`을 그
    클론의 `tasks` 경로에 걸고, Pier가 남긴 패치를 태스크 base 커밋 위에 얹은
    사본에서 `collect_metrics.py`를 돌려 `metrics.json`을 낸 뒤, verifier
    산출물(`reward.json`, `ctrf.json`, `test-stdout.txt`, `run.log`)과
    `metrics.json`만 `docs/benchmark/deepswe/results/<run-id>/`로 옮기고
    작업 경로를 지운다. 그 사본도 작업 경로 안에 두어 함께 사라진다. 제거는 `try/finally`와 SIGINT·SIGTERM
    핸들러에 걸어 성공·실패·중단 모두에서 실행된다.
  - `skills/agentic-code-benchmark/scripts/bridge_pier.py` (신규). 인자
    `--metrics`, `--reward`, `--arm`, 선택 `--ctrf`, 필수 `--out`.
    `collect_metrics.py`가 낸 metrics JSON에 `verdict` 블록을 실어 같은
    파일 모양으로 다시 쓴다.
  - `verdict` 형태: `{ "source": "pier", "task_id": <str>, "arm": <str>,
    "passed": <bool>, "reward": <number>, "pass_fraction": <number|생략> }`.
- 데이터·상태:
  - 합쳐진 JSON의 `schema`는 `agentic-code-benchmark/metrics/1` 그대로다.
    `verdict`는 `usage`와 같은 위치의 선택 키이고, `scorecard.py`는 이 키를
    읽지 않으므로 코드를 고치지 않아도 기존 채점이 그대로 돈다.
  - seed와 그 seed가 뽑은 태스크 id 10개는 `docs/benchmark/deepswe/sample.md`
    에 정본으로 남는다. 목록은 사람이 고른 것이 아니라 러너가 낸 것을 옮긴다.
  - `docs/benchmark/deepswe/results/`는 커밋되는 결과 착지점이고,
    `.benchmarks/deepswe/`는 커밋되지 않는 작업 경로다. 둘을 섞지 않는다.
- 수용 기준:
  1. `run_deepswe.py`가 종료된 뒤 `.benchmarks/deepswe/<run-id>/`가 없다.
     `pier run`이 0이 아닌 코드로 끝나거나 SIGINT로 끊겨도 없다.
  2. `docs/benchmark/deepswe/sample.md`가 seed 값과 `--n-tasks 10
     --sample-seed <값>` 명령줄, 그리고 뽑힌 id 목록이 어느 산출물에서 어떻게
     채워지는지를 담는다. 샘플링은 `pier run` 안에서 일어나므로 이 blueprint는
     10개 실행으로 목록을 확정하지 않는다.
  3. `bridge_pier.py`가 `reward.json`의 통과 값을 `verdict.passed`로 옮기고,
     `--metrics`가 준 기존 키를 하나도 잃지 않은 JSON을 `--out`에 쓴다.
  4. 3번이 낸 파일을 `scorecard.py score --metrics <그 파일> --judgment <j>
     --out <o>`에 넣으면 `scorecard.py`를 고치지 않고 점수가 나온다.
  5. `docs/benchmark/deepswe/protocol.md`가 vanilla·superpowers·bouncer 세
     arm의 통제 조건과 arm별 실행 절차를 담고, bouncer arm 절차에 태스크
     저장소에 `bouncer init`을 깐 뒤 사이클을 강제하는 단계가 있다.
  6. `test/public-name-regression.test.js`의 `COMPARISON_ARM_ALLOWLIST`가
     `skills/agentic-code-benchmark/scripts/run_deepswe.py`와 새
     `docs/benchmark/deepswe/protocol.md`를 포함해, 러너의 `--arm` 값과 그
     문서가 비교 arm 이름을 적어도 공개 이름 회귀 테스트가 통과한다. 러너는
     002가, 문서는 003이 더한다 — 그 스캔은 `git ls-files` 기준이라 파일이
     커밋되기 전에는 위반이 드러나지 않는다.
  7. 태스크 1개 × arm 1개 스모크 실행을 시도하고, 그 명령줄과 결과가
     `protocol.md`에 인용된다. 성공이면 합쳐진 JSON 한 장이
     `docs/benchmark/deepswe/results/` 아래에 있고, 환경 문제로 끝나지
     못했으면 실패한 명령줄과 로그 위치가 그 자리에 있다. 두 경우 모두
     이 기준을 충족한다 — 합성한 결과 JSON을 두는 것만이 위반이다.
  8. `npm run ci` 통과.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - Pier가 컨테이너 안에서 돌아 `collect_metrics.py`가 그 워크스페이스 git에
    닿지 못한다. 그래서 러너가 패치를 태스크 base 커밋 위에 얹은 사본을 작업
    경로 안에 만들고 거기서 `collect_metrics.py`를 돌린다. 이 단계가 없으면
    브리지에 줄 `--metrics`가 존재하지 않아 사슬이 끊긴다.
  - Pier가 패치를 남기지 않았거나 base 커밋에 얹히지 않으면 `metrics.json`을
    만들지 않고 그 사실을 stderr에 적는다. 빈 diff로 measured 필드를 채우면
    "재지 않음"이 "아무것도 안 고침"으로 읽힌다.
  - 태스크 여러 개를 한 번에 도는 표본 런(`--n-tasks`)도 `metrics.json`을
    내지 않는다. `metrics.json`과 `--task-id`가 단수라 태스크별 measured
    필드를 담을 이름이 없기 때문이다. 이 blueprint는 태스크 1개 스모크까지만
    재고, 표본 런의 태스크별 metrics 이름·스키마는 10개 전수 실행을 맡는
    다음 에픽이 정한다. `sample.md`가 적은 `--n-tasks 10` 명령줄은 Pier
    산출물까지는 남기지만 measured 한 장은 아직 남기지 않는다.
  - `reward.json`이 없거나 파싱에 실패하면 `bridge_pier.py`는 비영 코드로
    끝나고 `--out`을 만들지 않는다. 부분 결과를 남기면 "판정 없음"이 "실패"로
    읽힌다.
  - `--metrics`와 `--reward`의 태스크 id가 다르면 거부한다. 두 런의 조각을
    한 장으로 붙이는 실수를 막는다.
  - `pier`나 `docker`가 없는 호스트: 러너가 실행 전에 확인하고 설치 명령을
    가리키며 비영 코드로 끝난다. 클론을 뜬 뒤 죽지 않는다.
  - 스모크 실행이 환경 문제(이미지 pull 실패, API 키 부재, limits 초과)로
    끝나지 않으면 성공했다고 적지 않는다. 실패한 명령줄과 로그 위치를
    `protocol.md`에 그대로 적고 그 사실을 보고한다.
  - `<run-id>`가 이미 결과 디렉터리에 있으면 덮어쓰지 않고 거부한다.
  - `docs/benchmark/deepswe/protocol.md`가 커밋되는 순간
    `public-name-regression`의 arm 이름 스캔에 들어온다. `.bouncer/context/**`
    는 HISTORICAL이라 면제지만 `docs/` 아래는 아니다. 허용 목록을 같은
    커밋에서 넓히지 않으면 CI가 깨진다.
  - bouncer arm에서 태스크 저장소에 `.bouncer/`를 깔면 그 계획 문서가 심사
    diff에 섞인다. 050 프로토콜과 같이 `.bouncer/**`를 심사 diff에서 빼고
    분량은 비용 지표로만 남긴다.

## Out of scope
- 태스크 10 × arm 3 전수 실행과 arm 비교표.
- `scorecard.py` 수정과 루브릭·가중치 변경.
- `docs/benchmark/{history,protocol,task-selection}.md`와
  `docs/benchmark/tasks/*.json` 수정 — 050이 닫은 산출물이다.
- superpowers 설치.
- `--env modal` 원격 샌드박스 경로.
- `collect_metrics.py`의 기존 필드·플래그 변경.

## One-commit justification
- 세 태스크는 한 문장으로 읽힌다: 클론을 떴다 지우는 러너와 seed 정본을
  세우고(001), Pier 판정을 metrics 한 장에 싣고(002), 그 둘을 쓰는 3 arm
  절차를 적고 스모크로 증명한다(003). 리뷰어는 "다음 회차를 이 저장소만 보고
  원본에서 돌릴 수 있는가" 하나만 판단하면 되므로 blueprint 하나가 리뷰
  단위로 맞다.
- 002는 이름 허용 목록 한 줄을 함께 진다. 001의 러너가 커밋되어 tracked가 된
  순간 공개 이름 회귀가 깨졌고, 그 한 줄이 없으면 002 자신의 `npm run ci`가
  통과하지 못한다. 별개 기능이 아니라 002가 서기 위한 조건이라 같은 커밋에
  둔다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 임시 클론 수명주기 러너와 seed 샘플 정본
* [Tasks 002](tasks/002/tasks.md) - Pier 판정을 metrics JSON에 싣는 브리지
* [Tasks 003](tasks/003/tasks.md) - 3 arm 프로토콜과 스모크 실행 증적
* [Verification 001](tasks/001/verification.md) - 검증 명령과 증적
* [Review 001](tasks/001/review.md) - 리뷰 발견사항
* [Verification 002](tasks/002/verification.md) - 검증 명령과 증적
* [Review 002](tasks/002/review.md) - 리뷰 발견사항
* [Verification 003](tasks/003/verification.md) - 검증 명령과 증적
* [Review 003](tasks/003/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
