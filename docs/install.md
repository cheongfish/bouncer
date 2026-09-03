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

## 1.3.4 릴리스 검증 절차

설치 smoke는 최종 브랜치나 작업 중인 커밋이 아니라 `bouncer--v1.3.4` 태그가
가리키는 동일한 커밋을 대상으로 한다. 릴리스 운영자는 모든 task 커밋이 병합된
최종 HEAD에서 다음 순서를 지킨다.

1. 최종 HEAD에서 `npm run ci`가 성공하는지 확인한다.
2. `bouncer--v1.3.4`이 아직 없고 다른 커밋을 가리키는 기존 태그도 아님을
   확인한다. 충돌하면 태그를 삭제하거나 강제로 이동하지 않고 중단한다.
3. 검증한 최종 HEAD에 annotated 태그를 만든다.

   ```bash
   git tag -a bouncer--v1.3.4 <merged-head>
   ```

4. 원격 태그 push 권한과 marketplace 설치 권한에 대해 별도 동의를 받은 뒤
   태그를 push한다.

   ```bash
   git push origin bouncer--v1.3.4
   ```

5. push가 끝난 뒤에만 태그 기준으로 애플리케이션 저장소·모노레포·문서·설정
   중심 저장소와 Claude Code·Cursor·Codex·Antigravity의 12개 조합을 설치
   smoke한다. 각 조합의 결과는 [PILOT.md](PILOT.md#134-태그-기준-smoke-및-릴리스-기록)에
   기록한다.
6. smoke가 끝나면 **같은 `bouncer--v1.3.4` 태그의 GitHub Release**에 태그
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

호스트 관례 스캔은 공개 집합 `skills/*/SKILL.md`(워크플로 여섯·`migrate-ids`·
`agentic-code-benchmark`)만 잡습니다. 보조 브리프는 `references/<name>/index.md`에
두고 카탈로그에 올리지 않습니다. 커밋 가드는
`hooks/cursor-hooks.json`이 `beforeShellExecution`에 걸어 주며, `affected_paths`
밖 파일이 staged면 셸 실행을 `deny`합니다. Claude Code의 `PreToolUse` 가드와
**판정 로직이 같은 모듈**(`scripts/lib/commit-hook.js`)입니다. 훅은 상대 경로를
쓰므로 아래 `BOUNCER_HOME`과 무관합니다.

Cursor 설치 경로는 `bouncer-root --auto`의 지원 후보가 아닙니다. Cursor에서
워크플로를 실행하려면 실제 플러그인 루트를 한 번 지정하세요.

```bash
export BOUNCER_HOME=/absolute/path/to/bouncer
bouncer-root --auto
```

`BOUNCER_HOME`은 그 셸의 launcher 호출에만 쓰이는 검증된 루트 오버라이드입니다.
Cursor는 `subagents.provider: "cursor"`를 프로젝트 config에 직접 pin하세요. 이는
루트 해석과 별개의 설정입니다.

## Codex

같은 저장소가 Codex 플러그인이기도 합니다 (`.codex-plugin/`). 레포 마켓플레이스는
`.agents/plugins/marketplace.json`입니다. Codex Plugins Directory에서 이 저장소를
소스로 추가한 뒤 `bouncer`를 설치합니다.

- **스킬** (`skills/*/SKILL.md`)은 Codex·Claude·Cursor가 공통으로 읽는 공개
  카탈로그입니다. 워크플로 진입점(`/bouncer-init`·`/bouncer-plan`·
  `/bouncer-execute`·`/bouncer-commit`·`/bouncer-finalize`·`/bouncer-run`)은
  `skills/bouncer-*/SKILL.md`에 있고, 보조는 `references/`입니다.
- **named agent**는 Codex도 지원합니다. 커스텀 에이전트는 프로젝트
  `.codex/agents/*.toml`입니다. 플러그인 설치는 이 역할을 등록하지 않습니다.
  Codex를 쓰는 저장소는 `.codex/`를 이미 두거나 `bouncer init
  --seed-codex-agents`로 심기를 켭니다. 그 경우에만 init이 `agents/*.md`를
  TOML로 바꿔 그 경로에 심습니다. `.codex/`가 없고 플래그도 없으면
  Claude/Cursor 전용 저장소에 `.codex/`를 만들지 않습니다. 첫 줄이
  `# bouncer-generated`인 파일은 다음 init이 md와 다시 맞추고, 마커 없는
  파일은 덮지 않습니다. spawn 이름은 파일의 `name` 필드입니다
  (`bouncer-reviewer` 등). 호스트가 그 역할을 로드하지 못할 때만 스킬의
  generic/인라인 폴백을 타며, Codex라는 이유만으로 named 디스패치를
  건너뛰지 않습니다.
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

공개 스킬(`skills/*/SKILL.md`)과 named agent(`agents/*.md`)는 관례 경로로
그대로 잡힙니다. 보조 본문은 `references/`라 호스트 카탈로그 스캔 밖입니다.
Codex도 named/custom agent를 지원하므로, Antigravity에서도 로드에 실패할
때만 fallback으로 내려갑니다. 훅은 `hooks/hooks.json` 관례 경로에 있습니다.

**`subagents.provider: "antigravity"` (필수).** Antigravity 스킬 셸에는
`CLAUDE_PLUGIN_ROOT` / `PLUGIN_ROOT`가 없어 자동 판별 신호가 없습니다.
Cursor와 같이 provider를 명시하세요.

워크플로는 PATH의 `bouncer-root --auto`로 설치 후보를 고릅니다. provider pin은
루트 탐색과 별개로 유지합니다.

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

## 플러그인 루트 (`bouncer-root`)

워크플로 셸은 PATH의 `bouncer-root`를 호출합니다. 설치 경로마다 그 실행 파일을
등록하는 방법이 다릅니다.

호스트 플러그인 설치는 저장소를 캐시 디렉터리로 복사하고 `npm install`을
돌리지 않습니다. `package.json`의 `bin` 선언은 남아 있어도 호스트는
`node_modules/.bin`에 `bouncer` / `bouncer-root`를 링크하지 않습니다.
이 경로에서는 플러그인 루트의 `scripts/`를 PATH에 넣으세요.

```bash
export PATH="<plugin-root>/scripts:$PATH"
```

`<plugin-root>`는 호스트와 버전마다 다릅니다. 캐시 절대 경로를 문서에 고정하지
마세요.

`npm install <plugin-root>`는 선언된 `bin`을 그 프로젝트 `node_modules/.bin`에
링크합니다. `-g` / `npm link`는 prefix `bin`에 링크합니다.

확인: `bouncer-root --auto`가 절대 경로를 출력하면 등록된 것입니다. 등록 전에는
셸이 `command not found`를 냅니다. 워크플로 셸 첫 줄은
`BOUNCER_ROOT="$(bouncer-root --auto)" || exit $?`이라서, PATH에 올리기 전에는
여섯 워크플로가 그 줄에서 실패합니다.

PATH를 바꿀 수 없으면 아래 둘 중 하나를 쓰세요. 둘 다 기본이 아닙니다.

- 그 호출에만 `BOUNCER_HOME=/absolute/plugin/root`를 붙입니다. 상시 환경 변수가
  아니라 한 번의 launcher 오버라이드입니다.
- 플러그인 루트에서 `npm link` 또는 `npm install -g <plugin-root>`로 로컬 경로
  bin을 전역 환경에 연결합니다. 패키지는 레지스트리에 없습니다.

기본 실행은 모든 지원 설치 후보에서 최신 strict-semver 버전을 고릅니다.

```bash
bouncer-root --auto
bouncer-root --select
bouncer-root --host codex --auto
```

`--select`는 TTY에서만 번호 선택을 받습니다. 하나의 명시적 루트를 써야 하면
그 명령에만 `BOUNCER_HOME=/absolute/plugin/root`를 붙이세요. Cursor 워크플로는
지원 후보가 없으므로 같은 값을 셸 환경에 설정해야 합니다. 이 값은 provider를
추론하지 않으며, Cursor와 Antigravity의 `subagents.provider` pin을 대체하지
않습니다. 세부 규칙은 [`rules/plugin-root.md`](../rules/plugin-root.md)에 있습니다.

## 선택: Graphify (경로 추천)

Graphify는 **선택** 의존성입니다. 없어도 `/bouncer-plan`은 수동
`affected_paths` 확인으로 진행합니다.

### 기본: `bouncer init`이 설치

`/bouncer-init` → `bouncer init`이 graphify venv를 git common directory
아래(`<git-common-dir>/bouncer/venv`)에 둡니다. 작업 트리 밖이라
`git add`로 스테이징되지 않습니다. git 저장소가 아니면 예전처럼
`.bouncer/.venv`를 씁니다. 이미 `.bouncer/.venv`가 있으면 그 경로를
그대로 재사용합니다. 성공 시 `graphify.enabled: true`와 `graphify.bin`
(신규 설치는 절대 경로)을 기록합니다. 설치가 실패하면 이번 실행이
만든 venv만 지우고 `enabled: false`로 두며 부트스트랩은 그대로
성공합니다 (soft-fail). 기존 프로젝트에서 아직 꺼져 있으면 init 결과가
`graphifyPromotion: "candidate"`를 돌려 주며, `/bouncer-init`이 ACQ로
승격을 묻습니다. 동의 후:

```bash
bouncer init --promote-graphify            # 켜고 설치
bouncer init --promote-graphify --no-graphify  # 켜기만
```

실행 파일은 `bouncer graphify-bin`이 해석합니다
(`config.graphify.bin` → common-dir `bouncer/venv` → `.bouncer/.venv` → PATH). SessionStart와
`graphify-runner`는 그 경로로 `graph-sync` / query를 돌립니다.
`source_dirs` / `context_dirs`를 맞춘 뒤 세션을 다시 열면
`graphify-out/source`와 `graphify-out/context`가 갱신되고,
`graphify.test_dirs`가 있으면 `graphify-out/test`도 함께 갱신됩니다.

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
