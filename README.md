# Bouncer

에이전트가 "다 했습니다"라고 말하기 전에, **실행했는지** 검사하는 플러그인.

이 저장소는 [Claude Code](docs/install.md#claude-code) · [Cursor](docs/install.md#cursor) · [Codex](docs/install.md#codex) · [Antigravity](docs/install.md#antigravity)의 설치 절차를 제공합니다. 실제 설치·지원 여부는 [파일럿 지원 현황](docs/install.md#파일럿-지원-현황)의 검증 결과를 확인하세요.

## Why

> 코딩 에이전트에게 일을 맡기면 세 가지가 반복됩니다.

- **범위가 번진다.** 인증을 고치라고 했는데 결제 코드까지 손댄다.
- **검증이 말뿐이다.** "테스트 전부 통과"라고 적지만 실행한 적은 없다.
- **커밋이 뒤섞인다.** 한 커밋에 기능·리팩터·포맷팅이 함께 들어와 리뷰가 불가능하다.

## How it works

계획을 세우고 `affected_paths`를 승인받은 뒤, 격리된 worktree에서 구현합니다.
게이트가 `verify`를 직접 실행하고, 통과해야 커밋이 열립니다. task 하나가 커밋
하나, blueprint 하나가 PR 하나입니다. `/bouncer-run`이 이 구간을 task 소진까지
반복하고, 마감에서 draft PR을 엽니다.

## Deterministic gates

게이트는 프롬프트가 아니라 Node 스크립트입니다.

- **G13** — 하네스가 `verify`를 실행하고, execute·commit 게이트가 그 기록을
  `verification.md`와 대조합니다. 손으로 쓴 "통과했습니다"는 근거가 아닙니다.
- **G17** — commit 게이트는 스테이징 경로만 `affected_paths`와 대조합니다.
  `-a` 계열 커밋의 추적 중 수정 파일은 PreToolUse 가드가 검사합니다.
- **G10–G12** — 빈 계획 섹션과 근거 없는 경로를 잡습니다.

실패 코드와 대처는 [gates.md](docs/gates.md).

## Workflow

1. **`/bouncer-init`** — 프로젝트당 한 번. `.bouncer/`를 만들고 기존 파일은 건드리지
   않습니다.
2. **`/bouncer-plan`** — epic → blueprint → task 묶음을 쓰고, 경로 추천을 받고,
   `affected_paths`를 확정하고, 계획 문서를 리뷰한 뒤 승인합니다.
3. **`/bouncer-execute`** — worktree를 만들거나 재사용하고, 계획 문서를 옮기고,
   포인터가 가리키는 task를 구현한 뒤 검증·리뷰합니다. **커밋하지 않습니다.**
4. **`/bouncer-commit`** — 스코프를 미리 보고, task 하나를 커밋하고, 다음 task로
   포인터를 옮깁니다.
5. **`/bouncer-finalize`** — 지식을 Distill로 승격하고, 설명과 퀴즈를 남기고, 남은
   변경을 커밋하고, draft PR을 엽니다.

계획을 마치면 **`/bouncer-run`으로 이어집니다.** 3–4를 task가 소진될 때까지
반복하며, 질문 빈도는 `config.autonomy`가 정합니다. 3·4를 직접 부르는 것은 task
하나만 처리하거나 멈춘 주행을 복구할 때입니다.

전체 흐름도는 [workflow.md](docs/workflow.md)에 있습니다.

## Install

다른 프로젝트에 스킬·훅이 붙지 않도록 **project 또는 local scope** 설치를 권장합니다.

### Claude Code

카탈로그는 `.claude-plugin/marketplace.json`입니다. 마켓을 등록한 뒤 플러그인을 설치합니다.

```
/plugin marketplace add https://github.com/cheongfish/bouncer.git
/plugin install bouncer@chunjae-tools
```

프로젝트 전용 예:

```bash
claude plugin install bouncer@chunjae-tools --scope project   # 팀 공유 (.claude/settings.json)
claude plugin install bouncer@chunjae-tools --scope local     # 본인만 (.claude/settings.local.json)
```

### Cursor

단일 플러그인이라 `.cursor-plugin/plugin.json`만 있으면 됩니다 (marketplace 카탈로그 없음).

Cursor Settings → Plugins에서 **project / workspace**를 고른 뒤 아래 URL로 설치하세요.

```
https://github.com/cheongfish/bouncer.git
```

### Codex

레포 카탈로그는 `.agents/plugins/marketplace.json`입니다.

```bash
codex plugin marketplace add https://github.com/cheongfish/bouncer.git
codex plugin add bouncer@chunjae-tools
```

### Antigravity

매니페스트는 루트 `plugin.json`입니다. 카탈로그는 Codex와 공유하는
`.agents/plugins/marketplace.json`입니다.

```
agy plugin install <사내-git-url>
```

`BOUNCER_HOME`과 `subagents.provider: "antigravity"` 설정은
[docs/install.md](docs/install.md#antigravity)를 보세요.

## Quickstart

```
/bouncer-init
```

`.bouncer/`를 만듭니다(전역 `Distill.md` 포함). 기존 파일은 건드리지 않습니다.
`.gitignore` 추가는 **안내만** 하므로 알려주는 항목을 직접 넣으세요.

부트스트랩은 바로 커밋해야 합니다. (`/bouncer-plan` 전에만 가능).
`config.json`은 blueprint 커밋 범위 밖이라, 안 넣으면 첫 finalize가 막힙니다. 자세한 내용은 [docs/context-versioning.md](docs/context-versioning.md).

```bash
git add .bouncer && git commit -m "chore: bootstrap bouncer"
```

`.bouncer/config.json`에서 `source_dirs`와 **execute 게이트가 돌릴** `verify`를 확인하세요. 기본 형태는 [`config.example.json`](config.example.json)입니다.

```
/bouncer-plan      # epic → blueprint → tasks, affected_paths 승인
/bouncer-execute   # worktree seed → 구현 · verify · review
/bouncer-commit    # 스코프 · task 커밋 · 다음 task
/bouncer-run       # execute→commit 반복 주행 (task 소진까지)
/bouncer-finalize  # Distill 승격 · explain+퀴즈 · remainder · draft PR
```

## 무엇이 들어있나

**슬래시 커맨드 6개** — `/bouncer-init` · `/bouncer-plan` · `/bouncer-execute` ·
`/bouncer-commit` · `/bouncer-run` · `/bouncer-finalize`.

**게이트 4개** — `plan` / `execute` / `commit` / `finalize`. G 코드는 게이트별
검사, S 코드(S0–S26)는 항상 도는 구조·스키마 검사입니다. 표는
[gates.md](docs/gates.md)에 있습니다.

동결을 목표로 하는 공개 계약과 breaking change 절차는
[compatibility.md](docs/compatibility.md)에 정리했습니다.

**CLI** — 스킬이 내부에서 부르는 것을 직접 쓸 수 있습니다.

| 명령 | 하는 일 |
| --- | --- |
| `bouncer validate` | 구조 검사 + 게이트 하나 |
| `bouncer verify` | 설정된 검증 명령 실행 + 증적 기록 |
| `bouncer scaffold` | epic / blueprint / task 묶음 / explain / context-review 생성 |
| `bouncer commit` · `finalize` | 범위 확인 후 커밋 |
| `bouncer current` | 활성 blueprint·task 포인터 읽기 / 기록 / 지우기 |
| `bouncer migrate` · `import` | 레이아웃 이관, git 히스토리 전사 |

전체 플래그는 [cli.md](docs/cli.md), `bouncer --help`에도 있습니다.

**서브에이전트 4개** — `bouncer-implementer` / `bouncer-reviewer` /
`bouncer-debugger` / `bouncer-context-reviewer`. 모델은 `config.subagents`에서
에이전트 종류별로 지정합니다.

**스킬 19개** — 대부분 위 커맨드가 내부에서 부르는 것이라 직접 호출할 일은 없습니다.
예외는 개발자용 `agentic-code-benchmark`로, 워크플로 밖에 있고 게이트를 건드리지
않습니다.

## 언제 쓰고 언제 안 쓰나

한 사이클은 task 묶음과 게이트 4개를 거칩니다. 오타 수정에까지 이걸 요구하면
사람들은 곧 우회하기 시작합니다.

| 상황 | 판단 |
| --- | --- |
| 코드가 바뀌고 검증 명령이 의미 있는 결과를 내는 작업 | Bouncer 사이클 |
| 범위가 번질 위험이 있는 작업 (여러 디렉터리를 건드릴 것 같은) | Bouncer 사이클 |
| 오타·문구 수정처럼 검증할 것이 없는 변경 | 일반 커밋 |

이 기준은 잠정이고, 파일럿이 답할 질문입니다. "이건 Bouncer 쓰기엔 과하다"고 느낀
순간이 있으면 [기록해 주세요](docs/PILOT.md#기록-방법).

## 원칙

- **증적이 주장을 이긴다** — 검증 성공 근거는 하네스가 명령을 실행해 남긴
  기록입니다. 에이전트가 쓰지 않습니다. PreToolUse 가드가 막지 못하는 커밋
  경로가 있습니다. 한계는 [security.md](docs/security.md)에 있습니다.
- **한 task, 한 커밋** — 커밋 하나가 리뷰 가능한 단위입니다. task 아래에 또 다른
  하위 계층을 만들지 않습니다.
- **완료는 게이트가 정한다** — 실패 코드를 고칠 대상으로 보고, 통과했다고 설득하지
  않습니다.
- **하위 호환 없는 단일 프로토콜** — 별칭과 자동 마이그레이션 대신 `.bouncer/` /
  `bouncer.*` 하나만 지원합니다.

## 현재 상태

**1.0.0 — 출시 준비 중입니다.**

공개 표면(`.bouncer/` 구조, `config.json` 스키마, G/S 코드, CLI, 커맨드 이름)은
1.0.0 출시를 위해 동결할 범위입니다. 호스트별 설치·저장소 조합의 검증 상태는
[파일럿 지원 현황](docs/install.md#파일럿-지원-현황)을 기준으로 하며, 아직
검증하지 않은 조합의 설치 성공이나 지원을 뜻하지 않습니다.

검증 중 발견한 막힘과 호환성 문제는 [PILOT.md](docs/PILOT.md)의 기록 방법을
따라 제보해 주세요.

## Requirements

- Node.js 24에서 검증 (런타임은 표준 모듈 + 벤더링된 `js-yaml`)
- Claude Code, Cursor, Codex, 또는 Antigravity
- (선택) `gh`: finalize 시 draft PR 생성
- (선택) `python3`: `agentic-code-benchmark` 스킬 실행

## Documentation

문서는 독자에 따라 두 곳에 있습니다. 목차는 [docs/README.md](docs/README.md)입니다.

- **[`docs/`](docs/)** — 사람용. 설치, 실패 대처, 설계 배경, 기여.
- **[`rules/`](rules/)** — 에이전트 런타임 정본. 스킬과 `CLAUDE.md`가 인용하므로,
  고치면 에이전트 행동이 바뀝니다.

설계 배경은 [ARCHITECTURE.md](docs/ARCHITECTURE.md), 커밋 가드가 막지 못하는 것은
[security.md](docs/security.md)에 정리되어 있습니다.

## Contributing · License

개발 환경, 커밋·PR 규약, CI는 [contributing.md](docs/contributing.md)를 보세요.
버그와 막힌 지점은 이슈 템플릿(**버그** / **막힌 지점**)으로 받습니다.
보안 취약점은 공개 이슈가 아니라 [SECURITY.md](SECURITY.md)의 비공개 경로로
제보하세요. 참여 기준은 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)입니다.

라이선스는 [Apache-2.0](LICENSE)입니다.
