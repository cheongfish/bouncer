# 설정 (`.bouncer/config.json`)

`/bouncer-init`이 기본값을 만들어 줍니다. 프로젝트에 맞게 `verify`와
`source_dirs`부터 고치세요. 전체 기본 형태는 저장소 루트
[`config.example.json`](../config.example.json)을 보세요.

| 필드 | 기본값 | 설명 |
| --- | --- | --- |
| `source_dirs` | 실재하는 후보 디렉터리(`src`, `lib`, `app`, `packages`, `scripts`, `test`, `tests` 중 존재하는 것; 없으면 `[]`) | **소스 코드** 그래프 입력. `bouncer init`이 저장소 루트를 보고 채운다. 산출: `graphify-out/source/` |
| `context_dirs` | `[".bouncer/context"]` | **컨텍스트** 그래프 입력(에픽/BP 문서). 산출: `graphify-out/context/` |
| `verify` | `"npm test"` | **execute 게이트가 실행하는 전역 폴백 명령.** 블루프린트 `tasks.bouncer.verify`가 있으면 그쪽이 우선한다. 종료 코드 0이어야 G13 통과 |
| `base_branch` | `"develop"` | worktree와 PR의 기준 브랜치 |
| `pr.draft` | `true` | PR을 draft로 생성 |
| `pr.base` | `"develop"` | PR 대상 브랜치 |
| `pr.labels` | `["bouncer"]` | PR에 붙일 라벨 |
| `graphify` | `{ "enabled": false }` | 이중 그래프 생성. **기본 비활성·선택 의존성.** 켜려면 `pip install graphifyy && graphify install` 후 `enabled: true`. SessionStart와 plan의 `bouncer graph-sync`가 `source`/`context` 그래프를 mtime 기준으로 갱신하고, `graphify-runner`가 둘 다 query해 `suggested_paths`를 채웁니다. 없거나 꺼져 있으면 수동 `affected_paths`로 폴백합니다 ([install.md](install.md)) |
| `subagents` | (객체) | named agent별 모델 오버라이드. 아래 절 참고 |

## `subagents`

호스트(Claude / Cursor / Codex)마다 모델 ID 네임스페이스가 다르므로
프로바이더별 블록이 필요합니다. `bouncer init`은 세 프로바이더 × 두 에이전트
(`bouncer-reviewer`, `bouncer-implementer`)를 모두 `"inherit"`로 채워 두어,
사용자가 편집할 자리를 보여 줍니다.

- `"inherit"`: 부모 세션 모델을 그대로 씁니다. `resolveSubagentModel`은 이 값
  (또는 비어 있거나 문자열이 아닌 값)에 대해 `{ model: null }`을 돌려줍니다.
- 비어 있지 않은 문자열: 해당 호스트의 모델 slug로 해석합니다.
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
