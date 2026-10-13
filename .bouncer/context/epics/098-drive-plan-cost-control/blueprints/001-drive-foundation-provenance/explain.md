---
type: bouncer.explain
title: 드라이브 기반 안정화와 실행 출처·계측 설명
description: Explain stdout hygiene, stale-build detection, commit and report provenance, integrate guards, and drive metrics.
resource: .bouncer/context/epics/098-drive-plan-cost-control/blueprints/001-drive-foundation-provenance/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-13T15:12:36.707+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '098'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: 788152b3c3d33f255d0f3e47e3e69836c367be75
      range_to: 1740959cd6568d4ed88bdf4431b30ff23683beba
      diff_sha: 1157b6e88d11046f87b5f5592b29b800f5f22a579f712c283bda1280ebd2ff68
      recorded_at: '2026-10-13T15:40:00+09:00'
  task_commits:
    - task: EPIC-098/BP-001/TASK-001
      sha: 793d443f
      intent_anchor: task-001
    - task: EPIC-098/BP-001/TASK-002
      sha: 7cf6e3a3
      intent_anchor: task-002
    - task: EPIC-098/BP-001/TASK-003
      sha: b3b76a52
      intent_anchor: task-003
    - task: EPIC-098/BP-001/TASK-004
      sha: 1740959c
      intent_anchor: task-004
    - task: EPIC-098/BP-001/TASK-005
      sha: 7cbdf1fe
      intent_anchor: task-005
    - task: EPIC-098/BP-001/TASK-006
      sha: 5beb716c
      intent_anchor: task-006
    - task: EPIC-098/BP-001/TASK-007
      sha: 48ca245e
      intent_anchor: task-007
---
# Explain

## Background
coordinator가 결과를 JSON으로 읽는 경로에 의존성 설치 출력이 섞이면 이미 실행된 동작이 "결과 불명확"으로 보고되어 상태 확인 없이 재실행될 위험이 있었다. 개발 checkout에서는 소스보다 오래된 빌드가 실행되어 환경 문제가 구현 실패처럼 보였다. 또 worker 보고의 출처, integration 커밋과 worker 커밋의 대응, coordinator의 직접 수정 여부는 이력에 구조화되어 남지 않았다. 이 변경은 이 공백을 CLI가 결정적으로 막고, 재기동과 계획 리뷰 비용을 측정할 기록을 남기게 한다.

## Intuition
자동 action의 stdout은 결과 전용 우편함이고, 진행 메시지는 stderr라는 다른 창구로 보낸다. 빌드 stamp는 산출물에 붙인 소스 지문이고, launcher는 실행 전에 지문이 맞는지 본다.

## Code
- `scripts/src/lib/coordinator.ts`: 의존성 설치를 stderr로 보내는 호출 지점, fan-in 커밋의 `Bouncer-Worker-Commit` trailer, `coordinate report`의 보고 파일 검사(`report-revision-missing`·`report-revision-conflict`·`report-section-missing`), `coordinate integrate`의 `integration-source-mutated`와 경로 대조 경고, checkpoint `sessions[]`.
- `scripts/build-stamp.js`, `scripts/bouncer`, `scripts/bouncer-root`: 소스 해시 계산과 `stale-build` 거절.
- `scripts/src/lib/task-commits.ts`, `scripts/src/lib/finalize-digest.ts`, `scripts/src/lib/finalize-pr.ts`: trailer 파싱, digest의 `worker_sha`와 `worker_notes`, PR 리뷰 포인트.
- `scripts/src/lib/drive-metrics.ts`, `scripts/src/lib/cli-metrics-command.ts`, `scripts/src/lib/config.ts`: `bouncer metrics start|end|summary`와 `metrics.pricing`.
- `agents/bouncer-implementer.md`, `agents/bouncer-coordinator.md`, `references/coordinator-cards/report.md`, `references/coordinator-cards/record.md`: 보고 형식(`##` 제목, Open choices·Known weaknesses, 경로를 backtick으로 감싼 Changed files)과 수락 판단 규칙.

## Quiz
1. 개발 checkout에서 `scripts/lib/.build-stamp`가 없고 `scripts/src`가 있을 때 launcher는 어떻게 동작하는가?
   - A) 자동으로 `npm run build`를 실행한 뒤 계속한다.
   - B) stamp 부재를 stale로 보고 `stale-build`와 복구 명령을 출력한 채 exit 1로 끝난다.
   - C) 경고만 출력하고 기존 산출물로 실행한다.
2. full 드라이브의 worker 보고 파일에 `## Brief revision`이 없으면 `coordinate report`는 무엇을 하는가?
   - A) 활성 dispatch의 attempt와 hash로 값을 채워 수락한다.
   - B) stale-report 결정을 원장에 기록한다.
   - C) `report-revision-missing`으로 거절하고 원장을 쓰지 않으며 attempt를 열어 둔다.
3. fan-in이 만든 integration 커밋에는 worker 커밋과의 대응을 위해 무엇이 추가되는가?
   - A) `Bouncer-Worker-Commit: <worker sha>` trailer
   - B) worker 브랜치 이름을 담은 git note
   - C) 커밋 제목의 `[worker]` 접두사
4. integration checkout에 seed manifest 경로와 integrated task의 evidence 경로 밖의 미커밋 변경이 있는 상태에서 full commit wave를 integrate하면?
   - A) 변경을 자동으로 stash하고 통합한다.
   - B) 경고만 남기고 통합한다.
   - C) `integration-source-mutated`로 거절하고 원장을 바꾸지 않는다.
5. `bouncer metrics end`에 `--tokens`도 input/output 토큰도 주지 않으면 기록은 어떻게 되는가?
   - A) 토큰은 `null`이고 사유는 `not-reported`이며 비용은 계산하지 않는다.
   - B) 토큰을 0으로 기록하고 비용도 0으로 계산한다.
   - C) 직전 세션의 토큰을 복사한다.
6. worker가 보고한 열린 선택(`Open choices`)은 finalize에서 어디에 나타나는가?
   - A) Explain의 Background 절에 task별 실행 기록으로 쓴다.
   - B) digest의 `tasks[].worker_notes`로 전달되어 PR 리뷰 포인트에 `구현 선택(<task id>): …`로 나온다.
   - C) 커밋 메시지 본문에 들어간다.

## Tasks

### EPIC-098/BP-001/TASK-001 · `793d443f`

#### Goal & intent

coordinator가 worktree 의존성을 설치하는 네 호출 지점(prepare의 worker seed, fan-in seed, verification_node, supplement 완료)에서 `npm ci` 출력이 CLI stdout으로 가지 않게 한다. 그 결과 `bouncer coordinate advance`가 자식 명령에서 받는 stdout은 항상 단일 JSON 객체다. coordinator 역할 문서는 `unclear-result` 뒤 `coordinate next` 또는 `coordinate status`로 상태를 확인하기 전에 같은 mutation을 다시 실행하지 않는다고 명시한다. 완료 판정은 Checklist의 실제 launcher 경로 테스트와 `npm run ci`다.

#### Current behavior

- `prepareDependencies(worktreePath, deps)`(`scripts/src/lib/seed-worktree.ts:120-158`)는 lockfile stamp가 없거나 다르면 `(deps.execFileSync || execFileSync)('npm', ['ci','--include=dev','--ignore-scripts','--no-audit','--no-fund'], {cwd, stdio:'inherit'})`를 실행한다(`:144-147`). `SeedDeps = { execFileSync?: typeof execFileSync }`(`:26`).
- coordinator 호출 지점은 모두 stdio를 덮어쓰지 않는다.
  - `supplementDone`: `prepareDependencies(integrationPath, {execFileSync: exec})`(`scripts/src/lib/coordinator.ts:897`)
  - `prepareCoordinator` → `seedCoordinatorWorker({..., deps:{execFileSync: exec}})`(`:1912-1915`)
  - `integrateVerificationTask`: `prepareDependencies(integration.integrationPath, {execFileSync: exec})`(`:2122`)
  - fan-in `integrateCommitWave` → `seedCoordinatorWorker(...)`(`:2597-2599`)은 deps 없이 실제 `execFileSync`를 쓴다.
- `defaultRunArgv`(`scripts/src/lib/coordinate-advance.ts:76-86`)는 `spawnSync(process.execPath, [scripts/bouncer, ...], {stdio:['ignore','pipe','pipe']})`로 자식을 띄운다. 자식의 fd 1이 pipe이므로 손자 npm의 `inherit` 출력이 JSON 앞에 섞인다. `parseResultJson`이 stdout 전체를 `JSON.parse`하므로 `classifyRun`(`:149-174`)이 unclear를 내고 `:326-331`이 `unclear-result`를 돌려준다. 이때 action은 이미 실행된 상태다.
- finalize는 같은 문제를 `FINALIZE_INSTALL_STDIO = ['ignore','pipe','pipe']`와 `prepareFinalizeDependencies`의 exec wrapper로 막았다(`scripts/src/lib/finalize.ts:924-966`).
- 다른 stdout 기록자는 없다. coordinator·seed-worktree·advance에 `console.*`·`process.stdout.write`가 없고 CLI 출력은 `io.out` 한 번이다(`scripts/src/lib/cli-git-commands.ts:856`).
- 테스트: `test/coordinate-advance.test.js:197` (g)는 stub `runArgv`로 non-JSON만 확인하고 `defaultRunArgv`는 실행하지 않는다. `test/seed-worktree.test.js:273,651,693`은 기본 `stdio:'inherit'`을 단언한다. `test/finalize.test.js:1867`이 captured stdio 단언의 선례다. fake 실행 파일 패턴은 `test/cli-coordinate.test.js:915-926`(`#!${process.execPath}` + `chmodSync 0o755`)에 있다.
- `agents/bouncer-coordinator.md:160-169`와 `.codex/agents/bouncer-coordinator.toml`에는 `unclear-result` 처리 문구가 없다.

#### Target behavior

- 성공: coordinator의 네 호출 지점이 npm을 `stdio: ['ignore', 2, 2]`로 실행한다. npm stdout·stderr는 부모의 stderr로 가고 CLI stdout에는 마지막 JSON 한 개만 남는다. fan-in seed 호출도 같은 exec wrapper를 받는다.
- 실패: npm 설치가 실패하면 기존 실패 매핑(`prepareDependencies`의 `{ok:false, reason, message}`와 호출자 reason)이 그대로 나온다.
- 보존: `prepareDependencies`의 기본 `stdio:'inherit'`, npm argv, stamp 판정, finalize의 capture와 `FINALIZE_INSTALL_COMMAND`, `classifyRun`의 분류 규칙은 바뀌지 않는다.
- 문서: coordinator 역할 문서의 advance 절에 "`unclear-result`를 받으면 `coordinate next`나 `coordinate status`로 상태를 다시 읽고, 그 결과가 가리키는 행동만 실행한다. 같은 mutation argv를 바로 다시 실행하지 않는다"가 들어가고 TOML이 같은 내용으로 재생성된다. `failAdvance('unclear-result', …)`의 `next` 문구도 `coordinate next` 또는 `coordinate status` 확인을 요구한다.

#### Interface

- 제공: coordinator 내부 exec wrapper. 이름은 구현자가 정한다(신규 추출 지점: CLI 설치 stdio 고정). 모양은 `(exec: Exec) => Exec`이고, 받은 exec를 `options.stdio = ['ignore', 2, 2]`로 덮어 호출한다.
- 제공: 테스트 seam. 기존 `deps.execFileSync`(coordinator)와 `SeedDeps.execFileSync`를 그대로 사용한다. 새 공개 CLI 옵션은 없다.
- 거부: `prepareDependencies` 기본값 변경, finalize 경로 변경, `classifyRun`이 JSON 앞의 잡음을 잘라 내는 관대한 파싱. stdout 오염은 원인에서 막고 파서는 계속 엄격하게 둔다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinator.ts` | `supplementDone`, `prepareCoordinator`, `integrateVerificationTask`, `integrateCommitWave` | Modify | 네 지점에서 npm을 상속 stdio로 실행 | exec wrapper를 거쳐 stderr로 보냄. fan-in seed에 deps 전달 | 오염 원인인 호출 지점 |
| `scripts/src/lib/coordinate-advance.ts` | `failAdvance('unclear-result')` 호출부 | Modify | next 문구가 출력 확인만 요구 | `coordinate next`·`coordinate status` 확인 요구로 문구 변경 | 복구 절차의 CLI 안내 |
| `agents/bouncer-coordinator.md` | advance 절 | Modify | unclear-result 처리 문구 없음 | 상태 확인 전 같은 mutation 재실행 금지 추가 | 역할 절차 |
| `.codex/agents/bouncer-coordinator.toml` | 생성 결과 | Modify | md와 바이트 동일 | md 변경을 재생성 | `test/agents.test.js:44` |
| `test/coordinator.test.js` | 설치 stdio 단언 | Modify | 설치 stdio 단언 없음 | 네 지점의 npm 호출 stdio가 `['ignore',2,2]`임을 단언 | 검증 지점 |
| `test/coordinate-advance.test.js` | 실제 launcher 경로 테스트 | Modify | stub만 사용 | fake npm이 stdout에 잡음을 쓰는 상태에서 deps 없이 advance가 prepare를 실행하고 `unclear-result`가 없음을 단언 | 성공 기준 1의 고정 지점 |

#### Constraints

- npm 출력은 버리지 않고 stderr로 보낸다. 사용자는 설치 진행을 볼 수 있어야 한다.
- 실제 launcher 테스트는 네트워크 없이 끝나야 한다. fake `npm`을 임시 디렉터리에 두고 `PATH` 앞에 붙이며, fake는 stdout에 잡음을 쓰고 `node_modules/.package-lock.json`을 만든다.
- 테스트 이름과 한국어 주석은 `references/coding-standards/index.md`의 Tests 규칙과 `npm run lint:test-names`를 따른다.
- `agents/bouncer-coordinator.md`를 고친 뒤 TOML은 `mdToCodexToml` 결과와 바이트 단위로 같아야 한다.

### EPIC-098/BP-001/TASK-002 · `7cf6e3a3`

#### Goal & intent

`npm run build`가 `scripts/lib/.build-stamp`에 소스 트리 해시를 기록한다. `scripts/src`가 있는 checkout에서 plain JS launcher `scripts/bouncer`와 `scripts/bouncer-root`는 `scripts/lib`을 require하기 전에 현재 해시와 stamp를 비교한다. 다르거나 stamp가 없으면 `stale-build`와 복구 명령을 stderr에 쓰고 exit 1로 끝난다. `scripts/src`가 없는 배포본은 검사를 건너뛴다. 완료 판정은 Checklist의 launcher 테스트와 `npm run ci`다.

#### Current behavior

- `scripts/bouncer`(Node, CommonJS): `:57` `resolveInstalledRoot()`가 `:29`에서 bouncer-root를 spawn한다. `:62` 자기 실행 분기, `:63-71` `lib/cli.js` 존재 검사, `:72` `require('./lib/cli')`, `:76` 다른 root로 위임(stdio inherit).
- `scripts/bouncer-root`: `:9-15` `lib/bouncer-root.js` 존재 검사, `:17` require.
- 오류 출력은 JSON이 아닌 stderr 평문이다. `bouncer: scripts/lib is missing; run \`npm run build\` in <root>\n`과 exit 1(`scripts/bouncer:67-69`, `scripts/bouncer-root:11-13`).
- `package.json`: `"build": "tsc"`(`:53`), `"pretest": "npm run build"`. `files`(`:6-24`)에 `scripts/bouncer`, `scripts/bouncer-root`, `scripts/lib/`, `scripts/vendor/`가 개별 항목으로 있고 `scripts/*` glob은 없다. `scripts/src`는 배포되지 않는다(`test/distribution.test.js:98`).
- `tsconfig.json`: include는 `scripts/src/lib/**/*.ts`, outDir은 `scripts/lib`. `.ts` 파일 87개, 약 1.58MB.
- `.gitignore:20` `scripts/lib/`. `scripts/check-emit.js`는 build 후 tracked·unignored `scripts/lib` 파일만 거절한다. `scripts/build-release.js`는 `npm run build` 뒤 `npm pack --dry-run` 목록만 복사한다.
- eslint flat config는 `scripts/lib/**`, `scripts/vendor/**`를 무시하므로 새 `scripts/*.js`는 lint 대상이다(2칸 들여쓰기, 작은따옴표, `'use strict'`, max-len 120).
- 테스트: `test/plugin-root.test.js:150`, `:162`는 저장소 launcher를 실제로 실행한다(pretest build로 stamp 일치). `:196`, `:210`은 tmp에 `bouncer`, `bouncer-root`만 복사하고 `scripts/src`가 없다. `test/build-release.test.js:145`는 release tree의 `scripts/bouncer --help` 성공을, `:148`은 tree와 pack 목록 일치를 단언한다. `test/distribution.test.js:70-89`에 필수 배포 파일 목록이 있다.

#### Target behavior

- 성공: build 뒤 `scripts/lib/.build-stamp`에 `sha256:<64hex>\n`이 있고, launcher는 해시가 같으면 지금과 같이 동작한다.
- 실패: `scripts/src`가 있는데 stamp가 없거나 해시가 다르면 두 launcher가 아래 문구를 stderr에 쓰고 exit 1로 끝난다. `scripts/lib`은 require하지 않는다.
  ```text
  bouncer: stale-build: scripts/lib does not match scripts/src; run `npm run build` in <root>
  ```
- 생략: `scripts/src` 디렉터리가 없으면 helper를 require하지 않고 검사를 건너뛴다. tmp fixture와 배포본이 이 경로다.
- 보존: `lib/cli.js`·`lib/bouncer-root.js` 부재 안내 문구, 위임 흐름, `typecheck`(`tsc --noEmit`)는 stamp를 건드리지 않는다. launcher는 자동 빌드하지 않는다.

#### Interface

- 제공: `scripts/build-stamp.js` plain JS helper. `computeSourceHash(root: string) => string`, `readStamp(root) => string | null`, `checkBuildFresh(root) => { ok: true } | { ok: false, reason: 'stale-build' }`. CLI로 `node scripts/build-stamp.js --write`를 실행하면 stamp를 쓴다.
- 해시 정의: `scripts/src/**/*.ts`와 `tsconfig.json`을 root 기준 posix 상대 경로로 정렬하고, 각 파일마다 `<경로>\0<바이트>\0`를 차례로 sha256에 넣는다. 줄바꿈 정규화는 하지 않는다.
- 제공: `package.json` `"build": "tsc && node scripts/build-stamp.js --write"`, `files`에 `scripts/build-stamp.js` 추가.
- 거부: stamp 부재·불일치 상태에서 compiled 코드 실행. 검사 코드를 `scripts/src`에 두는 방식은 쓰지 않는다. 그러면 검사 자체가 오래된 산출물로 실행된다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/build-stamp.js` | `computeSourceHash`, `checkBuildFresh` | Create | 없음 | 해시 계산·stamp 쓰기·신선도 판정 | 컴파일하지 않는 검사 위치 |
| `scripts/bouncer` | `runLauncher` 자기 실행 분기 | Modify | `lib/cli.js` 존재만 검사 | require 전에 `scripts/src`가 있으면 신선도 검사 | 진입점 |
| `scripts/bouncer-root` | require 전 검사 | Modify | `lib/bouncer-root.js` 존재만 검사 | 같은 신선도 검사 | 진입점 |
| `package.json` | `scripts.build`, `files` | Modify | `tsc`만 실행, helper 없음 | stamp 쓰기 추가, helper 배포 | 빌드·배포 계약 |
| `test/plugin-root.test.js` | stale·생략 경로 테스트 | Modify | 부재 안내만 단언 | 불일치·stamp 부재·src 부재 세 경로 단언 | 검증 지점 |
| `test/build-stamp.test.js` | 해시 정의 단언 | Create | 없음 | 정렬·경로 포함·tsconfig 포함 단언 | 해시 계약 |
| `test/distribution.test.js` | 필수 배포 파일 목록 | Modify | helper 없음 | `scripts/build-stamp.js` 추가 | 배포 목록 계약 |

#### Constraints

- `scripts/bouncer`는 자기 실행 분기에서만 검사한다. 다른 root로 위임하면 그 root의 launcher가 스스로 검사한다.
- helper require는 `scripts/src` 존재를 확인한 뒤에만 한다. 기존 `test/plugin-root.test.js:196`, `:210` fixture는 helper를 복사하지 않고 `scripts/src`도 없다. 새 (1)·(2) fixture는 `scripts/src`와 함께 `scripts/build-stamp.js`를 tmp root에 복사한다.
- 검사 실패는 기존 launcher 오류처럼 `bouncer: ` 접두 평문과 exit 1을 쓴다.
- 테스트는 저장소의 `scripts/lib`과 stamp를 바꾸지 않는다. tmp root에 `scripts/src`, `scripts/lib`, stamp를 만들어 검사한다.

### EPIC-098/BP-001/TASK-003 · `b3b76a52`

#### Goal & intent

full 모드 fan-in이 worker 커밋을 cherry-pick해 만든 integration 커밋마다 `Bouncer-Worker-Commit: <worker full sha>` trailer를 남긴다. finalize digest의 task `commit`은 integration SHA를 유지하면서 같은 커밋의 trailer에서 읽은 `worker_sha`를 함께 낸다. coordinator 출력 계약과 compact 출력 규칙은 SHA마다 worker 브랜치 커밋인지 integration 커밋인지 표기한다. 완료 판정은 Checklist의 e2e·digest 테스트와 `npm run ci`다.

#### Current behavior

- fan-in은 `git(exec, faninPath, ['cherry-pick', pickSha])`(`scripts/src/lib/coordinator.ts:2621`)로 ledger `item.sha`를 옮긴다(`:2615-2617`). 실패하면 `['cherry-pick','--abort']`(`:2626`)를 실행한다. `-x`와 메시지 수정이 없어 integration 커밋은 worker 메시지를 그대로 갖고 SHA만 다르다. 루프 뒤 `rev-parse HEAD`로 `candidateHead`를 읽는다(`:2657`). verified fanin 재개(`:2464`)는 cherry-pick을 다시 하지 않는다.
- light 모드 `integrateLightCommitWave`(`:2321-2421`)는 커밋을 만들지 않는다. worker SHA와 integration SHA가 같다.
- trailer는 문자열 연결로 만든다. `buildStableProvenance`(`scripts/src/lib/commit-sha.ts:85-102`)가 `Bouncer-Task`, `Bouncer-Intent`를 내고, `buildCommitMessage`(`scripts/src/lib/finalize.ts:209-247`)가 본문 뒤 빈 줄과 trailer를 붙인다. `git interpret-trailers`는 쓰지 않는다.
- `resolveTaskCommits`(`scripts/src/lib/task-commits.ts:67-110`)는 `git log --format=%H%x00%B base..head`에서 `TRAILER_RE = /^Bouncer-Task\s*:\s*(.*?)\s*$/`(`:11`)로 task별 최신 커밋을 고르고 `Map<id,{sha,sha8}>`을 돌려준다. digest의 `TaskDigest.commit`은 `{ sha; sha8; source: 'trailer' | 'commit_sha' } | null`(`scripts/src/lib/finalize-digest.ts:56`)이고 `:755-788`에서 채운다.
- 출력 계약 `agents/bouncer-coordinator.md:249-267`의 Provenance는 "each worker's ledger `branch` and commit SHA"만 적고 integration SHA와 구분하지 않는다. `rules/output.md:44-50`의 compact 예시는 `완료: 001-login · integration a1b2c3d · …`이고 SHA 출처 규칙이 없다.
- git 호출 seam은 coordinator의 `git(exec,cwd,args)`(`:600-602`)와 `deps.execFileSync`(`:2872-2876`), task-commits의 `exec` 옵션(`:73-77`)이다.
- 테스트: `test/coordinator-e2e.test.js:289`("worker commits를 cherry-pick함 → provenance trailers가 안정적으로 유지됨")는 `:324-328`에서 Bouncer-Task·Bouncer-Intent 한 줄씩을 단언한다. `test/coordinator.test.js:1144`, `:1183`, `:2301`, `:2324`, `:2364`는 cherry-pick argv를 가로챈다. `test/finalize-digest.test.js:162-182`, `:265`, `:356`, `:401`, `:885`가 `commit.source`와 fixture 메시지를 단언한다.

#### Target behavior

- 성공: cherry-pick이 성공할 때마다 그 커밋 메시지 끝 trailer 블록에 `Bouncer-Worker-Commit: <pickSha>` 한 줄을 추가해 amend한다. 이 단계는 `candidateHead`를 읽기 전에 끝나므로 ledger `fanin.candidate_head`와 `integrationHead`는 amend된 SHA를 가리킨다.
- 성공: digest `tasks[].commit`에 `worker_sha: string | null`이 생긴다. `source: 'trailer'`이고 그 커밋에 `Bouncer-Worker-Commit`이 있으면 그 값, 없으면 `null`이다. `source: 'commit_sha'`이면 `null`이다.
- 실패: amend가 실패하면 cherry-pick이 이미 끝나 진행 중 상태가 없으므로 `cherry-pick --abort`를 호출하지 않는다. fanin worktree를 지우고(`removeFaninWorktree`) cherry-pick 실패와 같은 `cherry-pick-failed` reason으로 멈춘다. ledger `fanin`은 verified가 되지 않는다.
- 보존: light 모드, verified fanin 재개, `Bouncer-Task` 기반 task commit 선택, worker 증거의 `commit_sha = sha[:8]` 검사, finalize `TaskCommitEntry`는 바뀌지 않는다.
- 문서: Provenance 항목은 "worker 브랜치와 worker SHA, 그리고 `Bouncer-Worker-Commit`으로 연결된 integration task SHA"를 구분해 적게 한다. `rules/output.md`에는 SHA를 쓸 때 `worker <branch>@<sha8>`과 `integration <sha8>`처럼 출처를 붙인다는 규칙과 예시 한 줄이 들어간다.

#### Interface

- 제공: integration 커밋 trailer `Bouncer-Worker-Commit: <40hex>`. full 모드 fan-in이 만든 커밋에만 붙는다.
- 제공: `resolveTaskCommits` 반환 값 `{ sha, sha8, workerSha: string | null }`. 같은 커밋 본문에서 `/^Bouncer-Worker-Commit\s*:\s*([0-9a-f]{40})\s*$/m`로 읽는다.
- 제공: digest `TaskDigest.commit.worker_sha: string | null`.
- 제공: 테스트 seam은 기존 `deps.execFileSync`다. coordinator의 `git(exec,cwd,args)`를 거치는 `log -1 --format=%B`와 `commit --amend` 호출을 fake exec가 가로채 실패를 주입한다.
- 거부: amend는 `git commit --amend --no-verify -m <message>`로만 한다. hook이 fan-in worktree에서 lint를 다시 돌리지 않게 한다. trailer 형식이 40자리 hex가 아니면 `workerSha`는 `null`이다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinator.ts` | `integrateCommitWave` cherry-pick 루프 | Modify | worker 메시지 그대로 cherry-pick | 성공 뒤 trailer 추가 amend | trailer 생성 지점 |
| `scripts/src/lib/task-commits.ts` | `resolveTaskCommits` | Modify | Bouncer-Task만 파싱 | 같은 본문에서 worker trailer 파싱 | 출처 연결 |
| `scripts/src/lib/finalize-digest.ts` | `TaskDigest.commit` | Modify | sha·sha8·source만 제공 | `worker_sha` 추가 | digest 노출 |
| `agents/bouncer-coordinator.md` | Output contract Provenance | Modify | worker branch·SHA만 언급 | worker·integration SHA 출처 구분 | 출력 계약 |
| `.codex/agents/bouncer-coordinator.toml` | 생성 결과 | Modify | md와 바이트 동일 | 재생성 | `test/agents.test.js:44` |
| `rules/output.md` | compact SHA 표기 | Modify | SHA 출처 규칙 없음 | 출처 접두 규칙과 예시 추가 | 보고 표기 |
| `test/coordinator-e2e.test.js` | `:289` trailer 단언 | Modify | 두 trailer만 단언 | worker trailer 값이 ledger `sha`와 같음을 단언 | 검증 지점 |
| `test/coordinator.test.js` | cherry-pick 가로채기 fake exec | Modify | cherry-pick argv만 처리 | amend용 `log`·`commit` 호출 처리와 amend 실패 단언 | 기존 fake가 새 git 호출을 받음 |
| `test/finalize-digest.test.js` | `commit` 단언 | Modify | source만 단언 | `worker_sha` 값·`null` 경로 단언 | digest 계약 |

#### Constraints

- trailer는 기존 trailer 블록의 마지막 줄 바로 뒤에 붙인다. 마지막 문단이 trailer 블록이 아니면 빈 줄 하나를 두고 새 블록으로 붙인다.
- 커밋 author와 date는 cherry-pick 결과를 유지한다. `--reset-author`를 쓰지 않는다.
- `agents/bouncer-coordinator.md`를 고친 뒤 TOML은 `mdToCodexToml` 결과와 바이트 단위로 같아야 한다.

### EPIC-098/BP-001/TASK-004 · `1740959c`

#### Goal & intent

새 `bouncer metrics` 명령이 coordinator 세션과 plan context-review 호출을 main worktree의 `.bouncer/runtime/drive-metrics.json`에 기록한다. 기록 항목은 시작·종료 시점, 원장 진행 차이(완료 task, 예외 판단 수, 원장 hash), 호스트가 준 토큰·시간, 비용 또는 비용을 내지 못한 사유다. `coordinate status` checkpoint는 같은 blueprint의 coordinator 세션 기록을 `sessions[]`로 노출한다. `/bouncer-run` root는 coordinator 세션마다 start·end를 호출하고 종료 보고에 summary 합계를 쓴다. `/bouncer-plan` context review는 reviewer 호출마다 같은 기록을 남긴다. 이 BP의 CHANGELOG 항목도 이 task가 쓴다. 완료 판정은 Checklist의 CLI 테스트와 `npm run ci`다.

#### Current behavior

- CLI 등록: `COMMANDS`(`scripts/src/lib/cli.ts:33-75`)에 `import x = require(...)`와 키 하나를 추가한다. 최소 모양은 `scripts/src/lib/cli-retro-command.ts`(`export = { run, usage: USAGE_BLOCK }` `:165`, usage 2칸 들여쓰기 `:29-33`, `parseFlags`, 알 수 없는 플래그는 stderr usage와 exit 2)다. JSON 출력은 `io.out(JSON.stringify(result,null,2)+'\n')`와 `result.ok ? 0 : 1`이다.
- 원장(`.bouncer/runtime/coordinator.json`, integration worktree 기준, `scripts/src/lib/runtime-state.ts:376`, `:1035`)의 `decisions`는 append-only 배열이다. decision `kind`: `dispatch`, `report`, `stale-report`, `stale-lease`, `repair`, `supplement`, `rerecord`, `critical-recovery`, `fanin`, `fanin-verification-failed`, `revoke`(`scripts/src/lib/lease.ts:19,110`)이고 `record --decision`은 kind 없이 `{task, decision}`이다. `rework`·`scope_revision`·`task_change`·`blocked`는 report `outcome`이다(`REPORT_OUTCOMES`, `coordinator.ts:52`). `ledger.revision`은 repair 경로에서만 올라 대개 `null`이다.
- checkpoint: `CoordinatorCheckpoint`(`coordinator.ts:223-233`), `projectCheckpoint`(`:539-583`), `withCheckpoint`(`:594-598`). `status` 분기(`:2968-2979`)는 lock 없이 원장을 읽는다. `validateCoordinatorCheckpoint`(`runtime-state.ts:389-458`)는 모르는 키를 허용한다. `coordinator-input.ts:40`이 checkpoint를 `--write-input` 파일에 넣는다.
- main worktree 경로는 `bouncer project-root`가 쓰는 `runtimePaths(repoRoot).projectRoot`(`scripts/src/lib/cli-project-commands.ts:299-307`)로 얻는다. `.bouncer/runtime/`은 gitignore다.
- 원자적 쓰기 선례: `atomicWrite`(`coordinator.ts:396-401`), `atomicWriteFile`(`runtime-state.ts:800-820`).
- 설정: `readConfigResult`·`readCoordinatorPolicy`(`scripts/src/lib/config.ts:89`, `:150-175`)가 파싱 선례다. `test/config-help.test.js:49`는 `config --help` 키와 `docs/configuration.md`가 같아야 한다고 단언하고, 키 목록은 `scripts/src/lib/cli-config-command.ts`에 있다.
- 기존 계측: CLI에는 토큰 기록이 없다. `benchmarks/usage.cjs:67-68`은 `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_write_tokens` 이름을 쓴다. `/bouncer-run`·plan context-review 문서는 토큰·시간을 언급하지 않는다.
- 단어 수: `test/skill-bouncer-surface.test.js:107-129`는 7개 진입 skill 합계가 8665 미만이어야 한다. 현재 8663(bouncer-run 1597, bouncer-plan 2545)이다.
- 테스트: checkpoint 전체 키 집합 단언은 없다(`test/coordinator.test.js:1750`, `:1763`, `test/cli-coordinate.test.js:889-891`, `test/runtime-state.test.js:707`). `test/cli-help.test.js:9` `SUBCOMMANDS`와 `:61`이 usage 나열을 검사한다.

#### Target behavior

- 성공 `metrics start`: `--kind coordinator-session|context-review`, `--blueprint <dir>`, 선택 `--label <text>`. 기록에 `id`(`m-<16hex>`), `kind`, `blueprint`, `label`, `started_at`(ISO)을 쓴다. coordinator-session이면 그 blueprint 원장의 `decisions.length`, `completed_tasks`, 원장 sha256을 `start` snapshot으로 남긴다. 원장이 없으면 snapshot은 `null`이다. context-review이면 snapshot 대신 `--label`(perspective, 예 `r1-local-c1`)과 필수 `--target-digest <64hex>`를 남기고, 원장 진행 필드(`tasks_completed`, `exception_decisions`)는 만들지 않는다. 출력은 `{ok:true, id}`이다.
- 성공 `metrics end`: `--id`, 선택 `--tokens N`, `--input-tokens N`, `--output-tokens N`, `--model <slug>`, `--host-duration-ms N`. `ended_at`, `wall_ms`(CLI 시각 차), 같은 snapshot의 `end`를 쓴다. `tasks_completed`는 end에만 있는 완료 task id 목록이다. `exception_decisions`는 start 이후 추가된 decision 중 kind가 `stale-report`, `stale-lease`, `repair`, `supplement`, `rerecord`, `critical-recovery`, `fanin-verification-failed`, `revoke`이거나, kind `report`이면서 outcome이 `accepted`가 아닌 것의 수다.
- 값 누락: `--tokens`도 input/output도 없으면 `tokens: null, tokens_unavailable_reason: 'not-reported'`이다. `cost`는 `--model`과 input·output 토큰이 모두 있고 `config.metrics.pricing[<model>]`이 있을 때만 `input/1e6*input_per_mtok + output/1e6*output_per_mtok`로 계산한다. 아니면 `cost: null`이고 `cost_unavailable_reason`은 `no-model`, `no-token-split`, `no-pricing` 중 처음 해당하는 값이다.
- 성공 `metrics summary --blueprint <dir>`: kind별 세션 수, 토큰 합(`null` 제외)과 누락 세션 수, `wall_ms` 합, 비용 합(`null` 제외)과 누락 수, `tasks_completed` 합을 낸다.
- 성공 checkpoint: `sessions: Array<{id, label, started_at, ended_at, tasks_completed, exception_decisions, tokens}>`. 같은 blueprint의 `coordinator-session` 기록만 담는다. 파일이 없으면 `[]`이다.
- 실패: context-review에 `--target-digest`가 없거나 64 hex가 아니면 `invalid-metrics-input`이다. 알 수 없는 kind, 없는 id, 이미 끝난 id, 음수·정수가 아닌 숫자 플래그는 `{ok:false, reason:'invalid-metrics-input'|'metrics-session-not-found'|'metrics-session-ended'}`와 exit 1이다. 깨진 `drive-metrics.json`은 `metrics-file-invalid`로 거절하고 덮어쓰지 않는다. 깨진 `metrics.pricing`은 `end`에서 `cost_unavailable_reason: 'invalid-pricing'`로 기록한다.
- 보존: 원장, checkpoint의 기존 키, coordinator 동작은 바뀌지 않는다. metrics 명령은 원장을 쓰지 않는다.
- 문서: `skills/bouncer-run/references/drive-metrics.md`가 root 절차를 정한다. coordinator dispatch 직전 `metrics start`, 반환 직후 task-notification의 `subagent_tokens`를 `--tokens`로, `duration_ms`를 `--host-duration-ms`로 넘겨 `metrics end`를 호출하고, 종료 보고에 `metrics summary` 합계를 쓴다. `skills/bouncer-plan/references/context-review.md`도 reviewer 호출마다 kind `context-review`로 같은 순서를 따른다. `skills/bouncer-run/SKILL.md`는 이 reference를 한 줄로 가리킨다.

#### Interface

- 제공: `bouncer metrics start|end|summary`(위 플래그). usage 블록과 `--help`.
- 제공: `.bouncer/runtime/drive-metrics.json` `{ version: 1, sessions: MetricsSession[] }`(main worktree 기준). `MetricsSession`은 위 필드를 갖는다.
- 제공: 설정 `metrics.pricing: { [model: string]: { input_per_mtok: number, output_per_mtok: number } }`. `docs/configuration.md`와 `config --help`에 문서화한다.
- 제공: `CoordinatorCheckpoint.sessions`.
- 제공: 테스트 seam. `now: () => Date`와 `randomId: () => string`을 metrics 모듈 함수 인자로 받는다.
- 거부: 호스트가 주지 않은 토큰·시간·비용을 추정해 쓰는 경로. 토큰 합계는 `null`을 0으로 세지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/drive-metrics.ts` | 신규 추출 지점: 세션 기록·요약 | Create | 없음 | 파일 읽기·쓰기, snapshot 차이, 비용 계산 | 계측 계약 |
| `scripts/src/lib/cli-metrics-command.ts` | `run`, `USAGE_BLOCK` | Create | 없음 | 세 하위 명령 파싱·출력 | CLI 진입점 |
| `scripts/src/lib/cli.ts` | `COMMANDS` | Modify | metrics 없음 | `metrics` 등록 | 명령 등록 |
| `scripts/src/lib/coordinator.ts` | `CoordinatorCheckpoint`, `projectCheckpoint` | Modify | sessions 없음 | `sessions[]` 투영 | checkpoint 노출 |
| `scripts/src/lib/config.ts` | 신규 추출 지점: pricing 읽기 | Modify | pricing 없음 | `metrics.pricing` 파싱 | 비용 입력 |
| `scripts/src/lib/cli-config-command.ts` | 설정 키 목록 | Modify | metrics 키 없음 | `metrics.pricing` 추가 | `test/config-help.test.js:49` |
| `docs/configuration.md` | 설정 표 | Modify | metrics 키 없음 | `metrics.pricing` 문서화 | 설정 문서 |
| `skills/bouncer-run/references/drive-metrics.md` | root 기록 절차 | Create | 없음 | start·end·summary 절차 | run 절차 |
| `skills/bouncer-run/SKILL.md` | coordinator dispatch 절 | Modify | 계측 언급 없음 | reference 한 줄 추가, 같은 수 이상의 단어 정리 | 진입 skill |
| `skills/bouncer-plan/references/context-review.md` | reviewer 호출 절 | Modify | 계측 언급 없음 | 호출별 기록 단계 | plan 리뷰 계측 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | BP 001 항목 없음 | BP 001 변경 요약 | 프로젝트 규칙 |
| `test/cli-metrics.test.js` | metrics 명령 테스트 | Create | 없음 | 성공·누락·실패 경로 단언 | 검증 지점 |
| `test/coordinator.test.js` | status checkpoint | Modify | sessions 단언 없음 | `sessions` 투영 단언 | checkpoint 계약 |
| `test/cli-help.test.js` | `SUBCOMMANDS` | Modify | metrics 없음 | `metrics` 추가 | usage 나열 검사 |

#### Constraints

- 진입 skill 단어 수 합계는 8665 미만을 유지한다. `skills/bouncer-run/SKILL.md`에 더한 단어만큼 같은 파일의 기존 문장을 줄인다. 기준선 숫자는 바꾸지 않는다.
- `drive-metrics.json` 쓰기는 임시 파일 뒤 rename으로 한다.
- metrics 명령은 원장과 계획 문서를 읽기만 한다.
- CHANGELOG 항목은 TASKS-002를 포함해 선행 task가 모두 통합된 뒤 BP 001의 일곱 task 변경을 `### Changed` 아래 기존 항목 형식(굵은 제목 + `(EPIC 098 BP 001)`)으로 쓴다.

### EPIC-098/BP-001/TASK-005 · `7cbdf1fe`

#### Goal & intent

full 드라이브의 `coordinate report`는 활성 dispatch의 worker 보고 파일을 직접 읽는다. 파일이나 `## Brief revision`의 값이 없으면 `report-revision-missing`으로, 파일 값과 CLI 인자가 다르면 `report-revision-conflict`로, `## Open choices`나 `## Known weaknesses` 제목이 없으면 `report-section-missing`으로 거절한다. 세 거절 모두 원장에 쓰지 않고 attempt는 열린 채로 남는다. 통과한 보고의 `## Open choices`와 `## Known weaknesses` 항목은 `ReportDecision.open_choices`·`known_weaknesses`에 저장된다. light 모드의 inline 보고는 지금처럼 동작한다. 완료 판정은 Checklist의 coordinator 테스트와 `npm run ci`다.

#### Current behavior

- `coordinate report` 분기(`scripts/src/lib/coordinator.ts:3417-3466`)의 검사 순서: `no-active-dispatch` → `invalid-attempt` → `invalid-task-brief-hash`(64 hex) → `invalid-report-outcome` → `summary-required` → light 전용 `light-review-required`(`:3434-3437`) → expected/received 불일치면 `StaleReportDecision`을 쓰고 `stale-report`(`:3438-3453`) → 수락하면 dispatch `reported`와 `ReportDecision{task,kind,attempt,task_brief_hash,outcome,summary}`(`:3455-3462`, 타입 `:78-86`). 앞선 거절은 아무것도 쓰지 않는다.
- 이 분기는 보고 파일을 읽지 않는다. 파일 경로는 `reportPathFor(workerPath, task, attempt)` = `<workerPath>/.bouncer/runtime/reports/<task>-<attempt>.md`(`:189`)이고, `coordinate dispatch`가 항상 `report_path`로 돌려준다(`:3412-3414`). `observeReport`(`:203-211`)는 status 투영용 존재 검사만 한다.
- `coordinate next`의 보고 증거 포인터는 다른 경로 `<workerPath>/<blueprint>/tasks/<id>/report.md`를 가리킨다(`scripts/src/lib/coordinate-next.ts:268-276`의 `defaultEvidenceCandidates`). report argv는 활성 dispatch 값으로 `--attempt`·`--task-brief-hash`를 미리 채운다(`:820-830`).
- implementer 보고 형식(`agents/bouncer-implementer.md:136-161`)은 `- **Name** — …` bullet 목록이고 `##` 제목이 없다. Brief revision은 `- **Brief revision** — echo the \`attempt\` and \`task_brief_hash\` …` 한 줄이며 값의 형식이 정해져 있지 않다. 파일 기록은 `report_path`가 입력에 있을 때만 한다(`:107-111`).
- record 카드(`references/coordinator-cards/record.md:14`)도 "A missing or mismatched Brief revision is stale"이라 쓴다. `test/coordinate-next.test.js:1333-1375`는 카드 본문을 합쳐 regex로 검사하므로 두 카드의 모순을 잡지 못한다.
- report 카드(`references/coordinator-cards/report.md:10-13`)는 "A missing or mismatched Brief revision is stale"이라 쓰고 received 값으로 report를 호출하라고 한다. 값이 없으면 넘길 received가 없다.
- Cursor print(`rules/cursor-print-dispatch.md:46`)에서 보고는 `dispatch print` JSON의 `report` 필드다. `scripts/src/lib/print-dispatch.ts:350-365`는 파일을 쓰지 않는다.
- light 모드는 root가 inline 구현 후 직접 report를 호출한다(`skills/bouncer-run/references/light-run.md:10-15`, `:38-41`). 모드 판정은 `ledgerModeOf(ledger) === 'light'`(`coordinator.ts:3434`)다.
- 재사용할 파서: `parseSections(body, defs)`(`scripts/src/lib/validate-sections.ts:135`, export `:446-460`)는 `##` 제목으로 나누고 HTML 주석을 제거한다.
- 테스트: 어떤 테스트도 report 전에 보고 파일을 쓰지 않는다. `test/coordinator.test.js`의 `acceptDispatchReport`(`:86-100`)와 `:1396`, `:1433`(stale), `:1469`, `:1499`, `:1514`, `:1543`, `:1775`, `:1824`, `:1854`, `:2064`, light `:3005`, `:3091`, `:3108-3130`, `:3172`; `test/coordinate-next.test.js` helper `:60-72`와 `:570`, `:590`, `:612`, `:629`, `:1010`; `test/coordinator-e2e.test.js` helper `:190-200`와 `:753`(light `:1021`); `test/cli-coordinate.test.js:192`, `:507-529`, `:639`; `test/native-profile-e2e.test.js:189`(CLI `coordinate report`).

#### Target behavior

- 성공: full 모드에서 기존 다섯 형식 검사 뒤 활성 dispatch attempt의 `reportPathFor` 파일을 읽는다. `## Brief revision`의 `attempt`·`task_brief_hash`가 CLI 인자와 같으면 기존 stale 비교와 수락으로 진행한다. 수락한 `ReportDecision`에 `open_choices: string[]`, `known_weaknesses: string[]`가 붙는다. 항목이 `none` 한 줄이면 빈 배열이다.
- 실패: 파일이 없거나, `## Brief revision` 제목이 없거나, 두 값 중 하나라도 없거나 형식이 틀리면 `{ok:false, reason:'report-revision-missing', report_path}`이다. 파일 값과 CLI 인자가 다르면 `{ok:false, reason:'report-revision-conflict', file:{attempt,task_brief_hash}, args:{…}}`이다. 두 경우 모두 원장을 쓰지 않고 dispatch는 `active`로 남는다. outcome이 accepted가 아니어도 같은 검사를 한다.
- 실패: `## Open choices` 또는 `## Known weaknesses` 제목이 없으면 `report-revision-missing`과 같은 방식으로 `report-section-missing`(누락 제목 목록 포함)을 낸다.
- 보존: light 모드는 파일을 읽지 않고 `light-review-required`를 포함해 기존 순서대로 동작한다. `stale-report` 기록·`invalid-*` 거절·report argv 미리 채우기는 바뀌지 않는다.
- 보존: `coordinate next`의 보고 증거 포인터는 `reportPathFor`와 같은 경로를 가리킨다.
- 문서: implementer 보고 형식은 기존 필드(Changed files, Checklist coverage, Tests, Red run, Deviations, Scope impact, Needs planning, Brief revision)마다 `## <Name>` 제목을 쓰고, 새 필드 `## Open choices`와 `## Known weaknesses`를 추가한다. 값이 없으면 `- none` 한 줄을 쓴다. `## Changed files`의 각 항목은 ``- `<repo 상대 경로>` — <목적>`` 형식으로 경로를 backtick으로 감싼다. Brief revision 값의 형식은 아래처럼 고정한다. report 카드와 record 카드는 누락을 stale로 처리하지 않고 `report-revision-missing`이면 같은 attempt를 다시 dispatch하거나 worker에게 보고 파일 보완을 요구하게 한다. cursor print 규칙은 implementer에게 `report_path`를 넘기고 그 파일을 쓰게 한다.
  ```markdown
  ## Changed files
  - `scripts/src/lib/config.ts` — 환경변수 공백 처리

  ## Brief revision
  attempt: 2
  task_brief_hash: <64 hex>

  ## Open choices
  - 환경변수 값의 앞뒤 공백을 제거한다.

  ## Known weaknesses
  - none
  ```

#### Interface

- 제공: `coordinate report` 실패 reason `report-revision-missing`, `report-revision-conflict`, `report-section-missing`. 각 reason은 `COORDINATE_FAILURE_HINTS`에 `cause`·`next`를 갖는다.
- 제공: `ReportDecision.open_choices?: string[]`, `ReportDecision.known_weaknesses?: string[]`. full 모드 수락 기록에만 있다.
- 제공: 보고 파일 파서. 이름은 구현자가 정한다(신규 추출 지점: report 파일 섹션 파싱). 모양은 `(body: string) => { revision: {attempt:number, task_brief_hash:string} | null, open_choices: string[] | null, known_weaknesses: string[] | null }`이고 `null`은 제목 부재를 뜻한다.
- 제공: `defaultEvidenceCandidates(workerPath, blueprint, taskId, attempt)`. `attempt`는 호출부(`coordinate-next.ts:673`)가 활성 dispatch의 `attempt`로 넘기고, 보고 경로는 coordinator의 `reportPathFor`를 import해 만든다. 활성 dispatch가 없으면 보고 후보를 만들지 않는다.
- 용어: Brief revision 값 줄은 `^attempt:\s*(\d+)\s*$`, `^task_brief_hash:\s*([a-f0-9]{64})\s*$`에 맞는 줄이다. 예: `attempt: 2`.
- 거부 (throw 없음): 위 세 reason은 모두 `{ok:false}` 반환이다. 파일 읽기 오류 중 `ENOENT`는 `report-revision-missing`이고, 그 밖의 읽기 오류는 기존 coordinator 오류 처리로 던진다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinator.ts` | `report` 분기, `ReportDecision`, `COORDINATE_FAILURE_HINTS` | Modify | CLI 인자만 검사 | full 모드 보고 파일 검사·open_choices 저장·hint 추가 | 상태 변경 지점 |
| `scripts/src/lib/coordinate-next.ts` | `defaultEvidenceCandidates` | Modify | `tasks/<id>/report.md`를 가리킴 | `reportPathFor` 경로로 맞춤 | 보고 경로 불일치 |
| `agents/bouncer-implementer.md` | Output contract | Modify | bullet 형식, revision 값 형식 없음, 열린 선택·약점 필드 없음 | `##` 제목 형식, Open choices·Known weaknesses 필드 추가, Changed files 항목의 backtick 경로 형식과 revision 값 형식 고정 | worker 보고 계약 |
| `.codex/agents/bouncer-implementer.toml` | 생성 결과 | Modify | md와 바이트 동일 | 재생성 | `test/agents.test.js:68-76` |
| `references/coordinator-cards/report.md` | Brief revision 처리 | Modify | 누락을 stale로 처리 | 새 reason별 다음 행동 | 판단 카드 |
| `references/coordinator-cards/record.md` | `:14` Brief revision 규칙 | Modify | 누락·불일치를 stale로 처리 | 누락은 `report-revision-missing` 처리, 불일치만 stale로 남김 | report 카드와 같은 사례의 규칙 일치 |
| `rules/cursor-print-dispatch.md` | Report 항목 | Modify | 보고는 JSON 필드만 | implementer가 `report_path` 파일도 쓰게 함 | print 경로 |
| `test/coordinator.test.js` | report helper·새 reason 테스트 | Modify | 보고 파일 없이 report | helper가 보고 파일을 쓰고 새 reason·light 보존 단언 | 검증 지점 |
| `test/coordinate-next.test.js` | report helper·증거 포인터 | Modify | 보고 파일 없이 report | helper가 보고 파일을 쓰고 포인터 경로 단언 | 기존 테스트가 새 검사에 걸림 |
| `test/coordinator-e2e.test.js` | report helper | Modify | 보고 파일 없이 report | full helper가 보고 파일을 씀 | 기존 테스트가 새 검사에 걸림 |
| `test/cli-coordinate.test.js` | report 호출 | Modify | 보고 파일 없이 report | 보고 파일을 쓰고 호출 | 기존 테스트가 새 검사에 걸림 |
| `test/native-profile-e2e.test.js` | `:189` CLI report 호출 | Modify | 보고 파일 없이 full report | 호출 전 보고 파일을 씀 | 기존 테스트가 새 검사에 걸림 |

#### Constraints

- 보고 파일 위치는 `reportPathFor(item.workerPath, task, item.dispatch.attempt)`이다. CLI 인자의 attempt로 경로를 만들지 않는다.
- 보고 파일 검사는 `stale-report` 비교보다 먼저 한다. 파일 값이 CLI 인자와 같을 때만 기존 stale 비교가 의미를 갖는다.
- 활성 dispatch 값으로 파일 값을 채우거나, 누락을 accepted로 처리하는 경로를 만들지 않는다.
- `agents/bouncer-implementer.md`를 고친 뒤 TOML은 `mdToCodexToml` 결과와 바이트 단위로 같아야 한다.

### EPIC-098/BP-001/TASK-006 · `5beb716c`

#### Goal & intent

`bouncer finalize prepare` digest의 `tasks[]` 항목이 coordinator 원장에서 해당 task의 마지막 accepted `ReportDecision`이 가진 `open_choices`·`known_weaknesses`를 `worker_notes`로 싣는다. `pr.sections.review_points`는 이 값을 리뷰 포인트로 포함한다. explain 지침은 열린 선택을 drive 실행 기록이 아닌 코드 동작 설명으로 다루게 한다. 원장이 없거나 light이거나 값이 없으면 `worker_notes` 키가 없다. 완료 판정은 Checklist의 digest·PR 테스트와 `npm run ci`다.

#### Current behavior

- `FinalizeDigest`(`scripts/src/lib/finalize-digest.ts:84-110`)의 per-task 정보는 `TaskDigest`(`:51-67`: `stable_id,id,title,execution_kind,status,commit,affected_paths,verification,review,constraints`)이고 task 문서에서 만든다.
- 원장은 `:577`에서 한 번 읽어 `:600`의 `ledger`에 둔다. `body`(`:891-927`)를 만든 뒤 `pr: buildPrDraft(body, …)`(`:932`)를 호출하고, 그 뒤에 `drive: summarizeDrive(ledger)`(`:937`)를 붙인다. `:936` 주석은 원장 데이터를 PR 초안 입력에서 빼기 위한 순서라고 설명한다. `summarizeDrive`(`:518-540`)는 `{ready, tasks:[{id,status,sha}]}`만 낸다.
- `buildPrDraft`(`scripts/src/lib/finalize-pr.ts:315-358`)의 입력은 digest record뿐이다. `review_points`는 `buildReviewPoints({out_of_scope,tasks,unverified,blueprint_review})`(`:262-`)가 만들고 `tasks[].review.findings`를 읽는다.
- `skills/bouncer-finalize/SKILL.md:44-47`: "Do not invent Explain, Quiz, or PR inputs from the coordinator ledger … that digest is the sole factual input". digest를 거치는 원장 값은 이 규칙과 맞는다.
- `references/explain-diff/index.md:31-33`과 `skills/bouncer-finalize/references/explain-quiz.md:11`은 drive 실행 기록(task split, worker branch·sha, integration head)을 Explain에 쓰지 않게 한다. `skills/bouncer-finalize/references/draft-pr.md`의 `리뷰 포인트` 행은 digest `pr.sections.review_points`를 먼저 쓴다.
- 이 task 시작 시점의 `ReportDecision`은 TASKS-005가 추가한 `open_choices?: string[]`, `known_weaknesses?: string[]`를 가진다.
- 테스트: `test/finalize-digest.test.js:175`(`d.drive === null`), `:209`(drive fixture, `:259-262` `deepStrictEqual(d.drive, …)`), `test/finalize-pure.test.js:1079-1145`(`summarizeDrive`), `test/finalize-pr.test.js:59`, `:83`, `:174`. digest 전체 키 집합 단언은 없다.

#### Target behavior

- 성공: full 원장에 task의 accepted `ReportDecision`이 있고 두 배열 중 하나라도 비어 있지 않으면 `TaskDigest.worker_notes = { open_choices: string[], known_weaknesses: string[] }`이다. accepted 보고가 여러 개면 마지막 것만 쓴다.
- 성공: `review_points`에 열린 선택마다 `구현 선택(<task id>): <항목>`, 약점마다 `알려진 약점(<task id>): <항목>`이 기존 finding 뒤, unverified 앞에 들어간다.
- 생략: 원장이 `null`이거나 `mode`가 light이거나 해당 task에 값이 없으면 `worker_notes` 키를 만들지 않고 리뷰 포인트도 없다.
- 보존: `drive` 요약 모양, `summarizeDrive`, 기존 리뷰 포인트 순서, `coordinator` 키와 `tasks[].actual_paths` 미노출은 그대로다.
- 문서: explain 지침 두 곳에 "digest `tasks[].worker_notes`는 drive 실행 기록이 아니다. `## Code`에서 해당 동작의 설계 선택·한계로 설명한다"를 넣는다. `draft-pr.md`의 `리뷰 포인트` 행은 이 항목이 digest에서 온다고 적는다.

#### Interface

- 제공: `TaskDigest.worker_notes?: { open_choices: string[]; known_weaknesses: string[] }`.
- 제공: 원장 → task 대응 함수. 이름은 구현자가 정한다(신규 추출 지점: 원장 보고 메모 추출). 모양은 `(ledger: unknown) => Map<string, {open_choices:string[], known_weaknesses:string[]}>`이고, 키는 `TaskDigest.id` 형식(`TASKS-001`)이다. 원장 `ReportDecision.task`는 세 자리 번호(`'001'`)이므로 `TASKS-${task}`로 바꿔 넣는다. `TASKS-` 접두가 이미 있으면 그대로 쓴다. 원장 모양이 틀리면 빈 Map이다.
- 거부: 원장의 다른 필드(summary, dispatch, fanin)를 digest나 PR 초안에 싣지 않는다. 문자열이 아닌 배열 항목은 버린다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/finalize-digest.ts` | `TaskDigest`, `prepareFinalizeDigest` | Modify | task 문서에서만 task 항목 생성 | 원장 보고 메모를 `worker_notes`로 결합 | digest 노출 지점 |
| `scripts/src/lib/finalize-pr.ts` | `buildReviewPoints` | Modify | finding·out_of_scope·unverified만 | `worker_notes` 항목 추가 | PR 초안 |
| `references/explain-diff/index.md` | Background·Code 규칙 | Modify | drive 기록 금지만 | `worker_notes` 취급 규칙 추가 | explain 지침 |
| `skills/bouncer-finalize/references/explain-quiz.md` | `:11` 규칙 | Modify | drive 기록 금지만 | 같은 규칙 추가 | explain 지침 |
| `skills/bouncer-finalize/references/draft-pr.md` | `리뷰 포인트` 행 | Modify | digest review_points 사용 | 새 항목의 출처 명시 | PR 지침 |
| `test/finalize-digest.test.js` | drive fixture | Modify | worker_notes 없음 | 값 있음·light·값 없음 단언 | 검증 지점 |
| `test/finalize-pr.test.js` | review_points | Modify | 새 항목 없음 | 순서와 문구 단언 | 검증 지점 |

#### Constraints

- `buildPrDraft`의 입력은 digest record로 유지한다. `worker_notes`는 `body.tasks`를 통해서만 전달한다.
- 원장은 기존 `:577`의 한 번 읽기 결과를 재사용한다. 새 파일 읽기를 추가하지 않는다.
- 진입 skill `SKILL.md` 단어 수를 늘리지 않는다.

### EPIC-098/BP-001/TASK-007 · `48ca245e`

#### Goal & intent

full 모드 commit wave의 `coordinate integrate`는 integration checkout에 허용 경로 밖의 미커밋 변경이 있으면 `integration-source-mutated`로 거절한다. 허용 경로는 seed manifest 경로와 이미 integrated된 task의 evidence 문서다. 통합하는 worker 커밋의 변경 경로가 보고 파일 `## Changed files`와 다르면 실패 없이 `warnings`에 남긴다. coordinator 역할 문서는 CI·검사 실패를 `coordinate repair` worker task로만 고친다고 명시한다. report 카드는 보고 수락 전에 Contract의 저장 위치·상태 소유권·인터페이스 문구를 보고의 변경 파일·편차와 대조하게 한다. 완료 판정은 Checklist의 coordinator 테스트와 `npm run ci`다.

#### Current behavior

- full 모드 integrate: `coordinate`(`scripts/src/lib/coordinator.ts:2982`) → `integrateTask`(`:2003`) → `integrateCommitWave`(`:2426`). 이 함수는 light 분기(`:2438`), lock 아래 fanin 복구(`:2449`), phase 1 lock(`:2503`: fence, lease, nothing-to-integrate, `stale-integration-head` `:2545`, task별 `sha-not-owned-by-worker`·`checkWorkerEvidence` `:2550-2565`, `fanin: building` 기록), phase 2(fanin worktree, seed, cherry-pick, wave verify), `finishFaninAfterFf`(`:2714`) 순서로 진행한다.
- integrate는 HEAD만 비교하고 integration checkout의 dirty tree를 보지 않는다. 기존 `sourceStatus`(`:635`)는 main checkout의 `git status --porcelain` 전후 snapshot을 비교하는 용도다(`main-source-mutated`, `:2887`, `:2918`).
- `copyEvidenceBundle`(`:1459`, `:2795`에서 ff 뒤 호출)은 `<blueprint>/tasks/<NNN>/{tasks.md, verification.md, review.md}`만 복사한다. review 모드에서는 `review.md`를 뺀다(`evidenceFiles`, `:1237`). 이 파일들은 커밋되지 않고 wave 사이에 dirty로 남는다.
- `seedIntegration`(`scripts/src/lib/seed-worktree.ts:427-469`)은 blueprint 디렉터리, `<epic>/index.md`, `.bouncer/context/index.md`를 복사한다. 계획이 미커밋이면 이 경로가 dirty이며 `ledger.seedManifest`(`coordinator.ts:2950`)에 경로·해시가 있다. `.bouncer/runtime/`, `.bouncer/config.json`, `node_modules`, `.worktrees/`는 gitignore라 porcelain에 나오지 않는다.
- porcelain 경로 파싱 선례는 `onlyTaskBriefDirty`·`dirtyPaths`(`scripts/src/lib/coordinate-next.ts:376`, `:817`)다.
- coordinate JSON에는 warnings 채널이 없다. integrate 성공 모양은 `{ok, command, integrated, integrationHead, verification, ready, checkpoint}`(`:2802-2811`)이다. 다른 명령은 비어 있으면 `warnings` 키를 생략한다(`scripts/src/lib/validate.ts:394-396`). 새 reason은 `COORDINATE_FAILURE_HINTS`(`:3677`)에 등록한다.
- 보고 파일은 `reportPathFor(item.workerPath, task, item.dispatch.attempt)`(`:189`)로 찾는다. 이 task 시작 시점에는 TASKS-005가 implementer 보고를 `## Changed files` 등 `##` 제목 형식으로 바꾼 상태다.
- 문서: `agents/bouncer-coordinator.md:96-120`은 terminal CI 복구를 `coordinate repair`로 적고, `:132-146`은 worker 역할 직접 수행을 금지한다. CI 실패를 coordinator가 직접 고치지 말라는 문구는 없다. `references/coordinator-cards/report.md`에는 Contract 대조 항목이 없다.
- 테스트: integration checkout이 dirty인 채 integrate하는 fixture는 `test/coordinator-e2e.test.js:481`(미커밋 계획), `:807`, `:849`(다중 wave·재개)와 `test/coordinator.test.js:1089` `recordedDrive`(미커밋 계획)를 쓰는 `:2275`~`:2481`, `:2639`, `:1113`, `:1144`, `:1183`, `:1254`, `test/cli-coordinate.test.js:616`, `test/native-profile-e2e.test.js:205`, 그리고 integration 파일을 고치는 `test/coordinator.test.js:505`, `:522`, `:564`, `:676`, `:824`, `:2537`, `:2583`(verification 경로)이다.

#### Target behavior

- 성공: phase 1 lock에서 fence 검사 뒤, `fanin` 기록 전에 integration checkout의 `git status --porcelain --untracked-files=all` 경로가 모두 허용 경로이면 기존 흐름으로 진행한다.
- 실패: 허용 경로 밖 경로가 하나라도 있으면 `{ok:false, reason:'integration-source-mutated', paths:[…]}`를 내고 ledger를 쓰지 않는다. hint의 `next`는 "변경을 worker task나 `coordinate repair`로 옮기고, 직접 수정분은 되돌린 뒤 integrate를 다시 호출한다"이다.
- 경고: 각 통합 task에 대해 worker 커밋의 `git diff-tree --no-commit-id --name-only -r <sha>` 경로에서 `<blueprint>/tasks/<NNN>/` 아래 경로를 뺀 집합과 보고의 `## Changed files` 경로 집합이 다르면 성공 결과에 `warnings: [{task, code:'report-paths-mismatch', missing:[…], extra:[…]}]`를 붙인다. 보고 파일이나 제목이 없으면 `{task, code:'report-changed-files-unavailable'}`이다. 경고가 없으면 `warnings` 키를 생략한다.
- 생략: light 모드, verification 노드 integrate, verified fanin 재개(`finishFaninAfterFf`)에는 dirty 검사를 적용하지 않는다.
- 보존: 기존 fence·lease·head·worker 소유·evidence 검사 순서와 reason, `copyEvidenceBundle` 동작은 바뀌지 않는다.
- 문서: coordinator 역할 문서에 "CI·lint·단어 수 같은 검사 실패도 coordinator가 파일을 고치지 않는다. task 범위 안이면 rework, 종단 실패면 `coordinate repair`로 worker가 고친다"를 넣고 TOML을 재생성한다. report 카드에 Contract 대조 항목을 넣는다. 불일치면 `rework` 또는 `scope_revision`이고 `accepted`가 아니다.

#### Interface

- 제공: `coordinate integrate` 실패 reason `integration-source-mutated`(`paths: string[]` 포함)와 hint.
- 제공: integrate 성공 결과의 선택 키 `warnings?: Array<{task:string, code:'report-paths-mismatch', missing:string[], extra:string[]} | {task:string, code:'report-changed-files-unavailable'}>`. `missing`은 보고에만 있는 경로, `extra`는 커밋에만 있는 경로다.
- 용어: 허용 경로는 `ledger.seedManifest`의 경로와, 현재 status가 `integrated`인 task의 `evidenceFiles` 경로의 합집합이다. 예: `.bouncer/context/epics/098-x/blueprints/001-y/tasks/001/tasks.md`.
- 용어: `## Changed files` 경로는 그 제목 아래 `- ` 항목의 첫 backtick 구간이다. 이 형식은 TASKS-005가 implementer 보고 계약에 고정한다. backtick이 없는 항목은 경로 집합에서 빠지고 `missing`·`extra` 비교에 그대로 반영된다. 예: ``- `scripts/src/lib/coordinator.ts` — report 검사`` → `scripts/src/lib/coordinator.ts`.
- 제공: dirty 경로 수집 seam은 기존 `deps.execFileSync`를 통한 `git()` 호출이다.
- 거부: 허용 경로를 `.bouncer/context/**` 같은 넓은 prefix로 정하지 않는다. 경고를 실패로 승격하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinator.ts` | `integrateCommitWave`, `COORDINATE_FAILURE_HINTS` | Modify | HEAD만 비교 | phase 1 dirty 검사, 보고 경로 대조 경고, hint | 상태 변경 지점 |
| `agents/bouncer-coordinator.md` | repair·worker 역할 절 | Modify | CI 직접 수정 금지 문구 없음 | 검사 실패의 worker 경로 명시 | 역할 절차 |
| `.codex/agents/bouncer-coordinator.toml` | 생성 결과 | Modify | md와 바이트 동일 | 재생성 | `test/agents.test.js:44` |
| `references/coordinator-cards/report.md` | 수락 판단 항목 | Modify | Contract 대조 없음 | 저장 위치·상태 소유권·인터페이스 대조 추가 | W08 |
| `test/coordinator.test.js` | dirty 검사·경고 테스트와 기존 integrate fixture | Modify | dirty 검사 없음 | 거절·허용·경고·생략 단언, 기존 fixture가 허용 경로만 dirty인지 확인 | 검증 지점 |
| `test/coordinator-e2e.test.js` | 다중 wave·미커밋 계획 | Modify | dirty 검사 없음 | 두 번째 wave가 evidence dirty 상태로 통과함을 단언 | 허용 경로 회귀 |
| `test/cli-coordinate.test.js` | `:616` CLI integrate fixture | Modify | dirty 검사 없음 | 허용 경로 밖 dirty 파일이 있으면 커밋하거나 지움 | 기존 fixture가 새 검사에 걸릴 수 있음 |
| `test/native-profile-e2e.test.js` | `:205` CLI integrate | Modify | dirty 검사 없음 | 같은 정리 | 기존 fixture가 새 검사에 걸릴 수 있음 |

#### Constraints

- dirty 검사는 `fanin` 상태를 쓰기 전에 끝난다. 거절 시 ledger 바이트가 호출 전과 같다.
- rename porcelain 항목(`R  a -> b`)은 두 경로를 모두 검사한다.
- 경고는 결과 JSON에만 남기고 ledger에 쓰지 않는다.
- `agents/bouncer-coordinator.md`를 고친 뒤 TOML은 `mdToCodexToml` 결과와 바이트 단위로 같아야 한다.

### EPIC-098/BP-001/TASK-008

#### Goal & intent

TASKS-001~007이 모두 integrated된 integration checkout에서 `npm run ci`가 성공함을 증명한다. 빌드 stamp, launcher, coordinator, finalize, 역할 TOML, 단어 수, 커버리지 하한이 함께 맞는지 한 번에 확인한다.

#### Interface

- 제공: 선행 task가 모두 통합된 상태에서 verify 명령이 남기는 종단 검증 증적.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.