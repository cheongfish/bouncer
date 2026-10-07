---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/088-drive-token-reduction/blueprints/001-coordinator-recovery-fixes/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-07T08:55:21.486+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '088'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: dfa125aaf99c4eab63b33699e004a2143131b97a
      range_to: ac4bde75d9f31e50b3de870d9235b47d5320d9f5
      diff_sha: 3f264975c77821f1bfabcbfbadd5ede17c135f2810018ba843be6e72bf05bb55
      recorded_at: '2026-10-07T09:01:29+09:00'
  task_commits:
    - task: EPIC-088/BP-001/TASK-001
      sha: c7977f6f
      intent_anchor: task-001
    - task: EPIC-088/BP-001/TASK-002
      sha: a2f6e72a
      intent_anchor: task-002
    - task: EPIC-088/BP-001/TASK-003
      sha: 6329bad2
      intent_anchor: task-003
    - task: EPIC-088/BP-001/TASK-004
      sha: 61c58e62
      intent_anchor: task-004
    - task: EPIC-088/BP-001/TASK-005
      sha: ac4bde75
      intent_anchor: task-005
---
# Explain

## Background
1.5.4 재측정에서 coordinator 세션이 실행 토큰의 큰 몫을 썼다. 정상 순서에서도 `record`가 `stale-worker-report`를 내고, worker worktree에 epic·context index가 없어 게이트가 깨지고, `--help`를 쓰려면 CLI 소스를 열어 플래그를 확인했다. 이 변경은 그 다섯 원인을 고친다. brief 해시는 `bouncer.status`와 `bouncer.commit_sha`만 빼고 같은 정규형 함수를 `dispatch`·`record`·`intent bundle`이 쓴다. worker seed는 base에 있는 epic `index.md`와 `.bouncer/context/index.md`를 넣는다. `coordinate` 서브커맨드, `review record`, `dispatch print`는 필수 인자 검사보다 `--help`를 먼저 처리하고, 필수 플래그 누락은 stderr에 오류와 usage를 함께 쓴다. `/bouncer-run`과 coordinator는 통합·검증에서 멈추고 `/bouncer-finalize`를 직접 진행하지 않는다. 벤치마크 `bouncer` 이미지는 `/etc/profile.d`와 `node`의 `.bashrc`에 플러그인 `scripts` PATH를 넣는다.

## Intuition
해시는 brief 본문만 보고, 도움말은 소스 대신 CLI가 말하며, run은 마감 퀴즈까지 끌고 가지 않는다.

## Code
- `scripts/src/lib/task-brief-hash.ts` — `taskBriefHash`. `LIFECYCLE_KEYS`는 `status`와 `commit_sha`. 입력 객체를 깊은 복사한 뒤 지운다. `coordinator.ts`의 `taskBriefHashOf`, `intent-bundle.ts`가 같은 함수를 쓴다.
- `scripts/src/lib/seed-worktree.ts` — `seedCoordinatorWorker`. `seedIntegration`과 같은 `epicDirOf`·`CONTEXT_ROOT`로 epic·context index를 시드한다.
- `scripts/src/lib/cli-git-commands.ts`, `cli-review-command.ts`, `cli-dispatch-command.ts` — `argvRequestsHelp`가 필수 검사보다 앞선다. `review record --help`는 검증기를 통과하는 `--round` JSON 예시를 함께 출력한다.
- `benchmarks/docker/Dockerfile.cursor` — `bouncer` 단계에서 `/etc/profile.d/bouncer-path.sh`를 root로 쓰고, `.bashrc` PATH와 `bouncer-root --auto`는 `node`로 둔다.
- `agents/bouncer-coordinator.md`, `skills/bouncer-run/SKILL.md`, `rules/output.md`, `docs/workflow.md` — 모든 commit task 통합·검증 뒤 closing action을 진행하지 않고, 통합 worktree에서 `/bouncer-finalize`를 안내한다.

## Quiz
1. `taskBriefHash`가 정규형에서 빼는 frontmatter 키는?
   - A) `bouncer.status`와 `bouncer.commit_sha`만
   - B) `bouncer.status`, `bouncer.commit_sha`, `bouncer.affected_paths`
   - C) YAML 키를 전부 빼고 본문만 해싱한다
2. `seedCoordinatorWorker`가 base에 파일이 있을 때 추가로 시드하는 것은?
   - A) worker `verification.md`만
   - B) epic `index.md`와 `.bouncer/context/index.md`
   - C) 메인 worktree의 `.git/`
3. `bouncer coordinate status --help`의 동작은?
   - A) 필수 플래그를 먼저 검사하고 없으면 exit 2
   - B) 다른 플래그를 무시하고 stdout 도움말, exit 0
   - C) 도움말을 stderr에만 쓰고 exit 1
4. 벤치마크 `bouncer` 이미지에서 플러그인 `scripts` PATH를 넣는 위치는?
   - A) `/etc/profile.d`와 `node` 사용자의 `.bashrc`
   - B) CI 잡 YAML의 `env:`만
   - C) 호스트 `PATH`를 이미지에 복사
5. 모든 commit task가 통합·검증된 뒤 `/bouncer-run`·coordinator가 하는 일은?
   - A) 같은 세션에서 `/bouncer-finalize` 퀴즈와 remainder를 진행한다
   - B) 터미널 보고에서 통합 worktree의 `/bouncer-finalize` 실행을 안내하고 멈춘다
   - C) `bouncer commit --yes`로 포인터를 지운다

## Tasks

### EPIC-088/BP-001/TASK-001 · `c7977f6f`

#### Goal & intent

coordinator 드라이브의 정상 순서(dispatch → report → `bouncer commit` → record)에서 record가 `stale-worker-report`로 거절되지 않게 한다. brief 본문이나 brief 내용 frontmatter가 바뀐 경우는 계속 거절한다(epic Success criteria 1). 수용 기준은 Checklist의 회귀 테스트와 `bouncer.verify` 통과다.

#### Current behavior

- 해시 정의가 두 곳에 있고 둘 다 `tasks.md` 원본 바이트 전체의 SHA-256이다.
  - `taskBriefHashOf`(`scripts/src/lib/coordinator.ts:530-533`): 모듈 `fs`로 읽는다. 호출은 dispatch(:2616, 원장 `item.dispatch.task_brief_hash`에 저장)와 record(:2706, 다르면 `stale-worker-report`) 두 곳이다. report(:2640-2687)는 다시 계산하지 않고 호출자 값과 저장값을 비교한다.
  - `loadExecutionTask`(`scripts/src/lib/intent-bundle.ts:392-399`): 주입된 `input.fs`로 읽은 바이트를 해시한다. 같은 함수가 :368에서 `readDoc`로 frontmatter를 이미 파싱한다. 값은 `resolveTaskIntentBundle`(:212, 기록 :248·:272·:286)과 `projectRoleIntentSections`(:1051 비교, 다르면 `intent-bundle-stale`)가 쓴다.
- 드라이브 중 `tasks.md`를 쓰는 지점:
  - `commitTask`(`scripts/src/lib/commit.ts:452-470`)가 커밋 직후 `bouncer.commit_sha`를 넣고 `renderDoc`로 다시 쓴다. 키 값과 YAML 직렬화가 함께 바뀌므로, report 뒤 commit을 하면 record가 항상 `stale-worker-report`가 된다.
  - `tasks → verified`는 에이전트가 손으로 바꾼다(`agents/bouncer-coordinator.md:222-224`). 바이트 형태는 편집 방식에 따라 다르다.
- 헬퍼: `parseFrontmatter`(`scripts/src/lib/frontmatter.ts:19-29`)는 순수 함수이고 frontmatter가 없으면 `missing frontmatter block`을 던진다. `canonicalJson`/`sha256Canonical`(`scripts/src/lib/approval-snapshot.ts:37-61`)은 키를 재귀 정렬한 JSON의 SHA-256이며, 지금은 export하지 않는다(:158).
- 재현: `test/coordinator.test.js`의 `preparedCommitDrive`(:1364)와 `acceptDispatchReport`(:53-68)로 report까지 진행한 뒤 worker `tasks.md`에 `readDoc`/`renderDoc`로 `commit_sha`를 넣고 record를 부르면 `stale-worker-report`가 난다. 기존 e2e(`test/coordinator-e2e.test.js:169-202`)는 `commit_sha`를 dispatch 전에 써서 이 순서를 재현하지 않는다.
- 해시 정의에 묶인 테스트: `briefHash` 헬퍼(`test/coordinator.test.js:1385-1389`)와 'task_brief_hash is the sha256 of the current task brief bytes'(`test/intent-bundle.test.js:445-457`)가 원본 바이트 해시를 직접 계산한다. 나머지 고정값은 `'a'.repeat(64)` 자리표시자다.

#### Target behavior

- 성공: 해시 = `sha256Canonical(JSON.parse(JSON.stringify({ data, body })))`. `data`는 `parseFrontmatter`의 frontmatter에서 `bouncer.status`와 `bouncer.commit_sha`를 지운 사본이고, `body`는 `parseFrontmatter`가 돌려준 본문 문자열 그대로다. JSON 왕복은 js-yaml이 따옴표 없는 날짜를 `Date`로 읽어도 ISO 문자열로 바꿔, `canonicalJson`이 `Date`를 `{}`로 지우지 않게 한다.
  - report 뒤 `status`가 `verified`로 바뀌고 `commit_sha`가 들어가도(재직렬화 포함) record가 성공한다.
  - 같은 frontmatter 내용을 키 순서나 인용 방식만 다르게 써도 해시가 같다.
- 실패(계속 거절):
  - 본문이 바뀌면 `stale-worker-report`다. 기존 테스트 'record rejects after brief bytes change following an accepted report'가 그대로 통과해야 한다.
  - `bouncer.affected_paths` 같은 다른 frontmatter 키가 바뀌어도 `stale-worker-report`다.
- 오류: frontmatter 블록이 없거나 YAML이 깨진 `tasks.md`는 해시 계산이 예외를 던진다. `coordinate()`는 그 예외를 그대로 올리고, dispatch는 attempt를 열지 않고 원장 바이트를 바꾸지 않는다(해시 계산이 원장 변경보다 앞선다). record도 원장 바이트를 바꾸지 않는다. CLI는 기존 catch(`scripts/src/lib/cli-git-commands.ts` `cmdCoordinate` 끝)대로 stderr `coordinate: missing frontmatter block`, exit 1로 끝난다. 새 JSON reason은 만들지 않는다.
- 보존:
  - `coordinate dispatch`·`report`·`record`의 입력·출력 JSON 형태, reason 집합, 64자리 hex 형식, `intent-bundle-stale` 판정 위치는 바뀌지 않는다.
  - 원장 스키마도 바뀌지 않는다.

#### Interface

- 제공: 신규 모듈 `scripts/src/lib/task-brief-hash.ts`
  ```ts
  // markdown: tasks.md 전체 텍스트(UTF-8). 반환: 64자리 소문자 hex.
  function taskBriefHash(markdown: string): string;
  export = { taskBriefHash, LIFECYCLE_KEYS }; // LIFECYCLE_KEYS = ['status', 'commit_sha'] (bouncer 하위 키)
  ```
  - 순수 함수다(파일·프로세스 I/O 없음). `coordinator.ts`의 `taskBriefHashOf`와 `intent-bundle.ts`의 `loadExecutionTask`가 파일을 읽은 뒤 이 함수를 부른다.
  - `approval-snapshot.ts`는 기존 `sha256Canonical`을 export에 더한다(동작 변경 없음).
- 거부(즉시 throw)
  - frontmatter 블록이 없는 입력은 `parseFrontmatter`의 `missing frontmatter block`을 던진다.
  - YAML 파싱 오류는 js-yaml 예외를 그대로 던진다.
- 무시: `bouncer`가 객체가 아니거나 없으면 지울 키가 없는 것으로 보고 그대로 해시한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/task-brief-hash.ts` | `taskBriefHash` | Create | 없음 | lifecycle 키를 뺀 canonical 해시 | 두 해시 정의를 하나로 합칠 공유 지점 |
| `scripts/src/lib/coordinator.ts` | `taskBriefHashOf` | Modify | 원본 바이트 SHA-256 | 파일을 읽어 `taskBriefHash` 호출 | dispatch(:2616)·record(:2706) 해시 |
| `scripts/src/lib/intent-bundle.ts` | `loadExecutionTask` | Modify | 원본 바이트 SHA-256(:392-399) | 읽은 바이트를 UTF-8로 풀어 `taskBriefHash` 호출 | dispatch와 같은 값이어야 `intent-bundle-stale` 판정이 맞음 |
| `scripts/src/lib/approval-snapshot.ts` | `sha256Canonical` | Modify | 승인 digest용 canonical 해시(비공개) | export 목록에 추가 | 세 번째 canonical 구현을 만들지 않음 |
| `test/task-brief-hash.test.js` | 신규 테스트 | Create | 없음 | 순수 함수 단위 테스트 | 키 제외·순서 무관·거부 입력 |
| `test/coordinator.test.js` | `briefHash`, 신규 테스트 | Modify | 원본 바이트 해시 헬퍼 | `taskBriefHash` 사용, report→commit_sha→record 회귀 테스트 | 성공 기준 1 재현 |
| `test/intent-bundle.test.js` | 'task_brief_hash is the sha256 …' | Modify | 원본 바이트 해시 고정 | `taskBriefHash` 기준으로 바꿈 | 정의 변경의 직접 영향 |

#### Constraints

- 제외 키는 `bouncer.status`와 `bouncer.commit_sha` 두 개뿐이다. 다른 키를 더 빼지 않는다.
- 입력 객체를 변형하지 않는다. 깊은 복사본에서 지운다.
- 신규 모듈은 다른 `scripts/src/lib` 모듈처럼 값 경계를 `export =`와 `import x = require()`로만 둔다(`scripts/src/lib/cli.ts` 머리 주석).
- 해시 함수 안에서 파일을 읽지 않는다. 파일 접근은 기존 호출자의 `fs`·`input.fs`를 그대로 쓴다.
- `coordinator.ts`의 `taskBriefHashOf` 주석에 있는 "intent-bundle과 바이트 계약을 맞춘다"는 "같은 정규형 계약"으로 고친다.
- Touch 밖의 테스트 fixture가 frontmatter 없는 `tasks.md`로 dispatch해 깨지면, 고치지 말고 scope 개정을 보고한다.

### EPIC-088/BP-001/TASK-002 · `a2f6e72a`

#### Goal & intent

coordinator worker worktree가 integration checkout과 같은 계획 문맥을 받게 해서, worker에서 수동 복사 없이 `bouncer validate --gate execute`가 통과하게 한다(epic Success criteria 2). 수용 기준은 아래 Checklist의 회귀 테스트와 `bouncer.verify` 통과다.

#### Current behavior

- `seedCoordinatorWorker`(`scripts/src/lib/seed-worktree.ts:283-304`)는 `prepareDependencies`(:293, `npm ci`)와 `seedConfig`(:296) 뒤 blueprint 트리만 `fs.cpSync(..., { recursive: true, force: true })`(:299)로 복사하고 `seeded: [blueprintDir]`(:300)를 돌려준다. epic `index.md`와 `.bouncer/context/index.md`는 복사하지 않는다.
- `seedIntegration`(:310-356)은 blueprint 파일 목록에 `${epicDirOf(bp)}/index.md`와 `${CONTEXT_ROOT}/index.md`를 base에 있을 때만 더한다(:328-330). 헬퍼는 `epicDirOf`(`scripts/src/lib/paths.ts:52`), `CONTEXT_ROOT`(`scripts/src/lib/layout.ts:5`)다.
- 호출자 두 곳 모두 `repoRoot`로 integration checkout을 넘긴다: `prepareCoordinator`(`scripts/src/lib/coordinator.ts:1385-1394`)와 `integrateCommitWave`의 fan-in candidate(:1934-1946). 둘 다 `.ok`만 보고 `.seeded`는 읽지 않는다. 저장소 어디에도 `.seeded` 소비자가 없다.
- worker는 integration HEAD에서 만든 worktree라 새 epic이 untracked면 epic index가 없고(S8 "epic index.md absent", `scripts/src/lib/validate.ts:265-266`), context index는 커밋된 옛 내용이라 S13("epic directory not listed in context index", `scripts/src/lib/epic-index.ts:266-273`)이 난다. 둘 다 구조 실패라 execute 게이트가 `ok: false`가 된다(`validate.ts:339-356`).
- I/O: 파일 복사는 `fs.cpSync`·`fs.copyFileSync`, git은 주입 불가한 `realGit`(:296), `npm ci`는 `deps.execFileSync`로 주입된다(:54).
- 재현: `test/seed-worktree.test.js`의 `makeRepo`/`makeWorktree`(:39-58)로 만든 저장소에서 repo에만 `${EPIC_REL}/index.md`를 쓰고 `seedCoordinatorWorker`를 부르면 worker에 그 파일이 없다.

#### Target behavior

- 성공: blueprint 트리 복사 뒤 `${epicDirOf(bp)}/index.md`와 `.bouncer/context/index.md`를 `repoRoot`에 있을 때 worker의 같은 경로로 복사한다. 이미 있으면 덮어쓴다(worker seed의 기존 `force` 의미). `seeded`는 `[blueprintDir, <복사한 index 경로들>]` 순서다.
- 건너뜀: `repoRoot`에 없는 index는 복사하지 않고 `seeded`에 넣지 않으며 성공한다.
- 실패: 복사 중 예외는 기존처럼 `{ ok: false, reason: 'copy-failed', message }`다.
- 보존: `missing-worktree`, `missing-blueprint`, `npm ci` 호출 조건과 인자, config seed, `seedIntegration`의 conflict 검사는 바뀌지 않는다.

#### Interface

- 제공: `seedCoordinatorWorker(...)` 성공 결과 `{ ok: true, config, seeded: string[] }`의 `seeded`가 복사한 index 경로(POSIX, 저장소 상대)를 포함한다.
- 거부: 새 reason은 없다. index 복사 실패는 `copy-failed`로만 보고한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/seed-worktree.ts` | `seedCoordinatorWorker` | Modify | worker에 blueprint 트리·config·의존성 seed | epic·context index 복사와 `seeded` 확장 | 누락 지점(:299-300) |
| `test/seed-worktree.test.js` | 신규 테스트 | Modify | seed 회귀 테스트 | index 복사·건너뜀 테스트 추가 | 성공 기준 2의 회귀 증거 |

#### Constraints

- `seedIntegration`과 같은 경로 계산(`epicDirOf`, `CONTEXT_ROOT`)을 쓴다. 경로 문자열을 새로 조립하지 않는다.
- worker seed는 base(integration checkout)를 읽기만 한다. base 파일을 지우거나 고치지 않는다.

### EPIC-088/BP-001/TASK-003 · `6329bad2`

#### Goal & intent

coordinator가 CLI 형식을 소스 대신 `--help`로 확인하게 한다(epic Success criteria 3). 수용 기준은 Checklist의 테스트와 `bouncer.verify` 통과다.

#### Current behavior

- `parseFlags`(`scripts/src/lib/cli-flags.ts:7-27`)는 `--help` 뒤가 없거나 `--`로 시작하면 `flags.help = true`로 둔다. `--help foo`면 `foo`를 값으로 먹는다. `-h`는 무시한다. 도움말은 최상위 `help`/`--help`/`-h`(`scripts/src/lib/cli.ts:85-88`)만 처리하고, 전역 USAGE는 각 명령의 `usage`를 이어 붙인다(:65-76). 서브커맨드 핸들러는 `f.help`를 보지 않는다.
- 지금 결과(모두 stderr, exit 2):
  - `coordinate --help`는 `command must be …`로 끝난다.
  - `coordinate <sub> --help`는 `--blueprint is required`로 끝난다.
  - `review record --help`는 `--blueprint is required`와 USAGE를 출력한다.
  - `dispatch print --help`는 `--role is required`와 USAGE를 출력한다.
- coordinate(`scripts/src/lib/cli-git-commands.ts`)
  - `cmdCoordinate`(:310). 서브커맨드 14개(:313-316), fence 대상(:319-322).
  - usage 오류는 usage 없이 한 줄만 출력한다:
    - 서브커맨드 오류(:324-328)
    - `--blueprint`(:330-332)
    - `--generation`(:349-351)
    - report 필수 4개(:359-374)
    - revoke 필수 2개(:376-385)
  - fence 누락은 stdout JSON `ledger-checkpoint-invalid`, exit 1(:336-344)이다.
  - 핸들러가 읽는 플래그는 :437-462에 있다.
  - 사용법은 registry `usage` 문자열 하나(:500-548)에 형태별 블록으로 들어 있다. report `--outcome <accepted|rework|scope_revision|task_change|blocked>`(:513), critical-recovery `--outcome <resolved|blocked>`(:539). 서브커맨드별 필수 인자 일부는 core가 JSON reason(exit 1)으로 검사한다(`scripts/src/lib/coordinator.ts`의 `task-required`, `reason-required`, `findings-required`, `summary-required`, `lease-required` 등).
- review record(`scripts/src/lib/cli-review-command.ts`)
  - `USAGE`(:14-19)가 있고 registry `usage`(:126-130)에 같은 블록이 중복돼 있다.
  - `fail()`(:54-60)은 이미 USAGE를 붙인다.
  - review-record 모듈은 인자 검사 뒤 lazy require한다(:114).
  - round JSON 검사:
    - 최상위 `{ round: object, findings: array }`(`scripts/src/lib/review-record.ts:133-177`)
    - round 번호는 기존 수 + 1(:236-244)
    - finding 규칙은 `collectFindingFailures`(`scripts/src/lib/validate-sections.ts:248`): severity `blocker|major|minor|nit`, status `resolved|accepted|deferred`, accepted·deferred면 `note` 필요. round에 `mode`가 있으면 category, brief_clause, file, symbol, fingerprint, actionability(`must_fix|advisory`), origin(`discovery|introduced_by_revision|missed_critical`), first_seen_round, last_seen_round가 필요하다(:268-290).
    - round 규칙은 `collectRoundFailures`(:346-422): mode `discovery|delta|critical_recovery`, `target.base`·`target.head`, perspective name `combined|spec_scope|correctness_tests|minimality_maintainability|security`, `previous_finding_ids`, `new`·`resolved`·`regressed`.
    - 완성 예시는 `references/spec-authoring/review-rounds.md`에 있다.
- dispatch print(`scripts/src/lib/cli-dispatch-command.ts`)
  - `USAGE`(:13-17)가 있고 registry에 같은 블록이 중복돼 있다(:125-127).
  - `fail()`(:54-60)은 USAGE를 붙인다.
  - print-dispatch 모듈은 lazy require한다(:111).
  - `--input`은 JSON이 아니다. UTF-8 텍스트로 읽어 identity 줄과 역할 본문 뒤에 그대로 붙인다(`scripts/src/lib/print-dispatch.ts` `assemblePrintPrompt` :89-101). 검사는 파일 존재뿐이다(:196-201, `dispatch-input-invalid`). 내용은 `rules/cursor-print-dispatch.md:17-28`의 controller payload다.
- I/O: 핸들러는 주입된 `io.out`/`io.err`로만 쓰고 exit 코드를 돌려준다(`runCli(argv, io)`, `cli.ts:78-98`). 테스트는 `npm run build`가 만드는 `scripts/lib/cli.js`(gitignore 대상)를 require한다.
- 출력을 고정하는 테스트
  - 전역 usage 정규식: `test/cli-help.test.js`(:56, :74, :207, :243, :252, :261)와 `test/cli-coordinate.test.js`(:462, :472, :524, :567).
  - stderr 정규식과 `out === ''`: `test/cli-help.test.js:214`, `test/cli-coordinate.test.js:455`·`:484`, `test/print-dispatch.test.js:290`.
  - fence JSON 바이트: `test/cli-coordinate.test.js:536`.
- 지침: `agents/bouncer-coordinator.md:252-253`이 "do not read plugin sources to recover"라고만 쓴다. `.codex/agents/bouncer-coordinator.toml`은 이 md에서 `mdToCodexToml`(`scripts/src/lib/codex-agents.ts:43`)로 생성하고, `test/distribution.test.js:227`이 바이트 일치를 검사한다.

#### Target behavior

- 도움말 판정: 서브커맨드 뒤 argv를 원시 토큰으로 훑는다(`parseFlags` 결과를 쓰지 않는다). `--help`는 어느 자리에 있어도 도움말이다. `-h`는 바로 앞 토큰이 `--`로 시작하는 플래그가 아닐 때만 도움말이다. 그래서 `--reason -h`, `--summary -h`의 `-h`는 값으로 남고 지금처럼 동작한다. 도움말은 다른 인자 검사, fence 검사, lazy require, core 호출보다 먼저 처리한다. 출력은 stdout, stderr는 비우고 exit 0이다.
- `coordinate --help`(서브커맨드 없음): 지금 registry의 coordinate usage 전체를 출력한다.
- `coordinate <sub> --help`: 14개 서브커맨드 각각의 블록을 출력한다.
  - 첫 줄은 `usage: bouncer coordinate <sub>`로 시작한다.
  - 블록에는 그 서브커맨드가 쓰는 모든 플래그를 넣는다(핸들러 :437-462 기준). 필수(CLI 검사와 core `*-required` reason 기준)와 선택(`[...]`)을 구분하고, 허용값(enum)을 적는다.
  - fence 대상이면 `--ledger-path <path> --ledger-hash <sha256>`(값은 `coordinate status`의 `checkpoint.ledger`)를 적는다.
- `review record --help`: 기존 USAGE 뒤에 다음 순서로 출력한다.
  - `--round` 파일 형식
  - 그대로 기록 가능한 discovery round 1 예시 JSON. 예시는 `` ```json `` 펜스 하나로 감싸 파싱할 수 있게 한다.
  - 위 enum 목록
  - fingerprint 공식 `lower(category):lower(brief_clause):posix(file)#symbol`
  - 전체 원장 예시 경로 `references/spec-authoring/review-rounds.md`
- `dispatch print --help`: 기존 USAGE 뒤에 다음을 출력한다.
  - `--input`은 JSON이 아닌 UTF-8 텍스트 파일이고 역할 본문 뒤에 그대로 붙는다는 설명
  - 역할 4개
  - `--out` 디렉터리에 남는 산출물
  - payload 규칙 문서 `rules/cursor-print-dispatch.md`
- 필수 플래그 누락 usage: 위 coordinate usage 오류(exit 2) 줄 뒤에 같은 stderr로 usage를 붙인다.
  - 서브커맨드를 아는 경우(`--blueprint`, `--generation`, report·revoke 필수)는 그 서브커맨드 블록을 붙인다.
  - 알 수 없는 서브커맨드는 coordinate usage 전체를 붙인다.
  - review record와 dispatch print는 이미 USAGE를 붙이므로 동작을 유지한다.
- 보존:
  - 전역 `bouncer --help` 출력 바이트는 바뀌지 않는다. coordinate registry `usage`는 블록들을 이어 붙여 지금과 같은 문자열을 만든다.
  - 기존 stderr 첫 줄 문구와 exit 코드, stdout을 비우는 동작, fence JSON(exit 1)과 core JSON reason(exit 1)은 그대로다.
- 지침: `agents/bouncer-coordinator.md` Procedure 3의 "do not read plugin sources to recover" 문장 뒤에 "Check a command's flags, allowed values, and input format with `bouncer <command> <sub> --help`; do not read plugin sources for them." 한 문장을 더한다. `.codex/agents/bouncer-coordinator.toml`을 재생성한다.

#### Interface

- 제공
  - CLI: `bouncer coordinate [<sub>] --help|-h`, `bouncer review record --help|-h`, `bouncer dispatch print --help|-h`. stdout, exit 0.
  - 필수 플래그 누락 시 stderr에 usage 블록이 추가된다.
  - 모듈: `cli-git-commands`의 coordinate usage는 서브커맨드 키 → 블록 문자열 맵 하나에서 만든다. 핸들러 출력과 registry `usage`가 같은 맵을 쓴다. review·dispatch의 중복 블록은 각 모듈의 `USAGE` 한 곳에서 가져온다.
- 거부(변경 없음)
  - `--help` 없는 기존 오류 입력은 지금과 같은 exit 코드로 거절한다.
  - `--help`가 다른 잘못된 플래그와 함께 오면 도움말이 우선이다(exit 0).
  - 최상위 명령(`bouncer foo --help`)의 알 수 없는 명령 처리는 바뀌지 않는다.
- 범위 밖: `coordinate`·`review`·`dispatch` 외 명령의 서브커맨드 도움말.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/cli-git-commands.ts` | `cmdCoordinate`, coordinate `usage` | Modify | coordinate 인자 해석·usage 한 덩어리 | 서브커맨드별 블록 맵, 도움말 분기, 누락 usage | 역산 18건 중 report 11건 |
| `scripts/src/lib/cli-review-command.ts` | `cmdReview`, `USAGE` | Modify | review record 인자 해석 | 도움말 분기, round 형식·예시 | 역산 3건 |
| `scripts/src/lib/cli-dispatch-command.ts` | `cmdDispatch`, `USAGE` | Modify | dispatch print 인자 해석 | 도움말 분기, `--input` 설명 | 역산 4건 |
| `test/cli-help.test.js` | 신규 테스트 | Modify | 전역 usage 고정 | 세 명령 도움말·누락 usage 테스트, 전역 바이트 불변 | 성공 기준 3 |
| `test/review-record.test.js` | 신규 테스트 | Modify | review record 동작 | 도움말 예시 JSON을 실제 기록해 성공 확인 | 예시가 검증기와 맞는지 |
| `agents/bouncer-coordinator.md` | Procedure 3 | Modify | drive 절차 | `--help` 한 문장 | 지침의 형식 출처 |
| `.codex/agents/bouncer-coordinator.toml` | 생성 TOML | Modify | md 미러 | 재생성 | `test/distribution.test.js:227` |

#### Constraints

- 도움말 텍스트는 영어로 쓴다(기존 usage와 같은 언어).
- review record 예시 JSON은 현재 검증기를 통과해야 한다. 테스트가 이를 보장한다.
- `agents/bouncer-coordinator.md`는 TASKS-005도 바꾼다. 이 task는 Procedure 3의 한 문장만 더한다.
- `.codex/agents/bouncer-coordinator.toml`은 손으로 고치지 않고 생성기로 만든다:
  ```bash
  node -e "const fs=require('fs');const {mdToCodexToml}=require('./scripts/lib/codex-agents.js');fs.writeFileSync('.codex/agents/bouncer-coordinator.toml',mdToCodexToml(fs.readFileSync('agents/bouncer-coordinator.md','utf8')))"
  ```

### EPIC-088/BP-001/TASK-004 · `61c58e62`

#### Goal & intent

Cursor 벤치마크 `bouncer` 이미지에서 로그인 셸과 비로그인 셸 모두 `bouncer`·`bouncer-root`를 PATH로 찾게 한다(epic Success criteria 5). 수용 기준은 Checklist의 정적 테스트, 수동 컨테이너 확인, `bouncer.verify` 통과다.

#### Current behavior

- `benchmarks/docker/Dockerfile.cursor`
  - `cursor-base`(L1-21)는 `USER node`(L9), `ENV HOME=/home/node PATH=/home/node/.local/bin:/usr/local/bin:/usr/bin:/bin`(L10)이다. `vanilla`(L23)는 `cursor-base` 그대로다.
  - `bouncer` 단계(L31-47)는 플러그인을 `/home/node/.cursor/plugins/local/bouncer`에 복사하고 `ENV PATH=/home/node/.cursor/plugins/local/bouncer/scripts:...`(L42)를 둔 뒤 `RUN bouncer-root --auto`(L43)를 `node`로 실행한다.
  - 이미지 어디에도 `/etc/profile.d`나 `~/.bashrc` 편집이 없다.
- 실행 경로: `benchmarks/docker/agent-entrypoint.sh`(`#!/bin/sh`)가 `cursor-agent`를 exec한다. print 단계는 `docker exec`(`benchmarks/run-print-stage.cjs:33`), ACP는 `docker compose run`(`benchmarks/run-acp-stage.cjs:41`)이다. 모두 이미지 ENV를 물려받는다. `cursor-agent`가 도구 셸을 어떻게 띄우는지는 저장소에 없다.
- Debian `/etc/profile`은 비 root 로그인 셸에서 PATH를 `/usr/local/bin:/usr/bin:/bin:/usr/local/games:/usr/games`로 다시 설정한 뒤 `/etc/profile.d/*.sh`를 읽는다. 그래서 로그인 셸에서는 `ENV PATH`가 사라진다.
- 증거: `workflow-token-analysis.md` 4장에서 ledger-004 4차 coordinator 셸 명령 53개 중 5개가 `bouncer`를 찾는 시도였다. 감사 항목 P6로 epic 080·081에 남아 있었다.
- 테스트: Dockerfile을 읽는 테스트는 없다. CI(`npm run ci`)는 docker를 빌드하지 않는다. `node --test` 기본 탐색이 `benchmarks/*.test.cjs`를 포함한다(예: `benchmarks/subagent-guard.test.cjs`).

#### Target behavior

- 성공: `bouncer` 단계에 다음 두 `RUN`을 넣는다. `$PATH`는 셸이 build 시점에 펼치지 않도록 작은따옴표 안에 그대로 쓴다.
  - `USER root` 뒤 `RUN printf '%s\n' 'export PATH="/home/node/.cursor/plugins/local/bouncer/scripts:/home/node/.local/bin:$PATH"' > /etc/profile.d/bouncer-path.sh`, 바로 `USER node`.
  - `USER node`로 `RUN printf '%s\n' '<같은 export 줄>' >> /home/node/.bashrc`. 기존 `.bashrc`(Debian skel)에 덧붙이고, `node`로 실행하므로 소유자는 `node`로 남는다.
  - 기존 `ENV PATH`(L42)와 `RUN bouncer-root --auto`(L43)는 그대로 둔다.
- 결과: 컨테이너 안에서 `bash -lc 'command -v bouncer'`, `bash -c 'command -v bouncer'`, `bash -ic 'command -v bouncer'`가 모두 `/home/node/.cursor/plugins/local/bouncer/scripts/bouncer`를 출력한다.
- 보존: `cursor-base`·`vanilla`·`plugin-build`·`verifier` 단계는 바뀌지 않는다. vanilla 이미지에는 bouncer 경로가 없다.

#### Interface

- 제공: 이미지 산출물 `/etc/profile.d/bouncer-path.sh`와 `/home/node/.bashrc`의 PATH 줄(`bouncer` 단계 한정).
- 거부: 해당 없음. 공개 API·CLI 변경은 없다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `benchmarks/docker/Dockerfile.cursor` | `bouncer` 단계 | Modify | 플러그인 복사·`ENV PATH` | profile.d·bashrc PATH 줄 추가 | 로그인 셸이 `ENV PATH`를 덮어씀 |
| `benchmarks/docker-path.test.cjs` | 신규 테스트 | Create | 없음 | Dockerfile 정적 단언 | CI가 docker를 빌드하지 않음 |

#### Constraints

- 두 줄 모두 `bouncer` 단계(`FROM cursor-base AS bouncer`부터 다음 `FROM` 전까지) 안에만 둔다.
- `USER root` 구간은 `/etc/profile.d/bouncer-path.sh`를 쓰는 `RUN` 하나로 끝내고 바로 `USER node`로 돌아간다. `.bashrc` 줄과 `RUN bouncer-root --auto`는 `node`로 실행한다.

### EPIC-088/BP-001/TASK-005 · `ac4bde75`

#### Goal & intent

`/bouncer-run`과 coordinator가 모든 task를 통합·검증한 뒤 멈추고, `/bouncer-finalize`는 사용자가 integration worktree에서 직접 실행하게 한다(epic Success criteria 4). blueprint 전체의 CHANGELOG 항목도 여기서 쓴다(Success criteria 6). 수용 기준은 Checklist의 문서 테스트와 `bouncer.verify` 통과다.

#### Current behavior

- `agents/bouncer-coordinator.md`
  - L31-32: 입력 payload 목록에 "the closing action"이 있다.
  - L302-313 `6. **Close**`: 최종 리뷰를 "before the closing action"에 돌린다. 이어서 `/bouncer-finalize`를 integration worktree에서 동의 없이 갈 수 있는 데까지 실행하고, 첫 동의 단계에서 멈춰 그 단계를 이름 붙여 반환한다.
  - L323-325 Output contract `Completed`: "how far the closing action ran, and the consent step it stopped at with what the user still owns there".
  - L86-88의 일반 규칙 "Never answer another workflow's consent step …"은 closing action과 무관하게 유지할 문장이다.
- `skills/bouncer-run/SKILL.md`
  - L76-79 Preflight: "Finalize's consent steps stay with the user on both paths: … a delegated drive stops at the first one instead of answering it."
  - L127-132 payload의 closing action 항목.
  - L154-162 Report: `completed`에 "how far the closing action ran, and the consent step it stopped at — name that step and tell the user to run `/bouncer-finalize` to finish it". L162: "This skill does not enter finalize."
  - L46-48의 권한 경계("user-only finalize consent")는 유지한다.
- `rules/output.md`: L35 완료 줄 `… · 다음: <멈춘 동의 단계>`, L48 예시 `… · 다음: explain 퀴즈`.
- `docs/workflow.md`: L79 mermaid `R5 -- "모든 task integrated" --> F1`이 run에서 finalize로 바로 이어지는 화살표다.
- `skills/bouncer-finalize/SKILL.md:16-23`은 coordinator 드라이브에서는 integration worktree에서 실행한다고 정한다. step 1이 `bouncer finalize prepare`를 직접 실행하므로 coordinator가 미리 실행했다고 가정하지 않는다.
- 생성 미러: `.codex/agents/bouncer-coordinator.toml`은 같은 문장을 L32·304·308·325에 갖고, `test/distribution.test.js:227`이 `mdToCodexToml(md)`와 바이트 일치를 검사한다.
- 문구를 고정한 테스트
  - `test/agents.test.js:476` 'bouncer-coordinator stops the closing action at the first consent step'
  - `test/agents.test.js:527` 'bouncer-coordinator names its closing action'
  - `test/skill-bouncer-run.test.js:104` 'run keeps finalize consent with the user on both paths'
  - `test/skill-bouncer-run.test.js:114` 'run payload names the closing action and autonomy effect'
  - `test/subagents.test.js:512`의 `copies` 목록 `'closing action'`
- 근거: `workflow-token-analysis.md` 4장에서 ledger-004 4차 coordinator 셸 명령 중 5개가 run 단계에서 finalize prepare·explain 초안을 진행했다. 벤치마크는 finalize를 별도 단계로 다시 실행한다.

#### Target behavior

- coordinator
  - payload 목록에서 closing action을 뺀다.
  - Close는 다음 순서로 끝난다.
    1. 최종 리뷰를 돌린다(blueprint review 모드).
    2. 모든 task가 integrated·verified면 `completed`를 반환한다.
    3. `/bouncer-finalize`를 실행하거나 그 일부(`finalize prepare`, explain 초안)를 진행하지 않는다.
  - Output contract `Completed`는 integration head, 검증 결과, task별 최종 상태, integration worktree 경로를 담는다.
- `/bouncer-run`
  - payload에서 closing action 항목을 뺀다.
  - Preflight는 "nothing to delegate면 사용자가 `/bouncer-finalize`를 직접 실행" 문장을 유지한다. finalize 동의는 사용자 것이고 이 세션과 coordinator 모두 finalize를 실행하지 않는다고 쓴다.
  - Report `completed`는 integration head, 검증 결과를 보고한다. 이어서 사용자에게 integration worktree(`integrationPath`)에서 `/bouncer-finalize`를 실행하라고 안내한다.
- `rules/output.md`
  - 완료 줄을 `완료: <blueprint> · integration <head> · 검증: <결과> · 결정 N건 · 다음: /bouncer-finalize (<integrationPath>)`로 바꾼다.
  - 예시도 같은 형식으로 바꾼다.
- `docs/workflow.md`: 화살표 라벨을 사용자가 `/bouncer-finalize`를 실행한다는 뜻으로 바꾼다(예: `"모든 task integrated → 사용자가 /bouncer-finalize"`).
- 보존
  - 일반 동의 규칙(`agents/bouncer-coordinator.md` L86-88, run L46-48)과 continue·blocked·partial_closed 동작은 그대로다.
  - finalize skill은 바뀌지 않는다.
- CHANGELOG `[Unreleased]`에 이 blueprint의 다섯 변경을 적는다. 각 항목은 한두 문장이다.
  - brief 해시의 lifecycle 키 제외(Fixed)
  - worker seed index 추가(Fixed)
  - 서브커맨드 `--help`(Added)
  - 벤치마크 PATH(Fixed)
  - run 단계 경계(Changed)

#### Interface

- 제공: 에이전트·스킬 계약 변경. coordinator의 `completed` 보고 필드가 "closing action 진행 정도·멈춘 동의 단계"에서 "integration worktree 경로"로 바뀐다. run 완료 줄의 `다음:` 값이 `/bouncer-finalize (<integrationPath>)`가 된다.
- 거부: coordinator와 run은 `/bouncer-finalize`, `bouncer finalize prepare`, explain 작성을 실행하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `agents/bouncer-coordinator.md` | 입력 목록, `6. **Close**`, Output contract | Modify | finalize를 첫 동의 단계까지 진행 | closing action 삭제, Completed 필드 교체 | 단계 경계 이탈 |
| `.codex/agents/bouncer-coordinator.toml` | 생성 TOML | Modify | md 미러 | 재생성 | `test/distribution.test.js:227` |
| `skills/bouncer-run/SKILL.md` | Preflight, step 4 payload, step 5 Report | Modify | closing action 전달·보고 | 항목 삭제, finalize 안내 | 같은 계약의 run 쪽 |
| `rules/output.md` | 완료 줄, 예시 | Modify | 멈춘 동의 단계 표시 | `/bouncer-finalize (<integrationPath>)` | 보고 형식 |
| `docs/workflow.md` | mermaid 화살표 | Modify | run → finalize 직접 연결 | 사용자 실행 라벨 | 문서 정합성 |
| `test/agents.test.js` | :476, :527 테스트 | Modify | closing action 문구 고정 | 새 계약 단언으로 교체 | 문구 변경의 직접 영향 |
| `test/skill-bouncer-run.test.js` | :104, :114 테스트 | Modify | closing action 문구 고정 | 새 계약 단언으로 교체 | 문구 변경의 직접 영향 |
| `test/subagents.test.js` | :512 `copies` | Modify | rule 5 미복제 목록 | `'closing action'` 제거 | 없어진 필드 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 릴리스 노트 | blueprint 다섯 항목 | 프로젝트 규칙 |

#### Constraints

- `agents/bouncer-coordinator.md`의 TASKS-003 문장(Procedure 3의 `--help` 안내)을 유지한다.
- TOML은 TASKS-003의 Constraints에 있는 생성 명령으로만 만든다.
- 새 테스트 단언은 부정형(closing action·finalize 진행 지시가 없음)과 긍정형(integration worktree에서 `/bouncer-finalize` 안내가 있음)을 둘 다 둔다.
