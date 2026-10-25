# 설치

Bouncer는 npm으로 설치하는 CLI runtime과 호스트가 설치하는 plugin으로
구성됩니다. 두 배포물은 같은 버전이어야 합니다. plugin만 설치해도 CLI가
설치되지는 않습니다. runtime은 Node.js 24 이상에서 실행하며 Git은 plugin
설치와 저장소 작업에 필요합니다.

## runtime 설치

먼저 `node --version`이 `v24` 이상이고 `git --version`이 성공하는지
확인하세요. npm registry에 게시된 버전은 운영자가 공개 완료를 확인한 뒤
설치합니다. plugin release와 같은 버전을 고릅니다.

Bash:

```bash
BOUNCER_VERSION=0.1.10
npm view "@cheongfish/bouncer@$BOUNCER_VERSION" version
npm install --global "@cheongfish/bouncer@$BOUNCER_VERSION"
command -v bouncer
command -v bouncer-root
bouncer --help
```

PowerShell:

```powershell
$BouncerVersion = '0.1.10'
npm view "@cheongfish/bouncer@$BouncerVersion" version
npm install --global "@cheongfish/bouncer@$BouncerVersion"
Get-Command bouncer
Get-Command bouncer-root
bouncer --help
```

`npm view`가 해당 package version에 대해 `E404`를 반환하면 아직 게시되지 않은
것으로 보고 공개 설치를 시도하지 마세요. 네트워크·인증 오류는 게시 여부를
판정하지 못하므로 중단하고 연결을 확인하세요. 개발·검증 목적으로 로컬
checkout에서 만든 `.tgz`가 있다면 그 파일을 설치할 수 있습니다.
저장소 루트에서 `npm ci`, `npm run build`,
`npm pack --workspace=@cheongfish/bouncer --pack-destination ./runtime-tarball` 순으로
실행한 뒤 생성된 `.tgz`의 절대 경로를 `npm install --global`에 전달합니다. 로컬
tgz 설치는 registry 게시를 뜻하지 않으며, 해당 tgz와 같은 버전의 plugin을
설치해야 합니다.

전역 설치가 기본입니다. 프로젝트 안에만 runtime을 둘 수도 있습니다.
Bash에서는 프로젝트의 `node_modules/.bin`을 PATH에 추가하고, 호스트가 그 PATH를
상속하지 않는 경우 `BOUNCER_BIN`에 `bouncer` 실행 shim의 절대 경로를 지정합니다.
PowerShell에서는 `node_modules/.bin/bouncer.cmd` shim을 사용하거나 개발 checkout의
`packages/cli/bin/bouncer`를 `node`로 직접 실행합니다. plugin hook은 PATH의
`bouncer` 또는 명시된 절대 `BOUNCER_BIN`을 호출합니다.

드라이브의 토큰·시간 표는 기본으로 보고하지 않습니다(기록은 항상 남습니다). 벤치마크처럼
보고가 필요한 셸에서만 `BOUNCER_METRICS_REPORT=1`을 지정하세요.

```bash
npm install --save-dev "@cheongfish/bouncer@$BOUNCER_VERSION"
export PATH="$PWD/node_modules/.bin:$PATH"
export BOUNCER_BIN="$PWD/node_modules/.bin/bouncer"
```

`npm config get bin-links`가 `false`이면 npm shim이 만들어지지 않습니다. 값을
`true`로 바꾸고 같은 버전을 다시 설치하세요. Bash와 PowerShell 모두 다음을
실행할 수 있습니다.

```bash
npm config set bin-links true
npm install --global "@cheongfish/bouncer@$BOUNCER_VERSION"
```

```powershell
npm config set bin-links true
npm install --global "@cheongfish/bouncer@$BouncerVersion"
```

## 플러그인 설치

CLI 설치 후 호스트 절차를 따라 `release` plugin을 설치합니다. 개발 checkout은
아래 저장소 개발 절을 참고하세요. plugin version과 runtime version이 다르면
자산을 읽기 전에 `BOUNCER_PLUGIN_VERSION_MISMATCH` 오류가 납니다. 두 배포물을
같은 버전으로 설치하고, 여러 plugin이 보이는 환경에서는 `BOUNCER_HOME`을
일치하는 plugin root의 절대 경로로 지정해 복구합니다.

runtime이 없으면 plugin만으로 CLI 명령은 실행되지 않습니다. npm runtime을
설치하고 셸 PATH에 `bouncer`와 `bouncer-root`가 보이는지 확인하세요. 전역
설치 뒤에도 찾지 못하면 npm global prefix의 bin 디렉터리를 PATH에 추가하거나,
호스트가 PATH를 전달하지 않는 hook에는 `BOUNCER_BIN`에 `bouncer` shim의 절대
경로를 지정합니다.

## 파일럿 지원 현황

호스트별 설치 smoke 결과가 모두 `검증됨`일 때만 해당 호스트를 `검증됨`으로
바꾼다. 현재는 실행 증거가 없으므로 네 호스트 모두 `미검증`이다. `미검증`
호스트는 설치 방법을 제공하지만 지원한다고 선언하지 않는다.

| 호스트 | 상태 |
| --- | --- |
| Claude Code | 미검증 |
| Cursor | 미검증 |
| Codex | 미검증 |
| Antigravity | 미검증 |

## 릴리스 검증 절차

게시 작업은 저장소 루트에서 실행하며, CI가 검사한 runtime tarball과 plugin tree를
그대로 사용합니다. npm runtime이 확인된 뒤에만 plugin release branch가
갱신됩니다.

1. 루트 `package.json`의 version을 편집하고 `npm run sync:versions`를 실행합니다.
   이어서 `npm run check:versions`, `npm ci`, `npm run ci`를 통과시킵니다.
2. 수동 workflow 실행은 prepare 검증과 dry-run만 수행합니다. release branch에
   쓰지 않고 npm에 게시하지 않는지 확인합니다.

   ```bash
   gh workflow run release.yml --ref develop
   ```

3. 정확한 version의 태그가 없고 최종 검증 HEAD를 가리키는지 확인합니다. 예를
   들어 version이 `0.1.10`이면 태그는 `bouncer--v0.1.10`입니다. 다른 commit을
   가리키는 기존 태그가 있으면 중단합니다.
4. 별도 운영 승인을 받은 뒤에만 최종 HEAD에 정확한 annotated tag를 만들고
   push합니다. workflow가 태그, root version, runtime pack, plugin tree의
   version이 일치하는지 확인하고 OIDC로 npm 게시를 처리한 다음 plugin branch를
   갱신합니다.
5. 실행 결과에서 npm runtime의 registry 확인과 plugin branch 게시를 각각
   확인합니다. 하나라도 실패하면 사용자에게 설치 완료를 안내하지 않습니다.

### trusted publisher와 provenance 운영 조건

최초 게시 전에 운영자가 npm과 GitHub 양쪽에서 다음을 준비하고 확인합니다. 둘 다
외부 권한 작업이며, 이 문서와 로컬 검사는 설정 완료나 공개 상태를 증명하지
않습니다. package 최초 공개와 태그 push는 별도 승인 후에 수행합니다.

- npm package `@cheongfish/bouncer`의 trusted publisher 설정에는 실제 publish job과
  같은 값을 넣습니다. owner는 `cheongfish`, repository는 `bouncer`, workflow
  filename은 `release.yml`입니다. 이름은 `.github/workflows/`의 파일명이며
  workflow의 표시 이름(`name: release`)이 아닙니다. 대소문자와 `.yml` 확장자까지
  정확히 일치해야 합니다.
  ([npm trusted publishing](https://docs.npmjs.com/trusted-publishers/))
- 현재 publish job은 GitHub environment를 쓰지 않으므로 npm 쪽 environment 칸은
  비워 둡니다. environment를 지정하려면 workflow에 같은 이름의 `environment:`를
  먼저 추가해야 합니다.
- 허용 action은 직접 publish입니다. workflow가 `scripts/release-runtime.js`를 통해
  게시하므로 staged publish 승인을 요구하는 설정은 쓰지 않습니다.
  ([npm trusted publishing](https://docs.npmjs.com/trusted-publishers/))
- OIDC 게시는 publish job의 `id-token: write` 권한, GitHub-hosted runner
  (`ubuntu-latest`; self-hosted runner는 공식 문서상 미지원), npm CLI 11.5.1
  이상과 Node 22.14.0 이상이 필요합니다. workflow는 npm `^11.5.1`을 설치하고 token
  없이 OIDC로 게시합니다. token fallback은 권장하지 않습니다. Node 24는 이
  저장소의 선택이며 공식 최소 조건과 구별합니다.
  ([npm trusted publishing](https://docs.npmjs.com/trusted-publishers/))
- npm 쪽 설정은 저장할 때 검증되지 않아 오류가 게시 시점에야 드러나고, 새 설정은
  첫 게시를 2일 안에 성공시키지 못하면 만료됩니다. 설정은 수정할 수 없고 삭제 후
  다시 만들어야 합니다. 태그 push 직전에 등록하고 값을 다시 대조하세요.
  ([npm trusted publishing](https://docs.npmjs.com/trusted-publishers/))
- provenance는 OIDC 게시, 공개 source repository, 공개 package가 모두 충족될 때
  자동 생성되므로 `--provenance` 플래그는 필요하지 않습니다.
  ([npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)) 별도로
  provenance 문서는 `package.json`의 공개 `repository`가 게시 source와
  (대소문자까지) 일치해야 한다고 요구하며, 첫 게시에는 `--access public`이
  필요합니다. `packages/cli/package.json`의 repository metadata가
  `cheongfish/bouncer`를 가리키고 `publishConfig.access`가 `public`인지, 게시
  명령이 `--access public`을 쓰는지 게시 전에 확인합니다.
  ([npm provenance](https://docs.npmjs.com/generating-provenance-statements/))
- 운영자가 직접 확인할 항목: package와 repository의 공개 여부, npm publisher 등록
  값, 게시 후 registry의 provenance 표시. 위 조건은 2026-10-24에 두 공식 문서를
  읽고 실제 workflow와 대조한 것입니다. 공식 조건은 바뀔 수 있으므로 게시 직전에
  다시 확인합니다.

이 문서는 registry 공개나 호스트 smoke 완료를 주장하지 않습니다.

게시 재실행은 npm registry의 같은 name/version/integrity를 확인합니다. 이미 같은
integrity가 있으면 npm publish를 건너뛰고 plugin branch 게시를 재개합니다. 버전이
다르거나 integrity가 일치하지 않으면 중단합니다. `unpublish`, 태그 강제 이동,
이미 공개한 version 덮어쓰기는 복구 방법으로 사용하지 않습니다.

## Claude Code

원격 marketplace는 `release` ref를 붙여 등록합니다. `release` 트리의
`.claude-plugin/marketplace.json`(`source: "./"`)이 빌드된 트리를 가리킵니다.

```
/plugin marketplace add cheongfish/bouncer#release
/plugin install bouncer@cheongfish-tools
```

git URL이면 `<사내-git-url>#release` 형식을 씁니다. ref를 붙여 등록한
marketplace는 `/plugin marketplace update` 때 기본 브랜치가 아니라 `release`
tip을 따라갑니다. ref 없이 등록해 둔 marketplace는 한 번 제거한 뒤 `#release`로
다시 등록하세요.

로컬 경로로 쓰려면 `release` 브랜치를 클론해 등록합니다.

```
git clone -b release <사내-git-url> ./bouncer-release
/plugin marketplace add ./bouncer-release
/plugin install bouncer@cheongfish-tools
```

개발 checkout을 쓰려면 그 트리에서 `npm run build`를 실행한 뒤 같은 로컬 경로
설치를 합니다.

이미 클론한 `release` 트리 또는 빌드한 개발 checkout:

```
/plugin marketplace add ./path/to/bouncer
/plugin install bouncer@cheongfish-tools
```

## Cursor

같은 플러그인 트리가 Cursor 플러그인이기도 합니다 (`.cursor-plugin/plugin.json`).
단일 플러그인이라 Claude Code용 `marketplace.json`과 달리 Cursor 쪽
marketplace 카탈로그는 두지 않습니다. 기본 브랜치 URL을 그대로 넣지 말고
`release` 브랜치를 클론한 로컬 경로를 쓰세요. Cursor 세션에서:

```
git clone -b release <사내-git-url> ./bouncer-release
/add-plugin ./bouncer-release
```

개발 checkout이면 `npm run build` 뒤에 그 경로를 `/add-plugin`합니다.

호스트 관례 스캔은 공개 집합 `skills/*/SKILL.md`(워크플로 여섯)만
잡습니다. 보조 브리프는 `references/<name>/index.md`에 두고 카탈로그에
올리지 않습니다. 커밋 가드는
`hooks/cursor-hooks.json`이 `beforeShellExecution`에 걸어 주며, `affected_paths`
밖 파일이 staged면 셸 실행을 `deny`합니다. Claude Code의 `PreToolUse` 가드와
**판정이 같은 공개 명령**(`bouncer commit-guard`)입니다. 두 commit 훅과 SessionStart
그래프 훅(`bouncer graph-sync`)은 내부 모듈을 읽지 않고 PATH의 `bouncer`
또는 `BOUNCER_BIN`(절대 경로)을 호출하며, 자기 플러그인 루트를 `BOUNCER_HOME`으로
자식 `bouncer`에 넘깁니다. 런타임이 없으면 commit 훅은 commit을 막고(fail-closed)
SessionStart 훅은 경고만 내고 세션을 막지 않습니다.

Cursor 설치 경로는 `bouncer-root --auto`의 지원 후보가 아닙니다. Cursor에서
워크플로를 실행하려면 실제 플러그인 루트를 한 번 지정하세요.

```bash
export BOUNCER_HOME=/absolute/path/to/bouncer
bouncer-root --auto
```

`BOUNCER_HOME`은 그 셸의 launcher 호출과 훅이 띄우는 `bouncer`에 쓰이는 검증된 루트
오버라이드입니다. 순수 명령(`commit-guard`, `current`, `project-root`, `validate`,
`verify`, `graph-sync`)은 루트를 해석하지 않으므로 이 값을 보지 않습니다.
Cursor는 `subagents.provider: "cursor"`를 프로젝트 config에 직접 pin하세요. 이는
루트 해석과 별개의 설정입니다.

## Codex

같은 플러그인 트리가 Codex 플러그인이기도 합니다 (`.codex-plugin/`). 레포
마켓플레이스는 `.agents/plugins/marketplace.json`입니다. 기본 브랜치 URL을
Plugins Directory에 넣지 말고 `git clone -b release <사내-git-url>`로 받은
로컬 경로를 소스로 추가한 뒤 `bouncer`를 설치합니다. 개발 checkout이면
`npm run build` 뒤에 그 경로를 등록합니다.

- **스킬** (`skills/*/SKILL.md`)은 Codex·Claude·Cursor가 공통으로 읽는 공개
  카탈로그입니다. 워크플로 진입점(`/bouncer-init`·`/bouncer-plan`·
  `/bouncer-run`·`/bouncer-finalize`·`/bouncer-retro`)은
  `skills/bouncer-*/SKILL.md`에 있고, 보조는 `references/`입니다.
- **named agent**는 Codex도 지원합니다. 커스텀 에이전트는 프로젝트
  `.codex/agents/*.toml`입니다. 플러그인 설치는 이 역할을 등록하지 않습니다.
  Codex를 쓰는 저장소는 `.codex/`를 이미 두거나 `bouncer init
  --seed-codex-agents`로 심기를 켭니다. 그 경우에만 init이 `agents/*.md`를
  TOML로 바꿔 그 경로에 심습니다. `.codex/`가 없고 플래그도 없으면
  Claude/Cursor 전용 저장소에 `.codex/`를 만들지 않습니다. 첫 줄이
  `# bouncer-generated`인 파일은 다음 init이 md와 다시 맞추고, 마커 없는
  파일은 덮지 않습니다. spawn 이름은 파일의 `name` 필드이며, 심기는 대상은
  아래 [배포되는 named agent](#배포되는-named-agent)의 다섯입니다. 호스트가 그
  역할을 로드하지 못할 때만 스킬의 generic/인라인 폴백을 타며, Codex라는
  이유만으로 named 디스패치를 건너뛰지 않습니다.
- **커밋 가드**는 Codex가 기본 탐색하는 `hooks/hooks.json`의 `PreToolUse`/`Bash`
  경로로 걸립니다. 판정은 Claude Code와 같은 `hooks/commit-safety.js`이며, Codex는
  종료 코드 `2`와 stderr 사유로 차단합니다. 플러그인 훅은 사용자가 정의를
  trust하기 전까지 로드되지 않습니다. trust하지 않으면 가드가 동작하지 않습니다.
- 매니페스트에 `hooks` 키를 넣으면 공식 검증기가 거부합니다. 훅 파일은 선언 없이
  `hooks/hooks.json` 기본 경로에 둡니다.

## Antigravity

같은 플러그인 트리가 Antigravity 플러그인이기도 합니다. 매니페스트는 **루트
`plugin.json`**입니다. 카탈로그는 Codex와 공유하는
`.agents/plugins/marketplace.json`입니다. 기본 브랜치 URL을 그대로 설치하지
말고 `release` 브랜치를 클론한 로컬 경로를 쓰세요.

```
git clone -b release <사내-git-url> ./bouncer-release
agy plugin install ./bouncer-release
```

개발 checkout이면 `npm run build` 뒤에 그 경로를 `agy plugin install`합니다.

공개 스킬(`skills/*/SKILL.md`)과 named agent(`agents/*.md`)는 관례 경로로
그대로 잡힙니다. 보조 본문은 `references/`라 호스트 카탈로그 스캔 밖입니다.
Codex도 named/custom agent를 지원하므로, Antigravity에서도 로드에 실패할
때만 fallback으로 내려갑니다. 훅은 `hooks/hooks.json` 관례 경로에 있습니다.

**`subagents.provider: "antigravity"` (필수).** Antigravity 스킬 셸에는
`CLAUDE_PLUGIN_ROOT` / `PLUGIN_ROOT`가 없어 자동 판별 신호가 없습니다.
Cursor와 같이 provider를 명시하세요.

Claude Code와 Codex는 plugin-root 변수가 없는 터미널에서도 `CLAUDECODE`,
`CODEX_THREAD_ID`로 provider를 자동 판별합니다. Cursor와 Antigravity는
자동 판별하지 않으므로 `subagents.provider`를 명시해야 합니다.

워크플로는 PATH의 `bouncer-root --auto`로 설치 후보를 고릅니다. provider pin은
루트 탐색과 별개로 유지합니다.

### 릴리스 전 수동 확인

CI는 Antigravity 호스트를 띄울 수 없어 아래는 자동 검증 밖입니다. 릴리스 전에
직접 확인하세요. `agy plugin validate`는 필수 설치 절차가 아닙니다 — `agy`가
없는 환경에서도 설치는 가능합니다.

- [ ] `agy plugin validate <repo>`가 skills / agents / hooks를 processed로
  보고하는가
- [ ] 설치 후 `/bouncer-init`·`/bouncer-plan`·`/bouncer-run`이 스킬로 잡히는가
- [ ] named agent 다섯(`bouncer-implementer`·`bouncer-reviewer`·
  `bouncer-debugger`·`bouncer-context-reviewer`·`bouncer-coordinator`)이
  호출되는가
- [ ] SessionStart 훅이 실제로 실행되는가 — 훅 command의
  `${CLAUDE_PLUGIN_ROOT}` 치환 여부는 확인되지 않았다. 실행되지 않으면
  graph sync를 CLI로 대신한다
- [ ] 루트 `plugin.json`이 생긴 뒤에도 Claude Code와 Codex 설치가 그대로인가 —
  두 카탈로그(`.claude-plugin/marketplace.json`,
  `.agents/plugins/marketplace.json`)가 저장소 루트를 가리키므로 로더가 새
  매니페스트를 집어갈 여지가 있다. 두 호스트의 테스트는
  `.claude-plugin/plugin.json`을 경로로 직접 읽어 이 회귀를 잡지 못한다

## 배포되는 named agent

플러그인은 `agents/*.md` 다섯을 배포합니다. 이름은 각 파일의 `name` 필드가
정본이고, `.bouncer/config.json`의 `subagents.<provider>.<agent>` 키와 같은
문자열입니다.

| 이름 | 누가 부르나 | 역할 |
| --- | --- | --- |
| `bouncer-implementer` | `/bouncer-run`, coordinator | 승인된 task brief대로 구현 |
| `bouncer-reviewer` | `/bouncer-run`, coordinator | diff 판정(읽기 전용) |
| `bouncer-debugger` | verify 실패 경로, coordinator | 근본 원인 리포트(읽기 전용) |
| `bouncer-context-reviewer` | `/bouncer-plan` 승인 직전 | 계획 문서 판정 |
| `bouncer-coordinator` | `/bouncer-run` 시작 ACQ 뒤 한 번 | 주행 컨트롤러. 위 세 worker를 부르고 결과를 판정 |

`bouncer-coordinator`는 다른 넷과 같은 배포 경로를 씁니다. 시작 ACQ 없이
불리지 않고, 한 주행에 하나이며 중첩되지 않습니다. Codex는 `agents/*.md`를
읽지 못하므로 `.codex/agents/*.toml`이 로드 경로이고, 심기 조건은 위 Codex
절과 같습니다.

### 설치 확인

```bash
ls "$(bouncer-root --auto)"/agents          # 다섯 md 파일
bouncer --help | grep coordinate            # 이 명령이 있는 플러그인인지 확인
bouncer coordinate                          # 종료 코드로는 판정하지 마세요
```

둘째 줄이 판정입니다 — 도움말 출력에 `coordinate` 이름이 보이면 이 명령이 있는
플러그인입니다(`-q`를 붙이면 출력이 사라져 볼 것이 남지 않습니다). 셋째 줄의
종료 코드로는 판정하지 마세요. `coordinate`가 없는 구버전 플러그인도 알 수 없는
최상위 명령으로 종료 코드 2를 내므로, 종료 코드만 보면 잡아야 할 구버전을 그냥
통과시킵니다.

- [ ] 플러그인 루트 `agents/`에 다섯 파일이 모두 있는가
- [ ] `bouncer` 도움말에 `coordinate` 명령이 보이는가
- [ ] `.bouncer/config.json`의 `subagents.<provider>`에 `bouncer-coordinator`
  슬롯이 있는가 — 이미 `bouncer init`을 돌린 저장소에는 없을 수 있고, 없으면
  부모 세션 모델을 상속합니다
- [ ] Codex를 쓰는 저장소면 `.codex/agents/bouncer-coordinator.toml`이
  `# bouncer-generated`로 시작하는가

## 저장소 개발 checkout 연결

일반 설치에는 필요하지 않은 저장소 개발 절차입니다. checkout 루트에서
`npm ci`와 `npm run build`를 실행합니다. Bash에서는 생성된 repo bin을 PATH
앞에 두고 runtime 자산 루트를 checkout으로 고정합니다.

```bash
npm ci
npm run build
export PATH="$PWD/packages/cli/bin:$PATH"
export BOUNCER_HOME="$PWD"
bouncer --help
```

PowerShell에서는 npm이 만든 `.cmd` shim을 PATH에서 쓰거나, checkout의 Node bin을
직접 호출합니다. `BOUNCER_HOME`은 plugin asset root이며 runtime executable을
가리키지 않습니다.

전역 설치의 `bouncer.cmd`는 PATH에서 실행하고, 프로젝트 local 설치는
`node_modules/.bin/bouncer.cmd`를 실행합니다. npm shim이 없는 checkout 개발은
아래처럼 Node로 repo bin을 직접 호출합니다.

```powershell
npm ci
npm run build
$env:PATH = "$PWD\packages\cli\bin;$env:PATH"
$env:BOUNCER_HOME = (Get-Location).Path
node .\packages\cli\bin\bouncer --help
```

### 빌드 오류 진단과 복구

checkout의 `bouncer`와 `bouncer-root`는 두 가지 빌드 문제를 서로 다른 stderr로
거부합니다. 둘 다 plugin 자산 루트(`BOUNCER_HOME`) 문제가 아니라 checkout의
`packages/cli/dist` 문제이므로 `BOUNCER_HOME`을 바꾸지 말고 빌드하세요.

- `packages/cli/dist is missing`: `dist/cli.js`가 없습니다. 아직 빌드하지 않았거나
  `dist`를 지운 경우입니다.
- `stale-build`: `dist`는 있지만 `packages/cli/src`와 build stamp가 맞지 않습니다.
  소스를 바꾼 뒤 다시 빌드하지 않은 경우입니다.

복구는 두 경우 모두 checkout 루트에서 빌드한 뒤 같은 명령을 다시 실행하는 것입니다.
게시나 태그 push는 이 절차에 포함되지 않습니다.

```bash
npm ci
npm run build
export PATH="$PWD/packages/cli/bin:$PATH"
export BOUNCER_HOME="$PWD"
bouncer --help
```

```powershell
npm ci
npm run build
$env:PATH = "$PWD\packages\cli\bin;$env:PATH"
$env:BOUNCER_HOME = (Get-Location).Path
node .\packages\cli\bin\bouncer --help
```

source(`packages/cli/src`)가 없는 npm 설치본은 freshness 검사를 건너뜁니다.
tarball에는 소스가 없기 때문이며, 이 경우 `dist`가 없다는 오류는 설치가 불완전한
것이므로 같은 version을 다시 설치하세요.

## 플러그인 루트 (`bouncer-root`)

`bouncer`는 runtime CLI이고 `bouncer-root`는 설치된 plugin asset root를
찾습니다. 일반 설치에서는 npm package가 두 실행 파일을 제공합니다. 설치된
plugin root는 `BOUNCER_HOME`으로 직접 지정하거나 `bouncer-root --auto`로 확인할
수 있습니다. 자산 탐색은 명시한 `BOUNCER_HOME` 다음에 host 설치 후보를
검사하며, runtime tree를 asset root로 추론하지 않습니다. 선택된 plugin과 runtime
version이 다르면 오류를 내므로 같은 version을 다시 설치하세요. 순수 명령
(`commit-guard`, `current`, `project-root`, `validate`, `verify`, `graph-sync`)은
plugin root를 찾지 않아도 동작합니다.

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
`graphify-runner`는 그 경로로 plan 초입에 `graph-sync`를 돌리고 원본 `explain` / `query`로 소스 후보를 찾습니다.
`source_dirs`를 맞춘 뒤 세션을 다시 열면
`graphify-out/source`가 갱신되고,
`graphify.test_dirs`가 있으면 `graphify-out/test`도 함께 갱신됩니다.

venv를 만들 때 쓰는 python은 플랫폼마다 다릅니다. Linux·macOS는 `python3`을 쓰고, Windows는
`python`, `py -3`, `python3` 순서로 처음 실행되는 것을 씁니다. Windows에서 python.org 설치본은
`python3`을 제공하지 않으므로 `python --version` 또는 `py -3 --version`이 성공하는지 먼저 확인하세요.
셋 다 실패하면 init은 graphify를 꺼 둔 채 성공하고, 결과의 `reason`에 시도한 이름이 나옵니다.

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
