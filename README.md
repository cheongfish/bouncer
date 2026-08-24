# Bouncer

에이전트가 "다 했습니다"라고 말하기 전에, **실행했는지** 검사하는 플러그인.


## Why

> 코딩 에이전트에게 일을 맡기면 세 가지가 반복됩니다.

- **범위가 번진다.** 인증을 고치라고 했는데 결제 코드까지 손댄다.
- **검증이 말뿐이다.** "테스트 전부 통과"라고 적지만 실행한 적은 없다.
- **커밋이 뒤섞인다.** 한 커밋에 기능·리팩터·포맷팅이 함께 들어와 리뷰가 불가능하다.

## Install

다른 프로젝트에 스킬·훅이 붙지 않도록 **project 또는 local scope** 설치를 권장합니다.
호스트별 절차는 [install.md](docs/install.md)에 있습니다.

```
/plugin marketplace add https://github.com/cheongfish/bouncer.git
/plugin install bouncer@chunjae-tools
```

```bash
claude plugin install bouncer@chunjae-tools --scope project   # 팀 공유
claude plugin install bouncer@chunjae-tools --scope local     # 본인만
```

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

## When to use

한 사이클은 task 묶음과 게이트 4개를 거칩니다.

| 상황 | 판단 |
| --- | --- |
| 코드가 바뀌고 검증 명령이 의미 있는 결과를 내는 작업 | Bouncer 사이클 |
| 범위가 번질 위험이 있는 작업 (여러 디렉터리를 건드릴 것 같은) | Bouncer 사이클 |
| 오타·문구 수정처럼 검증할 것이 없는 변경 | 일반 커밋 |


## Measured results

태스크 4개를 Bouncer on/off로 각각 구현한 뒤, 블라인드 심사로
`agentic-code-benchmark`를 채점했습니다. **2026-08-21 (KST)**, 베이스 `3f52018`.

| task | 형태 | off | on | Δ |
| --- | --- | --- | --- | --- |
| t1 | 기존 코드에 작은 기능 | 83.19 (B) | 95.19 (A) | +12.00 |
| t2 | 리포트 기반 버그 수정 | 85.59 (B) | 99.99 (A) | +14.40 |
| t3 | 동작 불변 리팩터링 | 95.19 (A) | 95.19 (A) | **0.00** |
| t4 | 모호한 요구 | **35.0 (F, 실격)** | 92.79 (A) | +57.79 |

정상 3개 평균 **87.99 → 96.79 (+8.80)**. 실격은 off 1건, on 0건.
이득의 대부분은 **Test quality +3.00**이고, Scope discipline은 **±0.00**입니다
(off가 이미 테스트를 거의 안 썼고, 범위 점수는 이미 높았습니다).

비용 (합계 배수):

| | off | on | 배수 |
| --- | --- | --- | --- |
| Tokens | 202,268 | 442,061 | **2.19×** |
| Wall time | 8.7분 | 28.8분 | **3.32×** |

작은 작업일수록 wall time 배수가 큽니다 (t2: 코드 7줄, **7.26×**).
방법·한계·후속 회차는 [docs/benchmark/](docs/benchmark/)에 있습니다.

## Requirements

- Node.js 24에서 검증 (런타임은 표준 라이브러리 + 벤더링된 `js-yaml`)
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
효과 측정 결과와 그 한계는 [docs/benchmark/](docs/benchmark/)입니다.

## Contributing · License

개발 환경, 커밋·PR 규약, CI는 [contributing.md](docs/contributing.md)를 보세요.
버그와 막힌 지점은 이슈 템플릿(**버그** / **막힌 지점**)으로 받습니다.
보안 취약점은 공개 이슈가 아니라 [SECURITY.md](SECURITY.md)의 비공개 경로로
제보하세요. 참여 기준은 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)입니다.

라이선스는 [Apache-2.0](LICENSE)입니다.
