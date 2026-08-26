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
| **superpowers** | superpowers 플러그인만 설치·활성. Bouncer 사이클은 강제하지 않는다. `.bouncer/`를 만들지 않는다. | 예. `run_deepswe.py --arm superpowers`가 그 플러그인만 켠 `pier run`을 몬다. |
| **bouncer** | Bouncer 사이클 강제. 게이트 실패 코드는 고치고 `--no-verify`와 가드 우회는 금지. | 예. `run_deepswe.py --arm bouncer`가 `pier run` 전에 init·light scaffold·포인터를 남긴다. |

세 arm 모두 같은 인자 표면이다. `--arm`은 산출물 라벨이 아니라 그 런의 실행
조건을 고른다. 판정은 세 arm 모두 같은 Pier verifier가 낸다. 태스크의 숨은
테스트를 통과했는지는 arm과 무관하게 한 군데서 결정되고, 그 결과가
`reward.json` → `bridge_pier.py` → 병합 JSON의 `verdict` 블록으로 실린다.
러너가 통과를 다시 매기지 않는다.

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
  패치를 태스크 프로젝트의 base 위에 다시 얹은 사본에서 `collect_metrics.py`를
  돌리므로, 이 순서는 러너 안에서 지켜진다. 측정 사본은 호스트에 `.git`
  체크아웃이 없어도 된다. 태스크 메타(`task.toml`의 `repository_url`과
  `base_commit_hash`)로 그 프로젝트 트리를 복원한 뒤 패치를 얹는다. 스위트
  클론의 `tasks/` 트리는 `--repo`로 넘기지 않는다.

## Arm별 절차

세 arm 모두 저장소 루트에서 러너 한 줄이다. `--arm`만 갈린다.

```bash
python3 skills/agentic-code-benchmark/scripts/run_deepswe.py \
  --run-id <run-id> --arm <vanilla|superpowers|bouncer> --agent <agent> \
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
  --arm <vanilla|superpowers|bouncer> \
  --out docs/benchmark/deepswe/results/<run-id>/tasks/<task-id>/merged.json
```

### vanilla

플러그인 없이 `pier run --agent`다. 러너가 `.bouncer/`를 만들지 않는다.

### superpowers

superpowers 플러그인이 측정 호스트에 **이미 설치되어 있어야 한다**. 설치 절차는
이 문서 밖이고, 러너는 설치를 시도하지 않는다. 호스트에 없으면 비영 코드와
이유 한 줄을 stderr에 내고 결과 경로를 만들지 않는다.

러너는 그 플러그인만 켠 `pier run`을 몬다. `.bouncer/`는 만들지 않는다.
Bouncer 스킬과 게이트는 호출하지 않는다. 판정은 vanilla와 같은 Pier verifier다.

### bouncer

러너가 `pier run` 전에 작업 경로에 `bouncer init`, light scaffold
(`epic` + `blueprint --scale light`), 그 문서가 plan 게이트를 통과하도록
채운 뒤 `bouncer current --set`을 남긴다. `--set`은 포인터 기록 전에 plan
게이트를 그대로 돈다. scaffold 기본 템플릿만으로는 거절되므로 러너가 light
본문(status·`affected_paths`·`basis`·G10 절)을 채운다. `--no-verify`로
건너뛰지 않는다. plan 게이트 이후 execute/commit은 Pier 에이전트 세션이
돌리고, 러너가 그 CLI를 대신 부르지 않는다. 우회한 런은 표본에서 뺀다.

태스크 워크스페이스 하나에 사이클 하나다. 활성 포인터와 verify 원장은 같은 git
common directory를 공유하므로, 한 워크스페이스에서 두 사이클을 돌리지 않는다.
`/bouncer-plan`은 light 계약으로 돈다.

판정은 vanilla·superpowers와 같은 Pier verifier다. bouncer 게이트를 통과했다는
것은 사이클을 지켰다는 뜻이지 태스크를 통과했다는 뜻이 아니다.

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

그때는 `docker`와 네트워크는 있었지만 `pier`가 없었고, 그 호스트에는 `pip`도
`pipx`도 없어서 안내 문구의 `pipx install pier-cli`로는 채울 수 없었다. 그 회차의
`docs/benchmark/deepswe/results/`는 `.gitkeep` 하나뿐이었다. 합성한 결과 JSON을
그 자리에 대신 두지 않았다. Pier 패키지 이름은 그 뒤에
`uv tool install datacurve-pier`로 고쳤고, 같은 날 그 설치로 다시 돌렸다.

### 작업 경로가 남지 않았는지 확인

러너는 성공·실패·Ctrl-C 어느 쪽으로 끝나도 `.benchmarks/deepswe/<run-id>/`를
지운다. 스모크가 끝난 뒤 그 자리를 확인한다.

```bash
ls -d .benchmarks/deepswe/smoke-20260825
# ls: cannot access '.benchmarks/deepswe/smoke-20260825': No such file or directory
```

이 시도에서는 선행 조건 검사가 먼저 걸려 작업 경로가 애초에 만들어지지 않았다.
Pier를 깐 뒤의 시도에서도 같은 명령으로 확인한다. 경로가 남아 있으면 러너의
정리 경로가 깨진 것이므로 그 회차 결과를 쓰지 않는다.

## 스모크 시도 (2026-08-25, Pier 설치 후)

앞 시도가 끝난 뒤 같은 호스트에서 Pier를 설치하고 vanilla 1태스크를 다시 돌렸다.
이 회차도 병합 JSON을 남기지 못했다. `pier run`은 0으로 끝났지만
`metrics.json`이 없고, `run.log`에 호스트 쪽 체크아웃이 없다는 한 줄이 남았다.

호스트 준비:

```bash
uv tool install datacurve-pier
# Installed 1 executable: pier
pier --version
# 0.3.1
docker info >/dev/null; echo $?
# 0
```

태스크 id:

```bash
git clone --depth 1 --filter=blob:none --no-checkout \
  https://github.com/datacurve-ai/deep-swe /tmp/deep-swe-052
git -C /tmp/deep-swe-052 ls-tree --name-only HEAD tasks/ | head -20
# tasks/README.md
# tasks/abs-module-cache-flags
# ...
```

`--agent claude`는 Pier 0.3.1이 거절한다.

```
Invalid value for '-a' / '--agent': 'claude' is not one of 'oracle', 'nop',
'claude-code', 'antigravity-sdk', 'codex', 'cursor-cli', 'gemini-cli',
'mini-swe-agent', 'swe-agent', 'opencode'.
```

그래서 러너에는 Pier가 받는 이름 `claude-code`를 넘겼다.

```bash
python3 skills/agentic-code-benchmark/scripts/run_deepswe.py \
  --run-id smoke-052-vanilla --arm vanilla --agent claude-code \
  --task abs-module-cache-flags
```

stdout:

```
/home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/052/001/docs/benchmark/deepswe/results/smoke-052-vanilla
```

stderr (종료 코드 0):

```
run-id=smoke-052-vanilla arm=vanilla agent=claude-code model=-
Cloning into '/home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/052/001/.benchmarks/deepswe/smoke-052-vanilla/deep-swe'...
  1/1 F2P: 0.000 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0:04:03 0:00:00

adhoc • claude-code
┏━━━━━━━┳━━━━━━━┳━━━━━━━┳━━━━━━━┳━━━━━━━┳━━━━━━━┳━━━━━━━┳━━━━━━━┳━━━━━━━┳━━━━━━┓
┃ Tria… ┃ Exce… ┃   F2P ┃ F2P_… ┃ F2P_… ┃   P2P ┃ P2P_… ┃ P2P_… ┃ Part… ┃ Rew… ┃
┡━━━━━━━╇━━━━━━━╇━━━━━━━╇━━━━━━━╇━━━━━━━╇━━━━━━━╇━━━━━━━╇━━━━━━━╇━━━━━━━╇━━━━━━┩
│     1 │     1 │ 0.000 │ 0.000 │ 20.0… │ 1.000 │ 3.000 │ 3.000 │ 0.130 │ 0.0… │
└───────┴───────┴───────┴───────┴───────┴───────┴───────┴───────┴───────┴──────┘

┏━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━┓
┃ Reward              ┃ Count ┃
┡━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━┩
│ 0                   │     1 │
│ 20                  │     1 │
│ 0                   │     1 │
│ 3                   │     1 │
│ 3                   │     1 │
│ 0.0                 │     1 │
│ 1.0                 │     1 │
│ 0.13043478260869565 │     1 │
└─────────────────────┴───────┘

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━┓
┃ Exception                 ┃ Count ┃
┡━━━━━━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━┩
│ NonZeroAgentExitCodeError │     1 │
└───────────────────────────┴───────┘

Job Info
Total runtime: 4m 3s
Results written to jobs/2026-08-25__22-13-02/result.json
Inspect results by running `pier view jobs`

pier left no host-side workspace checkout for abs-module-cache-flags; skipping metrics.json
```

러너가 결과 디렉터리에 `run.log`와 `tasks/abs-module-cache-flags/{reward.json,ctrf.json,test-stdout.txt}`를
옮겼다. `metrics.json`은 없다. `bridge_pier.py`는 부르지 않았다. 예외 표는
`NonZeroAgentExitCodeError` 한 건이다. 에이전트가 패치를 안 남긴 채로 verifier가
베이스를 채점한 상태다.

`pier run`이 0인데 `metrics.json`이 없고 `run.log`에
`pier left no host-side workspace checkout`이 있으면 러너 쪽이다. 이 블루프린트는
그 실패를 문서로 닫고, 호스트 체크아웃 구멍은 다음 블루프린트가 고친다. 실패한
런의 JSON은 결과 디렉터리에 남기지 않았다.

작업 경로:

```bash
ls -d .benchmarks/deepswe/smoke-052-vanilla
# ls: cannot access '.benchmarks/deepswe/smoke-052-vanilla': No such file or directory
```
