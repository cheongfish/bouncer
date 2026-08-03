# 설정 (`.bouncer/config.json`)

`/bouncer-init`이 기본값을 만들어 줍니다. 프로젝트에 맞게 `verify`와
`source_dirs`부터 고치세요.

| 필드 | 기본값 | 설명 |
| --- | --- | --- |
| `source_dirs` | `["src", "test"]` | 그래프 생성과 탐색의 대상 디렉터리 |
| `verify` | `"npm test"` | **execute 게이트가 실제로 실행하는 명령.** 종료 코드 0이어야 G13 통과 |
| `base_branch` | `"develop"` | worktree와 PR의 기준 브랜치 |
| `pr.draft` | `true` | PR을 draft로 생성 |
| `pr.base` | `"develop"` | PR 대상 브랜치 |
| `pr.labels` | `["bouncer"]` | PR에 붙일 라벨 |
| `graphify` | `{ "enabled": false }` | 소스 그래프 생성. **기본 비활성.** 켜면 SessionStart에서 `graphify-out/` 캐시를 갱신하고 `suggested_paths`를 채웁니다 |
| `schema_version` | `"0.x"` | Bouncer 문서 frontmatter 스키마 버전. OKF 스펙 버전과는 별개이며, 후자는 OKF §11에 따라 `.bouncer/context/index.md` frontmatter의 `okf_version`에 선언합니다 |
| `plugin_advisors.ponytail` | (객체) | 단계별 Ponytail 모드 **권고**. 자동 전환하지 않습니다 |

프로젝트 로컬 규칙(blueprint 크기 등)은 `.bouncer/governance.md`에 둡니다.
플러그인 제품 ADR은 [ARCHITECTURE.md](ARCHITECTURE.md)입니다.
