# Bouncer 문서

| 문서 | 내용 |
| --- | --- |
| [install.md](install.md) | Claude Code · Cursor · Codex 설치, `BOUNCER_HOME`, 비공개 저장소 |
| [gates.md](gates.md) | plan / execute / finalize 게이트와 G·S 코드 |
| [cli.md](cli.md) | `bouncer` CLI 명령 |
| [configuration.md](configuration.md) | `.bouncer/config.json` 필드 |
| [governance.md](governance.md) | blueprint 크기 등 제품 운영 규칙 |
| [workflow.md](workflow.md) | `/bouncer-*` 단계 요약 |
| [okf.md](okf.md) | OKF 정렬·알려진 차이 |
| [context-versioning.md](context-versioning.md) | `.bouncer/` 커밋 정책과 부트스트랩 |
| [troubleshooting.md](troubleshooting.md) | 게이트 실패·막힘 대처, 피드백 |
| [security.md](security.md) | 커밋 가드 위협 모델과 한계 |
| [contributing.md](contributing.md) | 개발, 커밋·PR 규약, CI |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 플러그인 제품 설계 결정 (ADR) |
| [PILOT.md](PILOT.md) | 파일럿 안내와 알려진 마찰 |

플러그인 루트 [`CLAUDE.md`](../CLAUDE.md)가 세션용 마스터 룰(인덱스)이다.
[`AGENTS.md`](../AGENTS.md)는 Codex / Cursor용으로 `@CLAUDE.md`를 import한다.
소비 프로젝트에 설치되지 않으며, 워크플로 스킬이 시작할 때 `CLAUDE.md`를
읽도록 지시한다.

제품 소개와 5분 Quickstart는 [루트 README](../README.md)를 보세요.
