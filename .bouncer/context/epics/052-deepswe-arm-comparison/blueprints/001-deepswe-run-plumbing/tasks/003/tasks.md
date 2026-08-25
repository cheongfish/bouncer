---
type: bouncer.tasks
title: vanilla 스모크를 실제로 성공시키고 결과를 정본으로 남김
description: 설치한 Pier로 vanilla 1태스크 런을 성공시키고 병합 JSON과 문서를 실제 실행 결과로 채운다
resource: .bouncer/context/epics/052-deepswe-arm-comparison/blueprints/001-deepswe-run-plumbing/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-25T21:30:57.829+09:00'
bouncer:
  id: TASKS-003
  epic_id: '052'
  blueprint_id: '001'
  status: ready
  commit_intent:
    - 051이 세운 배관은 pier 부재로 한 번도 끝까지 돈 적이 없어 결과 디렉터리에 .gitkeep뿐이었음
    - 설치한 Pier로 vanilla 1태스크 런을 실제로 돌려 verdict가 실린 병합 JSON과 갱신된 프로토콜 기록을 남김
  affected_paths:
    - docs/benchmark/deepswe/protocol.md
    - docs/benchmark/deepswe/sample.md
    - docs/benchmark/deepswe/results
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-25T21:45:00.000+09:00'
    suggested_paths:
    - test
    # 유효 엔트리 필드: graph, status, query, result — 예시는 주석이라 파싱되지 않는다
    # - graph: source | context
    #   status: updated | reused | fail-skip | skip-disabled | missing
    #   query: <graphify 조회>
    #   result: <한 줄 요약>
    basis:
    - graph: source
      status: reused
      query: deepswe runner pier install hint per-task metrics results layout smoke benchmark
      result: 71 nodes, all under test/ (top - test/skill-agentic-code-benchmark.test.js, test/public-name-regression.test.js, test/public-contract.test.js); config.source_dirs is scripts/hooks/test so skills/agentic-code-benchmark/scripts is outside the graph
    - graph: context
      status: updated
      query: deepswe 벤치마크 러너 pier 설치 안내 태스크별 metrics 결과 레이아웃 스모크
      result: 8 nodes, all the freshly authored 052 plan documents themselves; no prior epic surfaced as an overlap
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
결과 디렉터리에 실제로 돈 런 하나가 남는다. 051의 스모크는 선행 조건 검사에서
멈춰 `docs/benchmark/deepswe/results/`에 `.gitkeep`밖에 없다. 001이 설치 안내를
고쳤고 002가 레이아웃을 세웠으니, 이 태스크는 그 배관으로 vanilla arm 1태스크를
실제로 돌려 `verdict`가 실린 병합 JSON 한 장을 커밋한다.

이 태스크는 **실제 외부 실행**을 포함한다. 측정 호스트에 Pier를 설치하고
(`uv tool install datacurve-pier`), Docker 데몬 위에서 에이전트 세션이 돈다.
실행이 환경 문제로 끝나지 못하면 합성한 결과를 두지 않고 `/bouncer-plan`으로
에스컬레이션한다.

## Interface
- 제공: `docs/benchmark/deepswe/results/smoke-052-vanilla/` 아래에 `run.log`와
  `tasks/<task-id>/{reward.json,ctrf.json,test-stdout.txt,metrics.json,merged.json}`이
  커밋된다. `merged.json`은 `bridge_pier.py`가 낸 병합 JSON이고 `verdict.source`는
  `pier`, `verdict.arm`은 `vanilla`다.
- 제공: `docs/benchmark/deepswe/protocol.md`의 「스모크 시도」 절이 실제로 친
  명령줄과 실제 출력, 결과 경로로 갱신된다. 실패했던 2026-08-25 시도 기록은
  지우지 않고 그 앞 시도로 남긴다 — 왜 안내가 바뀌었는지가 그 기록에 있다.
- 거부: 실행이 성공하지 못하면 결과 디렉터리에 아무 JSON도 두지 않는다.
  실패한 명령줄과 로그 위치를 protocol.md에 적고 태스크를 닫지 않는다.
- 거부: `pier run`이 0으로 끝났는데 `metrics.json`이 없는 경우는 환경 문제가
  아니라 러너 결함이다. 특히 `run.log`에
  `pier left no host-side workspace checkout; skipping metrics.json`이 남으면
  `bridge_pier.py --metrics`가 받을 입력이 없어 `merged.json`을 만들 수 없다.
  003은 스크립트를 고칠 수 없으므로(아래 Do not touch) 이 경우는 **002로
  되돌아갈 신호**다 — 003에서 우회하지 말고 `/bouncer-plan`으로 에스컬레이션한다.
- 거부: 같은 `--run-id`를 재사용하지 않는다. 실패 후 다시 돌릴 때는
  `smoke-052-vanilla-2`처럼 새 id를 쓰고, 커밋에는 성공한 런 하나만 남긴다.

## Touch
- Create `docs/benchmark/deepswe/results` 아래 성공한 스모크 런 디렉터리 하나 —
  기본 이름은 `smoke-052-vanilla`이고, 실패 후 재시도로 id가 바뀌면 그 이름이
  된다(러너가 같은 `--run-id` 재사용을 거부하므로 재시도는 반드시 새 id다).
  디렉터리 단위로 선언하는 이유가 이것이다. 커밋에는 성공한 런 **하나**만
  남기고, 실패한 시도의 잔여물은 남기지 않는다. `.gitkeep`은 그대로 둔다.
- Modify `docs/benchmark/deepswe/protocol.md` — 「스모크 시도」 절에 성공한 실행의
  명령줄·출력·결과 경로를 더하고, 측정 호스트 준비 단계(Pier 설치 명령)를 적는다.
- Modify `docs/benchmark/deepswe/sample.md` — 스모크가 돈 태스크 id를 적고,
  표본 10개 목록이 어느 회차에서 채워지는지를 현재 상태에 맞게 갱신한다.

## Do not touch
- `skills/agentic-code-benchmark/scripts/` 전체 — 이 태스크는 코드를 고치지
  않는다. 실행 중 러너 결함이 드러나면 그것은 002로 되돌아갈 신호이지 여기서
  고칠 일이 아니다.
- `test/skill-agentic-code-benchmark.test.js` — 실제 실행은 이 스위트가 재는
  대상이 아니다.
- `docs/benchmark/history.md` — 회차 기록은 9런이 끝난 뒤 다음 blueprint가 쓴다.
- `docs/benchmark/protocol.md`, `docs/benchmark/task-selection.md`,
  `docs/benchmark/tasks/` — 050이 만든 이 저장소 스위트다.

## Constraints
- 결과 JSON을 손으로 만들거나 고치지 않는다. 러너와 `bridge_pier.py`가 낸
  파일을 그대로 커밋한다.
- 실행 뒤 `.benchmarks/deepswe/<run-id>/`가 남아 있지 않은지 확인하고, 남아
  있으면 그 회차 결과를 쓰지 않는다 — 정리 경로가 깨진 것이다.
- `--arm vanilla`만 돈다. superpowers·bouncer arm은 다음 blueprint다.
- 태스크는 하나만 돈다(`--task <task-id>`). `--n-tasks`로 표본 전체를 돌지
  않는다 — 토큰과 시간이 든다.
- protocol.md에 적는 출력은 실제로 나온 것을 옮긴다. 요약하거나 다듬지 않는다.

## Checklist
- [ ] 측정 호스트에 Pier를 설치하고 버전을 기록한다.
  ```bash
  uv tool install datacurve-pier
  pier --version
  ```
- [ ] `docker info` 가 0으로 끝나는지 확인한다.
- [ ] 돌 태스크 id 하나를 원본 스위트 트리에서 고른다.
  ```bash
  git clone --depth 1 --filter=blob:none --no-checkout \
    https://github.com/datacurve-ai/deep-swe /tmp/deep-swe-052
  git -C /tmp/deep-swe-052 ls-tree --name-only HEAD tasks/ | head -20
  ```
- [ ] 러너를 돌린다.
  ```bash
  python3 skills/agentic-code-benchmark/scripts/run_deepswe.py \
    --run-id smoke-052-vanilla --arm vanilla --agent claude \
    --task <task-id>
  ```
- [ ] 결과 경로에 `tasks/<task-id>/metrics.json`과 `reward.json`이 있는지 확인한다.
- [ ] 브리지로 병합 JSON을 만든다.
  ```bash
  T=docs/benchmark/deepswe/results/smoke-052-vanilla/tasks/<task-id>
  python3 skills/agentic-code-benchmark/scripts/bridge_pier.py \
    --metrics "$T/metrics.json" --reward "$T/reward.json" --ctrf "$T/ctrf.json" \
    --arm vanilla --out "$T/merged.json"
  ```
- [ ] `merged.json`의 `verdict.source`가 `pier`인지 확인한다.
- [ ] 작업 경로가 지워졌는지 확인한다.
  ```bash
  ls -d .benchmarks/deepswe/smoke-052-vanilla
  # No such file or directory 여야 한다
  ```
- [ ] `protocol.md`의 「스모크 시도」 절과 측정 호스트 준비 단계를 실제 출력으로 갱신한다.
- [ ] 같은 문서에서 현재형으로 남은 두 서술을 함께 고친다 — "`pipx install
  pier-cli`로 채울 수 없다"와 "`docs/benchmark/deepswe/results/`는 그래서 비어
  있다"(2026-08-25 기준 203–204행 부근). 001이 안내를 고치고 003이 결과를
  남기므로 둘 다 더는 참이 아니다. 다만 184행에 인용된 그날의 stderr 원문은
  그때 실제로 나온 출력이므로 지우지 않는다.
- [ ] `sample.md`의 태스크 id 자리를 현재 상태에 맞게 갱신한다.
- [ ] `npm run ci` 통과.
