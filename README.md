# Bouncer

**승인한 명세를 병렬로 구현하고, 검증된 결과로 통합하는 SDD 플러그인.**

명세 변경을 검토하고 독립된 task를 worktree에서 실행하며, 각 작업과 통합 결과의
검증 근거를 확인합니다. 변경의 의도와 설명은 저장소에 남습니다.

## Bouncer가 제공하는 것

- **합의된 작업 단위** — task brief와 승인 범위가 구현 판단의 기준이 됩니다.
- **병렬 실행과 통합** — 독립 task는 worker worktree에서 처리하고 integration worktree에 모읍니다.
- **검증 근거** — 실제 검증 실행 기록과 검증 뒤 소스 변경 여부를 확인합니다.
- **지속되는 맥락** — epic, blueprint, explain에 의도와 판단 근거를 남깁니다.

## 줄이려는 문제

- **범위가 번진다.** 인증을 고치라고 했는데 결제 코드까지 손댄다.
- **검증이 말뿐이다.** "테스트 전부 통과"라고 적지만 실행한 적은 없다.
- **커밋이 뒤섞인다.** 한 커밋에 기능·리팩터·포맷팅이 함께 들어와 리뷰가 불가능하다.

## Install

다른 프로젝트에 스킬·훅이 붙지 않도록 **project 또는 local scope** 설치를 권장합니다.
호스트별 절차는 [install.md](docs/install.md)에 있습니다.

```
/plugin marketplace add cheongfish/bouncer#release
/plugin install bouncer@cheongfish-tools
```

```bash
claude plugin install bouncer@cheongfish-tools --scope project   # 팀 공유
claude plugin install bouncer@cheongfish-tools --scope local     # 본인만
```

## Quickstart

```
/bouncer-init
```

`.bouncer/`와 canonical context 골격을 만듭니다. 기존 파일은 건드리지 않습니다.
`.gitignore` 추가는 **안내만** 하므로 알려주는 항목을 직접 넣으세요.

부트스트랩은 바로 커밋해야 합니다. (`/bouncer-plan` 전에만 가능).
`config.json`은 blueprint 커밋 범위 밖이라, 부트스트랩 직후 별도로 커밋하세요.

```bash
git add .bouncer/config.json .bouncer/context && git commit -m "chore: bootstrap bouncer"
```

`.bouncer/config.json`에서 `source_dirs`와 **execute 게이트가 돌릴** `verify`를 확인하세요. 기본 형태는 [`config.example.json`](config.example.json)입니다.

```
/bouncer-plan      # epic → blueprint → tasks, affected_paths 승인
/bouncer-run       # 구현 · verify · review · task 커밋 주행 (task 소진까지)
/bouncer-finalize  # explain+퀴즈 · remainder · draft PR
/bouncer-retro     # 세션 근거 개선 후보 제안 (채팅 전용)
```

## How it works

승인된 blueprint에서 의존성이 없는 task를 고릅니다. 각 task는 별도 worker worktree에서
구현·검증·리뷰되고, 결과는 integration worktree에 모여 통합 검증을 거친 뒤 마감됩니다.

`명세 검토 → task 분할 → 병렬 구현 → 개별 검증 → 통합 검증 → 설명 보존`

## When to use

| 적합한 경우 | 덜 적합한 경우 |
| --- | --- |
| 기존 코드베이스에서 여러 모듈을 바꾸는 작업 | 오타·문구 수정, 짧은 실험 |
| 요구사항과 변경 이유를 나중에도 추적해야 하는 작업 | 검증할 명령이나 통합할 결과가 없는 작업 |
| 독립 task를 나눠 병렬로 위임할 수 있는 작업 | 절차 비용이 이득보다 큰 아주 작은 변경 |


## Requirements

- Node.js 24에서 검증 (런타임은 표준 라이브러리 + 벤더링된 `js-yaml`)
- Claude Code, Cursor, Codex, 또는 Antigravity
- (선택) `gh`: finalize 시 draft PR 생성

## Documentation

문서는 독자에 따라 두 곳에 있습니다. 목차는 [docs/README.md](docs/README.md)입니다.

- **[`docs/`](docs/)** — 사람용. 설치, 워크플로, 설정.
- **[`rules/`](rules/)** — 에이전트 런타임 정본. 스킬과 `AGENTS.md`가 인용하므로,
  고치면 에이전트 행동이 바뀝니다.

게이트와 CLI 계약은 [`rules/cli.md`](rules/cli.md)에 있습니다. PreToolUse 커밋 가드는 실수 방지용이며
악의적 우회를 막지 않습니다. 신뢰 경계는
[`AGENTS.md`](AGENTS.md) hard rule 1이 정본입니다. 막는 것과 막지 않는 것은
[`docs/threat-model.md`](docs/threat-model.md)입니다.

## Contributing · License

버그와 막힌 지점은 이슈 템플릿(**버그** / **막힌 지점**)으로 받습니다.
보안 취약점은 공개 이슈가 아니라 [SECURITY.md](SECURITY.md)의 비공개 경로로
제보하세요. 참여 기준은 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)입니다.

라이선스는 [Apache-2.0](LICENSE)입니다.
