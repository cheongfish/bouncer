---
type: bouncer.explain
title: release-pipeline-followup explain
description: Explain for release-pipeline-followup
resource: .bouncer/context/epics/host-distribution/blueprints/release-pipeline-followup/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-24T14:56:40.508+09:00'
bouncer:
  id: EXPLAIN-release-pipeline-followup
  epic_id: host-distribution
  blueprint_id: release-pipeline-followup
  status: published
  comprehension:
    - range_from: 27bfbef5f48f1e715fb6bff60bcd13b14883ee67
      range_to: bef3723a7bc1c7695d1be19c15f51345bcd4b3fb
      diff_sha: f6246400feb53505914358ad8de1e16095f8c9d0293f8f7d0c178e800b64b38d
      recorded_at: '2026-10-24T14:57:23.326+09:00'
  task_commits:
    - task: host-distribution/release-pipeline-followup/001
      sha: c2aea55b
      intent_anchor: task-001
    - task: host-distribution/release-pipeline-followup/002
      sha: 7e920779
      intent_anchor: task-002
    - task: host-distribution/release-pipeline-followup/003
      sha: ae3e1da0
      intent_anchor: task-003
    - task: host-distribution/release-pipeline-followup/004
      sha: f4143222
      intent_anchor: task-004
    - task: host-distribution/release-pipeline-followup/006
      sha: bef3723a
      intent_anchor: task-006
---
# Explain

## Background

릴리스 파이프라인은 태그를 push하면 npm 런타임 패키지를 게시하고 plugin 브랜치를 갱신한다. 게시는 되돌릴 수 없으므로, 잘못된 산출물이 나가기 전에 모든 검사가 끝나야 한다. 이전 작업이 이 흐름을 만들었지만 계약 위반이 몇 군데 남아 있었다.

- 버전 정본이 루트 `package.json`인데 게시 검사는 `packages/cli/package.json`을 읽었다. 두 값이 어긋나면 잘못된 버전이 통과할 수 있었다.
- 동시 릴리스를 막는 concurrency group이 ref별이라, 서로 다른 태그의 릴리스가 겹쳐 실행될 수 있었다.
- 독립 설치 검증이 source 디렉터리를 직접 복사해 배포물에 빠진 파일을 놓쳤고, 설치 결과를 한 번만 확인했다.
- 운영 문서에 npm 게시 조건과 개발 빌드 복구 절차가 빠져 있었다.

이번 변경은 이 결함을 고쳐, 잘못된 산출물의 게시를 외부 호출 전에 차단하고 설치 결과를 릴리스 산출물 기준으로 검증한다.

## Code

- `scripts/release-runtime.js` — `releaseRuntime`이 외부 호출 전에 `syncVersions({ mode: "check" })`로 루트·host manifest·lockfile 정합을 확인한다. 태그는 `isStrictSemver`로 검사하고 `+build`를 포함한 전체 문자열을 pack 버전과 비교한다. E404는 `code`가 E404이고 `pkgid`가 `${PACKAGE}@${pack.version}`과 정확히 같을 때만 "아직 없는 버전"으로 본다. `assertRegistryArtifact`는 게시 뒤 registry 응답을 검사한다. npm은 게시할 때 `+build`를 버린 버전을 저장하므로, 버전은 `pack.version.split("+")[0]`과 비교하고 name과 integrity는 정확히 비교한다. 객체가 아닌 응답은 TypeError 대신 불일치로 거부한다.
- `.github/workflows/release.yml` — concurrency group을 `release`로 통일해 모든 릴리스를 직렬화한다(`cancel-in-progress: false`). `root_version`은 루트 `package.json`을 읽는다.
- `scripts/check-distribution.js` — `smoke({ root })`가 `scripts/build-release.js`로 만든 plugin tree를 asset으로 쓰고, builder에 격리 npm env를 넘긴다. 설치 종류마다 새 Git repo와 asset-home을 만들어 앞 설치의 seed가 뒤 설치의 성공으로 세어지지 않게 한다. 각 설치는 plugin 없는 HOME에서 `bouncer current`가 `current: null`인지, `init --seed-codex-agents`가 다섯 agent TOML을 만드는지 확인한다. TOML은 `# bouncer-generated` 표식으로 시작해야 한다. 결과는 report의 `smoke` 키에 붙고, `process.exit` 대신 `process.exitCode`를 써 큰 JSON이 파이프에서 잘리지 않는다.
- `test/plugin-root.test.js` — 회귀 시 실패하는지 격리 복사본에서 자동 실행하는 negative control 두 개를 추가했다. 이 control은 `tsc`를 두 번 실행해 파일 실행이 약 7초 늘고, 부모 `node_modules`의 typescript에 의존한다.
- `docs/install.md` — npm 게시 조건과 개발 빌드 복구 절차를 추가했다. 조건은 npm 공식 문서를 조회한 요약에 근거하며 조회일을 문서에 적었다. 외부 npm 설정은 확인할 수 없어 운영자 확인 항목으로 남겼다. 복구 블록이 `BOUNCER_HOME`을 설정하는데 본문은 바꾸지 말라고 해서 서로 맞지 않는다.
- `test/release-runtime.test.js`, `test/build-release.test.js`, `test/runtime-install-smoke.test.js` — 위 동작의 회귀 테스트다. fake `npm view`는 실제 npm처럼 `+build`를 제거한 버전을 돌려준다.

알려진 한계: E404 `pkgid` 비교는 `+build` 포함 버전 기준이라, 실제 npm이 다른 형태의 pkgid를 내면 첫 게시 전에 lookup 실패로 멈출 수 있다. 게시 전이라 되돌릴 수 없는 손상은 없다. asset 디렉터리 이름의 `1.6.0`은 하드코딩이고, 일부 테스트는 `npm ci` 네트워크에 의존한다.

## Quiz

1. 게시 뒤 registry가 `1.2.3-alpha.1`을 돌려주고 pack 버전이 `1.2.3-alpha.1+build.7`이면 `assertRegistryArtifact`는 어떻게 하나?
   - A) 버전 불일치로 거부한다.
   - B) name·integrity가 같으면 통과한다.
   - C) `+build`가 있는 버전은 항상 경고만 하고 통과한다.
2. 루트 `package.json` 버전과 host manifest가 어긋난 상태에서 dry-run으로 `releaseRuntime`을 실행하면?
   - A) 게시 단계에서만 실패한다.
   - B) dry-run은 검사를 건너뛰므로 통과한다.
   - C) 외부 호출 전에 `syncVersions` check가 throw한다.
3. 서로 다른 두 태그의 릴리스가 동시에 시작되면 workflow는 어떻게 동작하나?
   - A) 같은 concurrency group이라 직렬로 실행되고 먼저 시작한 쪽은 취소되지 않는다.
   - B) ref별 group이라 병렬로 실행된다.
   - C) 나중에 시작한 쪽이 먼저 시작한 쪽을 취소한다.
4. plugin 자산이 없는 HOME에서 설치된 `bouncer current`를 실행하면 smoke 검증은 무엇을 기대하나?
   - A) host cache에서 plugin을 찾아 current를 채운다.
   - B) 종료 코드 0과 `current: null`을 기대한다.
   - C) 자산이 없으므로 실패해야 한다.
5. npm 조회가 E404를 내지만 `pkgid`가 요청한 `패키지@버전`과 다르면?
   - A) 새 버전으로 보고 게시를 진행한다.
   - B) `summary`에 버전이 있으면 게시를 진행한다.
   - C) lookup 실패로 보고 게시하지 않는다.

## Tasks

### host-distribution/release-pipeline-followup/001 · `c2aea55b`

#### Goal & intent

게시 진입 조건과 registry 실패 처리를 기존 계약에 맞추고 SPEC-001/002/003, CT-003/005/006을 해소한다. Epic 성공 기준 6~11, 13과 blueprint 수용 기준 1, 3, 4를 충족한다. 검증 명령은 frontmatter verify와 Checklist에 있다.

#### Current behavior

- `release.yml:9`는 ref별 concurrency group이라 서로 다른 tag를 직렬화하지 않는다. `:75`의 root_version도 CLI workspace를 읽는다.
- `scripts/release-runtime.js:40`은 FS에서 pack/CLI/plugin metadata를 읽고 `:52`의 자체 정규식으로 tag를 검사한다. 루트와 host/lockfile drift 검사는 없다. `+build` tag는 거부한다.
- `:76`은 E404 pkgid가 달라도 summary가 요청 spec을 포함하면 게시한다. 첫 npm 호출은 `:66`, 실제 Git fetch는 `:105`다.
- I/O seam은 `deps.run(command, args, {cwd,env}) -> {status,stdout,stderr}`다(`:19`, `:39`). fixture는 실제 FS와 로컬 Git remote를 사용한다(`test/release-runtime.test.js:26`, `:83`). 기존 fixture는 version 정본 검사에 필요한 전체 metadata가 없어 보완해야 한다.
- 재현: 현재 테스트 fixture에 root drift 또는 다른 pkgid+부분 일치 summary를 주고 외부 호출/게시 부재를 단언한다. 새 테스트와 Red는 아직 실행하지 않았다. 기존 manual guard와 dry-run은 현재 이미 존재한다(`:52`, `:63`).

#### Target behavior

- 성공: workflow concurrency group은 모든 버전에 공통인 `release`이며 cancel-in-progress=false다. 루트 정본과 syncVersions check를 통과한 strict SemVer tag만 게시한다. `1.2.3-alpha.1+build.7` 같은 일치 입력을 허용한다.
- 실패: version metadata drift·무효 SemVer·tag 불일치는 deps.run 첫 호출 전에 throw한다. E404는 정확한 pkgid만 신규 게시를 허용하며 summary fallback을 제거한다.
- 실패: auth/network/손상 JSON/불일치·누락 artifact/confirmation 실패는 후속 npm publish 또는 Git 게시를 막는다. fetch 실패는 worktree add/commit/push 전에 중단한다.
- 보존: dry-run 호출 0회, npm 선행 게시·재확인, 동일 integrity 재실행, release 부모와 non-force push, 동일 tree 무변경, 예외 cause 보존. manual 차단은 새 격리 negative control로 검증한다.

#### Interface

- 제공: 기존 releaseRuntime 입력과 반환 `{ok,mode,version,npm,plugin}`을 유지한다. `syncVersions({root,mode:'check'})`, `isStrictSemver(value)`를 직접 재사용하며 별도 validator나 버전 정본을 만들지 않는다.
- 주입: `deps.run(command:string,args:string[],opts:{cwd:string,env:object}) -> {status:number|null,stdout:string,stderr:string}`. lookup/confirmation/fetch 오류와 호출 이력을 이 seam으로 관찰한다. unit under test와 version checker는 가짜로 교체하지 않는다.
- 즉시 throw: drift, 손상 로컬 입력, 무효 버전, 불일치 tag, 허용되지 않은 publish 이벤트. 구조화 registry 오류는 `{error:{code:'E404',pkgid:'@cheongfish/bouncer@1.2.3'}}` 또는 같은 필드의 최상위 객체이며 두 값 모두 정확히 일치해야 한다.
- 신규 게시 상태: 위 exact E404만 absent artifact로 취급한다. 다른 오류는 cache miss나 fallback이 아니며 throw한다. summary의 자유 문자열은 판정하지 않는다.
- 인증 경계: 기존 push-only OIDC 게시 guard를 보존한다. workflow_dispatch에 일치 tag를 주어도 publish를 거부한다. token fallback을 추가하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `.github/workflows/release.yml` | `concurrency`, `jobs.publish` | Modify | 이벤트 분기와 게시 환경 | 공통 release group과 실제 루트 version 참조 | 해당 파일:9,75; 소비 단언 test/build-release.test.js:184; 문서 docs/install.md:106 |
| `scripts/release-runtime.js` | `releaseRuntime`, `assertRegistryArtifact` | Modify | npm 확인 후 plugin 게시 | 기존 버전 검사 재사용·exact E404·실패 차단 | 해당 파일:36,76,105,156; caller test/release-runtime.test.js:10 |
| `test/release-runtime.test.js` | `fixture`, `npmAndGit`, `releaseRuntime` | Modify | 로컬 FS/Git을 쓰는 게시 회귀 | 전체 metadata fixture와 실패 matrix, manual negative control | 해당 파일:26,83,101,189,201; fixture 참고 test/version-sync.test.js:26 |
| `test/build-release.test.js` | `release.yml` | Modify | builder와 workflow 구조 검사 | 공통 group·루트 version·manual guard 구조 단언 보강 | 해당 파일:184~198; docs/install.md:108,119 |

#### Constraints

- `test/build-release.test.js`의 기존 `(e) release.yml → manual dispatch cannot reach publishing` 테스트에서 on mapping·prepare 의존·권한 단언을 보존한다. concurrency group의 새 기대값은 `release`다. root_version은 root package.json의 version을 읽어야 한다.
- fixture는 root, workspace, lockfile과 기존 syncVersions TARGETS가 요구하는 모든 manifest를 만든다. metadata나 루트 입력을 누락해 module-load/fixture 오류가 목표 Red보다 먼저 발생하지 않게 한다.
- 전체 SemVer 문자열을 비교한다. registry version은 npm이 실제로 저장하는 형태인 `semver.clean(pack.version)`(+build metadata 제거)과 정확히 비교하며, 이 정규화 외에는 registry name/version/integrity 불일치를 허용하지 않는다(사용자 결정, F-CT-1 option b).
- 이미 차단되는 오류는 새 테스트가 첫 실행부터 통과할 수 있다. 이를 Red라고 기록하지 않는다. manual 차단만 별도 격리 mutation의 의도된 실패를 증거로 남긴다.
- Git fetch 실패 뒤 cleanup 호출은 허용한다. 부재 단언의 대상은 worktree add, commit, push다. 실제 network fetch 대신 로컬 bare remote의 존재하지 않는 release ref로 실제 Git fetch 실패를 만든다.
- 테스트는 integration 기존 배정을 유지한다. 실제 npm registry/원격 Git에 쓰지 않는다. 신규 dependency, 버전 bump, dist 추적을 추가하지 않는다.
- 명사형 한국어 commit 제목·종결 문장 본문을 사용하고 테스트 이름은 condition → result다. source 문구 regex 대신 호출 결과·YAML 의미·파일/remote 상태를 단언한다.

### host-distribution/release-pipeline-followup/002 · `7e920779`

#### Goal & intent

clean snapshot의 실제 release tree와 runtime tgz로 독립 설치를 검증해 SPEC-004/005, CT-007을 해소한다. Epic 성공 기준 3~7, 12 및 blueprint 수용 기준 2를 충족한다.

#### Current behavior

- `scripts/check-distribution.js:86~101`은 git ls-files와 staged 추가 경로를 열거하고 실제 worktree 바이트를 복사한다. 현재 추적 파일의 미커밋 내용 반영은 이미 구현되어 있다.
- snapshot에서 npm ci/build/pack을 수행하지만 `:143~149`는 plugin을 source 자산에서 직접 복사한다. `:124`의 verifyInstall에는 current 호출이 없다.
- `:135`는 init exit만 확인하고 seed 파일을 읽지 않는다. local/global은 같은 repo를 재사용한다(`:150`, `:154`). 상속 BOUNCER_HOME도 통제하지 않는다(`:82`, `:127`).
- I/O: `run`은 실제 spawnSync이고 smoke temp는 finally에서 사라진다(`:25`, `:155`). CLI report는 pack 목록뿐이라 중간 생성물 관찰이 없다(`:175`). 실제 seed 경로·생성 표식은 packages/cli/src/codex-agents.ts:13,24,188 및 layout.ts:14다.
- 재현 명령은 `node --test test/runtime-install-smoke.test.js`다. 기존 테스트는 exit와 상위 report만 확인한다(`:11~24`). 이번 계획 단계에서 실행하지 않았고 새 Red 증거도 아직 없다.

#### Target behavior

- 성공: snapshot 안의 `scripts/build-release.js --out <temp-plugin-tree>`를 격리 env로 실행한다. 그 pack 기반 tree 전체를 asset-home에 설치한다. snapshot source 디렉터리의 직접 복사 목록을 제거한다.
- 성공: local/global은 별도 fresh Git 소비 repo, asset-home, seed 대상 디렉터리를 가진다. plugin 없는 HOME과 BOUNCER_HOME 제거 상태에서 current의 exit 0와 current=null을 확인한 뒤 asset-only 해석과 init seed를 검사한다.
- 성공: seed 전 파일 부재를 확인하고 다섯 agent TOML의 생성 표식 및 비어 있지 않은 내용을 확인한다. test fixture의 미커밋 agent marker가 최종 생성 TOML에 남는다.
- 실패: builder·current·seed assertion 실패는 smoke 자체를 nonzero로 끝낸다. 이전 설치의 seed 결과를 다음 설치의 성공으로 세지 않는다.
- 보존: pack 필수/금지 목록, 임시 prefix/cache 사용, argv 실행, 사용자 설치 불변, temp 정리, 기존 CLI packs report 필드.

#### Interface

- 저장소용 checker의 내부 `smoke({root?:string})`를 export해 격리 fixture checkout을 검사할 수 있게 한다. root 기본값은 현재 script의 저장소다. runtime CLI 옵션은 늘리지 않는다.
- smoke 반환값은 `{pluginFiles:string[], installs:Array<{kind:'local'|'global', current:object, seededAgents:Record<string,string>}>}`다. seededAgents는 생성된 상대 파일 경로와 실제 읽은 TOML 내용이다. current는 CLI stdout을 파싱한 원본 JSON이다. 고정 성공 표식으로 관찰 결과를 대체하지 않는다.
- main의 `--smoke` 성공 JSON은 기존 필드에 smoke 결과를 추가하고 packs mode의 기존 필드를 유지한다. report의 실제 값으로 테스트가 builder tree 목록·설치별 current·seed 내용을 단언한다.
- 즉시 실패: builder exit nonzero, 잘못된 current JSON/exit, seed 파일 누락/무효 내용. plugin 없는 조회는 자산 부재를 정상 상태로 취급하며 host cache fallback에 기대지 않는다.
- 테스트 주입은 저장소 root와 실제 fixture 파일뿐이다. build/npm/install/runtime/seed를 가짜로 대체하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/check-distribution.js` | `smoke`, `main`, `run` | Modify | pack 경계 및 설치 확인 | snapshot builder·격리 current·실제 seed 관찰 결과 반환 | 해당 파일:25,76,124,143,175; builder scripts/build-release.js:118; seed packages/cli/src/codex-agents.ts:188 |
| `test/runtime-install-smoke.test.js` | `clean snapshot runtime tgz` | Modify | checker subprocess 성공 확인 | 격리 fixture marker와 설치별 산출물 단언 | 해당 파일:11~24; 호출 scripts/check-distribution.js:175; 관련 계약 test/build-release.test.js:173 및 test/distribution.test.js:69 |

#### Constraints

- root를 받는 하위 pack 검사에도 같은 fixture root와 격리 npm env를 전달한다. builder를 subprocess로 실행해 기존 process.env 상속이 host cache/prefix를 쓰지 않게 한다.
- snapshot 입력 제외 정책 `.git/.bouncer/.worktrees/dist/node_modules`를 유지한다. source와 dist 추적 계약 및 실제 pack 목록 정본을 보존한다.
- marker는 임시 fixture 저장소의 tracked `agents/bouncer-coordinator.md` 본문에만 추가한다. 공유 실제 worktree의 agent를 수정하거나 source 전체 복사로 builder를 대체하지 않는다.
- 기존 테스트의 ok/mode/runtimeFiles 단언을 보존하고 report 확장에 대한 단언만 추가한다. 문구 regex 대신 parsed JSON과 실제 생성 파일 내용을 검사한다. marker는 테스트 입력과 산출물 전달의 계약이다.
- 기존 integration 계층을 유지한다. 네트워크는 npm dependency 설치에만 사용하며 실제 registry publish/원격 Git 쓰기는 금지한다. Windows bin 선택과 격리 환경 복구를 유지한다.
- temp 디렉터리는 테스트가 직접 만든 것만 정리한다. 명사형 한국어 commit 규약과 한국어 비자명 주석·docstring 규칙을 따른다.

### host-distribution/release-pipeline-followup/003 · `ae3e1da0`

#### Goal & intent

이미 구현된 launcher-free 허용과 mismatch 전파의 새 실행 증거를 수집해 CT-004를 해소한다. Epic 성공 기준 6, 7, 13 및 blueprint 수용 기준 3을 충족하며 runtime 기능은 바꾸지 않는다.

#### Current behavior

- packages/cli/src/plugin-root.ts:47~64는 launcher를 요구하지 않는다. :152~175는 선택 직후 runtime 버전을 확인하고 asset API :210이 resolver를 호출한다.
- test/plugin-root.test.js:95는 명시 BOUNCER_HOME의 launcher-free 허용을 검사한다. :101의 matching 하위 후보는 1.5.0인데 runtime은 1.6.0이라 실제 일치 후보 fallback 방지까지 증명하지 않는다.
- I/O는 실제 임시 HOME과 자산 파일이다(`test/plugin-root.test.js:26`). capture는 runBouncerRoot의 homeDir/isTTY/readInput 및 출력 stream을 주입한다(`:43`). dist를 require하므로 source mutation 뒤 rebuild가 필요하다(`:8`).
- 재현 명령은 `node --test test/plugin-root.test.js`다. 현재 동작은 이미 구현되어 있고 이번 계획에서 테스트를 실행하지 않았다. 기존 Red 기록이 있다는 주장은 하지 않는다.

#### Target behavior

- 성공: 명시 루트 및 자동 host 후보의 matching asset-only plugin이 launcher 없이 선택된다.
- 실패: runtime과 실제로 일치하는 하위 후보가 있어도 최신 launcher-free 후보의 mismatch가 root/asset API와 runBouncerRoot 자동/선택 모드에 전달된다. library는 mismatch code, CLI는 exit 1와 양쪽 버전·복구 안내를 노출한다.
- 증거: launcher 필수 재도입과 mismatch 검사 제거를 각각 격리 복사본에서 적용·rebuild하면 지정 테스트가 실패하며 정상 구현에서는 통과한다.
- 보존: 실제 source/launcher는 수정하지 않고 테스트만 변경한다. 기존 후보 선택·명시 무효 루트·순수 CLI 계약을 유지한다.

#### Interface

- 제공: fixture(root assets,host,version,launcher:boolean)와 capture를 재사용한 회귀 및 격리 negative control이다. 공개 runtime signature와 오류 형식은 그대로다.
- 주입: `resolvePluginAssetRoot({env:{BOUNCER_HOME},runtimeVersion})`, `resolvePluginRoot({homeDir,env,runtimeVersion})`, `runBouncerRoot(argv,{homeDir,isTTY,readInput,stdout,stderr})`의 기존 seam을 쓴다. capture 반환은 `{code,out,err}`다. unit under test와 기대값은 대체하지 않는다.
- 즉시 throw: 명시 무효 루트와 선택 후보 mismatch는 기존 오류를 유지한다. mismatch code는 `BOUNCER_PLUGIN_VERSION_MISMATCH`다.
- 정상 miss: plugin 부재 no-op 계약을 바꾸지 않는다. mismatch를 miss로 흡수하거나 과거 후보로 fallback하는 negative control은 실패해야 한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `test/plugin-root.test.js` | `fixture`, `capture`, `resolvePluginAssetRoot`, `runBouncerRoot` | Modify | root 선택·mismatch·launcher 진단 회귀 | 실제 일치 하위 후보와 자동 경로·격리 negative control | 해당 파일:26,43,95,101; packages/cli/src/plugin-root.ts:47,152,210; packages/cli/src/bouncer-root.ts:50,55; docs/install.md:75 |

#### Constraints

- `test/plugin-root.test.js`의 기존 `selected latest plugin with a different version → throws an identifiable mismatch without fallback`에서 matching fixture를 실제 runtime과 일치하는 1.6.0으로 바꾸고 latest는 1.7.0을 유지한다. code·양쪽 버전·복구 안내·--select 실패 단언을 완화하지 않는다.
- 이미 Green인 테스트를 기능 변경 전 Red라고 주장하지 않는다. negative control의 입력·mutation·rebuild 명령·실패 단언·exit와 정상 재실행 결과를 구분한다.
- mutation은 테스트가 만든 격리 복사본 source에만 적용한다. 실제 저장소의 Do not touch 경로는 변경하지 않는다. 복사본을 rebuild하고 그 dist를 읽는 테스트를 실행한다. mutation 위치를 못 찾으면 skip 성공 대신 실패한다.
- launcher 필수 재도입은 matching 선택값/exit 단언에, version 검사 제거는 mismatch throw/exit 단언에 도달해야 한다. module-load나 빌드 실패는 목표 Red가 아니다.
- 기존 integration 배정·한국어 명사형 commit·비자명 주석 규칙을 유지한다. 신규 runtime seam·dependency·공개 옵션을 만들지 않는다.

### host-distribution/release-pipeline-followup/004 · `f4143222`

#### Goal & intent

trusted publisher와 provenance의 운영 조건, missing dist 및 stale build 진단·복구를 문서화해 SPEC-006/007을 해소한다. Epic 성공 기준 7, 10 및 blueprint 수용 기준 5를 충족한다.

#### Current behavior

- docs/install.md:125는 운영 준비를 일반적으로 나열하며 workflow identity와 허용 action을 특정하지 않는다. :331~363에는 Bash/PowerShell 예시만 있고 두 빌드 오류를 구분하지 않는다.
- publish job은 push-only·ubuntu-latest·Node 24·npm >=11.5.1이며 contents:write와 id-token:write를 사용한다. environment는 없다(.github/workflows/release.yml:44~59). repository metadata는 cheongfish/bouncer다(packages/cli/package.json:6~11).
- 두 bin은 dist entry 부재와 source/stamp 불일치를 다른 stderr로 거부한다(packages/cli/bin/bouncer:7,15 및 bouncer-root:7,15). 기존 진단 회귀는 test/plugin-root.test.js:240,256,310이다.
- I/O: 문서는 실행 상태를 갖지 않는다. 외부 npm 설정과 공개 여부는 로컬로 확인되지 않는다. check-doc-shape는 install 계약이 없어 직접 실행하면 실패한다(scripts/check-doc-shape.js:887).
- 문서의 복구 동작은 기존 `node --test test/plugin-root.test.js`로 검사하고 내용은 실제 workflow/bin과 수동 대조한다. 이번 계획 단계에서 복구 명령이나 실제 게시를 실행하지 않았다.

#### Target behavior

- 산출물: owner/repository/workflow filename·선택 environment·npm publisher 허용 action을 실제 publish job에 연결한다. workflow 표시 이름과 파일명을 구별한다.
- 산출물: OIDC 권한·runner·Node/npm·공개 repository/package와 repository metadata의 provenance 조건을 공식 출처와 함께 설명한다. 외부 설정 완료 여부는 운영자가 확인한다.
- 산출물: missing-dist와 stale-build를 원인별로 설명하고 checkout root에서 npm ci/build 및 bin 재실행을 Bash/PowerShell로 제시한다. source 없는 npm 설치본의 freshness skip을 구분한다.
- 보존: npm 우선 설치, local/global shim·BOUNCER_HOME/BIN 역할·재실행 절차·배포 승인 경계. 문서로 실제 배포 완료를 주장하지 않는다.

#### Interface

- 제공: docs/install.md의 릴리스 검증 절차 및 저장소 개발 checkout 절 보완. runtime/CLI signature와 계정 설정은 바꾸지 않는다.
- 거부: missing-dist/stale-build를 자산 루트 문제로 취급하는 안내, token fallback 권장, 실제 공개·provenance 생성을 로컬 검사로 대체하는 주장.
- 근거: [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/), [npm provenance](https://docs.npmjs.com/generating-provenance-statements/)와 통합된 TASKS-001/002. 구현 시점의 공식 조건과 실제 workflow를 대조한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `docs/install.md` | `릴리스 검증 절차`, `저장소 개발 checkout 연결` | Modify | 설치·개발·운영 안내 | publisher identity·OIDC/provenance와 빌드 오류 복구 | 해당 파일:125,331; .github/workflows/release.yml:44~59; packages/cli/bin/bouncer:7,15; test/plugin-root.test.js:240,256,310 |

#### Constraints

- 문서만 변경하고 문구 regex 테스트나 doc-shape 계약을 추가하지 않는다. install에는 heading/line-count 고정 계약이 없다. checker에 임의 등록하지 않는다.
- 설치 복구 예시에 publish·tag/push 자동 실행을 섞지 않는다. 기존 배포 별도 승인 지침을 유지한다.
- owner/repo는 cheongfish/bouncer, workflow filename은 release.yml이며 현재 environment는 미사용이다. 허용 action은 직접 publish에 해당하며 staged publish를 요구하지 않는다.
- Node 24는 저장소 선택이며 npm 일반 최소 조건과 구별한다. provenance 조건은 공식 출처와 연결하고 외부 공개 상태·publisher 등록을 추정하지 않는다.
- 한국어 본문·명사형 commit 규약을 따르며 로컬 인계와 기존 검증 기록을 커밋하지 않는다.

### host-distribution/release-pipeline-followup/005

#### Goal & intent

네 commit task가 모두 integrated된 checkout에서 전체 CI를 실행해 게시·설치·회귀·문서 변경이 저장소의 기존 검사와 함께 통과함을 증명한다. Epic 성공 기준 6과 blueprint 수용 기준 6을 확인한다. 실행 명령은 frontmatter verify가 정본이다.

#### Current behavior

- 저장소 CI는 .github/workflows/test.yml:22의 npm run ci를 실행한다. package.json의 ci는 emit·version·coverage·unit·lint·docs·context comments·typecheck·test names·audit를 묶는다.
- 선행 인계의 CI pass는 이전 checkout에 대한 기록이다. 이번 후속 구현의 성공 증거가 아니며 이번 계획 단계에서 전체 CI를 실행하지 않았다.

#### Target behavior

- 성공: 모든 선행 commit이 integrated된 뒤 frontmatter 명령의 exit 0 증거를 실행 gate가 기록한다.
- 실패: 명령이 nonzero이면 실행 workflow의 실패 복구 절차로 돌아가며 verification task에서 source를 고치거나 pass를 수기 기록하지 않는다.
- 보존: 기존 coverage 임계값·version 정본·unit/integration 정책과 npm audit를 완화하지 않는다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.

#### Constraints

- source diff와 commit을 만들지 않는다. 이 task의 affected_paths는 비어 있어야 한다.
- 성공 증적은 execute gate만 기록한다. 과거 CI 결과나 focused pass를 전체 CI pass로 대체하지 않는다.

### host-distribution/release-pipeline-followup/006 · `bef3723a`

#### Goal & intent

최종 리뷰 finding을 수정한다.

- F-CT-1 (major, correctness_tests, must_fix) — scripts/release-runtime.js#releaseRuntime — tasks/001 Target behavior — note: +build tag: real npm publish stores semver.clean(version) (libnpmpublish publish.js:76-83), so post-publish assertRegistryArtifact exact version compare throws after an irreversible publish; test (m) fakes an unnormalized npm view. Fix needs a product decision: TASKS-001 Target behavior (allow +build) conflicts with Constraints (no registry version mismatch tolerated even when npm normalizes). Blocked for user decision.

#### Interface

- 제공: 기록된 리뷰 finding을 해소하는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `scripts/release-runtime.js` — 기록된 리뷰 finding을 수정한다.
- Modify `test/release-runtime.test.js` — 기록된 리뷰 finding을 수정한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.
- 사용자 결정(F-CT-1 option b): `assertRegistryArtifact`의 registry version 비교 기대값을 `semver.clean(pack.version)`과 같은 npm 저장 형태(+build metadata 제거)로 바꾼다. `semver`는 직접 dependency가 아니므로 신규 dependency를 추가하지 않고, 이미 strict SemVer 검사를 통과한 입력에서 `+` 이후를 제거하는 동일 의미의 정규화를 구현한다.
- name, dist.integrity와 그 밖의 artifact 비교는 정확히 일치해야 한다. +build 제거 외의 버전 차이(예: prerelease 차이)는 여전히 throw한다.
- 테스트의 가짜 `npm view`/publish seam은 실제 npm처럼 게시 버전을 정규화해 저장·응답해야 한다. `+build` tag 게시가 성공하는 경우와, registry version이 정규화 결과와 다를 때 throw하는 경우를 단언한다. 기존 테스트 (m)의 비정규화 응답은 실제 npm 동작에 맞게 고친다.
- 공개 인터페이스, 반환 형태, workflow 파일은 바꾸지 않는다. 실제 registry/원격 Git에 쓰지 않는다.