# 설치

Claude Code · Cursor · Codex · Antigravity가 **같은 저장소**를 플러그인으로 읽습니다.
런타임에 `npm install`은 필요 없습니다. Claude Code는 플러그인을 클론만 하고
의존성을 설치하지 않으므로, 필요한 `js-yaml`은 `scripts/vendor/`에 벤더링돼
있습니다. 자세한 내용은 [`scripts/vendor/README.md`](../scripts/vendor/README.md)를
보세요. Node 24에서 검증했습니다. 런타임 코드는 Node 표준 모듈만 쓰지만 더 낮은
버전은 아직 확인하지 않았습니다.

## 파일럿 지원 현황

아래 상태는 [파일럿 매트릭스](PILOT.md#저장소-유형--호스트-파일럿-매트릭스)의
호스트별 세 행이 모두 `검증됨`일 때만 `검증됨`으로 바뀐다. 현재는 실행 증거가
없으므로 네 호스트 모두 `미검증`이다. `미검증` 호스트는 설치 방법을 제공하지만
지원한다고 선언하지 않는다.

| 호스트 | 상태 |
| --- | --- |
| Claude Code | 미검증 |
| Cursor | 미검증 |
| Codex | 미검증 |
| Antigravity | 미검증 |

## 1.0.0 릴리스 검증 절차

설치 smoke는 최종 브랜치나 작업 중인 커밋이 아니라 `bouncer--v1.0.0` 태그가
가리키는 동일한 커밋을 대상으로 한다. 릴리스 운영자는 모든 task 커밋이 병합된
최종 HEAD에서 다음 순서를 지킨다.

1. 최종 HEAD에서 `npm run ci`가 성공하는지 확인한다.
2. `bouncer--v1.0.0`이 아직 없고 다른 커밋을 가리키는 기존 태그도 아님을
   확인한다. 충돌하면 태그를 삭제하거나 강제로 이동하지 않고 중단한다.
3. 검증한 최종 HEAD에 annotated 태그를 만든다.

   ```bash
   git tag -a bouncer--v1.0.0 <merged-head>
   ```

4. 원격 태그 push 권한과 marketplace 설치 권한에 대해 별도 동의를 받은 뒤
   태그를 push한다.

   ```bash
   git push origin bouncer--v1.0.0
   ```

5. push가 끝난 뒤에만 태그 기준으로 애플리케이션 저장소·모노레포·문서·설정
   중심 저장소와 Claude Code·Cursor·Codex·Antigravity의 12개 조합을 설치
   smoke한다. 각 조합의 결과는 [PILOT.md](PILOT.md#100-태그-기준-smoke-및-릴리스-기록)에
   기록한다.
6. smoke가 끝나면 **같은 `bouncer--v1.0.0` 태그의 GitHub Release**에 태그
   commit SHA와 12개 조합 각각의 성공 횟수·실패 횟수·사용자 개입 횟수를
   남긴다. 태그 기준 smoke 전에는 모든 조합을 `미검증`으로 유지한다.

태그 push, 원격 설치, GitHub Release는 인증과 외부 권한이 필요한 운영 작업이다.
이 문서 변경과 `npm test` 검증만으로는 태그·push·smoke·Release가 완료된 것으로
간주하지 않는다.

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

같은 저장소가 Cursor 플러그인이기도 합니다 (`.cursor-plugin/plugin.json`).
단일 플러그인이라 Claude Code용 `marketplace.json`과 달리 Cursor 쪽
marketplace 카탈로그는 두지 않습니다. Cursor 세션에서:

```
/add-plugin <사내-git-url>
```

워크플로 스킬(`skills/bouncer-*/SKILL.md`)과 하위 스킬(`skills/*/SKILL.md`)은
Cursor의 기본 탐색 경로와 레이아웃이 같아 그대로 잡힙니다. 커밋 가드는
`hooks/cursor-hooks.json`이 `beforeShellExecution`에 걸어 주며, `affected_paths`
밖 파일이 staged면 셸 실행을 `deny`합니다. Claude Code의 `PreToolUse` 가드와
**판정 로직이 같은 모듈**(`scripts/lib/commit-hook.js`)입니다. 훅은 상대 경로를
쓰므로 아래 `BOUNCER_HOME`과 무관합니다.

**`BOUNCER_HOME` (필수에 가깝다).** Cursor 스킬 셸에는 `CLAUDE_PLUGIN_ROOT` /
`PLUGIN_ROOT`가 없습니다. `/bouncer-plan`·`/bouncer-execute` 등이
`node …/scripts/bouncer`를 실행하려면 플러그인 루트를 직접 알려 줘야 합니다.

```bash
# scripts/bouncer 가 있는 디렉터리 — 실제 설치 경로로 바꾸세요
export BOUNCER_HOME=~/.cursor/plugins/local/bouncer
```

셸 프로필이나 프로젝트 환경에 넣어 두면 세션마다 다시 설정하지 않아도 됩니다.
값이 비면 경로가 `/scripts/bouncer`처럼 깨져 CLI 호출이 실패합니다. 해석 순서는
아래 [플러그인 루트](#플러그인-루트-bouncer_home)를 보세요.

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

## Antigravity

같은 저장소가 Antigravity 플러그인이기도 합니다. 매니페스트는 **루트
`plugin.json`**입니다. 카탈로그는 Codex와 공유하는
`.agents/plugins/marketplace.json`입니다.

```
agy plugin install <사내-git-url>
```

스킬(`skills/*/SKILL.md`)과 named agent(`agents/*.md`)는 관례 경로로 그대로
잡힙니다. Codex와 달리 named agent가 지원되므로 fallback 경로로 내려가지
않습니다. 훅은 `hooks/hooks.json` 관례 경로에 있습니다.

**`subagents.provider: "antigravity"` (필수).** Antigravity 스킬 셸에는
`CLAUDE_PLUGIN_ROOT` / `PLUGIN_ROOT`가 없어 자동 판별 신호가 없습니다.
Cursor와 같이 provider를 명시하세요.

**`BOUNCER_HOME` (필수에 가깝다).** `/bouncer-plan`·`/bouncer-execute` 등이
`node …/scripts/bouncer`를 실행하려면 플러그인 루트를 직접 알려 줘야 합니다.

```bash
# scripts/bouncer 가 있는 디렉터리 — 실제 설치 경로로 바꾸세요
export BOUNCER_HOME=~/.gemini/antigravity-ide/plugins/bouncer
```

셸 프로필이나 프로젝트 환경에 넣어 두면 세션마다 다시 설정하지 않아도 됩니다.
값이 비면 경로가 `/scripts/bouncer`처럼 깨져 CLI 호출이 실패합니다. 해석 순서는
아래 [플러그인 루트](#플러그인-루트-bouncer_home)를 보세요.

### 릴리스 전 수동 확인

CI는 Antigravity 호스트를 띄울 수 없어 아래는 자동 검증 밖입니다. 릴리스 전에
직접 확인하세요. `agy plugin validate`는 필수 설치 절차가 아닙니다 — `agy`가
없는 환경에서도 설치는 가능합니다.

- [ ] `agy plugin validate <repo>`가 skills / agents / hooks를 processed로
  보고하는가
- [ ] 설치 후 `/bouncer-init`·`/bouncer-plan`이 스킬로 잡히는가
- [ ] named agent(`bouncer-reviewer` 등)가 호출되는가
- [ ] SessionStart 훅이 실제로 실행되는가 — 훅 command의
  `${CLAUDE_PLUGIN_ROOT}` 치환 여부는 확인되지 않았다. 실행되지 않으면
  graph sync와 legacy-id 경고를 CLI로 대신한다
- [ ] 루트 `plugin.json`이 생긴 뒤에도 Claude Code와 Codex 설치가 그대로인가 —
  두 카탈로그(`.claude-plugin/marketplace.json`,
  `.agents/plugins/marketplace.json`)가 저장소 루트를 가리키므로 로더가 새
  매니페스트를 집어갈 여지가 있다. 두 호스트의 테스트는
  `.claude-plugin/plugin.json`을 경로로 직접 읽어 이 회귀를 잡지 못한다

## 플러그인 루트 (`BOUNCER_HOME`)

스킬이 `bouncer` CLI를 어디서 실행할지 알아야 합니다. Claude Code와 Codex는
그 경로를 환경변수로 넣어주지만, **Cursor와 Antigravity는 넣어주지 않습니다.**
두 호스트에서는 `BOUNCER_HOME`을 설치 디렉터리(`scripts/bouncer`가 있는 곳)로
직접 export 하세요.

```bash
export BOUNCER_HOME=/path/to/bouncer
```

스킬이 세 변수를 어떤 순서로 해석하는지는
[`rules/plugin-root.md`](../rules/plugin-root.md)에 있습니다.

## 선택: Graphify (경로 추천)

Graphify는 **선택** 의존성입니다. 없어도 `/bouncer-plan`은 수동
`affected_paths` 확인으로 진행합니다.

### 기본: `bouncer init`이 설치

`/bouncer-init` → `bouncer init`이 `.bouncer/.venv`에 graphify를 두고,
성공 시 `graphify.enabled: true`와 `graphify.bin`을 기록합니다. 설치가
실패하면 `enabled: false`로 두고 부트스트랩은 그대로 성공합니다
(soft-fail). 기존 프로젝트에서 아직 꺼져 있으면 init 결과가
`graphifyPromotion: "candidate"`를 돌려 주며, `/bouncer-init`이 ACQ로
승격을 묻습니다. 동의 후:

```bash
bouncer init --promote-graphify            # 켜고 설치
bouncer init --promote-graphify --no-graphify  # 켜기만
```

실행 파일은 `bouncer graphify-bin`이 해석합니다
(`config.graphify.bin` → `.bouncer/.venv` → PATH). SessionStart와
`graphify-runner`는 그 경로로 `graph-sync` / query를 돌립니다.
`source_dirs` / `context_dirs`를 맞춘 뒤 세션을 다시 열면
`graphify-out/source`와 `graphify-out/context`가 갱신됩니다.

### 오프라인·수동 폴백

네트워크나 python이 없어 init 설치가 실패하면:

```bash
pip install graphifyy && graphify install
```

그다음 `bouncer init --promote-graphify`(필요 시 `--no-graphify`)로
`enabled`를 켭니다. PATH에만 두었으면 `bin` 없이 PATH 후보로 해석됩니다.
업스트림: [Graphify](https://github.com/Graphify-Labs/graphify).

## 비공개 저장소

사내 저장소가 **비공개**라면 SSH 리모트를 권장합니다. 백그라운드 자동 업데이트는
git credential helper를 비활성화한 채 `git pull`을 돌리기 때문에 HTTPS 인증이
실패하고 전체 재클론으로 폴백합니다. SSH 키(`ssh-agent`)는 이 영향을 받지
않습니다. 함께 `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE=1`을 설정하면
갱신 실패 시 기존 클론을 유지합니다.
