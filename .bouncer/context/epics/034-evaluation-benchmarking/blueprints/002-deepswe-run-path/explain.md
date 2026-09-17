---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/034-evaluation-benchmarking/blueprints/002-deepswe-run-path/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-25T21:12:18.485+09:00'
bouncer:
  id: EXPLAIN-002
  epic_id: '034'
  blueprint_id: '002'
  status: published
  comprehension:
    - range_from: develop
      range_to: 71f7098460f738221609236f7ff2c10d578a4986
      diff_sha: 3207833641058356438726986a52d11a68ea685615c793e7d0b351bfca396f53
      quiz_score: 3/4
      disposition: 러너·브리지·프로토콜의 계약과 이번 사이클의 git ls-files 함정은 짚었다. 정리 경로를 두 군데 건 이유만 어긋났으므로, 다음 회차에 시그널 처리와 finally의 실행 시점을 한 번 더 확인한다.
      recorded_at: '2026-08-25T21:16:16+09:00'
---
# Explain

## Background
DeepSWE 원본을 돌리려면 `deep-swe` 저장소가 있어야 한다. 그걸 이 저장소에
커밋할 수는 없고, 사용자 홈 어딘가에 풀어 두면 다음 회차가 어떤 상태의
클론을 쓴 것인지 알 수 없다. 돌린 뒤에도 문제가 남았다. Pier는 컨테이너
안에서 돌며 `reward.json`으로 통과 판정만 내고, 이 저장소의
`collect_metrics.py`는 diff와 커버리지 같은 measured 필드를 낸다. 둘이 다른
파일에 흩어져 있으면 런 하나를 한 장으로 볼 수 없고, `scorecard.py`에 넣을
입력도 없다. arm별 절차도 이 저장소 스위트를 전제로 적혀 있어 남의 저장소에는
그대로 쓸 수 없었다.

세 커밋이 그 셋을 각각 닫는다. 클론의 수명을 한 실행 안에 가두고, 두 판정을
JSON 한 장으로 합치고, 세 arm 절차를 원본 기준으로 다시 적는다.

## Intuition
러너는 빌려 온 작업장이다. 들어가서 일하고, 결과만 들고 나오고, 작업장은
반드시 허문다. 성공하든 실패하든 `Ctrl-C`로 끊기든 마찬가지다.

브리지는 그 위에 도장을 찍는다. Pier가 "통과"라고 말하고 이 저장소가 "이만큼
고쳤다"고 말하면, 브리지가 둘을 같은 종이에 올려 `scorecard.py`가 고쳐지지
않은 채로 채점하게 한다.

## Code
- `skills/agentic-code-benchmark/scripts/run_deepswe.py` — 선행 조건 확인 →
  결과 경로 충돌 확인 → 작업 경로 생성 → 클론 → `pier run` → 패치 얹은 사본
  → `collect_metrics.py` → 산출물 이동 → 제거. 제거는 `try/finally`와
  SIGINT·SIGTERM 핸들러 양쪽에 걸려 있고, 지울 경로는 인자 문자열이 아니라
  `.benchmarks/deepswe/<run-id>` 절대 경로로 다시 계산해 부모를 검사한 뒤
  지운다. 산출물·패치 탐색은 `walk_outputs(root, skip)`로 클론 서브트리를
  가지치기한다 — 스위트가 실어 온 `reward.json`이나 gold 패치를 이 런의
  것으로 오인하지 않기 위해서다.
- `skills/agentic-code-benchmark/scripts/bridge_pier.py` — metrics JSON의 모든
  키를 그대로 두고 `verdict`만 더한다. `schema`는 올리지 않는다. `pick()`의
  중첩 탐색은 태스크 id에만 열려 있다. id는 잘못 집어도 불일치 거부가
  받아 주지만, 보상과 통과 플래그는 잘못 집으면 그대로 지어낸 판정이 되기
  때문이다.
- `docs/benchmark/deepswe/protocol.md` — 세 arm의 통제와 절차. 러너가
  `pier run --agent`로 직접 몰 수 있는 것은 vanilla뿐이고 나머지 둘은 문서의
  절차로 선다는 비대칭을 숨기지 않고 적는다.
- `test/public-name-regression.test.js` — 비교 arm 이름 스캔. `git ls-files`로
  대상을 뽑는다는 점이 이번 사이클의 핵심 함정이다.

## Quiz
1. 러너가 작업 경로를 지우는 코드를 `try/finally`에만 걸지 않고 SIGINT·SIGTERM
   핸들러에도 건 이유는?
   - (a) `finally`는 예외가 났을 때만 돌기 때문에
   - (b) SIGTERM 기본 처리는 프로세스를 그대로 죽여 `finally`가 돌지 않기 때문에
   - (c) 시그널 핸들러가 `finally`보다 먼저 돌아 정리가 두 번 되기 때문에

2. TASKS-001의 execute 게이트가 `npm run ci`를 exit 0으로 기록했는데, 그
   커밋 직후 같은 명령이 실패했다. 왜인가?
   - (a) 게이트가 `npm test`를 돌렸고 `npm run ci`는 돌리지 않았기 때문에
   - (b) 리뷰 왕복에서 더한 테스트가 뒤늦게 깨졌기 때문에
   - (c) 이름 스캔이 `git ls-files`로 대상을 뽑는데 그때 러너가 untracked였기 때문에

3. `bridge_pier.py`가 `--metrics`의 `task_id`가 `null`이면 거부하는 이유는?
   - (a) `collect_metrics.py`는 `--task-id`를 주지 않으면 그 자리에 `null`을
     넣으므로, 통과시키면 두 런의 조각이 붙는 것을 막는 대조가 무력해져서
   - (b) `scorecard.py`가 `task_id`를 가중치 계산에 쓰기 때문에
   - (c) `verdict` 블록의 모든 키가 필수라 하나라도 비면 스키마가 깨져서

4. 003의 스모크가 `pier` 부재로 실패했는데도 이 태스크가 실패로 판정되지
   않은 이유는?
   - (a) 스모크는 선택 항목이라 시도 자체가 필수가 아니어서
   - (b) 브리프가 "합성한 결과 JSON을 결과 디렉터리에 두는 것만이 실패"라고
     정해 두었고, 실패한 명령줄과 사유를 그대로 적었기 때문에
   - (c) `pier`는 선행 조건이 아니라 선택 의존성이라서

## 이해 상태
4문항 중 3문항 정답 (`3/4`). 범위는 `develop..71f7098`.

- Q1 정답 (b) — 응답 (a), **오답**. `finally`는 예외가 났을 때만이 아니라 정상
  종료에서도 돈다. 핸들러가 필요한 쪽은 SIGTERM이다. 기본 처리가 프로세스를
  그대로 죽여 `finally`에 닿지 못하기 때문이다. 실제로 리뷰가 이 지점을
  짚었다 — 처음 붙인 SIGINT 테스트는 핸들러를 지워도 통과해서
  `try/finally`만 고정하고 있었고, 종료 코드를 `128+signal`로 단언하고
  SIGTERM 케이스를 더한 뒤에야 핸들러를 고정하게 됐다.
- Q2 정답 (c) — 응답 (c), 정답. 이번 사이클이 한 번 멈춘 원인이다.
- Q3 정답 (a) — 응답 (a), 정답.
- Q4 정답 (b) — 응답 (b), 정답.

Disposition: 세 커밋의 계약과 `git ls-files` 함정은 짚었다. 정리 경로를 두
군데 건 이유만 어긋났으므로, 다음 회차에 시그널 처리와 `finally`의 실행 시점을
한 번 더 확인한다.

## 다음 회차로 넘기는 것
- 표본 런(`--n-tasks 10`)은 `metrics.json`을 내지 않는다. `metrics.json`과
  `--task-id`가 단수라 태스크별 measured 필드를 담을 이름이 없다. 10개 전수
  실행을 맡는 다음 에픽이 그 이름과 스키마를 정한다.
- `run_deepswe.py`의 docstring이 050의 `docs/benchmark/protocol.md`를 가리키는데
  실제 원본 절차는 `docs/benchmark/deepswe/protocol.md`에 있다. 002·003 모두
  러너를 Do not touch로 두어 이번에는 고칠 수 없었다.
- `sample.md`의 `--n-tasks 10` 명령줄에 measured 한계 단서가 없다. 그 문서는
  열린 task의 `affected_paths` 밖이었다.
- 스모크는 `pier` 부재로 서지 못했다. 배관은 아직 실제로 증명되지 않았다.

## Tasks

### Task 001

#### Goal & intent

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

#### Interface

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

#### Touch

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

#### Constraints

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

### Task 002

#### Goal & intent

`python3 skills/agentic-code-benchmark/scripts/bridge_pier.py --metrics <m> --reward <r> --arm <arm> --out <o>`
가 Pier verifier의 통과 판정을 `collect_metrics.py` 출력에 `verdict` 블록으로
실어 같은 모양의 JSON 한 장으로 다시 쓴다. `schema`는
`agentic-code-benchmark/metrics/1` 그대로이고 `verdict`는 `usage`와 같은
선택 키이므로, `scorecard.py score --metrics <o> --judgment <j> --out <s>`가 코드 수정 없이
그대로 돈다.

이 태스크가 이름 허용 목록 한 줄을 함께 지는 이유가 있다. 001이 커밋되면서
`run_deepswe.py`가 tracked가 되었고, `test/public-name-regression.test.js`의
비교 arm 스캔이 `git ls-files` 기준이라 그 순간부터 `--arm`의 `choices`에 있는
`superpowers`를 위반으로 잡는다. 001의 execute 게이트가 녹색이었던 것은 그때
그 파일이 untracked라 스캔 대상이 아니었기 때문이다. 001은 이미 닫혔고 003은
`protocol.md`만 그 목록에 올리므로, 이 한 줄을 여기서 지지 않으면 002의
`npm run ci`가 통과할 수 없다.

#### Interface

- 제공:
  - `bridge_pier.py`. 필수 `--metrics`, `--reward`, `--arm`, `--out`.
    선택 `--ctrf`.
  - 출력 JSON = 입력 metrics JSON의 모든 키 + `verdict`.
  - `verdict` = `{ "source": "pier", "task_id": <str>, "arm": <str>,
    "passed": <bool>, "reward": <number> }`. `--ctrf`를 주고 그 파일에서 통과
    비율을 읽을 수 있으면 `"pass_fraction": <number>`를 더한다. 읽지 못하면
    그 키를 만들지 않는다 — `usage`와 같은 규칙으로, 없는 값을 `0`으로 채우면
    "재지 않음"과 "0이었음"이 구분되지 않는다.
- 거부:
  - `--reward` 파일이 없거나 JSON 파싱에 실패하면 비영 코드로 끝나고 `--out`을
    만들지 않는다. 부분 결과를 남기면 "판정 없음"이 "실패"로 읽힌다.
  - `--metrics`의 `task_id`와 `--reward`가 가리키는 태스크 id가 서로 다르면
    거부한다. 두 런의 조각이 한 장으로 붙는 것을 막는다.
  - `--metrics`의 `task_id`가 `null`이어도 거부한다. `collect_metrics.py`는
    `--task-id`를 주지 않으면 그 자리에 `null`을 넣으므로, `null`을 통과시키면
    대조가 통째로 무력해진다. 001의 러너는 `--task-id`를 항상 준다.
  - `--metrics`의 `schema`가 `agentic-code-benchmark/metrics/1`이 아니면
    거부한다.
  - `--out` 경로가 이미 있으면 덮어쓰지 않고 거부한다.

#### Touch

- Create `skills/agentic-code-benchmark/scripts/bridge_pier.py` — reward/ctrf를
  읽어 metrics JSON에 `verdict`를 실어 다시 쓴다. python3 stdlib만.
- Modify `test/skill-agentic-code-benchmark.test.js` — 파일 존재 목록에
  `scripts/bridge_pier.py`를 더하고, 병합 결과가 입력 키를 잃지 않는 것,
  거부 네 가지, 그리고 병합 결과가 `scorecard.py`에 그대로 들어가는 것을
  고정한다.
- Modify `test/public-name-regression.test.js` — `COMPARISON_ARM_ALLOWLIST`에
  `skills/agentic-code-benchmark/scripts/run_deepswe.py`를 더한다. 그 목록의
  다른 항목이 저마다 이유 주석을 달고 있으므로, 스크립트가 문서 목록에 끼는
  이유(`--arm` 값이 사용자가 치는 실제 값이라 리터럴을 피할 수 없음)를 한 줄
  주석으로 남긴다. 그 두 줄 외의 편집은 하지 않는다 — 다른 목록·정규식·스캔
  기준은 그대로 둔다.

#### Constraints

- python3 stdlib만 쓴다.
- `schema` 문자열을 올리지 않는다. 기존 키가 사라지지 않고 선택 키만 늘기
  때문이다 — 003이 `usage`를 더할 때 쓴 판단과 같다.
- `verdict`는 채점 입력이 아니다. `scorecard.py`가 읽는 필드 이름을 재사용해
  가중치에 새어 들어가게 하지 않는다.
- 비자명한 의도는 한국어 주석으로 남긴다.

### Task 003

#### Goal & intent

`docs/benchmark/deepswe/protocol.md`가 DeepSWE 원본 태스크에서 vanilla ·
superpowers · bouncer 세 arm을 돌리는 통제 조건과 arm별 절차를 담는다. bouncer
arm 절차는 태스크 저장소에 `bouncer init`을 깐 뒤 사이클을 강제하는 단계를
실행 가능한 수준으로 적는다.

001의 러너가 `pier run --agent`로 직접 몰 수 있는 것은 vanilla arm뿐이다.
superpowers와 bouncer arm은 이 문서의 절차로 서고, 세 arm 모두 판정은 같은
Pier verifier가 낸다. 그 비대칭을 문서가 숨기지 않고 적는다.

그리고 태스크 1개 × arm 1개(vanilla) 스모크를 **시도**해, 001의 러너와 002의
브리지를 거친 JSON 한 장이 남는지로 배관을 확인한다. 성공이든 환경 문제로
끝나지 못했든 그 명령줄과 결과를 `protocol.md`에 그대로 적는다.

#### Interface

- 제공:
  - `docs/benchmark/deepswe/protocol.md` — Arm 표, 공통 통제, arm별 절차,
    런당 기록 값, 스모크 시도 증적.
  - 스모크가 성공한 경우에 한해
    `docs/benchmark/deepswe/results/<smoke-run-id>/` 아래 병합된 metrics JSON.
- 거부:
  - 스모크가 환경 문제(이미지 pull 실패, 에이전트 자격 증명 부재, limits
    초과)로 끝나지 못하면 성공했다고 적지 않는다. 실패한 명령줄과 로그 위치를
    그대로 적고 그 사실을 보고한다. 합성한 결과 JSON을 결과 디렉터리에 두는
    것만이 이 태스크의 실패다 — 시도가 실패한 것 자체는 아니다.

#### Touch

- Create `docs/benchmark/deepswe/protocol.md` — 3 arm 통제·절차·기록 값과
  스모크 시도 증적.
- Create `docs/benchmark/deepswe/results/` 아래 스모크 산출물 — 성공했을 때만
  생긴다. 결과가 커밋되는 착지점이므로 범위 안에 있어야 스테이징된다.
- Modify `test/public-name-regression.test.js` — `COMPARISON_ARM_ALLOWLIST`에
  `docs/benchmark/deepswe/protocol.md`를 더한다. 그 문서가 커밋되는 순간
  비교 arm 이름 스캔에 들어오는데 `docs/` 아래는 HISTORICAL 면제가 아니다.
- Modify `skills/agentic-code-benchmark/SKILL.md` — DeepSWE 원본 경로
  (`run_deepswe.py` → `bridge_pier.py` → `scorecard.py`)를 이 저장소 스위트와
  나란히 한 절로 적어 진입점을 만든다.
- Modify `test/skill-agentic-code-benchmark.test.js` — 위 SKILL.md 수정이
  기존 단언(40/60 근접 매칭, `BOUNCER_ROOT` 부재, `scripts/bouncer` 부재,
  `NOTICE.md` 언급)을 깨면 여기서 고친다. 깨지 않으면 손대지 않는다.

#### Constraints

- 본문은 한국어. 경로·식별자·명령줄은 그대로 둔다.
- superpowers arm은 설치를 선행 조건으로 적기만 한다. 설치하지 않고 설치
  여부로 실패하지도 않는다.
- bouncer arm의 계획 문서(`.bouncer/**`)는 심사 diff에서 뺀다. 세 arm을 같은
  종류의 산출물로 비교하기 위해서다. 분량은 비용 지표로만 남긴다.
- `SKILL.md`를 고칠 때 `test/skill-agentic-code-benchmark.test.js`의 세 단언을
  깨지 않는다: 40과 60이 80자 이내로 붙어 있어야 하고, `BOUNCER_ROOT`와
  `scripts/bouncer`가 본문에 나오면 안 된다. bouncer arm 절차의 CLI 경로는
  `protocol.md`에만 적고 `SKILL.md`에는 적지 않는다.
- 스모크 증적은 실제 출력에서 옮긴다. 예시로 지어내지 않는다.
