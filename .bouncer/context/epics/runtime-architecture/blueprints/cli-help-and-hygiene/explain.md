---
type: bouncer.explain
title: cli-help-and-hygiene explain
description: Explain for cli-help-and-hygiene
resource: .bouncer/context/epics/runtime-architecture/blueprints/cli-help-and-hygiene/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-21T14:06:02.836+09:00'
bouncer:
  id: EXPLAIN-cli-help-and-hygiene
  epic_id: runtime-architecture
  blueprint_id: cli-help-and-hygiene
  status: published
  comprehension:
    - range_from: d2af67192ec335d8d287b28a22e8f3b3ab2c290a
      range_to: 01a51f2e01055008fc57fcd52f662249f9424b17
      diff_sha: 805f4e768d1866654c52be23ec56abb1083b33fb07a3fe2a95e0ad31fb561038
      recorded_at: '2026-10-21T14:12:00+09:00'
  task_commits:
    - task: runtime-architecture/cli-help-and-hygiene/001
      sha: c4ea51f7
      intent_anchor: task-001
    - task: runtime-architecture/cli-help-and-hygiene/002
      sha: 8fa51261
      intent_anchor: task-002
    - task: runtime-architecture/cli-help-and-hygiene/003
      sha: 0d6f01b4
      intent_anchor: task-003
    - task: runtime-architecture/cli-help-and-hygiene/004
      sha: 94e73e1c
      intent_anchor: task-004
    - task: runtime-architecture/cli-help-and-hygiene/005
      sha: b6975252
      intent_anchor: task-005
    - task: runtime-architecture/cli-help-and-hygiene/007
      sha: 01a51f2e
      intent_anchor: task-007
---
# Explain

## Background

일부 서브명령은 `--help`를 받으면 도움말 대신 실제로 실행됐다. `init`·`graph-sync`·`current`·`import`가 저장소를 바꾸거나 exit 2 오류로 끝났다. 도움말을 보려던 사용자가 부작용을 만나는 구조였다.

같은 논리가 여러 벌로 갈라져 있기도 했다. 테스트 원장 fence helper, help 요청 판정, tasks 문서 타입, 경로 정규화가 각각 복제돼 한쪽만 고치면 다른 쪽이 어긋났다. 폐기한 이름을 검사하는 테스트는 레거시 감지기 소스를 고정 경로로 허용해, 파일이 옮겨지면 허용이 깨졌다. 이전 소스 재구성의 inventory 문서에는 "후" 열이 `미측정`으로 남아 있었다.

## Code

- `scripts/src/lib/cli-flags.ts` — `argvRequestsHelp`가 help 요청 판정의 정본이다. `--help`는 항상 help이고, `-h`는 직전 토큰이 `--`로 시작하는 플래그면 그 플래그의 값으로 본다.
- `scripts/src/lib/cli.ts` — `runCli`가 handler를 적재하기 전에 help 요청을 가로채 `COMMAND_USAGE`를 출력하고 exit 0으로 끝낸다. 하위 명령별 usage가 필요한 7개 명령(`coordinate`·`review-dispatch`·`review`·`context-review`·`dispatch`·`config`·`epic`)은 `ownHelp: true`로 표시해 기존대로 handler가 판정한다.
- `test/helpers/coordinator-fence.js` — 14개 테스트 파일에 복제돼 있던 원장 fence helper를 모았다. 복제본은 모든 fs 오류를 삼켰지만 이 fixture는 원장 부재(ENOENT)만 흡수하고 나머지는 다시 던진다.
- `scripts/src/lib/path-overlap.ts` — `normalizeOverlapPath`의 정본. `execution-dag`의 사본을 없앴다. tasks 문서 타입 `TaskUnit`/`DocLeaf`도 한 곳에서 export한다. 이를 위해 `validate-docs.ts`를 `export =`에서 명명 export로 바꿨고, `require` 소비자의 CJS 형태는 그대로다.
- `test/public-name-regression.test.js` — 레거시 감지기 허용을 고정 경로 목록 대신 파일 안 표식 주석 한 줄로 판정한다. 표식은 `scripts/src/lib/*.ts`에서만 인정한다.
- `test/cli-help-static.test.js`, `test/tiers.json` — 자식 프로세스를 띄우는 정적 help 테스트 49개는 unit tier의 no-spawn guard에 걸리므로 integration tier로 옮겼다. guard와 테스트는 약화하지 않았다.
- `docs/architecture/measurements/source-restructuring.json`, `docs/architecture/source-boundaries.md` — Node 24로 잰 전후 snapshot과 inventory "후" 열. "전" 열은 `check-report`가 JSON과 대조하므로 다시 재서 고쳤다.

알려진 한계: `npm test` 소요 시간은 "전"(약 52초)과 "후"(약 69초)의 측정 환경이 달라 직접 비교하기 어렵다. 측정 JSON에는 로컬 절대 경로(`nodePath`)가 들어 있다. 자격증명은 아니지만 지우려면 측정 스크립트의 JSON 계약을 바꿔야 해서 후속으로 미뤘다.

## Quiz

1. `bouncer graph-sync --help`를 실행하면 어떻게 되는가?
   - A) graph-sync를 실행한 뒤 usage를 출력한다.
   - B) handler 없이 정적 usage를 출력하고 exit 0으로 끝난다.
   - C) 알 수 없는 플래그라며 exit 2로 끝난다.
2. `--reason -h`처럼 `-h`가 `--` 플래그 바로 뒤에 오면 어떻게 판정하는가?
   - A) 정적 usage를 출력하고 exit 0으로 끝난다.
   - B) 알 수 없는 플래그로 exit 2로 끝난다.
   - C) `-h`는 `--reason`의 값이므로 help 요청이 아니고 명령이 평소대로 진행된다.
3. 폐기한 이름 검사에서 레거시 감지기 소스는 어떻게 허용되는가?
   - A) `scripts/src/lib/*.ts` 안에서 줄 전체가 지정된 표식 주석인 파일만 허용한다.
   - B) 고정한 소스 경로 목록에 있는 파일만 허용한다.
   - C) `legacy`라는 단어가 들어 있는 모든 파일을 허용한다.

## Tasks

### runtime-architecture/cli-help-and-hygiene/001 · `c4ea51f7`

#### Goal & intent

이전 소스 재구성 epic이 남긴 inventory 기준선 표의 "후" 열을 실측값으로 채운다. 기준선 `c94947e7`과 이 task worktree의 시작 커밋(구현 전 HEAD)을 같은 Node 24·npm·OS에서 `scripts/measure-source-boundaries.js snapshot`으로 측정하고, 두 snapshot을 `{ "before": …, "after": … }` 비교 JSON 하나로 저장한다. 수용 기준은 epic 성공 기준 6이고 검증 명령은 frontmatter `bouncer.verify`의 `check-report`다.

#### Current behavior

- `docs/architecture/source-boundaries.md:11-21` 표의 "후" 열 11칸이 모두 `미측정(후속 blueprint가 채움)`이고, `:23`은 "마지막 blueprint가 같은 표에 값을 채워 닫는다"고 적는다.
- 측정 도구는 이미 있다. `scripts/measure-source-boundaries.js:195-257` `snapshot`은 Node major 24가 아니면 거절하고(`:197`), 추적 소스가 dirty면 거절하며(`:202-203`), `npm run build`·정렬된 `test/*.test.js` 실행·coverage 실행·`npm test`를 각각 재고 JSON을 원자적으로 쓴다(`:252-254`).
- `check-report`(`:260-264`)는 비교 JSON을 `compareReport`(`:98-132`: 두 snapshot의 `nodePath`·`nodeVersion`·`npmVersion`·`platform`·`arch`·`definition` 일치, 종료 코드 0, 실패 없음)로 검사한 뒤 `validateInventory`(`:271-304`)로 표의 모듈 수·줄 수·테스트 파일 수·줄 수·coverage 3종 칸을 원본과 대조한다. 문서 어디에든 `미측정`이 남으면 거절하고(`:273`), 두 전체 SHA가 문서에 있어야 한다(`:300`).
- 이 환경의 기본 `node`는 v22.19.0이고, Node 24는 `~/.nvm/versions/node/v24.22.0/bin/node`에 설치돼 있다. 기본 node로 `snapshot`을 실행하면 `Node major 24 required`로 실패한다.
- I/O 관찰 지점: `snapshot`은 `spawnSync`로 git·npm·node를 실행하고(`:134-143` `run`), 결과를 `--output` 경로에 쓴다. 측정 대상 checkout은 `--repo`로 받는다.

#### Target behavior

- 성공: `docs/architecture/measurements/source-restructuring.json`에 `before`(revision `c94947e7…` 전체 SHA)와 `after`(task 시작 HEAD 전체 SHA) snapshot이 들어 있고, inventory 표의 "후" 열 11칸이 그 JSON 값으로 채워진다. 검증 대상이 아닌 칸(직접 require, CLI 적재, export 키, `npm test` 시간)도 같은 JSON의 `inventory`·`probes`·`durationsMs`·`counts` 값을 옮긴다. `:23` 문장은 측정 커밋 두 개의 전체 SHA와 비교 JSON 경로를 적는 문장으로 바뀐다. `check-report`가 exit 0이다.
- 실패: Node 24 경로가 없거나 snapshot 명령이 실패하면 값을 손으로 쓰지 않고 task를 `blocked`로 보고한다. 측정값이 기준선보다 나빠도(coverage 하락 등) 그대로 기록한다.
- 보존: inventory의 다른 절(소비자 inventory, 공개 경계 초안, 구현 고정 테스트 inventory)은 바꾸지 않는다. 측정 도구 소스는 바꾸지 않는다.

#### Interface

- 제공: `docs/architecture/measurements/source-restructuring.json` — `{ "before": Snapshot, "after": Snapshot }`. `Snapshot`은 `snapshot` 명령이 쓴 JSON 객체 그대로다(필드를 고치거나 빼지 않는다).
- 거부: `nodeMajor`가 24가 아니거나 `failures`가 비지 않은 snapshot, 두 snapshot의 `nodePath`·`npmVersion`이 다른 비교 JSON은 쓰지 않는다(`check-report`가 거절한다).

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `docs/architecture/source-boundaries.md` | `## 기준선` 표 | Modify | "후" 열 11칸이 `미측정` | 비교 JSON 값으로 채우고 `:23` 문장을 측정 커밋·JSON 경로 설명으로 교체 | `validateInventory`가 대조하는 표 |
| `docs/architecture/measurements/source-restructuring.json` | `before`·`after` | Create | 없음 | 두 snapshot을 담은 비교 JSON | `check-report --report` 입력 |

#### Constraints

- 두 snapshot은 같은 Node 24 실행 파일과 같은 PATH에서 잰다. 기본 node를 바꾸지 않고 명령마다 PATH 앞에 `~/.nvm/versions/node/v24.22.0/bin`을 둔다.
- 측정 checkout은 task worktree 안의 gitignore 경로 `.bouncer/runtime/measure/`에 `git clone`으로 만든 독립 저장소다. 공유 `.git`에 worktree를 추가하지 않고, task worktree 밖에 파일을 쓰지 않는다. snapshot JSON도 같은 디렉터리에 쓰고, 끝나면 디렉터리를 지운다. task worktree 자신을 측정 대상으로 쓰지 않는다(측정 중 산출물이 섞이지 않게 한다).
- 비교 JSON은 두 snapshot 파일을 `before`·`after` 키 아래 그대로 넣는다. 숫자를 반올림하거나 바꾸지 않는다.
- inventory 문서에 `미측정` 문자열이 하나도 남지 않아야 한다.

### runtime-architecture/cli-help-and-hygiene/002 · `8fa51261`

#### Goal & intent

`bouncer <cmd> --help`·`-h`가 어떤 등록 명령에서도 명령을 실행하지 않게 한다. 자체 상세 help가 없는 명령은 `runCli`가 handler를 적재하기 전에 `COMMAND_USAGE[cmd]`를 stdout에 쓰고 exit 0으로 끝낸다. 자체 help가 있는 7개 명령(`coordinate`·`review-dispatch`·`review`·`context-review`·`dispatch`·`config`·`epic`)은 지금처럼 handler가 help를 낸다. 수용 기준은 epic 성공 기준 3과 4(CLI 서브명령 help 판정 함수)이고, 검증 명령은 `node --test test/cli-help.test.js test/cli-project-commands.test.js`다.

#### Current behavior

- `scripts/src/lib/cli.ts:62-77` `runCli`는 최상위 `help`·`--help`·`-h`만 USAGE로 처리하고(`:67`), 등록 명령이면 곧바로 `entry.load()(rest, sink)`로 handler를 적재·실행한다(`:76`). `COMMANDS`(`:21-52`) 항목은 `{ usage, load }`이고, usage 문자열은 `cli-usage.ts:6` `COMMAND_USAGE`에 이미 정적으로 있다.
- 재현(빌드 후, 저장소 루트):
  ```bash
  node -e "const {runCli}=require('./scripts/lib/cli');let o='',e='';const c=runCli(['finalize','--help'],{out:s=>o+=s,err:s=>e+=s});console.log(c,JSON.stringify(e),Object.keys(require.cache).filter(k=>k.includes('/scripts/lib/')).length)"
  # 2 "finalize: --blueprint is required\n" 54
  ```
  같은 방법으로 `validate`·`verify`·`commit`·`seed-worktree`·`execute`·`plan`·`run`·`intent`·`subagent-model`·`codex-agents`·`migrate`·`scaffold`·`ontology`는 exit 2 오류를, `init`·`graph-sync`·`current`·`import`는 명령을 실제로 실행한 JSON을 낸다(`init`은 초기화된 저장소라 `already-initialized`로 건너뛰었을 뿐 빈 저장소에서는 bootstrap한다). `commit-guard`·`retro`·`metrics`는 usage를 stderr에 쓰고 exit 2다.
- help 판정 함수 `argvRequestsHelp`가 5벌 복제돼 있다: `cli-git-commands.ts:359-369`, `cli-review-command.ts:117`, `cli-dispatch-command.ts:37`, `cli-review-dispatch-command.ts:163`, `cli-context-review-command.ts:168`. 규칙은 같다: `--help`는 위치와 무관하게 help, `-h`는 바로 앞 토큰이 `--`로 시작하면 플래그 값. `config`(`cli-config-command.ts:49`)는 인자가 정확히 `--help`/`-h` 하나일 때만, `epic`(`cli-epic-command.ts:71`)은 `includes`로 판정한다.
- I/O 관찰 지점: `runCli`는 주입된 `io`가 없을 때만 `process.stdout/stderr`에 쓴다(`cli.ts:63-64`). 적재 범위는 `require.cache`로 관측한다(`test/cli-project-commands.test.js:36`).
- 확인한 테스트: `test/cli-help.test.js:93-107`(최상위 help·unknown), `:316-531`(자체 help 7개 명령), `test/cli-project-commands.test.js:332-367`(help·unknown이 기능 영역을 적재하지 않음). 자체 help가 없는 명령의 `--help`를 단언하는 테스트는 없다.

#### Target behavior

- 성공: 자체 help가 없는 등록 명령에서 `rest`가 help를 요청하면 `runCli`는 `COMMAND_USAGE[cmd]`를 그대로 stdout에 쓰고, stderr는 비우며, exit 0을 돌려준다. 이때 적재되는 `scripts/lib` 모듈은 `cli`·`cli-flags`·`cli-usage` 세 개뿐이다.
- 실패: `-h`가 `--`로 시작하는 토큰 바로 뒤에 오면 help가 아니다. 예: `commit --message -h`는 handler로 가서 지금과 같은 `commit: --blueprint is required`·exit 2를 낸다.
- 보존: 자체 help 7개 명령의 출력·exit code·판정(특히 `config`의 토큰 하나 규칙)은 바뀌지 않는다. 최상위 help와 unknown-command 출력도 그대로다. help가 아닌 호출의 동작은 바뀌지 않는다.

#### Interface

- 제공: `cli-flags`의 `argvRequestsHelp(tokens: string[]): boolean`(기존 5벌과 같은 규칙). `cli.ts` `COMMANDS` 항목의 선택 필드 `ownHelp: true` — 이 표시가 있는 명령만 help 요청을 handler에 넘긴다.
- 관측 seam(테스트): 자식 프로세스 `spawnSync(process.execPath, ['-e', PROBE, cmd, ...args], { cwd: repoRoot, encoding: 'utf8' })`. `PROBE`는 `require('./scripts/lib/cli').runCli(argv, { out, err })`를 문자열 sink로 실행한 뒤 stdout에 JSON 한 줄 `{ code, out, err, loaded }`를 쓴다. `loaded`는 `Object.keys(require.cache)` 중 경로에 `scripts/lib/`가 든 항목의 basename 배열이다(`test/cli-project-commands.test.js:16-45`의 `probeIntentCache`와 같은 방식).
- 거부: `ownHelp`가 없는 명령의 help 요청에 대해 handler를 적재하지 않는다. 다른 플래그·하위 명령이 함께 와도(`migrate context-slugs --yes --help`) help가 이긴다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/cli.ts` | `runCli`, `COMMANDS` | Modify | 최상위 help만 처리하고 등록 명령은 바로 handler 적재 | `ownHelp` 표시와 handler 적재 전 help 가로채기 | 실행 진입점 |
| `scripts/src/lib/cli-flags.ts` | `argvRequestsHelp` | Modify | `parseFlags`만 export | 공용 help 판정 함수 추가·export | 판정 정본 |
| `scripts/src/lib/cli-git-commands.ts` | `argvRequestsHelp` | Modify | coordinate help용 로컬 사본 | 사본 삭제, `cli-flags`에서 import | 중복 제거 |
| `scripts/src/lib/cli-review-command.ts` | `argvRequestsHelp` | Modify | 로컬 사본 | 사본 삭제, import | 중복 제거 |
| `scripts/src/lib/cli-dispatch-command.ts` | `argvRequestsHelp` | Modify | 로컬 사본 | 사본 삭제, import | 중복 제거 |
| `scripts/src/lib/cli-review-dispatch-command.ts` | `argvRequestsHelp` | Modify | 로컬 사본 | 사본 삭제, import | 중복 제거 |
| `scripts/src/lib/cli-context-review-command.ts` | `argvRequestsHelp` | Modify | 로컬 사본 | 사본 삭제, import | 중복 제거 |
| `test/cli-help.test.js` | 서브명령 help 표 테스트 | Modify | 자체 help 명령만 단언 | 자체 help 없는 모든 명령의 help·적재 범위·값 `-h` 단언 추가 | 검증 지점 |

#### Constraints

- `cli.ts`는 계속 `cli-flags`·`cli-usage`만 정적으로 import한다. help 경로에서 다른 모듈을 require하지 않는다.
- 공용 `argvRequestsHelp`의 규칙은 기존 5벌과 문자 단위로 같아야 한다(`test/cli-help.test.js:403`의 `--reason -h` 값 판정이 계속 통과).
- `ownHelp` 명령 집합은 정확히 위 7개다.

### runtime-architecture/cli-help-and-hygiene/003 · `0d6f01b4`

#### Goal & intent

테스트가 원장 경로·sha256을 계산해 `coordinate` 호출에 주입하는 helper를 `test/helpers` 공통 fixture 하나로 모은다. 주입 대상 명령 목록은 제품 `LEDGER_FENCED_COMMANDS`(`scripts/src/lib/coordinator-commands.ts:70-73`)와 같은 14개로 맞춘다. stale·missing fence를 검사하는 테스트는 계속 자동 주입을 거치지 않는다. 수용 기준은 epic 성공 기준 4이고, 검증 명령은 frontmatter `bouncer.verify`(대상 14개 파일)다.

#### Current behavior

- 같은 블록(`__coordinatorMod`, `__coordinatorPathsFor`, `__LEDGER_REL`, `__FENCED`, `__fence`, 자동 주입 `coordinate`, `coordinateRaw`)이 `test/coordinator.test.js:13-37`에 있고, 거의 같은 사본이 `cli-current.test.js:871`, `commit-task.test.js:575`, `commit-hook.test.js:485`, `current.test.js:1046`, `cli-commit.test.js:451`, `coordinator-e2e.test.js:23`, `cli-validate.test.js:673`, `finalize.test.js:1382`, `cli-coordinate.test.js:21`, `coordinate-next.test.js:24`에 있다. 이름을 바꾼 사본이 `execute-prepare.test.js:358-364`(`__epFence` 등)와 `verification-runner.test.js:1669-1677`(`__coordFence` 등)에 있고, `run-detach.test.js:78` `fenceFor(repo)`는 blueprint 고정에 wrapper가 없다.
- `__FENCED` 목록이 갈라져 있다: 11개 파일은 11개 명령, `coordinate-next`·`cli-coordinate`는 13개, `coordinator.test.js:17-20`은 14개(제품에 없는 `release` 포함, `session-open` 누락). 제품 목록은 `coordinator-commands.ts:70-73`의 14개다.
- 자동 주입 wrapper는 명령이 목록에 있고 `ledgerPath`·`ledgerHash`가 둘 다 `undefined`일 때만 fence를 넣고, 원장이 없으면 주입을 건너뛴다(`coordinator.test.js:28-35`). stale·missing 검사는 `coordinateRaw`(`coordinator.test.js:2619`)나 명시적 fence(`:5698`)로 wrapper를 우회한다.
- I/O 관찰 지점: fence 계산은 `fs.readFileSync(coordinatorPathsFor(...).ledgerFile)`의 sha256이다(`coordinator.test.js:21-27`).

#### Target behavior

- 성공: `test/helpers/coordinator-fence.js` 하나가 fence 계산·자동 주입 wrapper·원본 `coordinate`를 제공하고, 14개 테스트 파일은 이를 import한다. `rg -n "function (__fence|__epFence|__coordFence|fenceFor)\(" test`가 아무것도 찾지 않는다. 대상 14개 파일 테스트가 모두 통과한다.
- 실패: 자동 주입이 명시적으로 넘긴 `ledgerPath` 또는 `ledgerHash`를 덮어쓰지 않는다. 원장이 없으면 주입하지 않고 core의 거절을 그대로 받는다.
- 보존: 각 테스트의 단언·기대 reason은 바뀌지 않는다. stale·missing fence 테스트(`coordinator.test.js:2619`, `:5698`, `:1307`)는 계속 우회 경로를 쓴다.

#### Interface

- 제공: `test/helpers/coordinator-fence.js`
  ```js
  module.exports = {
    LEDGER_REL,                       // '.bouncer/runtime/coordinator.json'
    FENCED_COMMANDS,                  // Set — 제품 LEDGER_FENCED_COMMANDS와 같은 14개
    fence(repoRoot, blueprint),       // → { ledgerPath, ledgerHash }
    coordinate(opts),                 // 목록 명령 + fence 미지정일 때만 fence를 넣어 호출
    coordinateRaw,                    // scripts/lib/coordinator의 coordinate 그대로
  };
  ```
- 거부: fixture는 제품 모듈의 비공개 목록을 import하지 않는다(제품 목록이 바뀌면 fixture 목록을 함께 고친다). `coordinate` wrapper는 CLI argv를 다루지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `test/helpers/coordinator-fence.js` | `fence`, `coordinate`, `coordinateRaw` | Create | 없음 | 공통 fixture | 정본 |
| `test/coordinator.test.js` | `__fence` 블록 | Modify | 복제 블록 | fixture import | 사본 |
| `test/coordinator-e2e.test.js` | `__fence` 블록 | Modify | 복제 블록 | fixture import | 사본 |
| `test/cli-coordinate.test.js` | `__fence` 블록 | Modify | 복제 블록 | fixture import | 사본 |
| `test/coordinate-next.test.js` | `__fence` 블록 | Modify | 복제 블록 | fixture import | 사본 |
| `test/cli-current.test.js` | `__fence` 블록 | Modify | 복제 블록 | fixture import | 사본 |
| `test/current.test.js` | `__fence` 블록 | Modify | 복제 블록 | fixture import | 사본 |
| `test/commit-task.test.js` | `__fence` 블록 | Modify | 복제 블록 | fixture import | 사본 |
| `test/commit-hook.test.js` | `__fence` 블록 | Modify | 복제 블록 | fixture import | 사본 |
| `test/cli-commit.test.js` | `__fence` 블록 | Modify | 복제 블록 | fixture import | 사본 |
| `test/cli-validate.test.js` | `__fence` 블록 | Modify | 복제 블록 | fixture import | 사본 |
| `test/finalize.test.js` | `__fence` 블록 | Modify | 복제 블록 | fixture import | 사본 |
| `test/execute-prepare.test.js` | `__epFence` 블록 | Modify | 이름 바꾼 사본 | fixture import | 사본 |
| `test/verification-runner.test.js` | `__coordFence` 블록 | Modify | 이름 바꾼 사본 | fixture import | 사본 |
| `test/run-detach.test.js` | `fenceFor` | Modify | blueprint 고정 fence 계산 | fixture `fence(repo, BP_REL)` 호출 | 사본 |

#### Constraints

- fixture는 `scripts/lib/coordinator`의 `coordinate`와 `scripts/lib/runtime-state`의 `coordinatorPathsFor`만 제품에서 가져온다.
- 목록을 14개로 넓혀 자동 주입이 새로 걸린 명령에서 기존 테스트가 missing fence 거절을 기대했다면, 그 호출을 `coordinateRaw`로 바꿔 기대를 보존한다(단언은 고치지 않는다).
- `test/helpers`는 eslint 일반 규칙을 받는다(`eslint.config.js:63`). `npm run lint`가 통과해야 한다.

### runtime-architecture/cli-help-and-hygiene/004 · `94e73e1c`

#### Goal & intent

tasks 문서 단위 타입(`TaskUnit`·`DocLeaf`)의 정본을 `validate-docs`에 두고, 같은 모양을 각자 선언한 모듈은 type-only import로 파생한다. 경로 겹침·scope 비교에 쓰는 정규화는 `path-overlap`의 함수 하나로 통일한다. 통일 의미는 사용자 결정대로 두 동작을 합친 것이다: 역슬래시를 `/`로 바꾸고, 선행 `./`를 반복해서 지우고, 단독 `/`가 아닌 말미 `/`를 지운다. 낡은 주석 두 곳을 현재 구조에 맞게 고친다. 수용 기준은 epic 성공 기준 4·7이고, 검증 명령은 frontmatter `bouncer.verify`다.

#### Current behavior

- 같은 strict 타입이 세 번 선언돼 있다: `scripts/src/lib/validate.ts:178-185`, `validate-docs.ts:21-28`, `validate-gates.ts:53-60` — `DocLeaf = { data: unknown; body: string; rel: string }`, `TaskUnit = { number: number | null; dir: string | null; tasks?; verification?; review? }`. 느슨한 변형이 따로 있다: `commit-message.ts:8-11`·`finalize-explain.ts:52-55`(`DocLeafLike`의 필드가 모두 선택, `TaskUnitLike`에 `dir` 없음, 인덱스 시그니처), `commit.ts:46-47`(`body` 없음, `tasks`만). 값을 만드는 곳은 `validate-docs.ts:185-197`의 `taskUnits`다.
- `execution-dag.ts:52-58` `normalizeOverlapPath`는 `./`를 반복해서 지우고 말미 `/`를 지우지만 역슬래시는 그대로 둔다. `finalize-digest.ts:522-526` `normalizeScopePath`는 `toPosix` 뒤 `./`를 한 번만 지운다. 후자는 `pathOutsideScope`(`:535-542`)에서 쓰인다. 전자는 `execution-dag` 내부 `tasksConflict`(`:76`), `dag-shape.ts:4,45,47`, `coordinator-commands.ts:621`(이미 `\\`→`/` 뒤 호출)이 쓴다.
- 낡은 주석: `execution-dag.ts:62-64`는 "validate-sections.pathsOverlap 하나만 쓴다"고 하지만 정본은 `path-overlap.ts`다(`path-overlap.ts:2-4`). `validate-gates.ts:1803-1805`는 "REVIEW_RISK_ENUM을 import하면 validate와 순환하므로" 보안 토큰을 따로 둔다고 하지만, 위험도 enum은 이제 의존 없는 `review-policy.ts`에 있고 보안 경로 토큰은 다른 어휘다.
- 의존 경계: `test/dependency-boundaries.test.js:80-84`는 `execution-dag`의 직접 import를 `{config, path-overlap}`, 전이 import를 `{config, guards, path-overlap}`로 고정한다. `path-overlap.ts`와 `posix-path.ts`는 import가 없다.
- 확인한 테스트: `test/execution-dag.test.js:53-58`(`'./a/'→'a'`, `'././src/x.ts'→'src/x.ts'`, `'/'→'/'`, `'./'→''`), `test/dag-shape.test.js:112,122-126`, `test/coordinator.test.js:305-307,565`(`./` 겹침과 `./` 거절), `test/finalize-digest.test.js:727-753`(plain 경로만). 역슬래시 입력이나 `././` scope 입력 테스트는 없다.

#### Target behavior

- 성공: `path-overlap`이 `normalizeOverlapPath`를 export하고 import는 여전히 없다. `execution-dag`는 로컬 정의를 지우고 `path-overlap`의 함수를 쓰며 같은 이름으로 다시 export한다(기존 소비자 `dag-shape`·`coordinator-commands` 무수정). `finalize-digest`의 `normalizeScopePath`는 사라지고 `pathOutsideScope`가 통합 함수를 쓴다. `validate.ts`·`validate-gates.ts`는 `TaskUnit`·`DocLeaf`를 `validate-docs`에서 type-only로 가져오고, `commit.ts`·`commit-message.ts`·`finalize-explain.ts`의 `*Like` 타입은 그 정본에서 `Partial`·`Pick`과 인덱스 시그니처로 만든다.
- 바뀌는 판정: `normalizeOverlapPath('a\\b')`는 `'a/b'`, scope 비교에서 `'././x'`는 `'x'`와 같다.
- 보존: `test/execution-dag.test.js:53-58`의 네 기대값, `coordinator.test.js:565`의 `./` 거절, `dependency-boundaries`의 허용 목록이 그대로 통과한다. 런타임 값·JSON 출력은 위 두 입력 외에 바뀌지 않는다.

#### Interface

- 제공: `path-overlap`의 `normalizeOverlapPath(raw: string): string`, `validate-docs`의 `export type TaskUnit`·`export type DocLeaf`.
- 거부: `path-overlap`은 다른 lib 모듈을 import하지 않는다(역슬래시 변환은 함수 안에 둔다). 타입 정본을 위해 런타임 import를 추가하지 않는다(type-only만).

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/path-overlap.ts` | `normalizeOverlapPath` | Modify | `pathsOverlap`만 제공 | 통합 정규화 추가·export | 정규화 정본 |
| `scripts/src/lib/execution-dag.ts` | `normalizeOverlapPath`, `tasksConflict` 주석 | Modify | 로컬 정규화와 낡은 주석 | 정본 사용·재export, 주석 수정 | 사본 제거 |
| `scripts/src/lib/finalize-digest.ts` | `normalizeScopePath`, `pathOutsideScope` | Modify | 다른 의미의 사본 | 사본 삭제, 정본 사용 | 사본 제거 |
| `scripts/src/lib/validate-docs.ts` | `TaskUnit`, `DocLeaf` | Modify | 로컬 타입 | 정본으로 export | 값을 만드는 로더 |
| `scripts/src/lib/validate.ts` | `TaskUnit`, `DocLeaf` | Modify | 같은 타입 사본 | type-only import | 사본 제거 |
| `scripts/src/lib/validate-gates.ts` | `TaskUnit`, `DocLeaf`, `SECURITY_PATH_TOKENS` 주석 | Modify | 타입 사본과 낡은 주석 | type-only import, 주석 수정 | 사본 제거 |
| `scripts/src/lib/commit.ts` | `TaskUnitLike`, `DocLeafLike` | Modify | 느슨한 사본 | 정본에서 파생 | 사본 제거 |
| `scripts/src/lib/commit-message.ts` | `TaskUnitLike`, `DocLeafLike` | Modify | 느슨한 사본 | 정본에서 파생 | 사본 제거 |
| `scripts/src/lib/finalize-explain.ts` | `TaskUnitLike`, `DocLeafLike` | Modify | 느슨한 사본 | 정본에서 파생 | 사본 제거 |
| `test/execution-dag.test.js` | `normalizeOverlapPath` 단언 | Modify | 네 입력만 고정 | 역슬래시 입력 단언 추가 | 바뀌는 판정 |
| `test/finalize-digest.test.js` | `path-outside-scope` 단언 | Modify | plain 경로만 | `././`·역슬래시 scope 입력 단언 추가 | 바뀌는 판정 |

#### Constraints

- `validate-gates.ts:1887`의 인라인 정규화(`toPosix` 후 `./` 1회 제거, 말미 `/` 유지)는 gate 판정이라 바꾸지 않는다.
- 타입 파생 때문에 기존 호출부가 타입 오류를 내면 호출부 타입이 아니라 파생 방식을 고친다(`npm run typecheck` 통과).
- 테스트는 빌드된 `scripts/lib`를 require하므로 테스트 전 `npm run build`.

### runtime-architecture/cli-help-and-hygiene/005 · `b6975252`

#### Goal & intent

`test/public-name-regression.test.js`가 레거시 입력 감지기 소스를 고정 경로(`scripts/src/lib/schema.ts`·`validate.ts`와 생성본 `scripts/lib/schema.js`·`validate.js`)로 허용하는 대신 파일 안의 표식 주석으로 허용하게 한다. 감지기를 다른 파일로 옮겨도 표식과 함께 옮기면 테스트가 통과하고, 표식을 남용하면 실패한다. 수용 기준은 epic 성공 기준 9이고, 검증 명령은 `node --test test/public-name-regression.test.js`다.

#### Current behavior

- `test/public-name-regression.test.js:30-42` `LEGACY_ALLOWLIST`는 테스트 5개와 함께 소스 4개 경로(`scripts/lib/schema.js`, `scripts/lib/validate.js`, `scripts/src/lib/schema.ts`, `scripts/src/lib/validate.ts`)를 허용한다. `:123`과 `:133`의 두 테스트가 이 집합에 든 파일을 검사에서 뺀다.
- 감지기 본문은 `scripts/src/lib/schema.ts:210-228` `detectLegacyFormat`이다. `validate.ts:39-41` 주석은 "레거시 문자열이 allowlist에 이 파일명으로 고정돼 있어 옮기면 테스트가 깨진다"고 적는다.
- `docs/architecture/source-boundaries.md:117` inventory 행은 이 테스트를 "유지함(전환 안 함): 내용 표식이 필요해 후속으로 미룸"으로 적는다.
- 검사 대상은 `trackedTextFiles()`(`:85-96`, `git ls-files`)다. `scripts/lib/`는 `.gitignore:20`으로 추적되지 않으므로 허용 목록의 `scripts/lib/*.js` 두 항목은 지금도 효과가 없다.
- 테스트는 폐기한 이름 정규식을 조각을 이어 만든다(`:80-84`). 자기 자신이 검사에 걸리지 않게 하는 방식이다.

#### Target behavior

- 성공: 표식 주석 `// public-name: legacy-input-detector`가 있는 추적 파일 `scripts/src/lib/*.ts`는 두 이름 검사에서 빠진다. `LEGACY_ALLOWLIST`에는 테스트 파일 5개만 남고 소스 4개 경로(`scripts/lib` 두 항목 포함)는 사라진다. 새 테스트가 다음을 단언한다: 표식이 있는 파일이 하나 이상 있다, 표식이 있는 파일은 모두 `scripts/src/lib/*.ts`다, 표식이 있는 파일은 모두 실제로 레거시 문자열을 포함한다.
- 실패: 표식이 `scripts/src/lib/*.ts` 밖(예: `skills/`, `docs/`, `test/`)에 있거나 레거시 문자열이 없는 파일에 있으면 테스트가 실패한다.
- 보존: 다른 파일의 검사 결과는 바뀌지 않는다. 감지기의 동작(`detectLegacyFormat`)은 바뀌지 않는다.

#### Interface

- 제공: 표식 리터럴 `// public-name: legacy-input-detector` — 레거시 입력을 거절하는 감지기 소스임을 선언한다.
- 검사 범위: 표식 검색은 기존 `activeFiles()`(추적 파일 중 `HISTORICAL_DIRS` 제외)와 같은 집합을 쓴다. 테스트 소스에서 표식 정규식은 `['public-name', 'legacy-input-detector']`처럼 조각을 이어 만들어, 테스트 파일 자신이 표식 리터럴을 갖지 않게 한다.
- 거부: 표식은 `scripts/src/lib/*.ts` 밖에서 무효이며 테스트 실패 사유다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `test/public-name-regression.test.js` | `LEGACY_ALLOWLIST`, 표식 판정 | Modify | 소스 고정 경로 허용 | 표식 판정과 남용 검사로 대체 | 검증 지점 |
| `scripts/src/lib/schema.ts` | `detectLegacyFormat` 위 표식 | Modify | 경로로 허용됨 | 표식 주석 추가 | 감지기 본문 |
| `scripts/src/lib/validate.ts` | 상단 주석 | Modify | 파일명 고정 설명 | 표식 주석 추가, 설명을 표식 기준으로 수정 | 레거시 문자열 포함 |
| `docs/architecture/source-boundaries.md` | 구현 고정 테스트 inventory 행 | Modify | "후속(내용 표식 필요)" | 전환함으로 갱신 | inventory 추적 |

#### Constraints

- 테스트 소스에는 폐기한 이름을 연속 리터럴로 쓰지 않는다(`public-name-regression.test.js:80-84`의 조합 방식 유지). 표식 리터럴에도 폐기한 이름을 넣지 않는다.
- `schema.ts`에서는 `detectLegacyFormat` 위에 표식 주석 한 줄만 추가하고 함수 본문은 바꾸지 않는다.
- 생성본은 `npm run build`로만 갱신한다.

### runtime-architecture/cli-help-and-hygiene/006

#### Goal & intent

다섯 commit task가 모두 통합된 결과에서 `npm run ci`가 한 번에 통과함을 증명한다. emit 검사·coverage 임계값·unit tier·lint·문서 검사·typecheck·테스트 이름 검사·audit가 모두 통과해야 하며, 이것이 epic 성공 기준 7의 이 blueprint 몫이다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.

### runtime-architecture/cli-help-and-hygiene/007 · `01a51f2e`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `test/tiers.json` — 기록된 CI 실패를 복구한다.
- Modify `test/cli-help.test.js` — 기록된 CI 실패를 복구한다.
- Modify `test/cli-help-static.test.js` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.