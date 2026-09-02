---
type: bouncer.tasks
title: 표본 런이 태스크마다 measured 한 장을 남기게 함
description: 결과 레이아웃을 tasks/<task-id>/ 단위로 통일하고 태스크가 여럿인 런에서도 태스크별 metrics.json을 내게 한다
resource: .bouncer/context/epics/034-evaluation-benchmarking/blueprints/003-deepswe-run-plumbing/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-25T21:30:57.792+09:00'
bouncer:
  id: TASKS-002
  epic_id: '034'
  blueprint_id: '003'
  status: verified
  commit_intent:
    - 표본 런은 패치가 둘 이상이면 metrics.json을 통째로 건너뛰어, 여러 태스크를 도는 회차에서 태스크별 측정이 하나도 남지 않았음
    - 결과 경로를 tasks/<task-id>/ 단위로 통일하고 태스크마다 산출물과 measured 한 벌을 앉힘
  affected_paths:
    - skills/agentic-code-benchmark/scripts/run_deepswe.py
    - test/skill-agentic-code-benchmark.test.js
    - docs/benchmark/deepswe/protocol.md
    - skills/agentic-code-benchmark/SKILL.md
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

Blueprint: [003](../../index.md)

## Goal & intent
태스크를 둘 이상 도는 표본 런에서도 태스크마다 measured JSON 한 장이 남는다.
지금 `build_measured_copy`는 패치가 둘 이상이면
`"metrics.json covers one task only, skipping"`을 적고 통째로 건너뛴다. 런
하나의 산출물이 결과 경로 루트에 평평하게 앉는 구조라 태스크별로 담을 이름이
없기 때문이다. 결과 레이아웃을 태스크 단위로 바꿔 그 이름을 만든다.

이 태스크가 끝나면 태스크가 하나인 런과 여럿인 런이 **같은** 레이아웃을 낸다.
비교표를 만드는 다음 blueprint가 분기를 안지 않게 하려는 것이다.

## Interface
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

## Touch
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

## Do not touch
- `skills/agentic-code-benchmark/scripts/collect_metrics.py` — measured 계산과
  `--task-id` 계약은 그대로다. 바뀌는 것은 `--out`이 가리키는 경로뿐이다.
- `skills/agentic-code-benchmark/scripts/bridge_pier.py` — 인자 표면과 병합
  동작 모두 그대로다.
- `skills/agentic-code-benchmark/scripts/scorecard.py` — 채점은 그대로다.
- `docs/benchmark/deepswe/sample.md` — 표본 목록은 003이 실제 런으로 채운다.
- `docs/benchmark/protocol.md`, `docs/benchmark/task-selection.md`,
  `docs/benchmark/tasks/` — 050이 만든 이 저장소 스위트다.

## Constraints
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

## Checklist
- [ ] 가짜 pier가 태스크 디렉터리 둘에 각각 **한 벌**을 남기는 테스트를 먼저 더한다.
  한 벌은 `reward.json`(`task_id`가 서로 다름), 패치 파일, 그리고 `git init` +
  커밋 하나를 마친 워크스페이스 디렉터리다. 워크스페이스와 base 커밋이 없으면
  `metrics.json`은 나올 수 없으므로, `reward.json`만 심은 fixture로는 수용 기준
  2를 재지 못한다.
  ```js
  const results = path.join(root, 'docs', 'benchmark', 'deepswe', 'results', 'r-multi');
  assert.ok(fs.existsSync(path.join(results, 'run.log')));
  for (const id of ['demo-a', 'demo-b']) {
    assert.ok(fs.existsSync(path.join(results, 'tasks', id, 'reward.json')));
    assert.ok(fs.existsSync(path.join(results, 'tasks', id, 'metrics.json')));
  }
  assert.doesNotMatch(run.stderr, /covers one task only/);
  ```
- [ ] 태스크 **하나**짜리 성공 런 테스트를 새로 쓴다. 지금 스위트에는 산출물이
  실제로 결과 경로에 앉는 단일 태스크 성공 케이스가 없다 — 가장 가까운
  `never mistakes suite fixtures…`는 stub pier가 아무것도 남기지 않는 음성
  단언뿐이라, 그대로 두면 수용 기준 3 뒤에 테스트가 없다. 위와 같은 한 벌을
  태스크 하나에만 심고 단언한다.
  ```js
  assert.ok(fs.existsSync(path.join(results, 'run.log')));
  assert.ok(fs.existsSync(path.join(results, 'tasks', 'demo-task', 'reward.json')));
  assert.ok(fs.existsSync(path.join(results, 'tasks', 'demo-task', 'metrics.json')));
  ```
- [ ] 태스크 id를 유도할 수 없는 단위가 섞인 런에서, 그 단위의 산출물이 결과
  경로에 하나도 앉지 않고 나머지 태스크의 결과는 남는 테스트를 더한다.
- [ ] `reward.json`의 태스크 id가 `../escape`처럼 경로를 벗어나는 값일 때 그
  단위가 같은 경로로 처리되고 결과 경로 밖에 아무것도 쓰이지 않는 테스트를 더한다.
- [ ] `node --test test/skill-agentic-code-benchmark.test.js`로 새 단언들이
  실패하는 것을 확인한다.
- [ ] `run_deepswe.py`의 수집·측정·이동 세 구간을 태스크 단위로 바꾼다. 클론
  skip과 정리 보증은 유지한다.
- [ ] 클론 fixture 오인 방지 테스트(`never mistakes suite fixtures`)의 단언을 새
  레이아웃 기준으로 **다시 쓴다**. 그대로 두면 두 단언이 공허하게 통과한다 —
  결과 루트에는 이제 아무것도 앉지 않으므로
  `!existsSync(path.join(results, 'reward.json'))`은 무조건 참이고,
  다중 패치 분기를 없애면 `doesNotMatch(run.stderr, /patches found/)`도 항상
  참이다. 이 테스트가 막던 것은 "클론이 실어 온 gold 패치·reward를 이 런의
  산출물로 오인"이므로, 새 레이아웃에서는 그 런이 `tasks/` 디렉터리를 아예
  만들지 않았음을 단언한다.
  ```js
  assert.ok(!fs.existsSync(path.join(results, 'tasks')), 'clone fixture must not become a task unit');
  assert.match(run.stderr, /no patch left by pier/);
  ```
- [ ] `docs/benchmark/deepswe/protocol.md`의 명령줄 경로와 레이아웃 서술을 갱신한다.
- [ ] `skills/agentic-code-benchmark/SKILL.md`의 DeepSWE 절 경로를 갱신하고,
  아래 검색이 옛 평평한 경로를 더 짚지 않는지 확인한다.
  ```bash
  grep -rnE "results>/[a-z]|deepswe/results/<run-id>/[a-z]" \
    skills/agentic-code-benchmark docs/benchmark
  ```
  좁은 패턴(`metrics.json`만)으로는 protocol.md에 남은 `reward.json`·`ctrf.json`·
  `merged.json` 경로와 산문 서술을 놓친다.
- [ ] `npm run ci` 통과.
