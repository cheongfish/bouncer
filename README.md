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

`bouncer` CLI runtime은 npm package이고 스킬·훅은 호스트 plugin입니다. 먼저
Node.js 24 이상과 Git을 확인하고, plugin의 runtime 호환 범위에 맞는 runtime을
설치하세요. 기본은 전역 설치입니다. 호스트별 명령과 복구 절차는
[install.md](docs/install.md)에 있습니다.

```
npm install --global @cheongfish/bouncer@0.1.17
/plugin marketplace add cheongfish/bouncer#release
/plugin install bouncer@cheongfish-tools
```

plugin 설치는 runtime을 설치하지 않습니다. runtime이 plugin의
`runtimeCompatibility` 범위에 없으면 `bouncer`가 plugin 자산을 읽기 전에 중단합니다.
호환되는 runtime을 설치하거나 `BOUNCER_HOME`을 호환되는 plugin root로 지정하세요.

### 구조

| 배포물 | 담는 것 | 배포 위치 |
| --- | --- | --- |
| runtime | `bouncer`·`bouncer-root` CLI (게이트, 검증, worktree, 마감) | npm `@cheongfish/bouncer` |
| plugin | skills, rules, subagents, hooks, `AGENTS.md` | 이 저장소의 `release` 브랜치 |

소스는 `packages/cli/`(runtime)와 저장소 루트의 plugin 자산으로 나뉩니다. plugin에는
CLI 소스가 들어가지 않고, skill과 hook은 PATH의 공개 `bouncer` CLI만 호출합니다.

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
```

회고는 `/bouncer-finalize` 종료 뒤 자동으로 실행됩니다(채팅 전용). 다른 세션의 증거는
`bouncer retro sources`로 후보를 보고 `bouncer retro read --path <file>`로 읽습니다.

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

- Node.js 24 이상 (`engines`). 런타임은 표준 라이브러리와 벤더링된 `js-yaml`만 씁니다.
- Git
- Claude Code, Cursor, Codex, 또는 Antigravity
- (선택) `gh`: finalize 시 draft PR 생성

## Documentation

문서는 독자에 따라 두 곳에 있습니다. 목차는 [docs/README.md](docs/README.md)입니다.

- **[`docs/`](docs/)** — 사람용. 설치, 워크플로, 설정, 릴리스([releasing.md](docs/releasing.md)).
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
