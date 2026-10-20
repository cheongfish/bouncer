---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/deepswe-benchmark/blueprints/deepswe-adapter/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-12T20:58:56.888+09:00'
bouncer:
  id: EXPLAIN-deepswe-adapter
  epic_id: deepswe-benchmark
  blueprint_id: deepswe-adapter
  status: published
  comprehension:
    - range_from: f2450fbe16fb9f33f5b7455cb0ef3a1f0ab5c535
      range_to: 26e511c3ead5ca3a87e19a69cffa9ec9d4e4dccb
      diff_sha: 4e3cc043e968a30e8119bcd46dd7b77acc7a1962a84e64b78da93bf2eb4fe483
      recorded_at: '2026-10-12T21:10:00+09:00'
  task_commits:
    - task: deepswe-benchmark/deepswe-adapter/001
      sha: 7dceea05
      intent_anchor: task-001
    - task: deepswe-benchmark/deepswe-adapter/002
      sha: 06d80fda
      intent_anchor: task-002
    - task: deepswe-benchmark/deepswe-adapter/003
      sha: f6f40367
      intent_anchor: task-003
    - task: deepswe-benchmark/deepswe-adapter/004
      sha: 26e511c3
      intent_anchor: task-004
---
# Explain

## Background

벤치마크 하네스는 Node 이미지 하나와 자체 검증기만 지원했다. DeepSWE 과제는 언어와 환경이 제각각이고 공식 채점기(`tests/test.sh`)가 따로 있어서 그대로는 돌릴 수 없었다. 이 변경으로 DeepSWE 과제를 고정 커밋에서 받아 과제 이미지 위에 에이전트 이미지를 얹어 실행하고, 공식 채점기의 reward와 f2p 비율을 `run.json`에 기록한다. 어려운 과제 4개(quill, expr, statemachine, oxvg)가 카드로 추가됐다.

## Intuition

과제마다 다른 교실(과제 이미지)에 같은 조교(에이전트)를 들여보내고, 시험지는 교실 밖의 채점자(호스트 docker)가 따로 채점한다. 채점이 깨지면 0점이 아니라 "채점 불가"로 남긴다.

## Code

- `benchmarks/prepare-deepswe-task.cjs`: 과제를 고정 커밋에서 받아 작업 공간 원본을 만든다.
- `benchmarks/agent-runtime.cjs`: 카드별 에이전트 서비스·이미지 선택, 실행 시간 예산, 컨테이너가 남긴 파일 소유권 복원.
- `benchmarks/verifiers/deepswe.cjs`: 호스트 docker로 `test.sh`를 돌려 판정(`deepsweVerdict`)을 만든다.
- `benchmarks/submission-diff.cjs`, `benchmarks/check-deepswe-solution.cjs`: 제출 diff 추출과 정답 확인.
- `benchmarks/tasks/deepswe-*.yaml`, `benchmarks/configs/deepswe-*-evaluator-policy.json`, `benchmarks/deepswe/README.md`: 카드·정책·사용법.

## Quiz

1. DeepSWE 채점 컨테이너가 시간 제한을 넘기면 `run.json` 판정은 어떻게 되는가?
   - A) `graded`, 점수 0
   - B) `unjudgeable`, 점수 계열이 모두 null
   - C) 그때까지 쓰인 `reward.json`을 읽어 `graded`
2. 실행 전체 시간 예산이 단계 사이에서 소진되면 어떻게 되는가?
   - A) 남은 단계를 건너뛰고 종료 코드 0으로 끝나며, 판정 필드가 null이라 표본에서 빠진다
   - B) 종료 코드 1로 끝난다
   - C) 오류를 던지고 레코드를 남기지 않는다
3. DeepSWE 컨테이너가 root로 만든 `/workspace` 파일의 소유권은 언제 호스트 사용자로 복원되는가?
   - A) 작업이 성공했을 때만
   - B) 컨테이너를 띄우기 전
   - C) 작업이 끝난 뒤, 성공·실패·시간 초과와 관계없이 호스트 git 작업 전

## Tasks

### deepswe-benchmark/deepswe-adapter/001 · `7dceea05`

#### Goal & intent

`node benchmarks/prepare-deepswe-task.cjs <card-id>` 한 번으로 DeepSWE 과제의 작업 공간 원본을 gitignore된 `benchmarks/fixtures/deepswe/`에 만들고, 기존 카드 로더(`loadRunnableCard`)와 실행기의 clone 흐름이 그 원본을 쓰게 한다.
완료 조건은 아래 Checklist의 단위 테스트가 통과하고 `npm run ci`가 통과하는 것이다.

#### Current behavior

- 기준: develop `6fc76678`. `f2450fbe`까지 `benchmarks/`·`.gitignore`는 바뀌지 않아 아래 줄 번호가 그대로 맞다.
- `benchmarks/task-card.cjs`
  - `benchmarkRoot = __dirname`(`:12`), 스키마 로드(`:13`).
  - `insidePath`(`:40-46`)는 `..`·절대 경로를 `` `<label>` must be a relative path without .. ``로 거부한다. copy 대상 탈출 테스트(`task-card.test.cjs:121-124`)가 이 메시지를 쓴다.
  - `checkCard`(`:48-78`)는 최상위 키만 `schema.properties`와 비교하고(`:50-52`), setup 항목 모양은 `setupStep`(`:77`에서 호출)이 검사한다.
  - `setupStep`(`:80-89`)은 `apply_index_patch`, `copy`/`to`, `install_dependencies`만 받고, 그 밖은 `<id>: unsupported workspace_setup step {<keys>}`로 throw한다(`:88`).
  - `bundleFor(baseCommit)`(`:103-111`)는 `root` 인자가 없고 `benchmarkRoot/fixtures`와 `benchmarkRoot/fixtures/upstream`의 `*.bundle`만 `git bundle list-heads`로 훑는다. `base_commit` head를 가진 bundle이 정확히 하나가 아니면 `expected one fixture bundle with head <sha>, found <n>`으로 throw한다.
  - `loadCard(id, tasksDir)`(`:113-135`)는 `user_request_file`을 언제나 `benchmarkRoot` 기준으로 읽고(`:122`) 파일이 없으면 throw한다.
  - `applyWorkspaceSetup(workDir, card)`(`:137-155`)는 `root` 인자가 없다. 기록 항목은 `{ kind, source, target?, source_sha256 }`이다.
  - `installDependencies`(`:161-169`)는 상류 과제의 `node_modules`를 복사한다. `loadRunnableCard`(`:186-191`)가 `bundleFor`의 유일한 운영 호출자다. 내보내기는 `:205-208`이다.
  - `listCardIds`는 없다. 카드 열거는 `task-card.test.cjs:23-35`에 인라인(readdirSync + 정규식)으로 있고, `upstream/<id>.json`이 있으면 `bundleFor` 검사를 건너뛴다.
- 스키마 `benchmarks/schemas/task-card.schema.json`의 `workspace_setup` 항목은 `oneOf` 세 갈래다(`:38-61`, `install_dependencies` 패턴 `:57`).
- 실행기는 `git clone --quiet <bundle> <workDir>`(`run-cursor.cjs:125`, `run-bouncer-full.cjs:341`) 뒤 `applyWorkspaceSetup`(`run-cursor.cjs:129`, `run-bouncer-full.cjs:345`)을 부르고 기록을 `run.json` `workspace_setup`에 넣는다.
- `.gitignore:4`가 `.benchmarks/`를(캐시 위치 포함), `:26-27`이 `benchmarks/fixtures/upstream/`을 무시한다. `benchmarks/fixtures/`에는 `README.md`와 `upstream/`만 있다. 과제 카드는 `fastify-001.yaml` 하나다.
- DeepSWE 과제 디렉터리(`tasks/<name>/`)
  - 구성: `task.toml`, `instruction.md`, `environment/Dockerfile`, `tests/{Dockerfile,test.sh,grader.py,config.json,test.patch}`, `solution/{solution.patch,solve.sh}`.
  - `task.toml`에서 쓰는 값: `[metadata] base_commit_hash`, `[environment] docker_image`, `[agent] timeout_sec`(10800), `[verifier] timeout_sec`(1800).
  - 과제 이미지의 `/app`은 git 저장소다. 상류 기본 브랜치가 `base_commit_hash`를 가리키고, 의존성(`node_modules`, `target/` 등)이 무시 파일로 들어 있다.
- DeepSWE 저장소 `https://github.com/datacurve-ai/deep-swe`는 Apache-2.0이다.
- 재현: `node --test benchmarks/task-card.test.cjs`가 현재 통과한다.

#### Target behavior

- 성공: `prepare-deepswe-task.cjs <card-id>`가 아래를 순서대로 만든다.
  1. `manifest.json`의 `repo`를 `.benchmarks/deepswe-cache/`에 bare clone하거나 fetch하고, 고정 `commit`에서 과제 디렉터리를 `fixtures/deepswe/<card-id>/task/`로 꺼낸다.
  2. `docker pull <docker_image>` → `docker create` → `docker cp <ctr>:/app <tmp>` → `docker rm <ctr>`.
  3. 꺼낸 `/app`의 `git rev-parse HEAD`가 `base_commit_hash`와 같은지 확인한다.
  4. `base_branch = git symbolic-ref --short HEAD`(꺼낸 `/app` 기준)를 구하고 `git bundle create fixtures/deepswe/<card-id>.bundle HEAD <base_branch>`로 bundle을 쓴다(이 bundle을 `git clone`하면 `<base_branch>`가 checkout된다). 그리고 `fixtures/deepswe/<card-id>/untracked.tar`를 쓴다. 묶음 경로는 무시되지 않은 미추적 파일 `git ls-files --others --exclude-standard`(파일 단위)와 무시 파일 `git ls-files --others --ignored --exclude-standard --directory`(디렉터리 단위로 접음)의 합집합(저장소 상대 경로)이고, 각 경로는 `assertArchiveEntry`를 통과해야 한다. 무시되지 않은 쪽을 파일 단위로 두는 이유: 이 목록은 TASKS-003에서 제출 diff 제외 경로가 되므로, 디렉터리로 접으면 에이전트가 그 디렉터리에 새로 만든 파일까지 제출에서 빠진다.
  5. `docker image inspect --format '{{index .RepoDigests 0}}'`로 `image_digest`를 얻고, `fixtures/deepswe/<card-id>/prepared.json`에 `{ card_id, task_name, deepswe_commit, docker_image, image_digest, base_commit, base_branch, untracked_paths }`를 쓴다.
  6. 마지막 줄에 그 JSON을 stdout으로 낸다.
- 성공(카드): `workspace_setup: [{ restore_untracked: <card-id> }]`가 clone한 작업 공간에 `untracked.tar`를 풀고 `{ kind: 'restore_untracked', source, source_sha256, paths }`를 기록한다. `source_sha256`은 `untracked.tar`의 sha256이고 `paths`는 `prepared.json`의 `untracked_paths`다. 풀기 전에 작업 공간의 `git symbolic-ref --short HEAD`가 `prepared.json`의 `base_branch`와 같은지 확인한다(bouncer-full bootstrap 검사가 쓰는 기준 브랜치를 유료 요청 전에 맞춘다).
- 성공(bundle 탐색): `bundleFor(baseCommit, root)`가 `root/fixtures`, `root/fixtures/upstream`, `root/fixtures/deepswe`를 훑는다.
- 성공(카드 열거): `listCardIds(tasksDir, root)`가 준비되지 않은 DeepSWE 카드를 `unprepared`로 나눈다. 기존 카드 로드 테스트는 `ready`만 `loadCard`하고, `unprepared` 카드는 YAML을 읽어 `checkCard(card, id)`만 돌린다(지시문이 gitignore돼 `loadCard`는 못 하지만 스키마·검증기 항목 검사는 CI에서 받는다).
- 실패: 아래 경우 모두 0이 아닌 코드로 끝나고 부분 산출물(`fixtures/deepswe/<card-id>*`)을 지운다.
  - 매니페스트에 없는 card id
  - 고정 커밋에 과제 디렉터리가 없음
  - `HEAD`가 `base_commit_hash`와 다름
  - docker 명령 실패
- 보존: 상류 과제(`fixtures/upstream/`)와 기존 setup 종류 동작·메시지, 카드 스키마의 다른 필드, `applyWorkspaceSetup`·`bundleFor`의 기존 호출(기본 `root = benchmarkRoot`).

#### Interface

- 제공:
  - `prepare-deepswe-task.cjs <card-id>`. 테스트 seam으로 내보내는 함수:
    - `deepsweFixturePaths(cardId, root) → { dir, taskDir, bundle, untracked, prepared }`
    - `readTaskToml(text) → { baseCommit, dockerImage, agentTimeoutSec, verifierTimeoutSec }`
    - `prepareDeepSweTask(cardId, deps)`. `deps`는 `{ manifest: object, root: string, cacheDir: string, tmpDir: string, runGit(args: string[], cwd: string) → string, runDocker(args: string[]) → string }`다. 기본값: `cacheDir = <저장소>/.benchmarks/deepswe-cache`, `tmpDir = mkdtempSync(os.tmpdir()/deepswe-)`. 테스트는 임시 `root`·`cacheDir`·`tmpDir`와 매니페스트 객체를 넘겨 추적 파일, 실제 `fixtures/`, 실제 `.benchmarks/`를 건드리지 않는다.
    - 파일 부작용 계약(주입 함수가 실제 명령과 같은 결과를 남긴다): 과제 디렉터리는 `runGit(['archive', '--format=tar', '-o', <tmpDir>/task.tar, <commit>, 'tasks/<name>'], cacheDir)`로 받고 `tar -xf`(실제 실행, `--strip-components=2`)로 `fixtures/deepswe/<card-id>/task/`에 푼다. `/app`은 `runDocker(['cp', '<ctr>:/app', <tmpDir>/app])`가 `<tmpDir>/app`에 만든다. `untracked.tar`는 실제 `tar -cf`로 `<tmpDir>/app`에서 만든다. 단위 테스트의 가짜 `runGit`은 첫 인자로 다음처럼 나눈다.
      - `clone`·`fetch`: 인자를 기록하고 `''`를 돌려준다(캐시 디렉터리는 만들지 않는다).
      - `archive`: `-o` 경로에 `tasks/<name>/task.toml`을 담은 tar를 실제로 쓴다. 실패 사례에서는 throw한다.
      - `rev-parse HEAD`: 사례별 고정 sha(성공은 `task.toml` `base_commit_hash`, 불일치 사례는 다른 값)를 돌려준다.
      - `symbolic-ref`: 고정 브랜치 이름(예: `develop`)을 돌려준다.
      - `bundle create`: 인자를 기록하고 대상 경로에 빈 파일을 만든다.
      - `ls-files`: 실제 git으로 넘겨 `cwd`(가짜 `runDocker`가 만든 `<tmpDir>/app`)에서 실행한다. `untracked.tar`가 실제 `tar`로 그 경로를 묶기 때문이다.
      - 가짜 `runDocker`는 `cp` 호출 때 대상 경로에 `git init`한 임시 저장소(커밋 1개, 무시 파일 1개)를 만들고, `image inspect`에는 고정 digest를 돌려준다.
    - `loadPrepared(cardId, root = benchmarkRoot) → object | null`. `prepared.json`이 없으면 `null`.
    - `untrackedPaths(repoDir, runGit) → string[]`. Target 4의 묶음 경로 계산(정렬, 중복 제거).
  - `benchmarks/deepswe/manifest.json` 형식 `{ "repo": string, "commit": 40-hex, "tasks": { "<card-id>": "<task name>" } }`. 값은 `repo: "https://github.com/datacurve-ai/deep-swe"`, `commit: "0b9fabbb63b9104d678fe965e1632f2dd9eaa2ea"`(2026-08-26, v1.1). 이 task에서는 `tasks`를 `{}`로 둔다(과제는 TASKS-004).
  - `task-card.cjs`:
    - `setupStep` 종류 `restore_untracked`. 값 형식은 card id(`^[a-z][a-z0-9-]*-[0-9]{3}$`, 예: `deepswe-quill-001`).
    - `restoreUntracked(workDir, cardId, root = benchmarkRoot) → { kind, source, source_sha256, paths }`.
    - `applyWorkspaceSetup(workDir, card, root = benchmarkRoot)`는 `root`를 `restoreUntracked`에 넘긴다(다른 종류의 원본 경로 해석은 기존처럼 `benchmarkRoot`).
    - `bundleFor(baseCommit, root = benchmarkRoot)`.
    - `listCardIds(tasksDir, root = benchmarkRoot) → { ready: string[], unprepared: string[] }`. 카드 YAML을 `loadCard` 없이 파싱해 `workspace_setup`에 `restore_untracked`가 있고 `root/fixtures/deepswe/<id>/prepared.json`이 없는 카드를 `unprepared`로, 나머지를 `ready`로 나눈다.
    - `assertArchiveEntry(entry) → void`. 묶음 항목 경로(예: `node_modules`, `target/debug`) 검사.
  - 스키마 `workspace_setup` `oneOf`에 `{ restore_untracked: <card id 패턴> }` 갈래를 더한다.
- 거부(즉시 throw, 메시지 고정):
  - `restore_untracked` 값 형식 오류 → `<id>: restore_untracked must name a card id`
  - 묶음 없음 → `<card-id>: untracked archive missing; run node benchmarks/prepare-deepswe-task.cjs <card-id>`
  - 묶음 항목이 `..`를 포함하거나 절대 경로 → `untracked archive entry must be a relative path without ..: <entry>`
  - 작업 공간 브랜치가 `prepared.json` `base_branch`와 다름 → `<card-id>: workspace branch <x> differs from prepared base_branch <y>`
  - 매니페스트 `commit`이 40-hex가 아님 → `deepswe manifest commit must be 40 hex characters`
  - 매니페스트에 없는 card id → `<card-id>: not in benchmarks/deepswe/manifest.json`
  - 고정 커밋에 과제 디렉터리가 없음 → `<card-id>: task <name> missing at <commit>`
  - `HEAD` 불일치 → `<card-id>: /app HEAD <x> differs from base_commit_hash <y>`
  - docker 명령 실패 → `runDocker`가 던진 오류를 그대로 전파(부분 산출물 삭제 뒤)
- 거부(실패 기록): 없음. 준비는 유료 실행 전 단계라 모든 실패가 즉시 끝난다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `benchmarks/prepare-deepswe-task.cjs` | `prepareDeepSweTask`, `readTaskToml`, `deepsweFixturePaths`, `loadPrepared` | Create | 없음 | 준비 명령 | Target 성공 |
| `benchmarks/prepare-deepswe-task.test.cjs` | 테스트 | Create | 없음 | 주입 seam 단위 테스트 | Checklist |
| `benchmarks/deepswe/manifest.json` | 매니페스트 | Create | 없음 | DeepSWE 저장소·고정 커밋 | Interface |
| `benchmarks/task-card.cjs` | `setupStep`, `bundleFor`, `applyWorkspaceSetup`, 신규 `restoreUntracked`·`listCardIds`·`assertArchiveEntry` | Modify | bundle 탐색·setup 종류 | `fixtures/deepswe/` 탐색과 `root` seam, `restore_untracked`, 카드 열거 | `:80-89`, `:103-111`, `:137-155`, `:205-208` |
| `benchmarks/task-card.test.cjs` | 카드 로드 루프, setup 테스트 | Modify | 카드 계약 검사 | `restore_untracked` 성공·거부, deepswe bundle 탐색, `listCardIds` | `:23-35`, `:95-124` |
| `benchmarks/schemas/task-card.schema.json` | `workspace_setup` `oneOf` | Modify | setup 종류 스키마 | `restore_untracked` 갈래 | `:38-61` |
| `.gitignore` | 항목 | Modify | 생성물 무시 | `benchmarks/fixtures/deepswe/` 추가 | `:26-27` |

#### Constraints

- 코드 주석·docstring은 `references/coding-standards/index.md` `Comments and docstrings`(한국어 Summary·Args·Returns)를 따른다.
- 새로 만들거나 바꾸는 테스트 이름은 `<조건> → <결과>` 형식이다(`references/coding-standards/index.md` `Tests`). 기존 테스트 이름은 바꾸지 않는다.
- 단위 테스트는 docker·네트워크를 쓰지 않는다. git과 `tar`는 임시 디렉터리에서 실제로 실행해도 된다. 코딩 표준은 실제 git을 integration 테스트로 한정하지만, 여기서는 bundle clone 뒤 checkout 브랜치, `ls-files` 무시 규칙, `tar` 항목 목록이 계약 자체라 seam으로 대신하면 검사 대상이 사라진다. 이 근거를 테스트 파일 주석에 적는다.
- `untracked.tar`는 `tar`로 만들고 심볼릭 링크를 그대로 둔다. 풀기 전에 `tar -tf` 목록의 모든 항목을 `assertArchiveEntry`로 검사한다.
- 받은 과제 파일은 수정하지 않는다. `solution/`도 그대로 받는다(정답 확인용이며 에이전트 작업 공간에는 들어가지 않는다).
- 기존 거부 메시지(`unsupported workspace_setup step`, `install_dependencies names an upstream task`, `relative path without ..`)는 바꾸지 않는다.

### deepswe-benchmark/deepswe-adapter/002 · `06d80fda`

#### Goal & intent

DeepSWE 카드는 과제 이미지(`prepared.json`의 `docker_image`)를 베이스로 빌드한 vanilla·bouncer 에이전트 이미지에서 실행되고, 그 밖의 카드는 지금 이미지 그대로 실행된다. bouncer-full은 정책 `task_facts.base_branch`를 기준 브랜치로 쓰고 실행 전체 wall-clock 180분(범위 1..240) 예산 안에서 단계를 돌린다.
완료 조건은 Checklist의 단위 테스트와 `npm run ci` 통과다. 실제 이미지 빌드는 이 task가 더하는 `--build-only`로 TASKS-004 수동 단계에서 확인한다.

#### Current behavior

- 기준: develop `6fc76678`. `f2450fbe`까지 `benchmarks/`는 바뀌지 않아 아래 줄 번호가 그대로 맞다. `docker/Dockerfile.deepswe`, `agent-runtime.cjs`, `agent-runtime.test.cjs`는 없다. `fixtures/deepswe/`·`loadPrepared`는 TASKS-001이 만든다.
- `benchmarks/docker/Dockerfile.cursor`: `cursor-base`는 `node:24-bookworm-slim`, `node` 사용자(uid `BENCH_UID`), `HOME=/home/node`. cursor-agent는 `curl https://cursor.com/install | bash`로 설치한다. `agent-entrypoint.sh`는 `/usr/local/bin/benchmark-agent`에 두고 shell guard·hooks도 같은 단계에 있다. `bouncer` 단계는 플러그인을 `/home/node/.cursor/plugins/local/bouncer`에 둔다.
- `benchmarks/docker/compose.cursor.yaml`: `x-agent`(`:3-18`, `/workspace`·`/home/node/.cursor/projects`·`/tmp/cursor-agent-logs-${BENCH_UID}` 마운트, secret, IPv6 끄기), 서비스 `vanilla`(`:20`, 이미지 `:28`), `bouncer`(`:31`, `:39`), `verifier`(`:42`, `:47`).
- 서비스·이미지 선택이 고정된 곳:
  - `run-cursor.cjs:133` `service = condition==='bouncer-full' ? 'bouncer' : 'vanilla'` → `:183` build `service verifier` → `:191` `cursor-agent --version` → `:193-194` `record.image_id = docker image inspect bouncer-benchmark-cursor-${service}:local` → `:200-202` 에이전트 실행. 허용 인자는 `:27-29`(task·condition·model·key-file·run-id·timeout-minutes·dry-run·keep-workspace)이고 그 밖은 `unknown or duplicate option: <arg>`로 거부한다. `--key-file`은 `--dry-run`일 때만 생략된다(`:39`). `options`를 내보내고(`:266`) `main()`은 `require.main === module`일 때만 돈다(`:259`).
  - `run-print-stage.cjs`: `:97` build, `:102` 플러그인 검사, `:116-117` `run -d ... sleep bouncer infinity`.
  - `run-acp-stage.cjs`: `:42`, `:47`, `:59-60`.
  - `plugin-version.cjs`: `:6` `IMAGE_PACKAGE_JSON=/home/node/...`, `:19` `bouncer` 고정, `:52` `assertImagePluginVersion({ compose, env, cwd, checkoutVersion })`.
- 기준 브랜치 `main` 고정:
  - `run-bouncer-full.cjs` `bootstrapCommit`(`:137`)이 `config.base_branch !== 'main'`(`:145-146`)이면 `Bouncer bootstrap configuration differs from policy`(`:147`)로 throw한다. `bootstrapCommit`은 내보내지 않는다(내보내기 `:397`).
  - `responder.cjs:88` `IMPLEMENTED_ANSWERS['init.base_branch'] = ['main']`, `init.base_branch` 결정(`:242-244`)은 답이 `main`이 아니면 `null`. `loadPolicy`(`:115`)는 구현되지 않은 답을 `evaluator policy answer <x> for <gate> is not implemented`로 throw한다(`:129-130`).
- 시간 제한:
  - `run-bouncer-full.cjs` `configOf`(`:39-56`)의 `timeoutMinutes` 기본 60, 범위 1..240, 오류 `invalid timeout`. `configOf`는 `--key-file` 파일이 있어야 통과한다. `stage()`(`:94-99`)가 같은 `--timeout-minutes`를 모든 단계에 넘긴다. 단계 루프(`:346-350`)에 예산 계산이 없다.
  - `run-cursor.cjs:42-43` 기본 30, 1..240. `stage-args.cjs:35-36` 기본 30, 1..240.
- `run-bouncer-full.cjs`는 최상위 `image_id`를 쓰지 않는다(레코드 초기화 `:334` 근처).
- 호스트 git 단계: bouncer-full은 단계 사이 `bootstrapCommit`(01-init 뒤)·`checkPlanGate`·`collectFinalEvidence`, run-cursor는 에이전트 실행(`:200-207`) 뒤 diff·검증기.
- 기존 테스트: `runner-args.test.cjs`(`--task` 필수만, `:29-46`), `plugin-version.test.cjs:9-34`(`:34`가 `cat bouncer /home/node/...` 인자 단언), `run-bouncer-full.test.cjs:40-105`(증거·integration·plugin_version·gitignore, bootstrap 테스트 없음), `responder.test.cjs`(`:689-693` develop 미구현, `:708-715` 커버리지 루프가 `IMPLEMENTED_ANSWERS[id]?.includes` 직접 대조, `:731-746` main 결정 사례), `docker-path.test.cjs`(Dockerfile 텍스트).
- DeepSWE 과제 이미지는 root로 돌고 Go 캐시는 `/root/go`, cargo는 `/root/.cargo`이며 `node` v24가 들어 있다.

#### Target behavior

- 성공(이미지):
  - `Dockerfile.deepswe`는 `ARG TASK_IMAGE`를 받는다. `deepswe-vanilla` 단계는 `FROM ${TASK_IMAGE}` 위에 cursor-agent와 `benchmark-agent`·shell guard·hooks를 `/root` 기준으로 설치한다. `deepswe-bouncer` 단계는 `plugin-build` 산출물을 `/root/.cursor/plugins/local/bouncer`로 더한다.
  - compose 서비스 `deepswe-vanilla`·`deepswe-bouncer`: 이미지 `bouncer-benchmark-deepswe-${BENCH_TASK_ID}-{vanilla,bouncer}:local`, 빌드 인자 `TASK_IMAGE=${BENCH_TASK_IMAGE}`, 마운트 `/workspace`·`/root/.cursor/projects`·`/tmp/cursor-agent-logs-0`, secret과 IPv6 끄기는 기존 서비스와 같다.
- 성공(실행기):
  - `fixtures/deepswe/<card-id>/prepared.json`이 있으면 서비스는 `deepswe-<vanilla|bouncer>`이고 `BENCH_TASK_ID`·`BENCH_TASK_IMAGE`가 compose env에 들어간다. `run-print-stage.cjs`·`run-acp-stage.cjs`는 이미 받는 `--task`로 `loadPrepared`·`agentRuntime`을 불러 같은 서비스·env를 정한다(`stage-args.cjs`는 바꾸지 않는다).
  - `run.json` `image_id`는 `agentRuntime().imageTag`를 inspect한 값이다(run-cursor와 bouncer-full 모두 최상위).
  - 플러그인 버전 검사는 `agentRuntime().service`·`pluginPackageJson`으로 읽는다.
  - DeepSWE 런타임이면 에이전트 실행(run-cursor)과 각 단계(bouncer-full) 뒤, 성공·실패·시간 초과와 상관없이 `restoreOwnership`이 돈다. 호스트 git 작업은 그 뒤에만 한다.
  - `run.json`에 `deviations`가 남는다(DeepSWE `["agent_network"]`, 그 밖 `[]`).
- 성공(bouncer-full):
  - bootstrap 검사는 `config.base_branch === policy.task_facts.base_branch`를 요구한다.
  - 응답기 `init.base_branch`는 정책 답이 `task_facts.base_branch`와 같을 때 그 브랜치 이름으로 답한다. 결정 함수의 현재 브랜치 확인(`responder.cjs:246`, `(deps?.currentBranch ?? currentBranch)(workDir) !== 'main'`)은 `'main'` 대신 `policy.task_facts.base_branch`와 비교하고, 선택지 매칭(`:247` `/\bmain\b/i`)도 그 브랜치 이름을 단어 경계로 찾는다. 현재 브랜치가 다르면 지금처럼 `null`이다.
  - `--timeout-minutes`는 실행 전체 wall-clock 예산이고 범위 1..240, 기본 180이다. 각 단계는 남은 분(내림)을 `--timeout-minutes`로 받는다. 남은 시간이 1분 미만이면 다음 단계를 시작하지 않고 `run.json`에 `status: stopped`, `stop_reason: budget_exhausted`, `skipped_stages`를 쓴다. 이때 `main`은 `collectFinalEvidence`·제출 diff·`verifyPatch`를 부르지 않고, `run.json` 판정 필드를 `judge_status: 'unjudgeable'`, `error: 'budget exhausted'`, `score`·`outcome_success`·`reward`·`f2p_passed`·`f2p_total`·`p2p_passed`·`p2p_total`·`apply_failed`는 `null`로 쓴다(`sampleEligibility`가 표본에서 뺀다). 기본값 변경(단계당 60 → 전체 180)은 fastify-001 bouncer-full에도 적용되는 의도된 변경이다.
- 성공(빌드 확인): `run-cursor.cjs --build-only true`는 키 파일 없이 이미지를 빌드하고(bouncer-full 조건이면 플러그인 버전 검사 포함) `cursor_version`·`image_id`·`plugin_version`·`status: built`를 `run.json`에 쓴 뒤 0으로 끝난다. 작업 공간 준비와 에이전트 요청은 하지 않는다.
- 실패(0이 아닌 종료): `prepared.json`의 `docker_image`가 비었거나 문자열이 아님, 이미지 빌드 실패, 정책 `task_facts.base_branch`가 비었음.
- 성공(verify 게이트): `plan.verify_command` 정책 답 `policy_verification_command`가 생긴다. package.json이 없는 과제에서 정책 `task_facts.verification_command`를 이름으로 가진 권장 선택지를 고른다(Interface 참조).
- 보존: DeepSWE가 아닌 카드(fastify-001)의 서비스·이미지 태그·경로·기존 기록 필드. `run-cursor.cjs`·`stage-args.cjs`의 `--timeout-minutes` 의미(단일 실행 제한)와 1..240 범위. `IMPLEMENTED_ANSWERS`의 기존 항목(`init.base_branch: ['main']`과 `plan.verify_command`의 `npm test`·`recommended_package_script` 포함). 바뀌는 것은 `plan.verify_command`에 `policy_verification_command`를 더하는 것뿐이다.

#### Interface

- 제공(`benchmarks/agent-runtime.cjs`, 모두 파일을 읽지 않는다):
  - `agentRuntime({ taskId, condition, prepared }) → { service, env, imageTag, pluginPackageJson, deepswe, deviations }`. `condition`은 `'vanilla'|'bouncer-full'`, `prepared`는 TASKS-001 `loadPrepared` 결과(객체 또는 `null`). 비DeepSWE: `service` `vanilla`/`bouncer`, `env` `{}`, `imageTag` `bouncer-benchmark-cursor-<service>:local`, `pluginPackageJson` `/home/node/.cursor/plugins/local/bouncer/package.json`, `deviations` `[]`. DeepSWE: `service` `deepswe-vanilla`/`deepswe-bouncer`, `env` `{ BENCH_TASK_ID: taskId, BENCH_TASK_IMAGE: prepared.docker_image }`, `imageTag` `bouncer-benchmark-deepswe-<taskId>-<vanilla|bouncer>:local`, `pluginPackageJson` `/root/.cursor/plugins/local/bouncer/package.json`, `deviations` `['agent_network']`.
  - `restoreOwnership(runtime, { uid, gid }, deps)`. `deps.runCompose(args: string[]) → string`. DeepSWE면 `['run', '--rm', '--no-deps', '--entrypoint', 'chown', runtime.service, '-R', '<uid>:<gid>', '/workspace']`로 한 번 부르고, 아니면 부르지 않는다.
  - `withOwnershipRestore(runtime, ids, fn, deps) → Promise<fn의 결과>`. `async` 함수다. `await fn()`이 끝난 뒤(이행·거부 모두) `finally`에서 `restoreOwnership`을 부른다. `fn`이 동기 값이나 Promise를 돌려줘도 같다. 거부되면 복원 뒤 같은 오류로 거부한다. run-cursor의 에이전트 실행(`await streamCompose(...)`, `run-cursor.cjs:199`)과 bouncer-full 단계 실행을 이 함수로 감싸며, 호출자는 반드시 `await`한다.
  - `stageBudget({ totalMinutes, startedAt, now }) → { minutes } | { exhausted: true }`. 시각은 ms. 남은 분 = `floor((startedAt + totalMinutes*60000 - now) / 60000)`. 1 미만이면 `exhausted`.
  - `runStagesWithBudget({ stages, totalMinutes, startedAt, now, runStage }) → Promise<{ completed: string[], skipped: string[] }>`. `async` 함수다. `now() → number`, `runStage(name, minutes) → Promise | 값`. 단계마다 `stageBudget`을 보고 `await runStage(...)`가 끝난 뒤에만 다음 단계를 본다. 소진이면 남은 단계를 `skipped`에 넣고 멈춘다. bouncer-full의 `runStage`는 `withOwnershipRestore`로 감싼 단계 실행과 그 뒤 호스트 git 작업(`bootstrapCommit`, `checkPlanGate`)을 이 순서로 `await`한다.
  - `exitCodeFor(record) → 0 | 1`. `status === 'finalized'`이거나 `stop_reason === 'budget_exhausted'`면 0, 그 밖(오류로 `stopped` 포함)은 1. `run-bouncer-full.cjs` `main`의 `if (record.status !== 'finalized') process.exitCode = 1`을 `process.exitCode = exitCodeFor(record)`로 바꾼다.
  - `run-bouncer-full.cjs` `main`은 `async` 함수가 되고, 직접 실행 시 `main().catch((error) => { 오류 출력; process.exitCode = 1; })`로 부른다.
  - `budgetStopRecord(skipped) → { status: 'stopped', stop_reason: 'budget_exhausted', skipped_stages: skipped, judge_status: 'unjudgeable', error: 'budget exhausted', score: null, outcome_success: null, reward: null, f2p_passed: null, f2p_total: null, p2p_passed: null, p2p_total: null, apply_failed: null }`. `main`은 `runStagesWithBudget`의 `skipped`가 비어 있지 않으면 이 객체를 레코드에 펼치고 증거 수집·채점 없이 끝낸다.
  - `imageIdOf(tag, deps) → string`. `deps.runDocker(args: string[]) → string`을 `['image', 'inspect', '--format', '{{.Id}}', tag]`로 한 번 부른다.
  - `runtimeRecordFields(runtime, deps) → { image_id, deviations }`. `image_id = imageIdOf(runtime.imageTag, deps)`, `deviations = runtime.deviations`. `run-cursor.cjs`와 `run-bouncer-full.cjs`는 `run.json` 최상위에 이 객체를 그대로 펼쳐 넣는다(`Object.assign(record, runtimeRecordFields(...))`). 두 실행기가 같은 함수를 쓰므로 이 함수의 단위 테스트가 epic 성공 기준 6·7의 `image_id`·`deviations` 기록 근거다.
- 제공(기존 모듈):
  - `run-cursor.cjs` 인자 `--build-only true`, `options` 결과 `buildOnly: true`(이때 `--key-file` 불필요).
  - `run-bouncer-full.cjs`가 `bootstrapCommit(workspace, policy, before)`를 내보낸다. `configOf`의 `timeoutMinutes` 기본 180.
  - `run-bouncer-full.cjs`가 `runtimeFieldsFor(config, prepared, deps) → { image_id, deviations }`를 내보낸다. `runtimeRecordFields(agentRuntime({ taskId: config.taskId, condition: 'bouncer-full', prepared }), deps)`이고, `main`은 `01-init` 단계가 끝난 직후(그 단계의 `withOwnershipRestore`·`bootstrapCommit` 뒤) `Object.assign(record, runtimeFieldsFor(config, loadPrepared(config.taskId), { runDocker }))`로 쓴다. `run-bouncer-full.cjs`는 에이전트 이미지를 직접 빌드하지 않고 각 단계 실행기가 빌드하므로(`run-print-stage.cjs:97`, `run-acp-stage.cjs:42`), 레코드 초기화 시점에 inspect하면 새 호스트에서는 이미지가 없어 실패하고 이전 빌드가 있으면 01-init이 다시 빌드하기 전 id를 기록한다. 01-init 전에 예산이 소진되거나 01-init이 실패하면 `image_id`는 `null`이다.
  - `responder.cjs`가 `isImplementedAnswer(policy, gate, answer) → boolean`을 내보낸다. `init.base_branch`는 `answer === policy.task_facts.base_branch`, 그 밖 게이트는 `IMPLEMENTED_ANSWERS[gate].includes(answer)`. `loadPolicy`와 커버리지 테스트가 이 함수로 판정한다.
  - `plan.verify_command`의 새 답 `policy_verification_command`(`IMPLEMENTED_ANSWERS['plan.verify_command']`에 추가). package.json이 없는 과제(Go·Python·Rust)를 위한 답이다. 정책 답이 이 값이면 결정 함수는 package.json을 보지 않고, 라벨에 `policy.task_facts.verification_command` 문자열(예: `go test ./...`)이 그대로 들어 있는 권장(recommended) 진행 선택지를 고른다(`chooseProceed(options, { require: { test: (label) => label.includes(command) }, deny: /unset|\bleave\b|different|다른|않/i })`, `command = policy.task_facts.verification_command`, `basis === 'recommended'`일 때만). `recommendedProceed`는 `require.test(label)`을 부르므로(`responder.cjs:163`) 문자열을 그대로 넘기지 않고, `.`·`(`·`+`가 정규식 문법이 되지 않도록 `RegExp`로 감싸지도 않는다. 기존 `named` matcher(`responder.cjs:329-332`)와 같은 `{ test }` 객체 형식이다. 맞는 선택지가 없으면 `null`(지금처럼 멈춤). 답이 `npm test`·`recommended_package_script`인 정책(fastify-001)의 결정은 바뀌지 않는다.
  - `plugin-version.cjs`: `readImagePackageJson(runCompose, { service = 'bouncer', packageJson = IMAGE_PACKAGE_JSON } = {})`, `assertImagePluginVersion({ compose, env, cwd, checkoutVersion, service, packageJson })`. 기본값은 지금 값. `checkPluginVersion`은 바꾸지 않는다.
- 거부(즉시 throw):
  - `agentRuntime`: `prepared`가 객체인데 `docker_image`가 비었거나 문자열이 아님 → `<taskId>: prepared.json docker_image missing`
  - `bootstrapCommit`: `policy.task_facts.base_branch`가 비었음 → `evaluator policy task_facts.base_branch missing`
  - `stageBudget`: `totalMinutes`가 1..240 정수가 아님 → `invalid timeout`
  - `loadPolicy`: `isImplementedAnswer`가 거짓 → 지금 메시지 `evaluator policy answer <x> for init.base_branch is not implemented`
- 거부(기록): 예산 소진은 throw가 아니라 `budgetStopRecord`로 남기고 0으로 끝난다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `benchmarks/docker/Dockerfile.deepswe` | `deepswe-vanilla`, `deepswe-bouncer`, `plugin-build` | Create | 없음 | 과제 이미지 기반 에이전트 이미지 | Target 이미지 |
| `benchmarks/docker/Dockerfile.deepswe.dockerignore` | 무시 목록 | Create | 없음 | `Dockerfile.cursor.dockerignore`와 같은 항목(`.git`, `.benchmarks`, `.bouncer`, `node_modules`, `benchmarks/fixtures` 등). 빌드 컨텍스트가 저장소 루트(`compose.cursor.yaml:23-24` `context: ../..`)이고 루트 `.dockerignore`가 없어 `.benchmarks/deepswe-cache/`·`benchmarks/fixtures/deepswe/`가 전송되지 않게 한다 | `docker/Dockerfile.cursor.dockerignore` |
| `benchmarks/docker/compose.cursor.yaml` | 서비스 | Modify | vanilla·bouncer·verifier | `deepswe-vanilla`·`deepswe-bouncer` 추가 | `:3-47` |
| `benchmarks/agent-runtime.cjs` | `agentRuntime`, `restoreOwnership`, `withOwnershipRestore`, `stageBudget`, `runStagesWithBudget`, `budgetStopRecord`, `exitCodeFor`, `imageIdOf`, `runtimeRecordFields` | Create | 없음 | 런타임 선택·예산·소유권 복원·이미지 id | Interface |
| `benchmarks/agent-runtime.test.cjs` | 테스트 | Create | 없음 | 위 함수 검사 | Checklist |
| `benchmarks/run-cursor.cjs` | `options`, `main` | Modify | 고정 서비스 실행 | `agentRuntime`·`--build-only`·`withOwnershipRestore`·`deviations`·`image_id` | `:27-43`, `:133`, `:183-207` |
| `benchmarks/run-print-stage.cjs` | `main` | Modify | `bouncer` 고정 | `agentRuntime` 서비스·env·플러그인 경로 | `:97`, `:102`, `:116-117` |
| `benchmarks/run-acp-stage.cjs` | `main` | Modify | `bouncer` 고정 | 같음 | `:42`, `:47`, `:59-60` |
| `benchmarks/run-bouncer-full.cjs` | `configOf`, `bootstrapCommit`, `stage`, `main` | Modify | main 고정, 단계마다 같은 제한, 이미지 기록 없음 | 정책 기준 브랜치, `main`을 async로 바꾸고 `await runStagesWithBudget`, 단계마다 `withOwnershipRestore`, `runtimeFieldsFor`, `exitCodeFor`, `bootstrapCommit` 내보내기 | `:39-56`, `:94-99`, `:137-147`, `:334-350`, `:397` |
| `benchmarks/run-bouncer-full.test.cjs` | 테스트 | Modify | 증거·plugin_version 검사 | bootstrap 기준 브랜치, `configOf` 기본 예산, `runtimeFieldsFor` | `:40-105` |
| `benchmarks/runner-args.test.cjs` | 테스트 | Modify | `--task` 필수 검사 | `--build-only` 사례 | `:29-46` |
| `benchmarks/plugin-version.cjs` | `readImagePackageJson`, `assertImagePluginVersion` | Modify | `bouncer`·고정 경로 | 서비스·경로 인자 | `:6`, `:19`, `:52` |
| `benchmarks/plugin-version.test.cjs` | 테스트 | Modify | 고정 인자 단언 | 인자 전달 단언 | `:34` |
| `benchmarks/acp/responder.cjs` | `IMPLEMENTED_ANSWERS`, `loadPolicy`, `init.base_branch`·`plan.verify_command` 결정, 신규 `isImplementedAnswer` | Modify | `main`만 답함, verify는 package.json 스크립트만 | 정책 `task_facts.base_branch`와 같은 답, `policy_verification_command` 답 | `:85-94`, `:115-130`, `:242-244`, `:320-334`, `:737` |
| `benchmarks/acp/responder.test.cjs` | base_branch·verify 사례, 커버리지 루프 | Modify | main 사례, `IMPLEMENTED_ANSWERS` 직접 대조 | `master` 정책 사례, `policy_verification_command` 사례, 루프를 `isImplementedAnswer`로 | `:515`, `:689-693`, `:708-715`, `:731-746` |

#### Constraints

- 단위 테스트는 docker를 띄우지 않는다. 이미지 빌드는 TASKS-004 수동 단계에서 확인한다.
- `Dockerfile.deepswe`의 `plugin-build` 단계는 `Dockerfile.cursor`와 같은 명령(`npm ci && npm run build`)을 쓴다.
- 코드 주석·docstring은 `references/coding-standards/index.md` `Comments and docstrings`(한국어 Summary·Args·Returns)를 따른다.
- 새로 만들거나 바꾸는 테스트 이름은 `<조건> → <결과>` 형식이다(`references/coding-standards/index.md` `Tests`). 기존 테스트 이름은 바꾸지 않는다.
- `bootstrapCommit` 테스트는 기존 `run-bouncer-full.test.cjs`처럼 임시 git 저장소를 실제로 쓴다. 검사 대상이 실제 작업 트리 상태(커밋하지 않은 `.bouncer/config.json`, 관리 경로 밖 변경)라서다. 그 밖의 새 테스트는 docker·git을 주입 seam으로 대신한다.
- `init.base_branch` 응답은 기존 `main` 사례와 같은 출력 형식이다. 정책 답이 `stop`이면 지금처럼 멈춘다.
- `agent-entrypoint.sh`의 `cd /workspace`와 `CURSOR_CONFIG_DIR="$HOME/.cursor"`는 root 이미지에서도 맞으므로 그대로 쓴다.

### deepswe-benchmark/deepswe-adapter/003 · `f6f40367`

#### Goal & intent

DeepSWE 카드의 제출 patch를 과제의 공식 `tests/test.sh`로 채점하고, `run.json`에 `reward`(주점수)와 f2p·p2p 통과 수, `apply_failed`를 남긴다. 제출 diff는 vanilla가 작업 트리 모드, bouncer-full과 아카이브 재채점이 커밋 ref 모드이며 세 경로가 같은 제외 경로를 쓴다. bouncer-full은 `unjudgeable` 판정을 기록하고 정상 종료한다.
완료 조건은 Checklist의 단위 테스트와 `npm run ci` 통과다.

#### Current behavior

- 기준: develop `6fc76678`. `f2450fbe`까지 `benchmarks/`는 바뀌지 않아 아래 줄 번호가 그대로 맞다. `verifiers/deepswe.cjs`, `submission-diff.cjs`는 없다. `restore_untracked`·`fixtures/deepswe/`는 TASKS-001, `agentRuntime`·`withOwnershipRestore`는 TASKS-002가 만든다.
- `task-card.cjs`
  - `CONTAINER_VALUES`(`:16-21`): `submission_patch=/result/diff.patch`, `result_json=/result/verifier.json` 등 컨테이너 경로.
  - `checkCard` 검증기 루프(`:71-76`)는 `argv`·`timeout_ms`·자리표시자만 본다. 스키마 검증기 항목은 `additionalProperties: false`(`schema :66`)지만 실행 시 강제하는 곳이 없어 `runtime: host`든 `runtime: docker`든 조용히 통과한다.
  - `verifierInvocation`(`:178-183`)은 argv를 컨테이너 경로로 렌더링하고 `argv[0]`을 `--entrypoint`로 떼어 `{ id, timeoutMs, composeArgs }`를 돌려준다. fastify 카드 argv는 `node`로 시작한다(`tasks/fastify-001.yaml:29`).
  - `applyWorkspaceSetup` 기록 항목은 `{ kind, source, target?, source_sha256 }`이고 `copy`의 대상 키는 `target`이다(`:83`, `:153`). 내보내기는 `:205-208`.
  - compose `verifier` 서비스(`compose.cursor.yaml:42-58`)는 Node 이미지, `network_mode: none`, 읽기 전용.
- 제출 diff 세 곳(어느 곳도 `.bouncer/`·`.worktrees/`·복원 파일을 거르지 않는다):
  - `run-cursor.cjs:230-231`: `git add -N --all` 뒤 `git diff --binary --no-ext-diff <base> --`(작업 트리 diff).
  - `run-bouncer-full.cjs` `collectFinalEvidence`(`:268-282`, patch `:279`): finalize가 integration worktree를 지운 뒤 workspace 메인 저장소에서 `git diff ... <base> <branch> --`(커밋 diff). `deps.git(args, cwd) → spawnSync 결과` 주입점이 있다.
  - `score-archived-run.cjs:48`: `GIT_DIR`/`GIT_WORK_TREE` env를 쓰는 지역 `git` 클로저(`:40-43`)로 `git diff ... <base> HEAD --`. `main()`을 무조건 부르고(`:82`) 아무것도 내보내지 않는다.
  - 공용 `runGit` seam은 없다.
- 결과를 읽는 곳(세 곳 모두 `judge_status`·`score`·`outcome_success`만 복사):
  - `run-cursor.cjs:241-248`: `verifier.json`이 없으면 `unjudgeable`.
  - `run-bouncer-full.cjs` `verifyPatch`(`:284-311`): 종료 코드 ≠ 0이거나 `verifier.json`이 없으면 `external verifier failed`, `judge_status !== 'graded'`면 `external verifier did not grade the patch`로 throw한다(`:303-310`).
  - `score-archived-run.cjs:57-77`.
- 세 경로는 `docker compose ... run --rm --no-deps <composeArgs>`로 검증기를 띄우고(`run-cursor.cjs:235-239`, `run-bouncer-full.cjs:294-299`, `score-archived-run.cjs:57-62`), `diff.patch`를 runDir에 먼저 쓰고 검증기 뒤 `run.json`을 저장한다.
- DeepSWE 채점기(`tests/grader.py`): 입력 `/logs/artifacts/model.patch`, 출력 `/logs/verifier/reward.json`(`reward, f2p_total, f2p_passed, p2p_total, p2p_passed, f2p, p2p, partial`, 실패 시 `apply_failed`). patch 적용 실패면 `reward 0`, `apply_failed 1`. `tests/test.sh`는 인프라 실패 시 `reward.txt`에 `-1`을 쓰고 `cd /app`이 필요하다. `tests/Dockerfile`은 과제 이미지 `FROM`에 `/tests/`를 복사한다.
- `provenance.cjs:26` `sampleEligibility`는 `judge_status === 'graded'`를 요구한다.
- 기존 테스트: `task-card.test.cjs:61-68`(fastify composeArgs `--entrypoint node`), `:55-59` `renderArgv`. `run-bouncer-full.test.cjs:40-61` `collectFinalEvidence`. 그 `repoWith`는 브랜치에 `.bouncer/.../index.md`를 이미 커밋한다(`:31-35`). run-cursor diff·`score-archived-run` 테스트는 없다.

#### Target behavior

- 성공(검증기): `node verifiers/deepswe.cjs --task <card-id> --patch <diff> --out-dir <dir> --output <file>`가 호스트에서 다음을 한다.
  1. `fixtures/deepswe/<card-id>/task/tests/`로 `bouncer-benchmark-deepswe-<card-id>-tests:local`을 빌드한다.
  2. `docker run --rm --network none`으로 `test.sh`를 실행한다. patch는 `/logs/artifacts/model.patch:ro`, `<dir>/logs`는 `/logs/verifier`에 마운트하고, 시간 제한은 `task.toml` `[verifier] timeout_sec`다. 에이전트 작업 공간은 마운트하지 않는다.
  3. stdout을 `<dir>/logs/test-stdout.txt`에 저장한다.
  4. `--output` 파일에 `deepsweVerdict` 결과를 쓰고 0으로 끝난다(판정이 `unjudgeable`이어도 파일을 썼으면 0).
- 성공(카드·실행기):
  - `external_verifiers[].runtime: host` 검증기는 compose가 아니라 호스트에서 `hostVerifierArgv`의 `argv[0]`을 직접 spawn한다(앞에 `node`를 붙이지 않는다). cwd는 `benchmarks/`다.
  - 세 실행 경로가 `verdictFields(verifier.json)`으로 `judge_status`·`score`·`outcome_success`·`reward`·`f2p_passed`·`f2p_total`·`p2p_passed`·`p2p_total`·`apply_failed`를 `run.json`에 복사한다(없는 키는 `null`).
- 성공(diff):
  - vanilla(`run-cursor.cjs`): `submissionDiff({ mode: 'worktree', cwd: workDir, base, excludes })` — `git add -N --all` 뒤 `git diff --binary --no-ext-diff <base> -- <pathspec>`.
  - bouncer-full(`collectFinalEvidence`): workspace 메인 저장소에서 `git diff --binary --no-ext-diff <base> <branch> -- <pathspec>`. finalize 뒤 worktree 없이 만든다.
  - 아카이브 재채점: `submissionDiff({ mode: 'ref', cwd: integration, base, ref: 'HEAD', excludes, env: { GIT_DIR, GIT_WORK_TREE } })`.
  - `pathspec = submissionPathspec(excludes)` = `['.', ':(exclude).bouncer', ':(exclude).worktrees', ...excludes.map((p) => `:(exclude)${p}`)]`. `excludes`는 `setupExcludes(record.workspace_setup?.steps ?? null)`이다(`applyWorkspaceSetup`은 `{ steps, index_tree } | null`을 돌려준다, `task-card.cjs:155`).
- 성공(bouncer-full 판정): `verifyPatch`는 `verifier.json`이 있으면 판정과 상관없이 복사만 하고 throw하지 않는다(`unjudgeable`은 `sampleEligibility`가 표본에서 뺀다).
- 실패(판정 기록):
  - `reward.json` 없음 + `reward.txt` `-1` → `unjudgeable`, `error: "verifier infrastructure failure"`
  - `reward.json` 없음 + `reward.txt` 없음 또는 다른 값 → `unjudgeable`, `error: "reward.json missing"`
  - 시간 초과 → `unjudgeable`, `error: "verifier timeout"`. 판정 순서는 ① `timedOut` ② `rewardJson` 있음(아래 `apply_failed`·`invalid reward`·`graded`) ③ `rewardTxt` `-1` ④ 그 밖 `reward.json missing`이다. 시간 초과면 `reward.json`이 있어도 읽지 않는다(컨테이너가 강제 종료돼 부분 결과일 수 있다).
  - `apply_failed` → `graded`, `reward: 0`, `apply_failed: true`
  - `reward`가 0/1이 아님 → `unjudgeable`, `error: "invalid reward"`
  - `unjudgeable`이면 `score`·`outcome_success`·`reward`·`f2p_passed`·`f2p_total`·`p2p_passed`·`p2p_total`·`apply_failed`가 모두 `null`이다. `score = reward * 100`·`outcome_success = reward === 1`은 `graded`일 때만 계산한다(`null * 100`이 `0`이 되어 인프라 실패가 0점으로 섞이지 않게 한다). TASKS-002 `budgetStopRecord`의 `null` 필드와 같은 형식이다.
- 실패(throw): 검증기 프로세스가 0이 아닌 코드로 끝나고 `verifier.json`이 없으면 bouncer-full·아카이브 재채점은 지금처럼 `external verifier failed`로 throw하고, run-cursor는 지금처럼 `unjudgeable`로 기록한다.
- 보존: compose `verifier` 서비스와 `runtime`이 없는 검증기(fastify-001 `upstream-tests.cjs`)의 실행·출력, 기존 `run.json` 필드 이름. fastify-001 제출 diff에서 빠지는 것은 `.bouncer/`·`.worktrees/`뿐이다(`node_modules`는 이미 gitignore되어 diff에 없다).

#### Interface

- 제공:
  - `verifiers/deepswe.cjs`: `deepsweVerdict({ rewardJson: object|null, rewardTxt: string|null, timedOut: boolean }) → { judge_status, score, max_score: 100, outcome_success, reward, f2p_passed, f2p_total, p2p_passed, p2p_total, apply_failed, error }`. 순수 함수. `score = reward * 100`, `outcome_success = reward === 1`. 직접 실행일 때만 `main()`.
  - `submission-diff.cjs`:
    - `submissionPathspec(excludes: string[]) → string[]`.
    - `submissionDiff({ mode: 'worktree'|'ref', cwd, base, ref?, excludes, env? }, deps) → string`. `deps.runGit(args: string[], { cwd: string, env?: object }) → string`(stdout). 기본값은 `execFileSync('git', args, { cwd, env: { ...process.env, ...env } })`.
  - `task-card.cjs`:
    - `setupExcludes(steps: object[]|null) → string[]`. 입력은 `applyWorkspaceSetup` 기록의 `steps` 배열(항목 `{ kind, source, target?, source_sha256, paths? }`)이고 카드 `workspace_setup` 항목이 아니다. `null` → `[]`. `kind: 'restore_untracked'` → 그 항목의 `paths`, 그 밖 종류(`install_dependencies`, `copy`, `apply_index_patch`) → `[]`(epic 성공 기준 8은 `.bouncer/`·`.worktrees/`·복원 경로만 뺀다. `copy` 대상은 에이전트가 고칠 수 있는 파일이고 `node_modules`는 이미 gitignore돼 diff에 없다).
    - `verifierInvocation(card)`: `runtime: host`면 `{ id, timeoutMs, runtime: 'host', argv }`(자리표시자 그대로), 아니면 지금처럼 `{ id, timeoutMs, composeArgs }`.
    - `hostVerifierArgv(invocation, { runDir, workDir }) → string[]`. `renderArgv(invocation.argv, { submission_patch: <runDir>/diff.patch, eval_dir: <runDir>/verify-work, result_json: <runDir>/verifier.json, final_repo: <workDir> })`.
    - `verdictFields(verifierJson) → { judge_status, score, outcome_success, reward, f2p_passed, f2p_total, p2p_passed, p2p_total, apply_failed }`.
    - `checkCard`는 검증기 항목 키를 스키마 항목 `properties`와 대조한다.
  - `run-bouncer-full.cjs` `collectFinalEvidence({ workspace, baseCommit, branch, blueprint, excludes = [], deps })`. 기존 `deps.git`을 그대로 쓰고 patch 인자에 `submissionPathspec(excludes)`를 붙인다.
  - `run-bouncer-full.cjs`가 `applyVerdict(record, { verifierJson }) → void`를 내보낸다. `verifierJson`은 읽은 `verifier.json` 객체 또는 `null`(파일 없음)이다. `null`이면 `external verifier failed: verifier.json missing`으로 throw하고, 아니면 `Object.assign(record, verdictFields(verifierJson))`만 하며 `judge_status`와 상관없이 throw하지 않는다. `verifyPatch`는 검증기 실행 뒤 이 함수를 부른다(종료 코드 ≠ 0이고 파일이 있으면 판정을 기록한다).
  - 스키마 검증기 항목에 `runtime: { "enum": ["host"] }`(선택).
- 거부(즉시 throw):
  - 검증기 항목에 스키마에 없는 키 → `<id>: verifier <vid> has unknown fields: <keys>`
  - `runtime`이 `"host"`가 아님 → `<id>: verifier <vid> runtime must be host`
  - `deepswe.cjs`: `--task`의 `prepared.json` 없음, `--patch` 파일 없음
  - `submissionDiff`: `mode`가 두 값이 아님, `ref` 모드에 `ref` 없음
- 거부(기록): `deepsweVerdict`의 판정 실패는 throw가 아니라 위 `unjudgeable` 기록이다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `benchmarks/verifiers/deepswe.cjs` | `deepsweVerdict`, `main` | Create | 없음 | 공식 채점기 실행과 결과 변환 | Target 검증기 |
| `benchmarks/verifiers/deepswe.test.cjs` | 테스트 | Create | 없음 | `deepsweVerdict` 경우별 검사 | Checklist |
| `benchmarks/submission-diff.cjs` | `submissionPathspec`, `submissionDiff` | Create | 없음 | 두 모드 공용 제출 diff | Target diff |
| `benchmarks/submission-diff.test.cjs` | 테스트 | Create | 없음 | 임시 git 저장소로 두 모드·제외 경로 검사 | Checklist |
| `benchmarks/task-card.cjs` | `checkCard`, `verifierInvocation`, 신규 `setupExcludes`·`hostVerifierArgv`·`verdictFields` | Modify | compose 검증기만, 항목 키 미검사 | host 분기, 항목 키 검사, 제외 경로·판정 필드 추출 | `:16-21`, `:71-76`, `:178-183`, `:205-208` |
| `benchmarks/task-card.test.cjs` | 테스트 | Modify | composeArgs 검사 | host 분기·거부·`setupExcludes`·`verdictFields` | `:55-68` |
| `benchmarks/schemas/task-card.schema.json` | `external_verifiers` 항목 | Modify | argv·timeout | `runtime` 추가 | `:62-77` |
| `benchmarks/run-cursor.cjs` | `main` | Modify | 작업 트리 diff, compose 검증기, 세 필드 복사 | `submissionDiff` worktree 모드, host 검증기, `verdictFields` | `:230-248` |
| `benchmarks/run-bouncer-full.cjs` | `collectFinalEvidence`, `verifyPatch`, 신규 `applyVerdict`, `main` | Modify | 제외 없는 브랜치 diff, `unjudgeable` throw | `submissionPathspec` 제외, host 검증기, `verdictFields`, `unjudgeable` 기록 | `:268-282`, `:284-311` |
| `benchmarks/run-bouncer-full.test.cjs` | 테스트 | Modify | 증거 검사 | `.bouncer/` 제외 단언 | `:31-61` |
| `benchmarks/score-archived-run.cjs` | `main` | Modify | env 클로저 diff, compose 검증기 | `submissionDiff` ref 모드(env 전달), host 검증기, `verdictFields` | `:40-48`, `:57-77` |

#### Constraints

- 받은 `grader.py`·`test.sh`·`config.json`은 수정하지 않는다.
- 채점 컨테이너는 에이전트 작업 공간을 마운트하지 않는다. patch 파일만 넘긴다.
- 단위 테스트는 docker를 띄우지 않는다. 채점기 실행은 TASKS-004 정답 확인으로 확인한다.
- 코드 주석·docstring은 `references/coding-standards/index.md` `Comments and docstrings`(한국어 Summary·Args·Returns)를 따른다.
- 새로 만들거나 바꾸는 테스트 이름은 `<조건> → <결과>` 형식이다(`references/coding-standards/index.md` `Tests`). 기존 테스트 이름은 바꾸지 않는다.
- `submission-diff.test.cjs`의 두 모드 사례와 `collectFinalEvidence` 사례는 임시 git 저장소를 실제로 쓴다. 코딩 표준은 실제 git을 integration 테스트로 한정하지만, 검사 대상이 git pathspec `:(exclude)`의 실제 결과라 seam으로 대신하면 제외가 동작하는지 확인할 수 없다. 이 근거를 테스트 파일 주석에 적는다. env 전달 사례는 `deps.runGit` seam으로 본다.
- run-cursor의 diff는 TASKS-002 `withOwnershipRestore` 뒤에 만든다.

### deepswe-benchmark/deepswe-adapter/004 · `26e511c3`

#### Goal & intent

네 DeepSWE 과제를 카드·평가자 정책·매니페스트 항목으로 더하고, `check-deepswe-solution.cjs`로 각 과제의 공식 채점이 손대지 않은 작업 공간을 `reward` 0, 정답 patch를 `reward` 1로 판정함을 확인한다.
완료 조건은 다음 세 가지다.
- `npm run ci`가 통과한다.
- Checklist 수동 단계의 정답 확인·dry-run·build-only 출력을 과제마다 `benchmarks/deepswe/README.md`의 `## 정답 확인 기록` 절에 날짜·card id·DeepSWE 커밋과 함께 남긴다(추적 파일이라 finalize 뒤에도 남는다).
- 네 과제의 `--dry-run`이 작업 공간 준비까지 돈다.

#### Current behavior

- 기준: develop `6fc76678`. `f2450fbe`까지 `benchmarks/`는 바뀌지 않았다. `test/acq-gate-ids.test.js`·`CHANGELOG.md`·`package.json`은 그 사이 바뀌었고 아래 줄 번호는 `f2450fbe` 기준이다. `benchmarks/tasks`·`benchmarks/configs`에는 fastify-001 자산만 있고 `benchmarks/deepswe/`는 없다(`manifest.json`은 TASKS-001이 만든다).
- 과제 카드는 `benchmarks/tasks/<id>.yaml`이다. 형식은 `tasks/fastify-001.yaml:1-45`(id, set, benchmark_version, base_commit, user_request_file, user_request_sha256, allowed_paths, forbidden_paths, workspace_setup, failure_opportunities, external_verifiers, success_checklist, manual_rubric, evaluator_facts), 검증은 `task-card.cjs:48-78`, id는 `^[a-z][a-z0-9-]*-[0-9]{3}$`이다.
- 평가자 정책은 `benchmarks/configs/<id>-evaluator-policy.json`이다. 실행기는 정책 `task_id`를 카드 id와 짝짓는다.
  - 최상위 키: `policy_version`(3), `task_id`, `approval_state`, `approved_by`, `approval_record`, `base_commit`, `request_file`, `purpose`, `shared_rules`, `benchmark_choices`, `task_facts`, `workflow`, `controller_actions`, `bouncer_decisions`, `vanilla_questions`, `completion_evidence`.
  - `task_facts` 키: `goal`, `product_paths`, `bouncer_management_paths`, `verification_command`, `base_branch`, `expected_gitignore_suggestions`, `discovery_terms`, `reusable_draft`.
  - `loadPolicy`(`acp/responder.cjs:115-140`) 검사 순서: ① `policy_version 3`·`task_id` 형식 ② `discovery_terms` 비어 있지 않음·`reusable_draft` 있음 ③ 모든 카탈로그 게이트와 구현된 답(또는 `stop`) ④ `approval_state === 'approved'`가 아니면 `evaluator policy is proposed; explicit user approval is required...`로 throw ⑤ `benchmark_choices`. 구조가 맞는 `proposed` 정책은 ④에서만 실패한다.
- `test/acq-gate-ids.test.js:51` `POLICY_NAMES = ['fastify-001']`. 정책 파일을 `fs.readFileSync`로 읽어(`:58`, `:67`, `:81`) 다음을 단언한다: 게이트 id가 카탈로그 안(`:57-61`), `policy_version 3`·`finalize.next_blueprint` 없음·`finalize.remainder` 답·`approval_record`가 `/2026-10-08 conversation: 사용자 승인/`(`:66-72`), approved(`:75`), 카탈로그 id 전부(`:80-83`). 목록에 파일이 없는 이름을 넣으면 세 테스트가 단언 실패가 아니라 `ENOENT`로 throw한다. 세 테스트 이름은 `<조건> → <결과>` 형식이다(`:53`, `:65`, `:78`).
- `npm run ci`(`package.json:47`)는 `typecheck` 다음에 `lint:test-names`(`scripts/check-test-names.js`)를 돌려 `test/*.test.js`의 테스트 이름이 공백으로 감싼 `→`를 갖지 않으면 실패한다. `benchmarks/*.test.cjs`는 검사하지 않는다.
- `benchmarks/acp/responder.test.cjs`는 fastify-001 정책을 `:14`에서 읽고, `loadPolicy` 승인·버전 테스트가 `:47-61`에 있다. `:670`에 `const POLICY_NAMES = ['fastify-001']`가 있고, 커버리지 루프(`:708-717`, TASKS-002가 `isImplementedAnswer`로 바꾼다)와 `승인된 정책 → loadPolicy 통과`(`:720-724`)가 이 목록을 돈다. 여기에 `proposed` 정책을 넣으면 `:720-724`가 `explicit user approval`로 실패한다.
- `test/tiers.json`은 `test/*.test.js`만 다룬다(`test/test-tiers.test.js:27-34`). `benchmarks/*.test.cjs`는 `npm run ci` 안의 `test:coverage`(`package.json:46-47`) 기본 탐색으로 돌고 tier 등록이 필요 없다.
- `CHANGELOG.md:8` `[Unreleased]`에는 `### Changed`(`:10`, EPIC 095·088), `### Removed`(`:36`, BP 001), `### Added`(`:44`, EPIC 093)가 이 순서로 있다.
- `build-upstream-task.cjs:170-189` `--check-solution`이 `untouched`·`solution`을 채점해 JSON으로 내는 패턴이 있다.
- 네 과제(DeepSWE 커밋 `0b9fabbb63b9104d678fe965e1632f2dd9eaa2ea`)

| card id | DeepSWE task | 언어 | 상류 기본 브랜치 | base_commit_hash | instruction.md sha256 | f2p/p2p |
| --- | --- | --- | --- | --- | --- | --- |
| `deepswe-quill-001` | `quill-shared-toolbar-focus` | TypeScript | `main` | `539cbffd0a13b18e9c65eb84dd35e6596e403158` | `a983670bc6aaee7de85eb8aeef1a4f1db44788ecc36905a0bccbec469e0c73cd` | 13/22 |
| `deepswe-expr-001` | `expr-try-catch-errors` | Go | `master` | `851b241a301f7c74646e65e4009c69cf290993a8` | `6f19f8363f75963c69072f03aa7515ffa304d6b726f85b09188760ae682e3447` | 79/66265 |
| `deepswe-statemachine-001` | `python-statemachine-state-data-scoping` | Python | `develop` | `8d17ba9f6ba8420cf05fddb94013bc221ed9a222` | `17e0781f9837bebd7304d5f1594dbf7de9a147a3ba8f03111e005f8376b3126a` | 72/1286 |
| `deepswe-oxvg-001` | `oxvg-structural-selector-preservation` | Rust | `main` | `1fd7fab851ecc975e008be0e3e279568ce4e2b51` | `8d2295f55760d269913b22c17b4c345ca41fd2d586fc6ba59c34fb97b4422db9` | 6/62 |

- 지시문은 영어 원문이고, 테스트 파일을 고치지 말라는 문장은 없다.
- 상류 라이선스는 quill BSD-3-Clause, expr·python-statemachine·oxvg MIT다. DeepSWE 과제 명세·검증기는 Apache-2.0이다(`PROVENANCE.md`).

#### Target behavior

- 성공(카드)
  - 공통값은 다음과 같다.
    - `set: general`
    - `benchmark_version: deepswe-v1.1`
    - `base_commit`: 위 표 값
    - `user_request_file: fixtures/deepswe/<card-id>/task/instruction.md`
    - `user_request_sha256`: 위 표 값
    - `workspace_setup: [{ restore_untracked: <card-id> }]`
    - `failure_opportunities: []`
  - `allowed_paths`는 `**`, `forbidden_paths`는 `.git/**`다. DeepSWE 채점이 경로 범위를 따로 보지 않으므로 넓게 둔다.
  - `external_verifiers`는 `[{ id: deepswe, runtime: host, argv: [node, verifiers/deepswe.cjs, --task, <card-id>, --patch, "{submission_patch}", --out-dir, "{eval_dir}", --output, "{result_json}"], timeout_ms: 2100000 }]`다.
  - `success_checklist`는 공식 채점기 `reward` 1이다. `manual_rubric`은 `deepswe`다.
  - `evaluator_facts.commit`은 "커밋은 하지 않아도 됩니다. 변경을 작업 트리에 남겨 주세요."다.
- 성공(정책)
  - fastify-001 정책을 틀로 쓴다. 바꾸는 값은 `task_id`, `base_commit`, `request_file`, `task_facts`, `bouncer_decisions`의 `init.base_branch` 답, `approval_state: proposed`, `approved_by: null`, `approval_record`다. `plan.light_scope` 항목의 `when`은 fastify 사실("public CLI option contract", "same criterion as ledger-001")을 복사하지 않고 `"Do not declare this task light: it changes behavior across several modules and its tests."`로 쓴다. 그 밖의 `bouncer_decisions`·`shared_rules`·`workflow` 문구에 fastify·ledger 고유 사실이 있으면 같은 방식으로 과제 중립 문구로 바꾼다. `approval_record`는 fastify-001의 승인 이력을 복사하지 않고 `"2026-10-11 초안: fastify-001 정책 형식을 따르고 DeepSWE 과제 사실만 바꿈. 사용자 승인 전에는 실행기가 거절한다."` 한 줄로 쓴다.
  - `task_facts.base_branch`는 위 표의 상류 기본 브랜치이고, `init.base_branch` 답도 그 브랜치다.
  - `plan.verify_command`: package.json이 있는 quill은 fastify-001처럼 `recommended_package_script`. expr·statemachine·oxvg는 TASKS-002가 더한 `policy_verification_command`이고, `task_facts.verification_command`는 그 과제 `tests/test.sh`가 p2p 테스트에 쓰는 테스트 명령을 단일 argv 문자열로 옮긴 값이다(파이프·`&&`·`cd` 없이, 예: `go test ./...`). `when`도 그 명령을 적는다.
  - `expected_gitignore_suggestions`는 과제 작업 공간 임시 복제본에서 `bouncer init`이 실제로 제안한 목록이다.
  - `discovery_terms`는 지시문의 핵심 식별자 3~5개다.
- 성공(정답 확인): `check-deepswe-solution.cjs <card-id>`는 다음을 한다. 채점은 TASKS-003의 호스트 검증기를 그대로 써서 실행기와 같은 경로(`--network none`, `/logs` 마운트, `reward.json` 읽기, `deepsweVerdict`)를 거친다. 임시 디렉터리 `<tmp>`에 빈 파일 `<tmp>/untouched.patch`를 만들고, 두 patch마다 `node verifiers/deepswe.cjs --task <card-id> --patch <patch> --out-dir <tmp>/<kind> --output <tmp>/<kind>/verifier.json`(cwd `benchmarks/`)을 spawn한 뒤 각 `verifier.json`을 읽는다. docker를 직접 부르지 않는다.
  1. 공식 채점기로 두 patch를 채점한다(채점 컨테이너는 작업 공간을 마운트하지 않는다). 하나는 빈 patch(`untouched`)이고, 다른 하나는 `task/solution/solution.patch`(`solution`)다. 공식 `grader.py prepare`는 patch가 없거나 비어 있으면 `git apply` 없이 기준 상태를 채점한다(`grader.py:148-149`). 그래서 `untouched`는 `apply_failed` 없이 숨은 f2p 테스트 실패로 `reward 0`이 된다.
  2. `{ card_id, untouched: { reward, f2p_passed, f2p_total, apply_failed }, solution: { ... } }`를 출력한다.
  3. `untouched.reward !== 0` 또는 `solution.reward !== 1`이면 0이 아닌 코드로 끝난다.
- 성공(테스트):
  - `acq-gate-ids.test.js` `POLICY_NAMES`에 네 정책을 더하고 단언을 `approval_state`별로 나눈다. `approved`(fastify-001)는 지금 단언(`2026-10-08` 승인 기록 포함)을 유지하고, `proposed`는 `approved_by === null`과 카탈로그·버전·`finalize.remainder` 단언만 받는다. 각 정책 파일 존재를 `assert.ok(fs.existsSync(file), file)`로 먼저 단언한다.
  - `responder.test.cjs`: 기존 `POLICY_NAMES`(`:670`)는 `['fastify-001']` 그대로 두고, 그 옆에 `PROPOSED_POLICY_NAMES`(네 이름)를 새로 둔다. 커버리지 루프(`:708-717`)는 두 목록을 모두 돈다. 새 테스트 `proposed 정책 → loadPolicy가 explicit user approval로 거부`는 네 정책 각각 `loadPolicy` → `/explicit user approval/`로 throw함을 단언한다(④까지 구조가 맞다는 뜻). `승인된 정책 → loadPolicy 통과`(`:720-724`)는 바꾸지 않는다.
  - 새 테스트는 `benchmarks/check-deepswe-solution.test.cjs`이므로 `test/tiers.json` 변경은 없다.
- 성공(문서)
  - `benchmarks/deepswe/README.md`: 출처·고정 커밋·Apache-2.0 고지·과제별 상류 라이선스, 준비·정답 확인·실행 명령, `## 정답 확인 기록` 절(수동 단계 출력), 해결률 근거(공개 trials grok 계열 30~45%), 공식과의 차이(에이전트 네트워크).
  - `benchmarks/README.md`: DeepSWE 절.
  - CHANGELOG `[Unreleased]`: 이미 있는 `### Added`(`:44`) 맨 앞에 BP 002 항목을 더한다. 새 `### Added` 제목을 만들지 않고, 다른 절의 항목은 그대로 둔다.
- 실패: 받은 지시문 sha256이 카드와 다르면 `loadCard`가 throw한다(기존 동작). 정답 확인 불일치는 0이 아닌 종료다.
- 보존: fastify-001 카드·정책과 그 테스트.

#### Interface

- 제공: `node benchmarks/check-deepswe-solution.cjs <card-id>`, `solutionVerdict({ untouched, solution }) → { ok: boolean, reasons: string[] }`(입력은 두 `verifier.json` 객체. `ok`는 `untouched.judge_status === 'graded' && untouched.reward === 0 && !untouched.apply_failed && solution.judge_status === 'graded' && solution.reward === 1`일 때만 참이고, 아니면 어긋난 조건을 `reasons`에 담는다), 카드 4개, 정책 4개, `manifest.json` `tasks` 4개 항목, `benchmarks/deepswe/README.md`.
- 거부: `check-deepswe-solution.cjs`는 `prepared.json` 없음(준비 명령 안내)과 매니페스트에 없는 id에서 즉시 0이 아닌 코드로 끝난다. 정책은 `proposed`이므로 이 명령은 `loadPolicy`를 부르지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `benchmarks/tasks/deepswe-quill-001.yaml` | 카드 | Create | 없음 | 위 표의 카드 | Target 카드 |
| `benchmarks/tasks/deepswe-expr-001.yaml` | 카드 | Create | 없음 | 위 표의 카드 | Target 카드 |
| `benchmarks/tasks/deepswe-statemachine-001.yaml` | 카드 | Create | 없음 | 위 표의 카드 | Target 카드 |
| `benchmarks/tasks/deepswe-oxvg-001.yaml` | 카드 | Create | 없음 | 위 표의 카드 | Target 카드 |
| `benchmarks/configs/deepswe-quill-001-evaluator-policy.json` | 정책 | Create | 없음 | proposed 정책 | Target 정책 |
| `benchmarks/configs/deepswe-expr-001-evaluator-policy.json` | 정책 | Create | 없음 | proposed 정책 | Target 정책 |
| `benchmarks/configs/deepswe-statemachine-001-evaluator-policy.json` | 정책 | Create | 없음 | proposed 정책 | Target 정책 |
| `benchmarks/configs/deepswe-oxvg-001-evaluator-policy.json` | 정책 | Create | 없음 | proposed 정책 | Target 정책 |
| `benchmarks/deepswe/manifest.json` | `tasks` | Modify | 빈 과제 목록 | 네 항목 | Interface |
| `benchmarks/deepswe/README.md` | 문서 | Create | 없음 | 출처·라이선스·명령 | Target 문서 |
| `benchmarks/rubrics/deepswe.md` | 루브릭 | Create | 없음 | 카드 `manual_rubric: deepswe`가 가리키는 채점 기준. 공식 `tests/test.sh`의 `reward`가 주점수(`score = reward * 100`, `outcome_success = reward === 1`)이고 f2p·p2p는 보조 기록임을 `rubrics/fastify-001.md` 형식으로 적는다 | `README.md:38` `rubrics/<name>.md` 관례 |
| `benchmarks/check-deepswe-solution.cjs` | `main`, `solutionVerdict` | Create | 없음 | 정답 확인 명령 | Target 정답 확인 |
| `benchmarks/check-deepswe-solution.test.cjs` | 테스트 | Create | 없음 | 판정 함수 검사 | Checklist |
| `test/acq-gate-ids.test.js` | `POLICY_NAMES`, 승인 단언 | Modify | 승인 정책만 가정 | 네 정책, 파일 존재 단언, 상태별 단언 | `:51-83` |
| `benchmarks/acp/responder.test.cjs` | `loadPolicy` 사례 | Modify | fastify-001만 | proposed 정책 거부 사례 | `:47-61` |
| `benchmarks/README.md` | 본문 | Modify | fastify·상류 과제 설명 | DeepSWE 절 | Target 문서 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 변경 이력 | BP 002 항목 | 성공 기준 10 |

#### Constraints

- 정책 `approval_state`는 `proposed`로 둔다. 승인은 측정 전에 사용자가 따로 한다.
- 지시문은 번역하지 않는다.
- 정답 확인과 `--dry-run`은 Docker·네트워크가 필요하다. CI 테스트는 판정 함수만 검사한다.
- 코드 주석·docstring은 `references/coding-standards/index.md` `Comments and docstrings`(한국어 Summary·Args·Returns)를 따른다.
- `acq-gate-ids.test.js`에서 나누거나 새로 만드는 테스트 이름은 `<조건> → <결과>` 형식이다(`lint:test-names`가 `npm run ci`에서 검사한다). `check-deepswe-solution.test.cjs`·`responder.test.cjs`의 새 테스트 이름도 같은 형식을 쓴다. 기존 테스트 이름은 바꾸지 않는다.