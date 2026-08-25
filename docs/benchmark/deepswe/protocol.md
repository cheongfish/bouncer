# DeepSWE 원본 3 arm 프로토콜

이 문서는 DeepSWE 원본 스위트(https://github.com/datacurve-ai/deep-swe)의
`tasks/`를 vanilla · superpowers · bouncer 세 arm으로 돌릴 때 쓰는 통제와 절차를
적는다. 이 저장소 자체를 대상으로 하는 스위트의 프로토콜은
[../protocol.md](../protocol.md)에 따로 있고, 그 문서는 이 문서가 고치지 않는다.
표본은 [sample.md](sample.md)의 seed가 정한다.

## Arm

| arm | 조건 | 러너가 직접 모는가 |
| --- | --- | --- |
| **vanilla** | 플러그인 없음. 태스크 본문만 주고 검증·커밋 방식은 에이전트가 고른다. | 예. `run_deepswe.py --arm vanilla`가 `pier run --agent`로 끝까지 몬다. |
| **superpowers** | superpowers 플러그인만 설치·활성. Bouncer 사이클은 강제하지 않는다. | 아니오. 아래 「arm별 절차」로 사람이 세운다. |
| **bouncer** | Bouncer 사이클 강제. 게이트 실패 코드는 고치고 `--no-verify`와 가드 우회는 금지. | 아니오. 아래 「arm별 절차」로 사람이 세운다. |

이 비대칭은 하네스의 한계지 설계 선택이 아니다. `run_deepswe.py`의 `--arm`은
세 값을 다 받지만, 실제로 자동화되는 것은 `pier run --agent <agent>` 한 줄로
끝나는 vanilla뿐이다. 나머지 둘은 에이전트 세션에 플러그인을 얹거나 사이클을
강제해야 해서 Pier의 `--agent` 인자만으로 서지 않는다. `--arm superpowers`나
`--arm bouncer`로 러너를 부르는 것은 산출물에 라벨을 붙이는 일이지, 그 arm의
조건을 만들어 주는 일이 아니다.

세 arm의 차이는 **에이전트를 어떻게 세우는가**에만 있다. 판정은 세 arm 모두 같은
Pier verifier가 낸다. 태스크의 숨은 테스트를 통과했는지는 arm과 무관하게 한
군데서 결정되고, 그 결과가 `reward.json` → `bridge_pier.py` → 병합 JSON의
`verdict` 블록으로 실린다.

## 공통 통제

- **같은 태스크.** 세 arm은 같은 태스크 id 집합을 돈다. arm마다 표본을 다시
  뽑지 않는다.
- **같은 base 커밋.** 각 태스크의 base는 그 태스크 메타데이터가 정한다. 런은
  서로의 산출물을 보지 못한다 — `run_deepswe.py`는 런마다 새 클론을 뜬다.
- **사람 개입 0회.** 세 arm 모두 물어볼 사람이 없다. 에이전트가 막히면 막힌
  대로 끝난다. 이 0회는 **에이전트를 구해 주는 개입**을 세는 것이고, arm을
  세우는 준비 작업은 여기 들어가지 않는다 — 플러그인 설치, 워크스페이스 준비,
  bouncer arm의 `affected_paths` 확정이 그렇다. `affected_paths` 확정은
  사이클 안에서 일어나지만 vanilla에 대응물이 없는 arm 조건 자체이므로 개입
  횟수에 넣지 않는다. 막힌 에이전트에게 답을 주는 개입만 0회로 센다.
- **판정은 Pier verifier 하나.** 사람이 통과 여부를 다시 매기지 않는다.
  루브릭 심사를 붙이더라도 그것은 품질 점수지 통과 판정이 아니다.
- **측정은 빌드 산출물이 diff를 더럽히기 전에.** `run_deepswe.py`가 Pier가 남긴
  패치를 base 위에 다시 얹은 사본에서 `collect_metrics.py`를 돌리므로, 이
  순서는 러너 안에서 지켜진다.

## Arm별 절차

### vanilla

저장소 루트에서 러너 한 줄이다.

```bash
python3 skills/agentic-code-benchmark/scripts/run_deepswe.py \
  --run-id <run-id> --arm vanilla --agent <agent> \
  --task <task-id>
```

표본 전체를 돌 때는 `--task` 대신 `--n-tasks 10 --sample-seed 20260825`을 준다.
`--task`와 `--n-tasks`는 서로 배타라 같이 주면 러너가 거부한다.

결과는 아래 레이아웃으로 남고 작업 경로는 지워진다. 태스크가 하나여도 여럿이어도
같은 모양이다. `run.log`만 런 루트에 한 장이고, 측정·판정 파일은 태스크마다
`tasks/<task-id>/` 아래 한 벌이다. Pier가 남기지 않은 파일은 키가 아니라 파일
자체가 없다.

```
docs/benchmark/deepswe/results/<run-id>/
  run.log
  tasks/<task-id>/reward.json
  tasks/<task-id>/ctrf.json
  tasks/<task-id>/test-stdout.txt
  tasks/<task-id>/metrics.json
```

러너가 남긴 것은 `tasks/<task-id>/metrics.json`(측정)과 Pier의
`tasks/<task-id>/reward.json`·`ctrf.json`(판정)이 따로 있는 상태다. 런당 기록
값 표가 읽는 병합 JSON은 브리지가 만든다.

```bash
python3 skills/agentic-code-benchmark/scripts/bridge_pier.py \
  --metrics docs/benchmark/deepswe/results/<run-id>/tasks/<task-id>/metrics.json \
  --reward docs/benchmark/deepswe/results/<run-id>/tasks/<task-id>/reward.json \
  --ctrf docs/benchmark/deepswe/results/<run-id>/tasks/<task-id>/ctrf.json \
  --arm vanilla \
  --out docs/benchmark/deepswe/results/<run-id>/tasks/<task-id>/merged.json
```

### superpowers

superpowers 플러그인이 측정 호스트에 **이미 설치되어 있어야 한다**. 설치 절차는
이 문서 밖이고, 이 프로토콜은 설치하지 않는다. 설치가 안 된 호스트에서는 이
arm을 돌리지 않고, 그 사실을 회차 기록에 적는다 — 설치 여부로 런을 실패
처리하지 않는다.

1. 태스크 저장소를 base에 detach한 워크스페이스로 연다.
2. superpowers만 켠 세션에 태스크 본문을 그대로 넣는다. Bouncer 스킬과 게이트는
   호출하지 않는다.
3. 세션이 끝나면 워크스페이스 diff를 패치로 뽑아 Pier verifier에 넣는다. 판정은
   vanilla와 같은 경로로 나온다.

### bouncer

태스크 워크스페이스 하나에 사이클 하나다. 활성 포인터와 verify 원장은 같은 git
common directory를 공유하므로, 한 워크스페이스에서 두 사이클을 돌리지 않는다.

```bash
# 1. 태스크 워크스페이스에 Bouncer를 깐다
bouncer init

# 2. light 계약으로 계획한다 (에이전트 세션에서 /bouncer-plan). 그 안에서 도는
#    scaffold는 epic 하나 + light blueprint 하나다. light blueprint가
#    tasks/001/{tasks,verification,review}.md까지 같이 만들므로 첫 태스크에
#    scaffold task를 따로 부르지 않는다 — 부르면 디렉터리가 이미 있다고 거절한다.
bouncer scaffold epic --id 001 --name <epic-slug>
bouncer scaffold blueprint \
  --epic-dir .bouncer/context/epics/001-<epic-slug> \
  --id 001 --name <bp-slug> --scale light

# 아래 세 명령은 모두 블루프린트 디렉터리를 받는다. 한 번만 잡아 둔다.
BP=.bouncer/context/epics/001-<epic-slug>/blueprints/001-<bp-slug>

# 3. plan 게이트. 실패 코드는 고친다.
bouncer validate --gate plan --blueprint "$BP"

# 4. 포인터를 세운다. --set은 블루프린트 디렉터리를 받고, 태스크 문서는
#    --task로 고른다 (NNN 또는 TASKS-NNN).
bouncer current --set "$BP" --task 001

# 5. 구현 (에이전트 세션에서 /bouncer-execute)
# 6. execute 게이트
bouncer validate --gate execute --blueprint "$BP"

# 7. 커밋 (에이전트 세션에서 /bouncer-commit)
```

커밋까지 끝나면 그 커밋의 diff를 패치로 뽑아 Pier verifier에 넣는다. 판정은
vanilla·superpowers와 같은 경로로 나온다 — bouncer 게이트를 통과했다는 것은
사이클을 지켰다는 뜻이지 태스크를 통과했다는 뜻이 아니다.

`/bouncer-plan`은 light 계약으로 돈다. `affected_paths`는 사람이 확정한다.
게이트가 뱉는 G/S 코드는 고쳐서 통과시키고, `--no-verify`나 커밋 가드 우회로
넘기지 않는다. 우회한 런은 표본에서 뺀다.

계획 문서(`.bouncer/**`)는 심사 diff에서 뺀다. 세 arm을 같은 종류의
산출물(코드 + 테스트)로 비교하기 위해서다. 계획 문서 분량은 비용 지표로만
남긴다. plan 게이트 통과 직후 줄 수를 재 두지 않으면 나중에 복구할 수 없다 —
런 클론은 커밋 하나로 squash되고 계획 트리 사본이 어디에도 남지 않는다.

## 런당 기록 값

| 값 | 출처 |
| --- | --- |
| `arm` | 병합 JSON `verdict.arm`. `bridge_pier.py --arm`이 넣는다 |
| `task_id` | 병합 JSON `task_id`. `verdict.task_id`는 같은 값을 옮겨 적은 것이라 둘이 어긋날 수 없다. 대조는 입력 쪽에서 한다 — `metrics.json`의 `task_id`와 Pier `reward.json`의 태스크 id가 다르면 `bridge_pier.py`가 병합을 거부한다 |
| `verdict.passed` | Pier `reward.json`의 통과 플래그. 없으면 보상 부호로 유도된다 |
| `verdict.reward` | Pier `reward.json`의 숫자 보상 |
| `verdict.pass_fraction` | Pier `ctrf.json` 요약의 passed/tests. 읽히지 않으면 키가 없다 |
| `checks` | `collect_metrics.py` measured. tests / lint / typecheck / build 각각 `ran`·`passed` |
| `coverage` | `collect_metrics.py` measured. `before`·`after`·`delta` |
| `diff` | `collect_metrics.py` measured. `files_changed`·`lines_added`·`test_line_share` 등 |
| `rework` | `collect_metrics.py` measured. `churn_ratio` |
| `usage.tokens_in` / `usage.tokens_out` | `collect_metrics.py --tokens-in` / `--tokens-out` |
| `usage.wall_s` | `--wall-s`. 구현 세션 벽시계(초) |
| `usage.tool_calls` | `--tool-calls` |
| 계획 문서 줄 수 | bouncer arm만. plan 게이트 통과 직후 `wc -l` |

`usage`는 기록 전용이다. `scorecard.py`의 합성 점수에 들어가지 않는다. 플래그를
준 키만 실리고, 재지 않은 값은 키를 만들지 않는다 — 0으로 채우면 "재지 않음"과
"0이었음"이 구분되지 않는다. 같은 이유로 `verdict`도 채점 입력이 아니다.
`scorecard.py`는 그 블록을 읽지 않는다.

## 스모크 시도 (2026-08-25)

태스크 1개 × arm 1개(vanilla)로 러너와 브리지를 잇는 배관을 확인하려 했다.
**이 시도는 성공하지 못했다.** 아래는 실제로 친 명령줄과 실제로 나온 출력이다.

태스크 id는 원본 스위트의 트리에서 그대로 가져왔다.

```bash
git clone --depth 1 --filter=blob:none --no-checkout \
  https://github.com/datacurve-ai/deep-swe /tmp/deep-swe
git -C /tmp/deep-swe ls-tree --name-only HEAD tasks/ | head -20
# tasks/abs-module-cache-flags ... (첫 태스크)
```

러너 호출:

```bash
python3 skills/agentic-code-benchmark/scripts/run_deepswe.py \
  --run-id smoke-20260825 --arm vanilla --agent claude \
  --task abs-module-cache-flags
```

출력(stderr), 종료 코드 2:

```
pier not found on PATH. install Pier: pipx install pier-cli  (see https://github.com/datacurve-ai/deep-swe)
```

러너는 클론을 뜨기 전 선행 조건 검사에서 멈췄다. 그래서 이 시도에는 `run.log`가
없다 — 작업 경로 자체가 만들어지지 않았고, 위 stderr 한 줄이 로그의 전부다.
이어서 돌릴 `bridge_pier.py`는 입력이 될 `metrics.json`과 `reward.json`이 없어
아예 부르지 않았다.

측정 호스트 상태:

```bash
command -v pier docker python3 git
# /usr/bin/docker /usr/bin/python3 /usr/bin/git  (pier 없음)
docker info >/dev/null; echo $?   # 0 — 데몬은 산다
python3 -m pip --version          # No module named pip
command -v pipx pip3              # 둘 다 없음
```

`docker`와 네트워크는 있지만 `pier`가 없고, 이 호스트에는 `pip`도 `pipx`도 없어
`pipx install pier-cli`로 채울 수 없다. 이 배관은 Pier가 설치된 호스트에서 다시
시도해야 한다. `docs/benchmark/deepswe/results/`는 그래서 비어 있다 —
`.gitkeep` 하나뿐이다. 합성한 결과 JSON을 그 자리에 대신 두지 않는다.

### 작업 경로가 남지 않았는지 확인

러너는 성공·실패·Ctrl-C 어느 쪽으로 끝나도 `.benchmarks/deepswe/<run-id>/`를
지운다. 스모크가 끝난 뒤 그 자리를 확인한다.

```bash
ls -d .benchmarks/deepswe/smoke-20260825
# ls: cannot access '.benchmarks/deepswe/smoke-20260825': No such file or directory
```

이 시도에서는 선행 조건 검사가 먼저 걸려 작업 경로가 애초에 만들어지지 않았다.
Pier가 있는 호스트에서 다시 돌린 뒤에도 같은 명령으로 확인한다. 경로가 남아
있으면 러너의 정리 경로가 깨진 것이므로 그 회차 결과를 쓰지 않는다.
