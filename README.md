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
- **Worktree execute** — plan 산출물을 worktree로 옮긴 뒤 구현·verify·review
- **Project Distill** — plan/execute 전 `.bouncer/context/Distill.md`를 읽고, finalize가 승격
- **Named 서브에이전트** — implementer / reviewer 분리와 모델 설정 계약
- **최소 변경 사다리** — 구현·리뷰가 재사용·과설계를 먼저 점검
- **멀티 에이전트** — Claude Code · Cursor · Codex가 같은 스킬·게이트 계약을 사용
- **증적 있는 finalize** — 코드와 `.bouncer/context` 문서를 한 커밋에 함께 담음

## What's new in 0.2.0

0.1.0 대비 주요 변경입니다. 전체 목록은 [CHANGELOG.md](CHANGELOG.md)를 보세요.

| 영역 | 0.1.0 | 0.2.0 |
| --- | --- | --- |
| Execute | 같은 checkout에서 구현 | 저장소 루트 아래 worktree + plan 문서 seed |
| Distill | BP distill 시점·전역 Distill 없음 | 전역 `Distill.md` 런타임 + finalize에서 BP distill·승격 |
| 서브에이전트 | 일반 Task/서브에이전트 디스패치 | named `bouncer-implementer` / `bouncer-reviewer` + 모델 설정 |
| 구현·리뷰 | 최소성 스킬만 | 최소 변경 사다리·상세 주석·과설계 루브릭 |
| 규칙·템플릿 | init이 프로젝트에 템플릿·규칙 복사 | 플러그인 내장 + `CLAUDE.md`/`AGENTS.md` 마스터 룰 |
| 코어 | JS 런타임 | TypeScript 소스 → CJS 산출, CI 동기화 검사 |
| 그래프 | 소스 graphify | source·context 이중 그래프 동기화 |
| 커밋 메시지 | Epic/Blueprint trailer | `.gitmessage`형 `type: 제목` + 의도 2줄 + title 불릿 |
| 게이트 | G10 placeholder 일부 | `<TODO: …>`·안내 주석만 있는 섹션도 미작성으로 판정 |
| 에이전트 설치 | Claude Code 중심 | Cursor·Codex 매니페스트와 설치 안내 |

## Requirements

- Node.js 24에서 검증 (런타임은 표준 모듈 + 벤더링된 `js-yaml`)
- Claude Code, Cursor, 또는 Codex
- (선택) `gh` — finalize 시 draft PR 생성

## Install

GitHub 저장소: `https://github.com/cheongfish/bouncer.git`  
비공개면 HTTPS를 권장합니다. SSH 키가 GitHub에 등록돼 있으면
`git@github.com:cheongfish/bouncer.git`도 됩니다.
**`npm install`은 사용 시 필요 없습니다.**

### Claude Code

```
/plugin marketplace add https://github.com/cheongfish/bouncer.git
/plugin install bouncer@chunjae-tools
```

### Cursor

```
/add-plugin https://github.com/cheongfish/bouncer.git
```

### Codex

```bash
codex plugin marketplace add https://github.com/cheongfish/bouncer.git
codex plugin add bouncer@chunjae-tools
```

로컬 경로·환경변수·훅 trust·비공개 저장소 주의사항은
[docs/install.md](docs/install.md)를 보세요.

## Quickstart

```
/bouncer-init
```

`.bouncer/`를 만듭니다(전역 `Distill.md` 포함). 기존 파일은 건드리지 않습니다.
`.gitignore` 추가는 **안내만** 하므로 알려주는 항목을 직접 넣으세요.

부트스트랩은 **바로 별도 커밋**하세요 (`/bouncer-plan` 전에만 가능).
이유는 [docs/context-versioning.md](docs/context-versioning.md)에 있습니다.

```bash
git add .bouncer && git commit -m "chore: bootstrap bouncer"
```

`.bouncer/config.json`에서 `source_dirs`와 **execute 게이트가 실제로 돌릴**
`verify`를 프로젝트에 맞게 확인하세요.

```
/bouncer-plan      # epic → blueprint → tasks, affected_paths 승인
/bouncer-execute   # worktree seed → 구현 · verify · review
/bouncer-finalize  # BP distill · 전역 Distill 승격 · 커밋 (+ draft PR)
```

각 단계 끝에서 게이트가 돌고, 실패하면 코드와 파일이 찍힙니다.

## How it works

```text
/bouncer-plan     → gate plan     (G1–G5, G10–G12)
/bouncer-execute  → worktree + seed → implement · verify · review
                  → gate execute  (G6–G8, G13–G14)  ← verify 실제 실행
/bouncer-finalize → BP distill · Distill 승격
                  → gate finalize (G9) → 한 커밋 (+ draft PR)
```

게이트 표와 실패 코드는 [docs/gates.md](docs/gates.md),
CLI는 [docs/cli.md](docs/cli.md), 설정은 [docs/configuration.md](docs/configuration.md)를
보세요. 커밋 가드의 한계는 [docs/security.md](docs/security.md)에 있습니다.

## Documentation

전체 목차는 [docs/README.md](docs/README.md)입니다.

| 문서 | 내용 |
| --- | --- |
| [Install](docs/install.md) | 에이전트별 설치 |
| [Workflow](docs/workflow.md) | `/bouncer-*` 단계 요약 |
| [Configuration](docs/configuration.md) | `.bouncer/config.json` |
| [Gates](docs/gates.md) | 게이트와 G·S 코드 |
| [Troubleshooting](docs/troubleshooting.md) | 막혔을 때 |
| [Architecture](docs/ARCHITECTURE.md) | 설계 결정 |
| [Contributing](docs/contributing.md) | 개발·커밋·CI |
| [Pilot](docs/PILOT.md) | 파일럿·알려진 마찰 |
| [Changelog](CHANGELOG.md) | 변경 이력 |

## Status

v0.2.0. 사내·팀 파일럿 단계이며 `package.json`은 `private: true`입니다.
라이선스는 아직 확정하지 않았습니다.

## License

TBD. 벤더링된 서드파티 고지는 [`scripts/vendor/`](scripts/vendor/)를 보세요.
