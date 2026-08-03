# Bouncer

에이전트가 "다 했습니다"라고 말하기 전에, **실제로 했는지** 검사하는 플러그인.

같은 저장소가 [Claude Code](docs/install.md#claude-code) · [Cursor](docs/install.md#cursor) · [Codex](docs/install.md#codex)에서 설치됩니다.

## Why

코딩 에이전트에게 일을 맡기면 세 가지가 반복됩니다.

- **범위가 번진다.** 인증을 고치라고 했는데 결제 코드까지 손댄다.
- **검증이 말뿐이다.** "테스트 전부 통과"라고 적지만 실행한 적은 없다.
- **커밋이 뒤섞인다.** 한 커밋에 기능·리팩터·포맷팅이 함께 들어와 리뷰가 불가능하다.

Bouncer는 작업을 **하나의 리뷰 가능한 커밋** 단위(blueprint)로 쪼개고, 각 단계를
결정적 게이트로 막습니다. 게이트는 문서 상태와 본문을 검사하는 Node 스크립트라
에이전트가 설득할 대상이 아닙니다.

## Features

- **Blueprint 단위 커밋** — 한 사이클이 리뷰 가능한 한 커밋으로 끝남
- **실제 검증 실행** — execute 게이트가 `config.verify`를 돌려 증적을 남김
- **변경 범위 가드** — 승인된 `affected_paths` 밖 커밋을 훅이 차단
- **멀티 에이전트** — Claude Code · Cursor · Codex가 같은 스킬·게이트 계약을 사용
- **증적 있는 finalize** — 코드와 `.bouncer/context` 문서를 한 커밋에 함께 담음

## Requirements

- Node.js 24에서 검증 (런타임은 표준 모듈 + 벤더링된 `js-yaml`)
- Claude Code, Cursor, 또는 Codex
- (선택) `gh` — finalize 시 draft PR 생성

## Install

Claude Code:

```
/plugin marketplace add <git-url-or-local-path>
/plugin install bouncer@chunjae-tools
```

Cursor · Codex · 환경변수·비공개 SSH는 [docs/install.md](docs/install.md)를 보세요.
**`npm install`은 사용 시 필요 없습니다.**

## Quickstart

```
/bouncer-init
```

`.bouncer/`를 만듭니다. 기존 파일은 건드리지 않습니다. `.gitignore` 추가는
**안내만** 하므로 알려주는 항목을 직접 넣으세요.

부트스트랩은 **바로 별도 커밋**하세요 (`/bouncer-plan` 전에만 가능).
이유는 [docs/context-versioning.md](docs/context-versioning.md)에 있습니다.

```bash
git add .bouncer && git commit -m "chore: bootstrap bouncer"
```

```
/bouncer-plan      # epic → blueprint → tasks, affected_paths 승인
/bouncer-execute   # worktree에서 구현 · verify · review
/bouncer-finalize  # distill · 범위 확인 · 커밋 (+ draft PR)
```

각 단계 끝에서 게이트가 돌고, 실패하면 코드와 파일이 찍힙니다.

## How it works

```text
/bouncer-plan  →  gate plan     (G1–G5, G10–G12)
/bouncer-execute → gate execute (G6–G8, G13–G14)  ← verify 실제 실행
/bouncer-finalize → gate finalize (G9) → 한 커밋
```

게이트 표와 실패 코드는 [docs/gates.md](docs/gates.md),
CLI는 [docs/cli.md](docs/cli.md), 설정은 [docs/configuration.md](docs/configuration.md)를
보세요. 커밋 가드의 한계는 [docs/security.md](docs/security.md)에 있습니다.

## Documentation

전체 목차는 [docs/README.md](docs/README.md)입니다.

| 문서 | 내용 |
| --- | --- |
| [Install](docs/install.md) | 에이전트별 설치 |
| [Gates](docs/gates.md) | 게이트와 G·S 코드 |
| [Troubleshooting](docs/troubleshooting.md) | 막혔을 때 |
| [Architecture](docs/ARCHITECTURE.md) | 설계 결정 |
| [Contributing](docs/contributing.md) | 개발·커밋·CI |
| [Pilot](docs/PILOT.md) | 파일럿·알려진 마찰 |
| [Changelog](CHANGELOG.md) | 변경 이력 |

## Status

v0.1.0. 사내·팀 파일럿 단계이며 `package.json`은 `private: true`입니다.
라이선스는 아직 확정하지 않았습니다.

## License

TBD. 벤더링된 서드파티 고지는 [`scripts/vendor/`](scripts/vendor/)를 보세요.
