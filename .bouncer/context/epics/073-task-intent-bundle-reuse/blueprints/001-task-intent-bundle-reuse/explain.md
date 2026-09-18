---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/073-task-intent-bundle-reuse/blueprints/001-task-intent-bundle-reuse/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-18T10:35:43.530+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '073'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: develop
      range_to: a84ca1d7eedadbfde46113f29c164ae8d08c18d8
      diff_sha: 1fee78252d94432c5ecec6b8816d70daf1ac85697a45e2864aea809c3cbd5b86
      quiz_score: 4/4
      disposition: 네 문항 모두 정답. intent bundle hit 조건·lazy CLI·scope 후 재검증·r3 TOML 사유를 정확히 짚음.
      recorded_at: '2026-09-18T10:37:22+09:00'
  task_commits:
    - task: EPIC-073/BP-001/TASK-001
      sha: b4e97ea8
      intent_anchor: task-001
    - task: EPIC-073/BP-001/TASK-002
      sha: 6a797318
      intent_anchor: task-002
    - task: EPIC-073/BP-001/TASK-003
      sha: 317dfda6
      intent_anchor: task-003
  coordinator:
    base: aa50cd72aac9d73117fd7d01325ef4f9aaf34412
    integration_head: a84ca1d7eedadbfde46113f29c164ae8d08c18d8
    integration_branch: feat/073-001-task-intent-bundle-reuse
    revision: r3
    worktrees:
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/073/001/integration
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/073/001/workers/001
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/073/001/workers/002
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/073/001/workers/003
    tasks:
      - id: '001'
        status: integrated
        sha: b4e97ea81c0be03885461f02b54c21a7cbb94c66
        branch: bouncer/073-001-001
        scope_revision: r3
        paths:
          - scripts/src/lib/intent-bundle.ts
          - scripts/lib/intent-bundle.js
          - scripts/src/lib/intent-provenance.ts
          - scripts/lib/intent-provenance.js
          - scripts/src/lib/runtime-state.ts
          - scripts/lib/runtime-state.js
          - test/intent-bundle.test.js
          - test/runtime-state.test.js
          - .codex/agents/bouncer-implementer.toml
          - .codex/agents/bouncer-coordinator.toml
        actual_paths:
          - .codex/agents/bouncer-coordinator.toml
          - .codex/agents/bouncer-implementer.toml
          - scripts/lib/intent-bundle.js
          - scripts/lib/intent-provenance.js
          - scripts/lib/runtime-state.js
          - scripts/src/lib/intent-provenance.ts
          - scripts/src/lib/runtime-state.ts
          - test/runtime-state.test.js
          - scripts/src/lib/intent-bundle.ts
          - test/intent-bundle.test.js
      - id: '002'
        status: integrated
        sha: 6a797318177c0eabd2c00600bba34c70ee0d13da
        branch: bouncer/073-001-002
        scope_revision: null
        paths: []
        actual_paths:
          - scripts/lib/cli-intent-command.js
          - scripts/lib/cli-project-commands.js
          - scripts/src/lib/cli-intent-command.ts
          - scripts/src/lib/cli-project-commands.ts
          - test/cli-project-commands.test.js
          - test/typescript-module-contract.test.js
      - id: '003'
        status: integrated
        sha: 317dfda6adeafc59d915d93fba651c8ed679bf4f
        branch: bouncer/073-001-003
        scope_revision: null
        paths: []
        actual_paths:
          - .codex/agents/bouncer-debugger.toml
          - .codex/agents/bouncer-implementer.toml
          - .codex/agents/bouncer-reviewer.toml
          - agents/bouncer-debugger.md
          - agents/bouncer-implementer.md
          - agents/bouncer-reviewer.md
          - references/debugging/index.md
          - references/implementation/index.md
          - references/review/assets/reviewer-prompt.md
          - references/review/index.md
          - skills/bouncer-execute/SKILL.md
          - skills/bouncer-execute/references/agent-dispatch.md
          - skills/bouncer-execute/references/review-round.md
          - skills/bouncer-execute/references/verification-recovery.md
          - test/agents.test.js
          - test/skill-bouncer-execute.test.js
          - test/skill-debugging.test.js
    decisions:
      - task: '001'
        kind: scope
        reason: Pre-existing md/TOML drift on base aa50cd7 blocks npm run ci (agents.test.js); regenerate checked-in implementer TOML so verify can pass without weakening the sync test.
        previous:
          - scripts/src/lib/intent-bundle.ts
          - scripts/lib/intent-bundle.js
          - scripts/src/lib/intent-provenance.ts
          - scripts/lib/intent-provenance.js
          - scripts/src/lib/runtime-state.ts
          - scripts/lib/runtime-state.js
          - test/intent-bundle.test.js
          - test/runtime-state.test.js
        next:
          - .codex/agents/bouncer-implementer.toml
        revision: r1
      - task: '001'
        kind: scope
        reason: Restore full TASKS-001 Touch plus regenerated Codex implementer TOML; r1 incorrectly replaced scope with only the TOML path.
        previous:
          - .codex/agents/bouncer-implementer.toml
        next:
          - scripts/src/lib/intent-bundle.ts
          - scripts/lib/intent-bundle.js
          - scripts/src/lib/intent-provenance.ts
          - scripts/lib/intent-provenance.js
          - scripts/src/lib/runtime-state.ts
          - scripts/lib/runtime-state.js
          - test/intent-bundle.test.js
          - test/runtime-state.test.js
          - .codex/agents/bouncer-implementer.toml
        revision: r2
      - task: '001'
        kind: scope
        reason: Same base-SHA Codex TOML drift blocks agents.test.js for coordinator; regenerate alongside implementer TOML so npm run ci can pass.
        previous:
          - scripts/src/lib/intent-bundle.ts
          - scripts/lib/intent-bundle.js
          - scripts/src/lib/intent-provenance.ts
          - scripts/lib/intent-provenance.js
          - scripts/src/lib/runtime-state.ts
          - scripts/lib/runtime-state.js
          - test/intent-bundle.test.js
          - test/runtime-state.test.js
          - .codex/agents/bouncer-implementer.toml
        next:
          - scripts/src/lib/intent-bundle.ts
          - scripts/lib/intent-bundle.js
          - scripts/src/lib/intent-provenance.ts
          - scripts/lib/intent-provenance.js
          - scripts/src/lib/runtime-state.ts
          - scripts/lib/runtime-state.js
          - test/intent-bundle.test.js
          - test/runtime-state.test.js
          - .codex/agents/bouncer-implementer.toml
          - .codex/agents/bouncer-coordinator.toml
        revision: r3
      - task: '001'
        decision: 'Accepted TASKS-001 after implement/verify/review/commit. Changed paths: scripts/src/lib/intent-bundle.ts scripts/lib/intent-bundle.js scripts/src/lib/intent-provenance.ts scripts/lib/intent-provenance.js scripts/src/lib/runtime-state.ts scripts/lib/runtime-state.js test/intent-bundle.test.js test/runtime-state.test.js .codex/agents/bouncer-implementer.toml .codex/agents/bouncer-coordinator.toml. Worker branch bouncer/073-001-001 SHA b4e97ea81c0be03885461f02b54c21a7cbb94c66.'
      - task: '002'
        decision: 'Accepted TASKS-002 lazy intent bundle CLI. Paths: scripts/src/lib/cli-intent-command.ts scripts/lib/cli-intent-command.js scripts/src/lib/cli-project-commands.ts scripts/lib/cli-project-commands.js test/cli-project-commands.test.js test/typescript-module-contract.test.js. Worker bouncer/073-001-002 @ 6a797318177c0eabd2c00600bba34c70ee0d13da.'
      - task: '003'
        decision: Accepted TASKS-003 execute role intent-bundle payloads. Paths per commit actualPaths. Worker bouncer/073-001-003 @ 317dfda6adeafc59d915d93fba651c8ed679bf4f.
---
# Explain

## Background

실행 중 implementer·debugger·reviewer가 같은 함수 의도를 매번 Git provenance와 Explain 본문으로 다시 해석하면 비용이 커지고 역할마다 다른 절을 집을 위험이 있다. 이 블루프린트는 실행 Task와 함수 집합을 내용 주소화한 intent bundle로 두고, blob·Explain 절 hash가 같을 때만 revision을 재사용하며, CLI와 execute dispatch가 그 ID를 공유하게 했다.

드라이브는 승인 DAG `001 → 002 → 003`을 유지한 채 직렬로 통합했다. TASKS-001만 scope revision r1→r3으로 Codex TOML 동기화를 `affected_paths`에 넣었고(agents.test.js 드리프트), 실제 커밋 경로는 그 범위와 일치한다.

## Intuition

영수증 해시가 같으면 창고에서 같은 박스를 꺼내고, 내용이 바뀌면 새 박스에 revision을 찍는다. 역할마다 박스를 다시 포장하지 않는다.

## Code

- `scripts/src/lib/intent-bundle.ts` — `resolveTaskIntentBundle`, cache hit/miss, canonical Explain allowlist, Git common dir 경계
- `scripts/src/lib/runtime-state.ts` — `intentBundlePathFor`
- `scripts/src/lib/intent-provenance.ts` — `projectExplainSectionHashes`
- `scripts/src/lib/cli-intent-command.ts` — lazy `bouncer intent bundle`
- `skills/bouncer-execute/**`, `agents/bouncer-{implementer,debugger,reviewer}.md` — 역할 payload에 `task_brief_hash` / `intent_bundle_id` / `intent_bundle_revision`

통합 HEAD: `a84ca1d7eedadbfde46113f29c164ae8d08c18d8` (`feat/073-001-task-intent-bundle-reuse`). Worker SHA: 001 `b4e97ea8`, 002 `6a797318`, 003 `317dfda6`.

## Quiz

1. cache hit가 되려면 무엇이 같아야 하는가?
   - A) function blob SHA와 선택 Explain 절 hash, 그리고 요청 함수 집합
   - B) task brief의 수정 시각만
   - C) worker branch 이름만

2. `bouncer intent bundle`이 argv 검증 전에 하면 안 되는 일은?
   - A) help 문자열을 출력하는 것
   - B) `intent-bundle` / `intent-provenance` / `symbol-index`를 require하는 것
   - C) exit code 2를 반환하는 것

3. execute가 scope revision 뒤에 해야 할 일은?
   - A) 이전 bundle ID를 fallback에 숨긴 채 계속 dispatch
   - B) 현재 brief hash와 함수 집합으로 bundle을 재검증하고, 실패면 dispatch를 시작하지 않음
   - C) Explain 전체 본문을 모든 역할에 다시 붙임

4. TASKS-001 r3에서 Codex TOML을 넣은 이유는?
   - A) UI 테마를 바꾸기 위해
   - B) base SHA의 md/TOML 드리프트로 `agents.test.js` sync가 막혀 verify가 실패했기 때문
   - C) npm dependency를 추가하기 위해

## 이해 상태

- 점수: 4/4
- Q1 정답 A / 응답 A — 맞음 (blob SHA + Explain 절 hash + 함수 집합)
- Q2 정답 B / 응답 B — 맞음 (argv 검증 전 heavy require 금지)
- Q3 정답 B / 응답 B — 맞음 (scope revision 뒤 bundle 재검증, 실패 시 dispatch 중단)
- Q4 정답 B / 응답 B — 맞음 (base md/TOML 드리프트로 agents.test.js sync 차단)
- disposition: 네 문항 모두 정답. intent bundle hit 조건·lazy CLI·scope 후 재검증·r3 TOML 사유를 정확히 짚음.

## Tasks

### Task 001

#### Goal & intent

실행 Task와 함수 provenance를 결정적 bundle로 저장하고, 현재 함수 blob과 선택된 Explain section hash가 그대로인 경우 Git provenance resolver를 건너뛴다. 관련 입력이 달라진 경우에만 같은 실행 Task의 revision을 증가시켜 stale 의도를 재사용하지 않았음을 검증할 수 있어야 한다.

#### Current behavior

`resolveIntentProvenance`는 호출마다 symbol index, `git blame`, `git log --follow`, trailer와 Explain 역색인을 다시 읽고 최대 2,000 UTF-8 byte의 선택 본문을 반환한다. `selectSections`는 장기 절 allowlist를 적용하지만 절별 hash나 재사용 가능한 runtime record를 만들지 않는다. `runtimePaths`는 Git common directory의 Bouncer 저장 위치를 계산하지만 intent용 경로는 제공하지 않는다. 다음 명령으로 현재 resolver 회귀를 재현할 수 있다.

```bash
node --test test/intent-provenance.test.js test/runtime-state.test.js
```

#### Target behavior

- 성공: 같은 실행 Task와 정규화된 함수 집합에서 function ref·blob SHA와 non-historical Explain section hash가 모두 같으면 저장된 bundle ID와 revision을 반환하며 Git provenance 명령을 실행하지 않는다.
- 변경: 함수 집합, function ref, blob SHA 또는 선택 절 hash가 달라지면 resolver 결과로 새 내용 hash와 다음 양의 revision을 원자적으로 기록한다. 이 값들이 같으면 저장된 provenance Task·commit·freshness를 그대로 재사용한다.
- 실패: cache가 손상됐거나 stable ID, hash, Explain realpath, repo 경계를 검증할 수 없으면 hit로 인정하지 않는다. resolver가 예외를 내면 이전 record를 덮어쓰거나 부분 record를 남기지 않는다.
- 보존: `resolveIntentProvenance`의 공개 결과, candidate 정렬·limit·본문 예산, freshness 의미와 `historical` 본문 제외는 바뀌지 않는다.

#### Interface

- 제공: 내부 `resolveTaskIntentBundle({ repoRoot, taskFile, functions })`는 `created | reused`, SHA-256 `bundle_id`, 양의 `revision`, 실행 Task stable ID, `task_brief_hash`, 정렬된 function entries를 반환한다. `intentBundlePathFor`는 Git common directory 아래 task 경로 digest 기반 record 위치를 반환한다.
- 거부: 저장소 밖·symlink 탈출 task/Explain, canonical task layout이 아닌 task 파일, 중복 또는 빈 함수 요청, malformed candidate ref, 잘못된 stable ID·revision·hash와 부분 resolver 성공을 거부한다. 읽을 수 없거나 검증에 실패한 cache는 hit로 인정하지 않고 현재 입력으로 재생성한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/intent-bundle.ts` | `신규 추출 지점: bundle resolve와 cache validation` | Create | 없음 | bundle 정규화, content hash, cache hit 검증, miss resolver와 원자적 write를 소유 | 재사용 규칙을 CLI와 workflow 문구에서 분리한 단일 정본이 필요함 |
| `scripts/lib/intent-bundle.js` | 생성 CommonJS | Create | 없음 | TypeScript 정본과 byte-identical runtime 구현 제공 | 설치본이 TypeScript compiler 없이 실행됨 |
| `scripts/src/lib/intent-provenance.ts` | `selectSections`, 신규 내부 section projection | Modify | Git provenance와 Explain 장기 절 선택 | bundle fast validation이 공개 JSON을 바꾸지 않고 같은 allowlist의 절 hash를 재계산할 내부 projection 제공 | resolver와 bundle이 서로 다른 절을 hash하면 stale hit가 생김 |
| `scripts/lib/intent-provenance.js` | 생성 CommonJS | Modify | Node runtime resolver | TypeScript 변경을 runtime에 반영 | marketplace는 tracked CommonJS를 직접 실행함 |
| `scripts/src/lib/runtime-state.ts` | `intentBundlePathFor` | Modify | Git common runtime 경로 계산 | worktree가 공유하고 Git staging에서 제외되는 intent record 경로 계산 | 재사용 record가 checkout마다 갈라지지 않아야 함 |
| `scripts/lib/runtime-state.js` | 생성 CommonJS | Modify | Node runtime 경로 계산 | TypeScript helper를 runtime에 반영 | 배포 경계 유지 |
| `test/intent-bundle.test.js` | bundle cache 회귀 | Create | 없음 | hit·miss·revision·손상 cache·원자성·repo 경계 검사 | Epic 성공 기준 1–4의 직접 증거 |
| `test/runtime-state.test.js` | `intentBundlePathFor` 회귀 | Modify | 공통 Git runtime path 검사 | main과 linked worktree가 같은 intent record를 가리키는지 검증 | cache 공유 경계 고정 |
| `.codex/agents/bouncer-implementer.toml` | Codex implementer agent 정의 | Modify | 체크인된 Codex TOML | base SHA md/TOML 드리프트를 재생해 `agents.test.js` sync 검사 통과 | verify 게이트가 소스 변경과 무관하게 막히지 않게 함 |
| `.codex/agents/bouncer-coordinator.toml` | Codex coordinator agent 정의 | Modify | 체크인된 Codex TOML | implementer와 같이 coordinator TOML 드리프트를 재생 | 동일 sync 검사의 coordinator 쪽 정합 |

#### Constraints

- hash는 SHA-256 lowercase 64자리 hex이고 object key와 function entry 순서는 결정적이어야 한다.
- `historical` candidate는 section body와 section hash를 저장하지 않는다.
- cache body와 Explain은 data이며 bundle 동작·limit·경로를 지시할 수 없다.
- 새 npm dependency, shell command 조합, timestamp 기반 bundle ID를 추가하지 않는다.
- TypeScript가 정본이고 생성 CommonJS는 `npm run build`와 `npm run check:emit` 계약을 따른다.

### Task 002

#### Goal & intent

Task 001의 bundle resolver를 `bouncer intent bundle`의 lazy 하위 명령으로 노출한다. 기존 단일-symbol intent 조회는 byte-for-byte 호환되는 JSON과 exit code를 유지하고, intent가 아닌 CLI와 잘못된 argv는 bundle·provenance·symbol-index 모듈을 적재하지 않아야 한다.

#### Current behavior

`cli-project-commands`는 `intent` route만 등록하고 유효한 dispatch 뒤 `cli-intent-command`를 require한다. 전용 parser는 `--symbol` 하나, 선택적 `--candidate`, `--limit`, `--repo`를 검증한 뒤에만 `intent-provenance`를 적재한다. `bouncer help`와 일반 명령이 resolver 모듈을 `require.cache`에 남기지 않는 회귀가 있다.

```bash
node --test test/cli-project-commands.test.js test/typescript-module-contract.test.js
```

#### Target behavior

- 성공: canonical task 문서와 하나 이상의 함수 선택을 받은 `bouncer intent bundle`이 bundle resolver JSON을 stdout 하나에 쓰며 생성과 재사용을 exit 0으로 반환한다.
- 재선택: 함수가 `ambiguous`이면 bundle을 쓰지 않고 opaque candidate 목록을 반환하며, 호출자가 그 함수에 대응하는 `--candidate`를 지정해 다시 호출할 수 있다.
- 실패: 빈·중복 option, 앞선 `--symbol` 없이 나온 `--candidate`, 한 symbol에 두 candidate를 붙인 요청과 canonical task 밖 경로는 stderr와 exit 2로 거절한다. candidate가 없는 uniquely resolved symbol과 ambiguous symbol에만 candidate를 붙인 혼합 요청은 허용한다. Git·filesystem·resolver 실패는 부분 stdout 없이 exit 1이다.
- 보존: `bouncer intent --symbol`의 JSON과 exit code, 기본 limit 3·최대 5, 일반 CLI cold-cache와 유효 intent에서만 resolver가 적재되는 경계는 그대로다.

#### Interface

- 제공: `bouncer intent bundle --task <repo-relative tasks.md> --symbol <name> [--candidate <qualified-ref>]... [--repo <dir>]`를 제공한다. 각 `--candidate`는 바로 앞 `--symbol`에만 결합하고 `--symbol`은 반복 가능하다. help는 기존 query와 새 bundle 형식을 모두 표시한다.
- 거부: `bundle`이 아닌 위치의 positional argument, 함수 없는 bundle, candidate만 있는 요청, 같은 함수의 중복 요청, 빈 task/symbol/candidate, `--limit`을 포함한 bundle 요청과 알 수 없는 option을 사용법 오류로 거절한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/cli-intent-command.ts` | `parseIntentArgs`, `cmdIntent` | Modify | 단일 함수 intent argv와 lazy resolver dispatch | query와 bundle 문법을 분기하고 유효한 bundle에서만 core를 적재 | 기존 lazy 경계를 지키는 명령 소유자임 |
| `scripts/lib/cli-intent-command.js` | 생성 CommonJS | Modify | Node runtime intent command | TypeScript parser와 dispatch를 runtime에 반영 | 설치본 실행 경계 유지 |
| `scripts/src/lib/cli-project-commands.ts` | `intent.usage` | Modify | 최상위 intent route와 help 문자열 | bundle 하위 명령을 공개하되 lazy wrapper는 유지 | 공개 help의 정본임 |
| `scripts/lib/cli-project-commands.js` | 생성 CommonJS | Modify | Node runtime route registry | TypeScript help 변경을 runtime에 반영 | 배포 경계 유지 |
| `test/cli-project-commands.test.js` | intent CLI와 module cache 회귀 | Modify | query JSON·exit code·lazy loading 검증 | bundle created/reused/ambiguous/argv 오류와 cold/warm cache 단언 추가 | 공개 CLI 성공 기준의 직접 증거 |
| `test/typescript-module-contract.test.js` | intent module export 회귀 | Modify | TypeScript와 CommonJS module signature 검증 | 신규 bundle module과 command import 경계가 compile되는지 단언 | 정본/산출물 경계 회귀 방지 |

#### Constraints

- stdout은 성공 JSON 하나만, 진단은 stderr만 사용한다.
- argv 검증이 끝나기 전에 `intent-bundle`, `intent-provenance`, `symbol-index`를 require하지 않는다.
- 기존 query parser의 duplicate·empty·unknown option과 exit 0/1/2 의미를 바꾸지 않는다.
- shell parsing, 새 dependency와 호환 별칭 route를 추가하지 않는다.

### Task 003

#### Goal & intent

`/bouncer-execute`가 현재 task brief와 관련 함수로 intent bundle을 한 번 만든 뒤 implementer, debugger와 reviewer가 같은 bundle ID를 공유하게 한다. 각 역할은 task brief hash, 필요한 브리프 절과 자기 단계의 diff 또는 실패 evidence만 받아야 하며 scope revision 뒤에는 관련 입력을 다시 검증한다.

#### Current behavior

execute step 3은 implementer에게 현재 task brief의 최대 여덟 절을 전달한다. verify 실패 recovery는 debugger에게 실패 evidence와 여섯 절을, review는 frozen target과 여섯 절을 전달한다. 세 역할의 payload에는 task brief hash나 공유 intent bundle ID가 없고, scope revision 뒤 현재 brief만 다시 읽는다. 구조 회귀는 named/fallback 권한과 role payload 문구를 검사한다.

```bash
node --test test/skill-bouncer-execute.test.js test/skill-debugging.test.js test/agents.test.js test/subagents.test.js
```

#### Target behavior

- 성공: preflight에서 고정한 task brief bytes의 SHA-256과 관련 함수 선택으로 bundle을 한 번 resolve하고, 모든 역할 dispatch가 같은 brief hash와 bundle ID를 가진다.
- 역할 분리: implementer는 현재 authority 절과 bundle ID를, debugger는 여섯 절·실패 evidence를, reviewer는 여섯 절·frozen diff·latest verify를 받는다. 필요한 intent 절은 bundle의 section projection으로만 전달하며 Explain 전체 body나 다른 역할의 report는 전달하지 않는다.
- scope revision: `coordinate revise` 뒤 현재 brief hash와 관련 함수 집합으로 bundle 명령을 다시 호출한다. function blob과 section hash가 같으면 기존 revision을 유지하고 하나라도 달라지면 새 revision을 이후 역할에 고정한다.
- 실패: bundle 생성이나 재검증이 실패하면 역할 dispatch를 시작하지 않고 controller에 원인과 복구 행동을 반환한다. stale bundle ID를 fallback payload로 숨기지 않는다.
- 보존: task brief가 sole execution authority이고 bundle은 advisory intent data다. affected_paths, Do not touch, named-agent model, retry·review ceiling, gate와 status 소유권은 바뀌지 않는다.

#### Interface

- 제공: execute dispatch 공통 필드 `task_brief_hash`, `intent_bundle_id`, `intent_bundle_revision`과 역할별 `intent_sections` projection을 정의한다. named agent와 generic/inline fallback은 동일한 식별자와 절 집합을 받는다.
- 거부: bundle 또는 Explain을 authority로 사용해 brief를 변경하거나 scope를 넓히는 것, 서로 다른 brief hash·bundle revision을 한 review round에 섞는 것, 전체 Explain body·다른 task bundle·다른 reviewer finding을 역할 payload에 넣는 것을 금지한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-execute/SKILL.md` | `Preflight`, `Implement`, verify failure, review 단계 | Modify | execute 순서와 역할 dispatch 시점 | bundle 생성·scope revision 재검증·역할 공통 식별자 고정 | 전체 execute 흐름의 정본임 |
| `skills/bouncer-execute/references/agent-dispatch.md` | named/fallback implementer와 reviewer payload | Modify | 역할별 compact/fallback 입력 | brief hash, bundle ID/revision과 필요한 intent 절만 전달 | 실제 dispatch payload 소유자임 |
| `skills/bouncer-execute/references/verification-recovery.md` | debugger와 재구현 payload | Modify | verify 실패 증적과 brief 전달 | 같은 bundle 식별자와 필요한 절을 재사용 | debugger recovery 입력의 정본임 |
| `skills/bouncer-execute/references/review-round.md` | frozen target과 round ledger 계약 | Modify | review base·HEAD·brief revision·verify 고정 | brief hash와 bundle ID/revision도 한 round의 target으로 고정 | discovery와 delta가 다른 intent revision을 섞지 않게 함 |
| `references/implementation/index.md` | caller 입력 계약 | Modify | task brief authority와 implementer 호출 경계 | bundle은 advisory data이며 brief authority를 바꾸지 않는다고 명시 | behavioral brief와 dispatch reference의 모순 방지 |
| `references/debugging/index.md` | debugger caller 입력 계약 | Modify | 실패 evidence·brief·cwd 전달 | brief hash와 bundle 식별자를 고정 입력에 추가 | agent authority와 debugging reference 정합성 유지 |
| `references/review/index.md` | `Load`, `Review` | Modify | frozen review target과 brief 계약 | bundle 식별자를 frozen target에 포함하고 전체 Explain 복제를 금지 | reviewer workflow 소비 경계임 |
| `references/review/assets/reviewer-prompt.md` | reviewer call slot | Modify | 관점별 reviewer 입력 template | brief hash, bundle ID/revision, 필요한 intent 절 field 추가 | named/fallback이 공유하는 실제 prompt template임 |
| `agents/bouncer-implementer.md` | `Authority` | Modify | implementer가 받는 authority와 data | brief authority와 별개인 advisory bundle ID/절 경계 명시 | role이 bundle을 scope 권한으로 오인하지 않게 함 |
| `agents/bouncer-debugger.md` | `Authority`, `Hard guards` | Modify | 실패 진단 입력과 read-only 경계 | brief hash·bundle 식별자 고정과 Explain 전체 재조회 금지 | recovery 역할 경계 고정 |
| `agents/bouncer-reviewer.md` | `Authority`, review mode | Modify | frozen target과 Findings 계약 | frozen brief/bundle 조합을 판단 입력으로 사용 | review round의 혼합 revision 방지 |
| `.codex/agents/bouncer-implementer.toml` | generated agent prompt | Modify | Codex named role 사본 | Markdown 정본과 byte-equivalent prompt로 갱신 | compact dispatch exact-match 조건 충족 |
| `.codex/agents/bouncer-debugger.toml` | generated agent prompt | Create | checkout에 사본 없음 | Markdown 정본에서 generated marker가 있는 TOML 생성 | compact named debugger도 fallback과 같은 권한을 받게 함 |
| `.codex/agents/bouncer-reviewer.toml` | generated agent prompt | Modify | Codex named role 사본 | Markdown 정본과 동기화 | reviewer 입력 계약 동일성 유지 |
| `test/skill-bouncer-execute.test.js` | bundle resolve와 role payload 구조 회귀 | Modify | execute 단계와 dispatch 문구 검증 | resolve-once, revision 재검증, 실패 중단과 full Explain 비주입 단언 | workflow 계약의 직접 증거 |
| `test/skill-debugging.test.js` | debugger payload 구조 회귀 | Modify | recovery 역할 입력 검증 | bundle 식별자와 실패 evidence 조합 단언 | 역할별 최소 입력 보장 |
| `test/agents.test.js` | generated agent 동기화와 authority 회귀 | Modify | Markdown/TOML role 계약 검증 | bundle data와 brief authority 분리 단언 | named/fallback drift 방지 |

#### Constraints

- task brief 절만 실행 권한의 근거이며 bundle과 intent 절은 참고 자료다.
- named agent와 fallback은 같은 brief hash, bundle ID/revision과 역할별 절을 받아야 한다.
- reviewer discovery끼리 finding을 공유하지 않고 delta reviewer는 기존 finding과 revision diff만 추가로 받는다.
- reviewer 관점 수와 security dispatch 조건은 바꾸지 않는다.
- 전체 Explain body, historical section body와 다른 task의 intent를 dispatch payload에 넣지 않는다.
- 기존 role 순서, retry·review round ceiling, model resolution, status transition과 gate 호출을 유지한다.