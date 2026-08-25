# 측정 프로토콜

이후 회차는 아래 세 arm으로 태스크 스위트(`docs/benchmark/tasks/`)를 돌린다.
1–3회차는 off / on(또는 on-light) 두 arm이었다. 그 회차의 수치와 설계 서술은
[history.md](history.md)와 git 히스토리에 있다. 이 문서는 그 기록을 고치지 않고,
다음 회차가 같은 스위트를 세 arm으로 재현할 때 쓸 통제와 절차만 적는다.

## Arm

| arm | 조건 |
| --- | --- |
| **vanilla** | 플러그인 없음. 저장소와 태스크 프롬프트만 주고, 검증·커밋 방식은 에이전트가 고른다. |
| **superpowers** | superpowers 플러그인만 설치·활성. Bouncer 사이클은 강제하지 않는다. |
| **bouncer** | Bouncer 사이클 강제: plan → plan 게이트 → pointer → execute → `bouncer verify` → execute 게이트 → `bouncer commit`. 게이트 실패 코드는 고친다. `--no-verify`와 가드 우회는 금지. |

superpowers arm은 그 플러그인이 측정 호스트에 이미 설치되어 있어야 한다.
설치 절차는 이 문서 밖이다. 설치가 안 된 호스트에서는 이 arm을 돌리지 않는다.

## 공통 통제

3회차까지 쓴 통제는 그대로 둔다. 같은 모델, 런 중 사람 개입 0회, 런마다 같은
checks, 측정치는 그 런에서 다른 명령을 돌리기 **전에** 수집한다.

추가로 세 arm에 같이 적용한다.

- 같은 base 커밋. 런은 서로의 산출물을 보지 못한다.
- 프롬프트는 토씨 하나 안 바꾸고 동일하게 전달한다. `done_when`은 심사자에게만
  주고 구현 에이전트에게는 주지 않는다.
- 사람 개입 0회. 세 arm 모두 "물어볼 사람이 없다"고 명시한다.
- checks는 스위트 JSON의 `checks`를 모든 런에 그대로 쓴다. arm마다 명령을
  바꾸지 않는다.
- 측정치는 빌드 산출물이 diff를 더럽히기 전에 수집한다. `collect_metrics.py`를
  그 런 디렉터리에서 먼저 돌린다.

## Arm별 절차

세 arm 모두 독립 작업 공간에서 같은 base로 시작한다. vanilla와 superpowers는
포인터를 쓰지 않으므로 `git worktree add`로 런을 나눠도 된다.
`collect_metrics.py`는 `.git` 존재만 본다.

**vanilla.** 플러그인을 끈 세션에 프롬프트만 넣는다. Bouncer CLI와 `/bouncer-*`
를 호출하지 않는다.

**superpowers.** superpowers만 켠 세션에 같은 프롬프트를 넣는다. Bouncer
스킬·게이트·`scripts/bouncer`를 호출하지 않는다.

**bouncer.** 독립 클론 하나당 사이클 하나. 활성 포인터
(`<git-common-dir>/bouncer/current`)와 verify 원장
(`<git-common-dir>/bouncer/verify/<digest>.json`)은 linked worktree가 공유하므로,
같은 git common directory 아래 두 사이클을 돌리지 않는다. 클론은
`--no-hardlinks --no-local`로 뜬 뒤 base에 detach한다.

사이클은 light 계획 계약이다. scaffold는
`bouncer scaffold blueprint --scale light` 한 줄이고, 계획 문서는 blueprint
`index.md`와 `tasks/001/{tasks,verification,review}.md`다. `affected_paths`는
사람이 확정한다. plan 게이트 통과 직후 아래 「plan 단계 스냅샷」을 찍고 나서
구현을 시작한다.

on arm의 `.bouncer/context/**` 계획 문서는 심사 diff에서 뺀다. 세 arm을 같은
종류의 산출물(코드 + 테스트 + 문서)로 비교하기 위해서다. 계획 문서 분량은 비용
지표로만 남긴다.

## 런당 기록 값

런마다 아래를 남긴다. `usage`는 기록 전용이다. `scorecard.py`의
`objective_breakdown`과 합성 점수에 넣지 않는다.

| 값 | 출처 |
| --- | --- |
| `arm` | `vanilla` / `superpowers` / `bouncer` |
| `task_id` | 스위트 JSON `id` |
| `label` | 예: `t1-vanilla` |
| checks, coverage, diff, rework | `collect_metrics.py` 본문. 스키마 `agentic-code-benchmark/metrics/1` |
| `usage.tokens_in` | `--tokens-in`. 프롬프트+완료 입력 토큰 |
| `usage.tokens_out` | `--tokens-out` |
| `usage.wall_s` | `--wall-s`. 구현 세션 벽시계(초) |
| `usage.tool_calls` | `--tool-calls` |
| plan-gate 줄 수 | bouncer arm만. 「plan 단계 스냅샷」의 `lines.txt` |

`collect_metrics.py`에 플래그를 준 키만 `usage`에 실린다. 재지 않은 값은 키를
만들지 않는다. 0으로 채우면 "재지 않음"과 "0이었음"을 구분할 수 없다.

## plan 단계 스냅샷

하네스는 런별 plan 단계 `.bouncer/context` 트리를 보관하지 않는다. 실행 clone은
커밋 하나로 squash되고 `.benchmarks/`에도 트리 사본이 없으므로, clone 안에만
두면 plan-gate 시점 줄 수가 사라진다. 3회차 계획 문서 줄 수가 사이클 종료 대리값이
된 이유다. 이후 회차는 plan 게이트가 통과한 직후, 구현을 시작하기 전에 찍는다.

복사 대상은 blueprint `index.md`와 `tasks/<NNN>/{tasks,verification,review}.md`다.
light 계약은 `context-review.md`를 만들지 않으므로 그 파일을 복사하지 않고 `wc`
인자에서도 뺀다.

남기는 곳은 실행 clone 밖, 측정 저장소의
`docs/benchmark/round-<N>/plan-snapshots/<run>/`이다. `DEST`를 clone 안
상대경로로 두면 squash와 함께 지워진다.

```bash
BP=.bouncer/context/epics/<epic>/blueprints/<bp>
DEST=docs/benchmark/round-<N>/plan-snapshots/<run>
mkdir -p "$DEST"
cp -R "$BP" "$DEST/"
wc -l "$BP"/index.md "$BP"/tasks/*/*.md > "$DEST/lines.txt"
```

`$BP`는 해당 런 clone 안 경로다. `$DEST`는 측정 저장소(이 파일과 같은 저장소)
안 경로다.

## 심사

런당 독립 심사 에이전트 1명. 심사자는 코드를 쓴 적이 없고, arm 라벨을 가린 채
자기 런의 diff·원본 프롬프트·루브릭만 받는다. 다른 런의 점수는 보지 못한다.

블라인드를 위해 심사용 저장소를 중립 이름의 새 클론으로 만들고 해당 diff만
적용한다. 심사 요약에 revert 체크를 실행했는지 추론했는지를 명시한다.

실패 보고가 표본 제외보다 앞선다. 목표 미달은 미달로 보고하고, 표본 제외는
프로토콜 위반(사이클 미완, 사람 개입, 게이트 우회)에만 적용한다.
