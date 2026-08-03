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
| `subagents` | (객체) | named agent별 모델 오버라이드. 아래 절 참고 |

## `subagents`

호스트(Claude / Cursor / Codex)마다 모델 ID 네임스페이스가 다르므로
프로바이더별 블록이 필요합니다. `bouncer init`은 세 프로바이더 × 두 에이전트
(`bouncer-reviewer`, `bouncer-implementer`)를 모두 `"inherit"`로 채워 두어,
사용자가 편집할 자리를 보여 줍니다.

- `"inherit"` — 부모 세션 모델을 그대로 씁니다. `resolveSubagentModel`은 이 값
  (또는 비어 있거나 문자열이 아닌 값)에 대해 `{ model: null }`을 돌려줍니다.
- 비어 있지 않은 문자열 — 해당 호스트의 모델 slug로 해석합니다.
- Cursor는 `CLAUDE_PLUGIN_ROOT` / `PLUGIN_ROOT`로 자동 판별되지 않습니다.
  Cursor 사용자는 `subagents.provider: "cursor"`를 명시하세요.
  (`BOUNCER_HOME`은 수동 플러그인 루트 오버라이드라 프로바이더 신호가 아닙니다.)

`resolveSubagentModel({ repoRoot, agentName, provider })`는 스킬이 `node -e`로
직접 부르는 헬퍼이며, 어떤 입력에도 예외를 던지지 않습니다. 아직 게이트
입력은 아니며, named-agent 라우팅 스킬이 첫 소비자입니다.

프로젝트 설정은 `.bouncer/config.json`에 둡니다. blueprint 크기·워크플로·OKF
정렬 같은 제품 규칙은 플러그인 문서
([governance.md](governance.md) · [workflow.md](workflow.md) · [okf.md](okf.md))에
있으며 프로젝트에 복사되지 않습니다. 플러그인 제품 ADR은
[ARCHITECTURE.md](ARCHITECTURE.md)입니다.
