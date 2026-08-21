# Bouncer 문서

문서는 독자에 따라 두 곳에 있습니다.

- **`docs/`** — 사람이 읽습니다. 설치, 실패 대처, 설계 배경, 기여. 한국어.
- **`rules/`** — 에이전트가 런타임에 읽습니다. 스킬과 `CLAUDE.md`가 인용하는
  정본이라, 고치면 에이전트 행동이 바뀝니다. 영어.

같은 내용을 양쪽에 두지 않습니다. 반대편은 링크만 합니다.

## docs — 사람용

| 문서 | 내용 |
| --- | --- |
| [install.md](install.md) | Claude Code · Cursor · Codex · Antigravity 설치, Graphify, 비공개 저장소 |
| [workflow.md](workflow.md) | `/bouncer-*` 다섯 단계와 게이트 흐름 개요 |
| [configuration.md](configuration.md) | `.bouncer/config.json` 필드·값·예시 |
| [gates.md](gates.md) | 게이트별 G 코드와 항상 도는 S 코드 |
| [compatibility.md](compatibility.md) | 1.0.0 출시 준비 호환성 계약, 공개 이름과 변경·이관 절차 |
| [cli.md](cli.md) | `bouncer` CLI 명령과 플래그 |
| [troubleshooting.md](troubleshooting.md) | 게이트 실패·막힘 대처, 피드백 |
| [context-versioning.md](context-versioning.md) | `.bouncer/` 커밋 정책과 부트스트랩 |
| [security.md](security.md) | 커밋 가드 위협 모델과 한계 |
| [PILOT.md](PILOT.md) | 파일럿 안내와 알려진 마찰 |
| [contributing.md](contributing.md) | 개발, 커밋·PR 규약, CI |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 플러그인 제품 설계 결정 (ADR) |
| [benchmark/](benchmark/) | Bouncer on/off A/B 측정 결과·프로토콜·태스크 (2026-08-21 KST) |
| [Changelog](../CHANGELOG.md) | 변경 이력 · [1.0.0](../CHANGELOG.md#100--2026-08-15) |

## rules — 에이전트 런타임

| 문서 | 내용 |
| --- | --- |
| [governance.md](../rules/governance.md) | blueprint·task 크기, 경량 경로 |
| [okf.md](../rules/okf.md) | OKF 정렬, 프론트매터 필드의 소유·작성 기준, 알려진 차이 |
| [plugin-root.md](../rules/plugin-root.md) | `BOUNCER_HOME` 해석 순서 |

진입점은 플러그인 루트 [`CLAUDE.md`](../CLAUDE.md)입니다 — 마스터 룰이자 위
`rules/` 문서의 인덱스입니다. [`AGENTS.md`](../AGENTS.md)는 Codex / Cursor용으로
`@CLAUDE.md`를 import 합니다. 둘 다 소비 프로젝트에 설치되지 않습니다.

제품 소개와 5분 Quickstart는 [루트 README](../README.md)를 보세요.
