# npm 런타임과 플러그인 자산 분리 요구사항 정의서

## 1. 목적

Bouncer를 다음 두 배포물로 분리한다.

| 배포물 | 책임 | 배포 채널 |
| --- | --- | --- |
| 플러그인 자산 | `AGENTS.md`, `agents/`, `skills/`, `rules/`, `references/`, `hooks/`, 호스트별 플러그인 매니페스트 | Git `release` 브랜치 및 각 호스트의 플러그인 설치 경로 |
| 런타임 CLI | TypeScript 소스에서 빌드한 JavaScript, CLI 실행 파일, 런타임 벤더 자산 | npm 공개 패키지 `@cheongfish/bouncer` |

분리 뒤 플러그인은 정책·프롬프트·훅 어댑터만 포함하고, npm 패키지는 실행 로직만
포함한다. 두 배포물은 서로의 내부 파일 경로에 의존하지 않고 공개 CLI/환경 계약으로만
연동한다.

이 문서는 구현·공개 배포의 승인서가 아니다. 실제 `npm publish`, npm 조직/패키지 생성,
토큰 또는 trusted publishing 설정, Git 원격 push는 별도 사용자 승인 후에만 수행한다.

## 2. 조사 기준선 (2026-10-20)

- TypeScript 런타임 원본은 `scripts/src/lib/*.ts` 116개이고, `tsc` 산출물은
  gitignore된 `scripts/lib/`이다. 현 `tsconfig.json`은 이 두 경로를 각각
  `rootDir`/`outDir`로 지정한다.
- 현재 `package.json`의 `files`는 플러그인 자산과 `scripts/bouncer`,
  `scripts/bouncer-root`, `scripts/lib/`, `scripts/vendor/`를 모두 허용한다.
  임시 npm 캐시로 실행한 `npm pack --dry-run --json` 결과는 209개 파일,
  unpacked 2,749,750 bytes였다. 즉, 현재 npm 패키지는 분리 대상 전부를 함께 싣는다.
- `scripts/lib/`는 git 추적 대상이 아니다. 또한 `package.json`에 `prepack`/`prepare`
  생명주기가 없다. 따라서 깨끗한 checkout에서 산출물 생성 없이 root에서 pack/publish하면
  실행 파일이 필요한 런타임을 포함하지 않는 패키지가 만들어질 수 있다.
- 현재 release CI는 `npm run ci` 후 `scripts/build-release.js`가 `npm pack --dry-run`
  목록을 복사하여 `release` 브랜치를 만든다. npm registry에 게시하는 단계는 없다.
- 런타임 직접 결합은 세 훅에 있다.

  | 위치 | 현재 결합 | 분리 때 필요한 공개 경계 |
  | --- | --- | --- |
  | `hooks/commit-safety.js` | `../scripts/lib/commit-hook`의 `evaluateCommit` | 명령문을 안전하게 전달하는 `bouncer` hook/guard CLI |
  | `hooks/cursor-commit-safety.js` | 같은 내부 모듈 | 같은 CLI와 Cursor JSON 응답 어댑터 |
  | `hooks/session-graph.js` | `../scripts/lib/session-graph` | `bouncer graph-sync`의 구조화된 결과 |

- 문서/스킬에도 내부 경로 실행이 남아 있다. `rules/current-pointer.md`는
  `node "${BOUNCER_ROOT}/scripts/bouncer" current`를, finalize cleanup reference는
  `runtime-state`를 `node -e`로 직접 require하며, explain reference는
  `comprehension`을 직접 require한다. 이들은 지원되는 CLI 하위 명령으로 대체해야 한다.
- `plugin-root.ts`, `bouncer-root.ts`, `codex-agents.ts` 등은 현재 `scripts/lib`에서
  두 단계 위가 플러그인 루트라는 배치 가정을 가진다. 단순 이동은 agents 탐색,
  설치 후보 선택 및 wrapper 실행을 깨뜨린다.
- 버전은 현재 적어도 여섯 곳에 있다: root `package.json`, root `plugin.json`,
  `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`,
  `.codex-plugin/plugin.json`, `.cursor-plugin/plugin.json`.
- unscoped `bouncer` 이름은 이 환경의 `npm view bouncer`에서 응답을 얻지 못해
  점유를 확정하지 못했다. 범용 이름 충돌 위험 때문에 scope를 전제로 한다.

## 3. 권장 목표 아키텍처 (구현 전 승인 필요)

### 3.1 패키지와 설치 계약

1. npm 패키지 이름은 `@cheongfish/bouncer`를 권장한다. 전역/로컬 실행 이름은 계속
   `bouncer` 및 `bouncer-root`로 유지한다.
2. 권장안은 플러그인만 설치된 상태를 지원 구성으로 간주하지 않는다. 사용자는 npm
   런타임을 전역 설치하거나 소비 저장소의 dev dependency로 설치해야 한다.
3. 플러그인 자산은 npm 런타임의 소스·컴파일 산출물·벤더 런타임을 포함하지 않는다.
   반대로 npm 패키지는 agents/rules/skills/references/hooks 및 호스트 매니페스트를
   포함하지 않는다.
4. 런타임은 플러그인 자산을 찾을 때 다음 우선순위를 사용한다: 명시적
   `BOUNCER_HOME` 또는 명령 옵션, 호스트가 관리하는 설치 후보, 실패. npm 패키지의
   설치 디렉터리나 상대 `../..`로 플러그인 자산 위치를 추측해서는 안 된다.
5. 발견한 플러그인 루트는 유효한 Bouncer 플러그인 매니페스트와 필요한 자산 경로를
   검증해야 한다. 런타임 버전과 플러그인 버전이 다르면 명확한 오류를 내고 실행하지
   않는다.

### 3.2 권장 저장소 배치

`packages/cli/`를 npm package root로 두고, TypeScript 및 빌드 산출물을 그 하위로
옮긴다. 저장소 최상위는 플러그인 자산과 개발/릴리스 오케스트레이션만 둔다.

```text
packages/cli/
  package.json          # @cheongfish/bouncer
  src/                  # TypeScript 원본
  dist/                 # pack 전에 생성되는 JavaScript (gitignore)
  bin/                  # bouncer, bouncer-root
  vendor/               # 런타임에 필요한 vendored dependency
agents/ hooks/ rules/ references/ skills/ AGENTS.md
plugin.json .claude-plugin/ .codex-plugin/ .cursor-plugin/ .agents/
scripts/                # 저장소 전용 build/release/lint 보조 도구만 허용
```

정확한 디렉터리 명칭은 구현에서 조정할 수 있으나, npm package root와 플러그인
asset root가 독립적이어야 한다는 경계는 바꾸지 않는다.

## 4. 기능 요구사항

### FR-1. 공개 CLI 경계

- 모든 스킬·규칙·훅은 `bouncer` 또는 `bouncer-root`만 실행하며,
  `node <plugin-root>/scripts/...`, `require(<plugin-root>/scripts/lib/...)` 및
  npm 패키지 내부 경로 import를 사용하지 않는다.
- 훅 전용 기능이 기존 CLI로 정확히 표현되지 않으면 공개 서브명령을 추가한다.
  최소한 commit 명령문 판단용 입력/출력 계약, graph sync의 JSON 결과,
  cleanup의 단일 worktree 경로 조회, diff SHA 계산 결과가 필요하다.
- 새 명령의 성공/차단/사용법 오류 exit code와 stdout/stderr 형식은 문서화하고
  테스트로 고정한다. 훅은 stdout 프로토콜이 필요한 Cursor에서 JSON 이외의 내용을
  출력하지 않는다.

### FR-2. 훅 동작 보존

- Claude/Codex commit 훅은 활성 blueprint의 범위 밖 commit을 계속 차단해야 한다.
  런타임 호출 오류는 기존 fail-closed 보안 성질을 유지해 commit을 차단하고 복구
  명령을 stderr에 제시한다.
- Cursor 훅은 같은 판정을 `deny` JSON으로 변환한다.
- SessionStart graph 훅은 기존처럼 세션을 차단하지 않으며, 런타임 부재·호출 실패는
  경고만 남기고 0으로 종료한다.
- 훅은 쉘 문자열 보간으로 payload를 전달하지 않는다. stdin JSON 또는 고정 argv와
  명시적 작업 디렉터리만 사용한다.

### FR-3. 플러그인 자산 접근

- agents 변환, rules/references 읽기, 템플릿 접근 등 플러그인 자산이 필요한 런타임
  코드는 검증된 plugin-root resolver에서 받은 절대 경로를 인자로 받는다.
- 각 명령은 cwd(소비 프로젝트)와 plugin root(설치 자산)를 구분한다. cwd 기반 쓰기는
  기존 write-boundary 규칙을 보존한다.
- `bouncer-root`는 npm 패키지의 bin으로 제공하되, 플러그인 트리 안에 실행 파일이
  있다는 현재 검사 조건을 제거하고 플러그인 매니페스트/필수 자산으로 판정한다.

### FR-4. 빌드와 package contents

- `npm pack --dry-run --json`은 깨끗한 git worktree에서 빌드 후 실행한다.
- npm tarball에는 package의 `bin`, 실행 JavaScript, 런타임 vendor/license,
  `package.json`, README/LICENSE만 포함한다. 개발 소스, 테스트, benchmark,
  `.bouncer/`, 플러그인 자산은 포함하면 안 된다.
- 플러그인 release tree에는 npm runtime 디렉터리와 npm 전용 wrapper/vendor가
  포함되면 안 된다. 플러그인 manifest·agents·skills·rules·references·hooks·AGENTS는
  계속 포함한다.
- `files` allowlist를 두 배포물 각각에 유지하고, 검사 스크립트가 금지/필수 파일을
  pack 결과에서 판정한다. 단순 glob이나 소스 트리 목록을 정본으로 중복 관리하지
  않는다.

### FR-5. 버전과 호환성

- CLI package version과 모든 플러그인 manifest version은 동일한 SemVer 값이어야 한다.
- 한 곳을 정본으로 정하고 release build가 나머지를 검증 또는 생성한다. 현재의 여섯
  버전 필드는 검증 대상에서 빠지면 안 된다.
- 릴리스는 같은 버전의 npm package가 성공적으로 공개된 뒤 해당 버전의 플러그인
  release branch/tag를 게시한다. 플러그인만 먼저 공개되어 런타임을 찾지 못하는
  상태를 만들지 않는다.
- patch/minor/major 호환 정책은 npm SemVer를 따르며, 플러그인-런타임 프로토콜이
  호환되지 않는 변경은 major 또는 명시한 compatibility window를 요구한다.

### FR-6. 문서와 설치 경험

- `docs/install.md`, README 및 스킬 내 shell 예시는 npm 설치와 플러그인 설치의
  순서, `BOUNCER_HOME`이 필요한 경우, 로컬 개발 설치를 설명한다.
- 런타임이 없을 때 오류에는 설치할 정확한 scoped package와 확인 명령을 포함한다.
- 더 이상 유효하지 않은 `scripts/lib`, `scripts/bouncer`, `node -e require(...)`
  예제는 제거하거나 개발자 내부 문서로만 격리한다.

## 5. 비기능 요구사항

- Node 지원 범위는 현재 `>=24`를 유지한다. npm 설치만으로 별도 런타임 의존성 설치가
  필요하지 않게 vendoring 정책을 유지하거나, runtime dependencies를 명시적으로
  선언하고 clean install smoke로 증명한다.
- 지원 운영체제는 Windows, Linux, macOS이다. 순수 JavaScript/Node 런타임만으로
  동작해야 하며, 네이티브 addon·특정 CPU·특정 libc가 새로 필요해지는 경우에는
  `os`/`cpu`/`libc` 제약과 대체 설치 경로를 package metadata와 설치 문서에 명시한다.
- resolver와 hook adapter는 Windows, macOS, Linux의 path delimiter·`.cmd` wrapper
  차이를 고려한다. npm의 `bin` shim으로 `bouncer`와 `bouncer-root`를 호출할 수
  있어야 하며, `bin-links=false`로 shim이 만들어지지 않은 환경에서는 원인과 복구
  방법을 명확히 출력한다.
- 최소 실행 전제는 Node `>=24` 및 Git이다. graphify를 켠 프로젝트에는 Python과
  graphify 실행 파일도 필요하다. 런타임은 누락된 외부 실행 파일을 OS별 "command not
  found" 오류로 방치하지 말고, 필요한 도구·검사 명령·복구 방법을 오류로 알려야 한다.
- 플러그인 훅이 로컬 npm 설치를 쓸 때에는 호스트 프로세스의 PATH에
  `node_modules/.bin`이 없을 수 있음을 고려한다. 전역 설치를 필수 계약으로 하거나,
  검증된 로컬 bin 경로/명시적 `BOUNCER_BIN` 설정 중 하나를 지원하고, 전자를 기본
  설치 문서에서 분명히 선택해야 한다.
- 사람이 실행하는 설치·복구 문서는 Bash 전용 문법만 제공해서는 안 된다. Windows
  PowerShell 예시를 함께 제공하거나 Git Bash/WSL을 명시적 필수 조건으로 선언한다.
- npm auth token은 저장소·문서·release tree에 기록하지 않는다. CI는 npm trusted
  publishing을 우선 검토하고, 불가능할 때에만 최소 권한 automation token을 CI secret으로
  사용한다. provenance 사용 여부는 CI 권한과 registry 정책 검증 후 결정한다.
- release 재실행은 같은 npm 버전을 다시 publish하려 하지 않고, 이미 게시된 버전의
  integrity/version을 확인한 뒤 실패 또는 안전하게 skip한다. npm에 게시한 버전은
  덮어쓰지 않는다는 운영 원칙을 문서화한다.

## 6. 구현 순서와 완료 조건

1. **경계 설계**: CLI가 필요로 하는 plugin-root API와 훅/문서가 요구하는 공개
   서브명령의 JSON·exit-code 계약을 테스트와 함께 확정한다.
2. **소비자 이전**: 세 훅과 세 내부 경로 문서를 공개 CLI로 이전한다. 이 단계가
   통과하기 전에는 파일 이동을 시작하지 않는다.
3. **런타임 패키지화**: `packages/cli` 빌드·bin·pack allowlist·clean worktree
   pack smoke를 구현한다.
4. **플러그인 release 축소**: release builder가 플러그인 asset tree만 만들도록
   변경하고, 해당 트리에서 훅과 스킬 설치 smoke를 수행한다.
5. **릴리스 파이프라인**: version 동기화 검사, npm publish dry-run/실제 publish
   분기, `release` branch 생성, provenance 및 외부 권한 절차를 추가한다.
6. **점진 배포**: prerelease 또는 별도 test tag에서 네 호스트(Claude, Cursor,
   Codex, Antigravity)와 전역/프로젝트 로컬 npm 설치 조합을 smoke한 뒤 첫 공개
   stable 버전을 게시한다.

다음 항목이 모두 충족되어야 완료다.

- clean checkout에서 `npm ci`, build, runtime `npm pack --dry-run --json`이 성공하고
  tarball 검사에서 플러그인 자산 0개가 확인된다.
- 생성한 플러그인 release tree에 runtime 파일 0개가 확인되고, 필수 플러그인 자산은
  모두 존재한다.
- 네 호스트에서 commit guard와 SessionStart의 정상/오류 경로가 기존 계약대로
  동작한다.
- npm tarball을 전역 설치와 소비 프로젝트 local install 두 방식으로 설치하여
  `bouncer --help`, `bouncer-root --auto`, init/current/graph sync 및 agent seed의
  plugin-root 동작을 검증한다.
- Windows, Linux, macOS 각각에서 전역 및 local npm 설치 smoke를 실행한다. Windows는
  PowerShell에서 npm `.cmd` shim과 hook adapter를, Unix 계열은 POSIX PATH/실행 권한과
  hook adapter를 검증한다. 최소 검증 조합은 Node 24와 지원 대상의 최신 LTS Node다.
- 각 운영체제에서 Git만 있는 기본 경로와 graphify가 활성화된 경로를 분리 검증한다.
  외부 의존성 누락 시에는 문서화된 복구 안내가 출력되고, commit guard의 fail-closed 및
  SessionStart의 non-blocking 계약이 각각 유지되어야 한다.
- 구 릴리스 형식에서 새 조합으로 갱신할 때 실패 원인과 복구 방법이 문서화되어 있고,
  내부 `scripts/lib` 경로를 실행하는 배포 자산은 0건이다.

## 7. 범위 밖 및 승인 보류 항목

- 기존 TypeScript 모듈의 도메인별 대규모 리팩터링, CLI 명령 의미 변경, agent/rule
  본문 재작성은 이 분리의 범위 밖이다.
- unscoped `bouncer`의 실제 registry 점유 여부는 공개 전 인증된 환경에서
  `npm view bouncer`로 다시 확인하되, 설계는 이를 사용하지 않는다.
- npm 조직 생성/권한 부여, 공개 범위 결정, trusted publishing 연결, npm publish,
  Git tag/push와 GitHub Release는 운영자의 명시적 승인이 필요한 후속 작업이다.
