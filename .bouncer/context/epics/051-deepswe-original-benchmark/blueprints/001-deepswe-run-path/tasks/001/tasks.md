---
type: bouncer.tasks
title: 임시 클론 수명주기 러너와 seed 샘플 정본을 세움
description: deep-swe를 무시되는 작업 경로에 클론해 pier로 돌리고 결과만 남긴 뒤 클론을 지우는 러너와, seed가 뽑은 태스크 10개 정본을 만든다
resource: .bouncer/context/epics/051-deepswe-original-benchmark/blueprints/001-deepswe-run-path/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-25T16:24:29.361+09:00'
bouncer:
  id: TASKS-001
  epic_id: '051'
  blueprint_id: '001'
  status: verified
  verify: npm run ci
  commit_intent:
    - DeepSWE 원본을 돌릴 저장소가 없고, 클론을 어디에 두고 언제 지우는지 정해진 곳이 없었음
    - 결과만 남기고 클론은 반드시 사라지는 러너와 seed 정본 문서를 세움
  affected_paths:
    - skills/agentic-code-benchmark/scripts/run_deepswe.py
    - docs/benchmark/deepswe/sample.md
    - docs/benchmark/deepswe/results/.gitkeep
    - test/skill-agentic-code-benchmark.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-25T16:40:00+09:00'
    suggested_paths:
      - test/skill-agentic-code-benchmark.test.js
      - skills/agentic-code-benchmark/scripts
      - docs/benchmark
    basis:
      - graph: source
        status: updated
        query: >-
          query 'benchmark metrics collect scorecard pier deepswe runner'
          (BFS depth=2, 47 nodes)
        result: >-
          COLLECT_METRICS / collectMetrics()에서 출발한 이웃이 전부
          test/skill-agentic-code-benchmark.test.js 안에 모인다. 하네스
          스크립트의 유일한 호출·고정 지점이 그 테스트라는 뜻이다. 나머지
          히트(scripts/src/lib/validate.ts)는 collectFindingFailures() 이름
          충돌이라 이 작업과 무관하다.
      - graph: context
        status: updated
        query: >-
          query 'agentic code benchmark protocol arms superpowers naming
          allowlist' (BFS depth=2, 12 nodes)
        result: >-
          034/001과 050/002·003의 explain.md만 걸린다. 벤치마크 하네스와
          arm 프로토콜의 선행 결정이 그 셋에 있고, 새로 건드릴 컨텍스트
          문서는 없다. 이름 허용 목록은 그래프에 노드로 잡히지 않아
          test/public-name-regression.test.js를 직접 읽어 확인했다.
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`python3 skills/agentic-code-benchmark/scripts/run_deepswe.py` 한 번으로
`deep-swe`가 `.benchmarks/deepswe/<run-id>/`에 클론되고, 그 클론의 `tasks`
경로에 `pier run`이 걸리고, Pier가 남긴 패치를 태스크 base 커밋 위에 얹은
사본에서 `collect_metrics.py`가 돌아 `metrics.json`이 나오고, 그 다섯 산출물만
`docs/benchmark/deepswe/results/<run-id>/`로 옮겨진 뒤 작업 경로가 사라진다.
성공·실패·`Ctrl-C` 어느 경우에도 작업 경로가 남지 않는다.

`metrics.json`을 이 러너가 내는 이유는 사슬 때문이다. Pier는 컨테이너 안에서
돌아 `collect_metrics.py`가 그 워크스페이스 git에 닿지 못한다. 러너가 사본을
만들어 주지 않으면 002의 브리지에 줄 `--metrics`가 아예 존재하지 않는다.

`--arm`은 이 태스크에서 라벨 전용이다. 러너가 `pier run --agent`로 직접 몰 수
있는 것은 vanilla arm뿐이고, superpowers·bouncer arm은 003의 `protocol.md`
절차로 선다. `--arm`은 결과 경로 라벨과 002가 실을 `verdict.arm`에만 쓰인다.

## Interface
- 제공:
  - `run_deepswe.py`. 필수 `--run-id`, `--arm`, `--agent`. 선택
    `--sample-seed`, `--n-tasks`, `--task`, `--model`.
  - 작업 경로 `.benchmarks/deepswe/<run-id>/` (이미 `.gitignore` 대상).
    그 아래에 클론과 measured 수집용 사본이 함께 들어간다.
  - 결과 경로 `docs/benchmark/deepswe/results/<run-id>/`에
    `reward.json`·`ctrf.json`·`test-stdout.txt`·`run.log`·`metrics.json`.
  - `metrics.json`은 `collect_metrics.py`를 `--repo <사본> --base <태스크 base
    커밋> --task-id <태스크 id> --label <run-id>`로 불러 얻는다. `--task-id`를
    반드시 준다 — 002의 태스크 id 대조가 그 값에 걸린다.
  - `docs/benchmark/deepswe/sample.md` — seed 값, `--n-tasks 10 --sample-seed
    <값>` 명령줄, 뽑힌 id 목록이 어느 산출물에서 어떻게 채워지는지.
- 거부:
  - `pier` 또는 `docker`가 `PATH`에 없으면 클론을 뜨기 **전에** 설치 명령을
    stderr에 적고 비영 코드로 끝난다.
  - `docs/benchmark/deepswe/results/<run-id>/`가 이미 있으면 덮어쓰지 않고
    비영 코드로 끝난다.
  - `--task`와 `--n-tasks`를 함께 주면 거부한다. 하나는 단일 태스크,
    다른 하나는 샘플이라 동시에 성립하지 않는다.
  - 저장소 루트(`.git`이 있는 곳)가 아닌 cwd에서 부르면 거부한다.
  - Pier가 패치를 남기지 않았거나 base 커밋에 얹히지 않으면 `metrics.json`을
    만들지 않고 그 사실을 stderr에 적는다. 빈 diff로 measured 필드를 채우면
    "재지 않음"이 "아무것도 안 고침"으로 읽힌다.

## Touch
- Create `skills/agentic-code-benchmark/scripts/run_deepswe.py` — 클론 →
  `pier run` → 패치 얹은 사본에서 `collect_metrics.py` → 결과 이동 → 작업 경로
  제거를 한 실행에 담는다. python3 stdlib만.
- Create `docs/benchmark/deepswe/sample.md` — seed 값, 샘플링 명령줄, id 목록이
  채워지는 경로.
- Create `docs/benchmark/deepswe/results/.gitkeep` — 결과 착지 디렉터리를
  빈 채로 커밋에 남긴다.
- Modify `test/skill-agentic-code-benchmark.test.js` — 파일 존재 목록에
  `scripts/run_deepswe.py`를 더하고, 선행 조건 부재·인자 충돌·SIGINT 정리·
  `pier` 비영 종료 시 정리를 고정한다.

## Do not touch
- `skills/agentic-code-benchmark/scripts/collect_metrics.py` — 러너는 이 파일을
  **부르기만** 한다. 기존 필드·플래그를 바꾸지 않는다.
- `skills/agentic-code-benchmark/scripts/scorecard.py` — 루브릭·가중치는
  에픽 Out of scope다.
- `docs/benchmark/tasks/` 와 `docs/benchmark/protocol.md`,
  `docs/benchmark/task-selection.md`, `docs/benchmark/history.md` — 050이 닫은
  산출물이다.
- `.gitignore` — `.benchmarks/`가 이미 걸려 있어 바꿀 이유가 없다.

## Constraints
- python3 stdlib만 쓴다. 이 하네스는 `python3` 외 선행 조건을 늘리지 않는다.
- 작업 경로 제거는 `try/finally`와 SIGINT·SIGTERM 핸들러 양쪽에 건다.
  정상 종료 경로에만 걸면 `Ctrl-C`에 클론이 남는다.
- 제거 대상 경로는 항상 `.benchmarks/deepswe/<run-id>/` 절대 경로로 계산해
  검사한 뒤 지운다. 인자에서 받은 문자열을 그대로 `rmtree`에 넘기지 않는다.
- 이 태스크는 태스크 10개를 실제로 돌리지 않는다. `sample.md`의 id 목록 칸은
  다음 에픽의 첫 샘플 런이 채운다 — 손으로 만든 목록을 정본이라 적지 않는다.
- 네트워크가 필요한 단계(클론, 이미지 pull)는 실패를 삼키지 않고 그대로
  비영 코드로 올린다.
- 비자명한 의도는 한국어 주석으로 남긴다.

## Checklist
- [ ] `docs/benchmark/deepswe/` 디렉터리와 `results/.gitkeep`을 만든다.
- [ ] `test/skill-agentic-code-benchmark.test.js`에 실패하는 테스트를 먼저
      더한다. 넷 다 `pier`를 `PATH` 앞에 놓은 스텁으로 대체해 docker 없이 돈다:
      - 존재 목록에 `scripts/run_deepswe.py`.
      - `pier`를 가린 `PATH`에서 부르면 종료 코드가 0이 아니고
        `.benchmarks/deepswe/<run-id>`가 생기지 않는다.
      - `--task`와 `--n-tasks`를 함께 주면 종료 코드가 0이 아니다.
      - 스텁 `pier`가 비영 코드로 끝나면 러너도 비영으로 끝나고
        `.benchmarks/deepswe/<run-id>`가 남지 않는다.
      - 스텁 `pier`가 도는 동안 러너에 `SIGINT`를 보내면
        `.benchmarks/deepswe/<run-id>`가 남지 않는다.
- [ ] `node --test test/skill-agentic-code-benchmark.test.js`로 실패를 확인한다.
- [ ] `run_deepswe.py`를 구현한다. 순서는 선행 조건 확인 → 결과 경로 충돌 확인
      → 작업 경로 생성 → `git clone --depth 1 https://github.com/datacurve-ai/deep-swe`
      → `pier run` → 패치 얹은 사본 생성 → `collect_metrics.py` → 산출물 이동
      → 작업 경로 제거.
- [ ] `pier run` 호출은 두 형태 중 하나만 쓴다. `-p`는 한 번만 나온다:
      ```
      # 샘플 실행
      pier run -p <clone>/tasks --agent <agent> [--model <model>] \
        --n-tasks <n> --sample-seed <seed>
      # 단일 태스크 실행
      pier run -p <clone>/tasks/<task-id> --agent <agent> [--model <model>]
      ```
- [ ] `collect_metrics.py` 호출에 `--task-id <태스크 id>`를 반드시 넣는다.
      빠지면 `task_id`가 `null`로 남아 002의 대조가 무의미해진다.
- [ ] `docs/benchmark/deepswe/sample.md`에 seed 값과 샘플링 명령줄을 적고,
      id 목록 칸은 어느 산출물(`pier run`이 남기는 실행 매니페스트/`run.log`)
      에서 언제 채우는지를 명시한 채로 비워 둔다.
- [ ] `npm run ci` 통과.
