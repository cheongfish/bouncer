# Bouncer 문서

문서는 독자에 따라 나뉩니다. 이 폴더는 사람용이고, 에이전트가 읽는 규칙은
[`rules/`](../rules/)에 있습니다.

## 사용자용

| 문서 | 내용 |
| --- | --- |
| [install.md](install.md) | runtime(npm)과 호스트별 plugin 설치, Graphify 설정 |
| [workflow.md](workflow.md) | `/bouncer-*` 단계 개요 |
| [configuration.md](configuration.md) | `.bouncer/config.json` 필드와 예시 |
| [context-ontology.md](context-ontology.md) | context ontology 사용법 |
| [threat-model.md](threat-model.md) | 강제력이 막는 실수와 막지 않는 우회 |
| [Changelog](../CHANGELOG.md) | 변경 이력 |

## 유지보수자용

| 문서 | 내용 |
| --- | --- |
| [releasing.md](releasing.md) | runtime(npm)과 plugin(`release` 브랜치) 릴리스 절차, 첫 공개 기록, 복구 |

## 설계 기록

결정과 측정의 기록입니다. 현재 동작의 정본이 아니므로 사용법은 위 문서를 따르세요.

| 문서 | 내용 |
| --- | --- |
| [architecture/rule-ownership.md](architecture/rule-ownership.md) | 규칙 조각의 소유자와 로드 그래프 |
| [architecture/source-boundaries.md](architecture/source-boundaries.md) | 소스 경계 분리 전후의 측정 기록 (분리 전 `scripts/lib` 기준) |
| [reviews/](reviews/) | 변경 단위 리뷰 기록 |
| [branding-discussion.md](branding-discussion.md) | 가치와 브랜딩 방향 논의 |

게이트와 CLI는 에이전트 런타임 정본인
[`rules/cli.md`](../rules/cli.md)에 있습니다.
진입점은 플러그인 루트 [`AGENTS.md`](../AGENTS.md)입니다.
