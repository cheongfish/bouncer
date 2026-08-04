# 설치

Claude Code · Cursor · Codex가 **같은 저장소**를 플러그인으로 읽습니다.
런타임에 `npm install`은 필요 없습니다. Claude Code는 플러그인을 클론만 하고
의존성을 설치하지 않으므로, 필요한 `js-yaml`은 `scripts/vendor/`에 벤더링돼
있습니다. 자세한 내용은 [`scripts/vendor/README.md`](../scripts/vendor/README.md)를
보세요. Node 24에서 검증했습니다. 런타임 코드는 Node 표준 모듈만 쓰지만 더 낮은
버전은 아직 확인하지 않았습니다.

## Claude Code

원격 마켓플레이스:

```
/plugin marketplace add <사내-git-url>
/plugin install bouncer@chunjae-tools
```

로컬 경로:

```
/plugin marketplace add ./path/to/bouncer
/plugin install bouncer@chunjae-tools
```

## Cursor

같은 저장소가 Cursor 플러그인이기도 합니다 (`.cursor-plugin/`). Cursor 세션에서:

```
/add-plugin <사내-git-url>
```

워크플로 스킬(`skills/bouncer-*/SKILL.md`)과 하위 스킬(`skills/*/SKILL.md`)은
Cursor의 기본 탐색 경로와 레이아웃이 같아 그대로 잡힙니다. 커밋 가드는
`hooks/cursor-hooks.json`이 `beforeShellExecution`에 걸어 주며, `affected_paths`
밖 파일이 staged면 셸 실행을 `deny`합니다. Claude Code의 `PreToolUse` 가드와
**판정 로직이 같은 모듈**(`scripts/lib/commit-hook.js`)입니다.

## Codex

같은 저장소가 Codex 플러그인이기도 합니다 (`.codex-plugin/`). 레포 마켓플레이스는
`.agents/plugins/marketplace.json`입니다. Codex Plugins Directory에서 이 저장소를
소스로 추가한 뒤 `bouncer`를 설치합니다.

- **스킬** (`skills/`)은 Codex·Claude·Cursor가 공통으로 읽는 표면입니다.
  워크플로 진입점 네 개(`/bouncer-init`·`/bouncer-plan`·`/bouncer-execute`·
  `/bouncer-finalize`)도 `skills/bouncer-*/SKILL.md`에 있습니다.
- **커밋 가드**는 Codex가 기본 탐색하는 `hooks/hooks.json`의 `PreToolUse`/`Bash`
  경로로 걸립니다. 판정은 Claude Code와 같은 `hooks/commit-safety.js`이며, Codex는
  종료 코드 `2`와 stderr 사유로 차단합니다. 플러그인 훅은 사용자가 정의를
  trust하기 전까지 로드되지 않습니다. trust하지 않으면 가드가 동작하지 않습니다.
- 매니페스트에 `hooks` 키를 넣으면 공식 검증기가 거부합니다. 훅 파일은 선언 없이
  `hooks/hooks.json` 기본 경로에 둡니다.

## 플러그인 루트 (`BOUNCER_HOME`)

워크플로 스킬 본문은 `bouncer` CLI를 플러그인 디렉터리에서 실행합니다. 그 위치를
알려주는 환경변수는 에이전트마다 달라서, 스킬은 다음 순서로 해석합니다.

```bash
BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
```

`BOUNCER_HOME`은 수동 탈출구, `CLAUDE_PLUGIN_ROOT`는 Claude Code(및 Codex 호환
별칭), `PLUGIN_ROOT`는 Codex 네이티브 변수입니다. Cursor 스킬 셸에는 플러그인
루트 변수가 없으므로 `BOUNCER_HOME`을 설치 디렉터리(`scripts/bouncer`가 있는 곳)로
export 하세요. `hooks/hooks.json`은 Claude·Codex가 치환하는
`${CLAUDE_PLUGIN_ROOT}`를 그대로 쓰고, Cursor 훅은 상대 경로를 씁니다.

## 선택: Graphify (경로 추천)

Graphify는 **선택** 의존성입니다. 없어도 `/bouncer-plan`은 수동
`affected_paths` 확인으로 진행합니다. 경로 추천을 쓰려면:

```bash
pip install graphifyy && graphify install
```

프로젝트 `.bouncer/config.json`에서:

```json
"graphify": { "enabled": true }
```

`source_dirs` / `context_dirs`를 맞게 고친 뒤 세션을 다시 열면 SessionStart가
`graphify-out/source`와 `graphify-out/context`를 갱신합니다. `/bouncer-plan`의
`graphify-runner`는 `bouncer graph-sync`로 같은 freshness를 한 번 더 검사합니다.
설치·활성화 안내는 SessionStart와 `graphify-runner` 스킵 메시지에도 나옵니다.
업스트림: [Graphify](https://github.com/Graphify-Labs/graphify).

## 비공개 저장소

사내 저장소가 **비공개**라면 SSH 리모트를 권장합니다. 백그라운드 자동 업데이트는
git credential helper를 비활성화한 채 `git pull`을 돌리기 때문에 HTTPS 인증이
실패하고 전체 재클론으로 폴백합니다. SSH 키(`ssh-agent`)는 이 영향을 받지
않습니다. 함께 `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE=1`을 설정하면
갱신 실패 시 기존 클론을 유지합니다.
